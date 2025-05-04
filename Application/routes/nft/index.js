import express from 'express';

import getNft from './getNft.js';

export default function index(DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/:tokenId")
    .get((req, res) => {
        getNft(req, res, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia);
    })

    return MainRouter
}