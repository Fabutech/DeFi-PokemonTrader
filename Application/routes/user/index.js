import express from 'express';

import getUserNFTs from './getUserNFTs.js';

export default function index(DB, CONTRACTS, ABIS, signer, helia) {
    const MainRouter = express.Router();

    MainRouter.route("/nfts")
    .get((req, res) => {
        getUserNFTs(req, res, DB, CONTRACTS, signer, helia);
    })

    MainRouter.route("/mint")
    .get(async (req, res) => {
        const userAddress = req.session.walletAddress;
        const contractOwner = await CONTRACTS.nftContract.connect(signer).contractOwner();

        if (contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()) {
            res.render("mint", {
                nftContractAddress: await CONTRACTS.nftContract.getAddress(),
                nftContractABI: ABIS.erc721ABI.abi,
                userAddress: userAddress,
                isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase()
            });
        } else {
            res.redirect("/");
        }
    })

    return MainRouter
}