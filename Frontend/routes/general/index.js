import express from 'express';

import getMarketplace from './getMarketplace.js';

export default function index(DB, tradingContract, nftContract, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/")
    .get((req, res) => {
        res.redirect("/marketplace");
    })

    MainRouter.route("/marketplace")
    .get((req, res) => {
        getMarketplace(req, res, DB, tradingContract, nftContract, signer, helia)
    })

    return MainRouter
}