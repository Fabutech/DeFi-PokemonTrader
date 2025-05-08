import express from 'express';

import getUserNFTs from './getUserNFTs.js';

export default function index(DB, nftContract, nftContractABI, tradingContract, tradingContractABI, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/nfts")
    .get((req, res) => {
        getUserNFTs(req, res, DB, nftContract, signer, helia);
    });

    MainRouter.route("/mint")
    .get(async (req, res) => {
        const userAddress = req.session.walletAddress; // Get user wallet address from session
        const contractOwner = await nftContract.connect(signer).contractOwner(); // Get contract owner address

        // Only the contract owner is allowed to access the minting page
        if (contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()) {
            res.render("mint", {
                nftContractAddress: await nftContract.getAddress(),  // NFT contract address for frontend
                nftContractABI: nftContractABI,                      // ABI needed to interact with NFT contract
                tradingContractAddress: await tradingContract.getAddress(), // Trading contract address
                tradingContractABI: tradingContractABI,              // ABI for trading contract
                userAddress: userAddress,                            // Current user address
                isContractOwner: contractOwner && userAddress &&     // Flag to indicate contract owner in UI
                                 contractOwner.toLowerCase() === userAddress.toLowerCase()
            });
        } else {
            res.redirect("/"); // Redirect unauthorized users to home page
        }
    });

    return MainRouter;
}