import express from 'express';

import getMarketplace from './getMarketplace.js';

export default function index(DB, tradingContract, tradingContractABI, nftContract, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/")
    .get((req, res) => {
        res.redirect("/marketplace");
    })

    MainRouter.route("/marketplace")
    .get((req, res) => {
        getMarketplace(req, res, DB, tradingContract, tradingContractABI, nftContract, signer, helia)
    })

    MainRouter.route("/transactions")
    .get(async (req, res) => {
        const userAddress = req.session.walletAddress;
        const contractOwner = await nftContract.connect(signer).contractOwner();

        res.render("transactions", {isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()});
    })

    return MainRouter
}