import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getUserNFTs(req, res, DB, nftContract, signer, helia) {
    const userAddress = req.session.walletAddress;

    if (!userAddress) {
        return res.render("connect");
    }

    const decoder = new TextDecoder();
    const fs = unixfs(helia);

    const nftsFromDB = await DB.ownership.find({ "ownerAddress": userAddress });

    let currentlyForSale = 0;
    let totalValueETH = 0;

    const nfts = await Promise.all(nftsFromDB.map(async (nft) => {
        try {
            const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
            const ipfsHash = tokenUri.replace("ipfs://", "");
    
            let content = '';
            for await (const chunk of fs.cat(ipfsHash)) {
                content += decoder.decode(chunk);
            }
            const metadata = JSON.parse(content);

            if (nft.currentlyForSale) currentlyForSale++;
            totalValueETH += nft.currentValue;
    
            return {
                ...nft.toObject(),
                ...metadata
            };
        } catch (err) {
            console.error(`Error fetching metadata for token ${nft.tokenId}:`, err);
            return nft.toObject(); // fallback
        }
    }));

    let totalValueUSD = 0;
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await response.json();
        const ethUsd = data.ethereum.usd;
        totalValueUSD = totalValueETH * ethUsd;
    } catch (e) {
        console.log("Error while fetching eth to usd exchange rate: " + e);
    }

    res.render("myNFTs", {
        nfts: nfts, 
        currentlyForSale: currentlyForSale, 
        totalValueETH: totalValueETH, 
        totalValueUSD: totalValueUSD, 
        userAddress: userAddress
    });
}