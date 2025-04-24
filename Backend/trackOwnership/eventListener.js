import { ethers, Interface } from 'ethers';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: "../.env"});

const nftOwnershipSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now },
});

const tradingEventSchema = new mongoose.Schema({
    eventType: { type: String, required: true },
    tokenId: { type: String },
    from: { type: String },
    to: { type: String },
    price: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const NFTOwnership = mongoose.model('NFTOwnership', nftOwnershipSchema);
const TradingEvent = mongoose.model('TradingEvent', tradingEventSchema);

let mongooseConnected = false;

export async function setupEventListener(nftContractAddress, nftContractABI, tradingContractAddress, tradingContractABI, wipeDB = false) {
    await connectMongoDB()
    
    // Wipe the NFTOwnership collection
    if (wipeDB) {
      await NFTOwnership.deleteMany({})
        .catch((err) => {
            console.error(`${time()} Error clearing database:`, err);
        });

      await TradingEvent.deleteMany({})
        .catch((err) => {
            console.error(`${time()} Error clearing database:`, err);
        });
        console.log(`${time()} Cleared database`);
    }
    
    // Set up Ethers.js provider to connect to local Hardhat network
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    
    const nftIface = new Interface(nftContractABI);
    const nftContract = new ethers.Contract(nftContractAddress, nftIface, provider);
    const tradingIface = new Interface(tradingContractABI);
    const tradingContract = new ethers.Contract(tradingContractAddress, tradingIface, provider);

    // Listen for Transfer events
    try {
        nftContract.on("Transfer", async (from, to, tokenId) => {
            try {
                // Check if tokenId exists in the DB
                const existingRecord = await NFTOwnership.findOne({ tokenId });
    
                if (existingRecord) {
                    // If the token is already in the DB, update the owner address
                    existingRecord.ownerAddress = to.toLowerCase();
                    existingRecord.lastUpdated = Date.now();
                    await existingRecord.save();
                } else {
                    // If the token is new, create a new record
                    const newOwnership = new NFTOwnership({ tokenId, ownerAddress: to.toLowerCase() });
                    await newOwnership.save();
                }
    
                if (from.toLowerCase() === ethers.ZeroAddress.toLocaleLowerCase()) {
                  await saveEvent('Mint', {
                    tokenId: tokenId.toString(),
                    from: from.toLowerCase(),
                    to: to.toLowerCase()
                  });
                } else {
                  await saveEvent('Transfer', {
                    tokenId: tokenId.toString(),
                    from: from.toLowerCase(),
                    to: to.toLowerCase()
                  });
                }
            } catch (error) {
                console.log(`${time()} Error processing Transfer event: ${error}`);
            }
        });
    
        const saveEvent = async (eventType, data) => {
            try {
                const event = new TradingEvent({ eventType, ...data });
                await event.save();
                console.log(`${time()} Saved ${eventType} event:`, data);
            } catch (error) {
                console.error(`${time()} Failed to save ${eventType} event:`, error);
            }
        };
    
        tradingContract.on('NFTListed', async (tokenId, seller, price, event) => {
            await saveEvent('List', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(price)
            });
      });
    
        tradingContract.on('NFTSold', async (tokenId, seller, buyer, price, event) => {
            await saveEvent('Sale', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                to: buyer.toLowerCase(),
                price: ethers.formatEther(price)
            });
        });
    
        tradingContract.on('AuctionStarted', async (tokenId, seller, startPrice, endTime, event) => {
            await saveEvent('AuctionStarted', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: startPrice.toString()
            });
        });
    
        tradingContract.on('NewBid', async (tokenId, bidder, amount, event) => {
            await saveEvent('NewBid', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: amount.toString()
            });
        });
    
        tradingContract.on('AuctionEnded', async (tokenId, winner, amount, event) => {
            await saveEvent('AuctionEnded', {
                tokenId: tokenId.toString(),
                to: winner.toLowerCase(),
                price: amount.toString()
            });
        });
    
        tradingContract.on('NFTDelisted', async (tokenId, seller, event) => {
            await saveEvent('Delist', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase()
            });
        });
    
        tradingContract.on('BidWithdrawn', async (tokenId, bidder, amount, event) => {
            await saveEvent('BidWithdrawn', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: amount.toString()
            });
        });

        tradingContract.on('OfferMade', async (tokenId, offerer, amount, expiration, event) => {
            await saveEvent('OfferMade', {
                tokenId: tokenId.toString(),
                from: offerer.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });

        tradingContract.on('OfferCancelled', async (tokenId, offerer, event) => {
            await saveEvent('OfferCancelled', {
                tokenId: tokenId.toString(),
                from: offerer.toLowerCase()
            });
        });

        tradingContract.on('OfferAccepted', async (tokenId, offerer, amount, event) => {
            await saveEvent('OfferAccepted', {
                tokenId: tokenId.toString(),
                to: offerer.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });
    } catch (e) {
        console.log(e);
        setupEventListener(nftContractAddress, nftContractABI, tradingContractAddress, tradingContractABI);
    }
    
}

async function connectMongoDB() {
    if (mongooseConnected) return;
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      mongooseConnected = true;
      console.log(`${time()} Connected to MongoDB`);
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
}

// Helper function to get current time
function time() {
    const today = new Date();
    const date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    const time = (today.getHours() + 2) + ":" + today.getMinutes() + ":" + today.getSeconds();

    return "[" + date + " " + time + "]";
}