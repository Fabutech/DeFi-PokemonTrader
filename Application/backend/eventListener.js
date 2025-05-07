import { ethers, Interface } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: "../.env"});

export async function setupEventListener(DB, nftContractAddress, nftContractABI, tradingContractAddress, tradingContractABI, wipeDB = false) {    
    if (wipeDB) {
      await DB.ownership.deleteMany({})
        .catch((err) => {
            console.error(`${time()} Error clearing database:`, err);
        });

      await DB.transactions.deleteMany({})
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

    try {
        // ********************** TRANSFER EVENTS OF NFT-CONTRACT **********************
        nftContract.on("Transfer", async (from, to, tokenId) => {
            try {
                // Check if tokenId exists in the DB
                const existingRecord = await DB.ownership.findOne({ tokenId });
    
                if (existingRecord) {
                    // If the token is already in the DB, update the owner address
                    existingRecord.ownerAddress = to.toLowerCase();
                    existingRecord.lastTransfer = Date.now();
                    existingRecord.lastUpdated = Date.now();
                    await existingRecord.save();
                } else {
                    // If the token is new, create a new record
                    const newOwnership = new DB.ownership({ tokenId, ownerAddress: to.toLowerCase() });
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
    
        // ********************** LISTING EVENTS **********************
        tradingContract.on('NFTListed', async (tokenId, seller, price, event) => {
            await saveEvent('List', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(price)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: true, lastUpdated: Date.now() });
        });
    
        tradingContract.on('NFTSold', async (tokenId, seller, buyer, price, event) => {
            await saveEvent('Sale', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                to: buyer.toLowerCase(),
                price: ethers.formatEther(price)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, currentValue: parseFloat(ethers.formatEther(price)), lastUpdated: Date.now() });
        });

        tradingContract.on('NFTDelisted', async (tokenId, seller, event) => {
            await saveEvent('Delist', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase()
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, lastUpdated: Date.now() });
        });
    

        // ********************** AUCTION EVENTS **********************
        tradingContract.on('AuctionStarted', async (tokenId, seller, startPrice, endTime, event) => {
            await saveEvent('AuctionStarted', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(startPrice)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: true, lastUpdated: Date.now() });
        });
    
        tradingContract.on('NewBid', async (tokenId, bidder, amount, event) => {
            await saveEvent('NewBid', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });

        tradingContract.on('BidWithdrawn', async (tokenId, bidder, amount, event) => {
            await saveEvent('BidWithdrawn', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });
    
        tradingContract.on('AuctionEnded', async (tokenId, winner, amount, event) => {
            await saveEvent('AuctionEnded', {
                tokenId: tokenId.toString(),
                to: winner.toLowerCase(),
                price: ethers.formatEther(amount)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, currentValue: parseFloat(ethers.formatEther(amount)), lastUpdated: Date.now() });
        });


        // ********************** DUTCH-AUCTION EVENTS **********************
        tradingContract.on('DutchAuctionStarted', async (tokenId, seller, startPrice, endPrice, endTime, event) => {
            await saveEvent('DutchAuctionStarted', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(startPrice)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, {
                currentlyForSale: true,
                lastUpdated: Date.now()
            });
        });

        tradingContract.on('DutchAuctionEnded', async (tokenId, buyer, amount, event) => {
            await saveEvent('DutchAuctionEnded', {
                tokenId: tokenId.toString(),
                to: buyer.toLowerCase(),
                price: ethers.formatEther(amount)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, {
                currentlyForSale: false,
                currentValue: parseFloat(ethers.formatEther(amount)),
                lastUpdated: Date.now()
            });
        });


        // ********************** OFFER EVENTS **********************
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
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, currentValue: parseFloat(ethers.formatEther(amount)), lastUpdated: Date.now() });
        });
    } catch (e) {
        // Retry behavior
        console.log(e);
        setupEventListener(nftContractAddress, nftContractABI, tradingContractAddress, tradingContractABI);
    }
    
    const saveEvent = async (eventType, data) => {
        try {
            const event = new DB.transactions({ eventType, ...data });
            await event.save();
            console.log(`${time()} Saved ${eventType} event:`, data);
        } catch (error) {
            console.error(`${time()} Failed to save ${eventType} event:`, error);
        }
    };
}

// Helper function to get current time
function time() {
    const today = new Date();
    const date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    const time = (today.getHours() + 2) + ":" + today.getMinutes() + ":" + today.getSeconds();

    return "[" + date + " " + time + "]";
}