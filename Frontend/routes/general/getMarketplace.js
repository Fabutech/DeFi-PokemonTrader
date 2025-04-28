import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getMarketplace(req, res, DB, tradingContract, nftContract, signer, helia) {
    const decoder = new TextDecoder();
    const fs = unixfs(helia);

    const allNFTs = await DB.ownership.find({});

    const listedNfts = await Promise.all(
        allNFTs.map(async nft => {
            try {
                let listing = await tradingContract.connect(signer).listings(nft.tokenId);

                if (listing.isActive === false) {
                    return null;
                }
        
                const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
                const ipfsHash = tokenUri.replace("ipfs://", "");
        
                let content = '';
                for await (const chunk of fs.cat(ipfsHash)) {
                    content += decoder.decode(chunk);
                }
        
                const metadata = JSON.parse(content);

                let priceETH = ethers.formatEther(listing.price.toString());
                let nftPriceUSD = "-";
                try {
                    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
                    const data = await response.json();
                    const ethUsd = data.ethereum.usd;
        
                    nftPriceUSD = priceETH * ethUsd;
                } catch (e) {
                    console.log("Error while fetching eth to usd exchange rate: " + e);
                }

                return {
                    tokenId: nft.tokenId,
                    expiry: listing.expiration,
                    priceETH: priceETH,
                    priceUSD: nftPriceUSD,
                    metadata: metadata
                };
            } catch (err) {
                console.error(`Error fetching metadata for token ${nft.tokenId}:`, err);
                return null;
            }
        })
    );

    const nftsOnAuction = await Promise.all(
        allNFTs.map(async nft => {
            try {
                let auction = await tradingContract.connect(signer).auctions(nft.tokenId);

                if (auction.isActive === false) {
                    return null;
                }
        
                const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
                const ipfsHash = tokenUri.replace("ipfs://", "");
        
                let content = '';
                for await (const chunk of fs.cat(ipfsHash)) {
                    content += decoder.decode(chunk);
                }
        
                const metadata = JSON.parse(content);

                let priceETH;
                // If the auction has bids take the highestBid value, otherwise take the starting price of the auction
                if (auction.highestBid.toString() != 0) {
                    priceETH = ethers.formatEther(auction.highestBid.toString());
                } else {
                    priceETH = ethers.formatEther(auction.startingPrice.toString());
                }

                let nftPriceUSD = 0;
                try {
                    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
                    const data = await response.json();
                    const ethUsd = data.ethereum.usd;
        
                    nftPriceUSD = priceETH * ethUsd;
                } catch (e) {
                    console.log("Error while fetching eth to usd exchange rate: " + e);
                }

        
                return {
                    tokenId: nft.tokenId,
                    expiry: auction.endTimestamp,
                    priceETH: priceETH,
                    priceUSD: nftPriceUSD,
                    metadata: metadata
                };
            } catch (err) {
                console.error(`Error fetching metadata for token ${nft.tokenId}:`, err);
                return null;
            }
        })
    );
    
    // Remove nulls (non-active or errored NFTs)
    const filteredListings = listedNfts.filter(nft => nft !== null);
    const filteredAuctions = nftsOnAuction.filter(nft => nft !== null);
    
    res.render("marketplace", { 
        listings: filteredListings, 
        auctions: filteredAuctions 
    });
}