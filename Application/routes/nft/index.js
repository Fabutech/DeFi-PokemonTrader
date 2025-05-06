import express from 'express';

import getNft from './getNft.js';

export default function index(DB, CONTRACTS, ABIS, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/:tokenId")
    .get((req, res) => {
        getNft(req, res, CONTRACTS, ABIS, signer, helia);
    })

    return MainRouter
}