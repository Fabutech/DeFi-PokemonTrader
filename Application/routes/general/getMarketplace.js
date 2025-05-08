import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getMarketplace(req, res, DB, tradingContract, tradingContractABI, nftContract, signer, helia) {
    // This function fetches and categorizes all NFTs into listed, on-auction, or unlisted for marketplace display.
    const decoder = new TextDecoder();
    const fs = unixfs(helia);

    // Retrieve user wallet address from session
    const userAddress = req.session.walletAddress;

    // Get contract owner's address to determine permissions
    const contractOwner = await nftContract.connect(signer).contractOwner();

    // Retrieve all NFTs from the database
    const allNFTs = await DB.ownership.find({});

    // Arrays to categorize NFTs
    const listedNfts = [];
    const nftsOnAuction = [];
    const unlistedNfts = [];

    // Fetch the current ETH to USD conversion rate
    const ethUsd = await fetchEthPrice();

    // Process all NFTs in parallel
    await Promise.all(allNFTs.map(async nft => {
        try {
            // Fetch listing, auction, offers, and metadata URI from blockchain
            const [listing, auction, offers, tokenUri] = await Promise.all([
                tradingContract.connect(signer).listings(nft.tokenId),
                tradingContract.connect(signer).auctions(nft.tokenId),
                tradingContract.connect(signer).getOffers(nft.tokenId),
                nftContract.connect(signer).tokenURI(nft.tokenId)
            ]);

            const ipfsHash = tokenUri.replace("ipfs://", "");

            // Fetch and decode the metadata JSON from IPFS
            let content = '';
            for await (const chunk of fs.cat(ipfsHash)) {
                content += decoder.decode(chunk);
            }

            const metadata = JSON.parse(content);

            // Process active offers and determine highest offer price
            let hasOffers = false;
            let highestOfferPrice = "-";
            if (offers) {
                const now = Math.floor(Date.now() / 1000);
                const activeOffers = [];

                offers
                  .map(o => [...o]) // Convert to mutable arrays
                  .filter(offer => offer[0] != 0n) // Filter out zero address offers
                  .forEach(offer => {
                    if (Number(offer[2]) > now) { // Check if offer is still valid
                      activeOffers.push(offer);
                    } 
                  });

                // Sort offers by price descending
                activeOffers.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

                hasOffers = activeOffers.length != 0;
                if (hasOffers) {
                    highestOfferPrice = Number(ethers.formatEther(activeOffers[0][1].toString()));
                }
            }

            // Classify NFT based on its marketplace status
            if (listing.isActive) {
                let priceETH = ethers.formatEther(listing.price.toString());
                let priceUSD = ethUsd ? priceETH * ethUsd : "-";

                listedNfts.push({
                    tokenId: nft.tokenId,
                    expiry: listing.expiration,
                    priceETH: priceETH,
                    priceUSD: priceUSD,
                    hasOffers: hasOffers,
                    metadata: metadata
                });
            } else if (auction.isActive) {
                let priceETH = auction.highestBid.toString() !== "0"
                    ? ethers.formatEther(auction.highestBid.toString())
                    : ethers.formatEther(auction.startingPrice.toString());
                let priceUSD = ethUsd ? priceETH * ethUsd : 0;

                nftsOnAuction.push({
                    tokenId: nft.tokenId,
                    expiry: auction.endTimestamp,
                    priceETH: priceETH,
                    priceUSD: priceUSD,
                    hasOffers: hasOffers,
                    metadata: metadata
                });
            } else {
                // Unlisted NFT: show current estimated value and last transfer info
                unlistedNfts.push({
                    tokenId: nft.tokenId,
                    metadata: metadata,
                    currentValueETH: nft.currentValue,
                    priceUSD: ethUsd ? nft.currentValue * ethUsd : 0,
                    hasOffers: hasOffers,
                    highestOfferPrice: highestOfferPrice,
                    lastTransfer: nft.lastTransfer
                });
            }
        } catch (err) {
            console.error(`Error processing token ${nft.tokenId}:`, err);
        }
    }));

    // Render the marketplace page with categorized NFTs and relevant metadata
    res.render("marketplace", { 
        listings: listedNfts, 
        auctions: nftsOnAuction,
        unlisted: unlistedNfts,
        isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase(),
        tradingContractAddress: await tradingContract.getAddress(),
        tradingContractABI: tradingContractABI,
    });
}

// Helper function to fetch current ETH to USD conversion rate
async function fetchEthPrice() {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await response.json();

        return data.ethereum.usd;
    } catch (e) {
        console.log("Error while fetching eth to usd exchange rate: " + e);
        return null;
    }
};