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
                if (!listing.isActive) {
                    return null;
                }
        
                const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
                const ipfsHash = tokenUri.replace("ipfs://", "");
        
                let content = '';
                for await (const chunk of fs.cat(ipfsHash)) {
                content += decoder.decode(chunk);
                }
        
                const metadata = JSON.parse(content);

                const priceETH = ethers.formatEther(listing.price.toString());
                const ethUsdRaw = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
                const ethUsdJson = await ethUsdRaw.json();
                const ethUsd = ethUsdJson.ethereum.usd;
                const nftPriceUSD = priceETH * ethUsd;
        
                return {
                    tokenId: nft.tokenId,
                    listing: listing,
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
    const filteredNfts = listedNfts.filter(nft => nft !== null);
    
    res.render("marketplace", { nfts: filteredNfts });
}