import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: "../.env"});

export async function setupEventListener(DB, nftContractAddress, tradingContractAddress, ABIS, wipeDB = false) {    
    // Wipe the NFTOwnership collection
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
    
    const nftContract = new ethers.Contract(nftContractAddress, ABIS.erc721ABI.abi, provider);
    const tradingContract = new ethers.Contract(tradingContractAddress, ABIS.tradingABI.abi, provider);

    const auctionContract = new ethers.Contract(await tradingContract.auction(), ABIS.auctionABI.abi, provider);
    const dutchContract = new ethers.Contract(await tradingContract.dutchAuction(), ABIS.dutchABI.abi, provider);
    const fixedContract = new ethers.Contract(await tradingContract.fixedPrice(), ABIS.fixedABI.abi, provider);
    const offerContract = new ethers.Contract(await tradingContract.offerManager(), ABIS.offerABI.abi, provider);

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
        fixedContract.on('NFTListed', async (tokenId, seller, price, event) => {
            await saveEvent('List', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(price)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: true, lastUpdated: Date.now() });
        });
    
        fixedContract.on('NFTSold', async (tokenId, seller, buyer, price, event) => {
            await saveEvent('Sale', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                to: buyer.toLowerCase(),
                price: ethers.formatEther(price)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, currentValue: parseFloat(ethers.formatEther(price)), lastUpdated: Date.now() });
        });

        fixedContract.on('NFTDelisted', async (tokenId, seller, event) => {
            await saveEvent('Delist', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase()
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, lastUpdated: Date.now() });
        });
    

        // ********************** AUCTION EVENTS **********************
        auctionContract.on('AuctionStarted', async (tokenId, seller, startPrice, endTime, event) => {
            await saveEvent('AuctionStarted', {
                tokenId: tokenId.toString(),
                from: seller.toLowerCase(),
                price: ethers.formatEther(startPrice)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: true, lastUpdated: Date.now() });
        });
    
        auctionContract.on('NewBid', async (tokenId, bidder, amount, event) => {
            await saveEvent('NewBid', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });

        auctionContract.on('BidWithdrawn', async (tokenId, bidder, amount, event) => {
            await saveEvent('BidWithdrawn', {
                tokenId: tokenId.toString(),
                from: bidder.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });
    
        auctionContract.on('AuctionEnded', async (tokenId, winner, amount, event) => {
            await saveEvent('AuctionEnded', {
                tokenId: tokenId.toString(),
                to: winner.toLowerCase(),
                price: ethers.formatEther(amount)
            });
            await DB.ownership.findOneAndUpdate({ tokenId: tokenId.toString() }, { currentlyForSale: false, currentValue: parseFloat(ethers.formatEther(amount)), lastUpdated: Date.now() });
        });


        // ********************** DUTCH-AUCTION EVENTS **********************
        dutchContract.on('DutchAuctionStarted', async (tokenId, seller, startPrice, endPrice, endTime, event) => {
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

        dutchContract.on('DutchAuctionEnded', async (tokenId, buyer, amount, event) => {
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
        offerContract.on('OfferMade', async (tokenId, offerer, amount, expiration, event) => {
            await saveEvent('OfferMade', {
                tokenId: tokenId.toString(),
                from: offerer.toLowerCase(),
                price: ethers.formatEther(amount)
            });
        });

        offerContract.on('OfferCancelled', async (tokenId, offerer, event) => {
            await saveEvent('OfferCancelled', {
                tokenId: tokenId.toString(),
                from: offerer.toLowerCase()
            });
        });

        offerContract.on('OfferAccepted', async (tokenId, offerer, amount, event) => {
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