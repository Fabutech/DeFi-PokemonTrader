// This function retrieves all NFTs owned by the logged-in user, including metadata from IPFS,
// and calculates total portfolio value in ETH and USD for display.

import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getUserNFTs(req, res, DB, nftContract, signer, helia) {
    const userAddress = req.session.walletAddress;

    // Get contract owner's address to check privileges
    const contractOwner = await nftContract.connect(signer).contractOwner();

    // If no user address in session, redirect to connect page
    if (!userAddress) {
        return res.render("connect", { 
            isContractOwner: contractOwner && userAddress && 
                             contractOwner.toLowerCase() === userAddress.toLowerCase() 
        });
    }

    const decoder = new TextDecoder();
    const fs = unixfs(helia);

    // Fetch all NFTs from DB where current user is owner
    const nftsFromDB = await DB.ownership.find({ "ownerAddress": userAddress });

    let currentlyForSale = 0;
    let totalValueETH = 0;

    // Process each NFT: fetch metadata and accumulate totals
    const nfts = await Promise.all(nftsFromDB.map(async (nft) => {
        try {
            const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
            const ipfsHash = tokenUri.replace("ipfs://", "");

            // Fetch and decode metadata from IPFS
            let content = '';
            for await (const chunk of fs.cat(ipfsHash)) {
                content += decoder.decode(chunk);
            }
            const metadata = JSON.parse(content);

            if (nft.currentlyForSale) currentlyForSale++;
            totalValueETH += nft.currentValue;

            // Merge DB and metadata info
            return {
                ...nft.toObject(),
                ...metadata
            };
        } catch (err) {
            console.error(`Error fetching metadata for token ${nft.tokenId}:`, err);
            return nft.toObject(); // fallback if metadata fetch fails
        }
    }));

    let totalValueUSD = 0;
    try {
        // Fetch ETH to USD conversion rate
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await response.json();
        const ethUsd = data.ethereum.usd;
        totalValueUSD = totalValueETH * ethUsd;
    } catch (e) {
        console.log("Error while fetching eth to usd exchange rate: " + e);
    }

    // Render user's NFT portfolio page
    res.render("myNFTs", {
        nfts: nfts, 
        currentlyForSale: currentlyForSale, 
        totalValueETH: totalValueETH, 
        totalValueUSD: totalValueUSD, 
        userAddress: userAddress,
        isContractOwner: contractOwner && userAddress && 
                         contractOwner.toLowerCase() === userAddress.toLowerCase()
    });
}