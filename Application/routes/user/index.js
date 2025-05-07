import express from 'express';

import getUserNFTs from './getUserNFTs.js';

export default function index(DB, nftContract, nftContractABI, tradingContract, tradingContractABI, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/nfts")
    .get((req, res) => {
        getUserNFTs(req, res, DB, nftContract, signer, helia);
    })

    MainRouter.route("/mint")
    .get(async (req, res) => {
        const userAddress = req.session.walletAddress;
        const contractOwner = await nftContract.connect(signer).contractOwner();

        if (contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()) {
            res.render("mint", {
                nftContractAddress: await nftContract.getAddress(),
                nftContractABI: nftContractABI,
                tradingContractAddress: await tradingContract.getAddress(),
                tradingContractABI: tradingContractABI,
                userAddress: userAddress,
                isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()
            });
        } else {
            res.redirect("/");
        }
    })

    return MainRouter
}