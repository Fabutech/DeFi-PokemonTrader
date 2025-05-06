import express from 'express';
import session from 'express-session';
import path from 'path';
import { ethers } from 'ethers';
import { createHelia } from "helia";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { routes } from './routes/index.js';

export async function runApp(DB, tradingContractAddress, nftContractAddress, ABIS, signer) {
    const app = express();
    app.use(express.json({ limit: '100mb' })); // needed to set this manually for the image upload of manual minting
    const PORT = 3000;

    // Set up Ethers.js provider to connect to local Hardhat network
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    
    const tradingContract = new ethers.Contract(tradingContractAddress, ABIS.tradingABI.abi, provider);

    const CONTRACTS = {
        nftContract: new ethers.Contract(nftContractAddress, ABIS.erc721ABI.abi, provider),
        tradingContract: tradingContract,
        auctionContract: new ethers.Contract(await tradingContract.auction(), ABIS.auctionABI.abi, provider),
        dutchContract: new ethers.Contract(await tradingContract.dutchAuction(), ABIS.dutchABI.abi, provider),
        sealedBidContract: new ethers.Contract(await tradingContract.sealedBidAuction(), ABIS.sealedBidABI.abi, provider),
        fixedContract: new ethers.Contract(await tradingContract.fixedPrice(), ABIS.fixedABI.abi, provider),
        offerContract: new ethers.Contract(await tradingContract.offerManager(), ABIS.offerABI.abi, provider)
    }

    // Create Helia Node for the IPFS metadata storage
    const helia = await createHelia();

    // Setup Express Sessions
    app.use(session({
        secret: 'Pokemon',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } 
    }));


    // Middleware
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());


    // ROUTES
    routes(app, DB, CONTRACTS, ABIS, signer, helia);

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
}

