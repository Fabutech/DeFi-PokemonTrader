import express from 'express';

import getUserNFTs from './getUserNFTs.js';

export default function index(DB, nftContract, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/nfts")
    .get((req, res) => {
        getUserNFTs(req, res, DB, nftContract, signer, helia);
    })

    return MainRouter
}