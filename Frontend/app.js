import express from 'express';
import session from 'express-session';
import path from 'path';
import Web3 from 'web3';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { routes } from './routes/index.js';

// Contract ABIs
const tradingAbiPath = join(__dirname, '../SmartContracts/artifacts/contracts/TradingContract.sol/TradingContract.json');
const TRADING_ABI = JSON.parse(fs.readFileSync(tradingAbiPath)).abi;
const erc721AbiPath = join(__dirname, '../SmartContracts/artifacts/contracts/ERC721.sol/ERC721.json');
const ERC721_ABI = JSON.parse(fs.readFileSync(erc721AbiPath)).abi;

// MongoDB setup
const nftOwnershipSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now },
});
const tradingEventSchema = new mongoose.Schema({
    eventType: { type: String, required: true },
    tokenId: { type: String },
    from: { type: String },
    to: { type: String },
    price: { type: String },
    timestamp: { type: Date, default: Date.now }
});
const DB = {
  ownership: mongoose.model('NFTOwnership', nftOwnershipSchema),  
  transactions: mongoose.model('TradingEvent', tradingEventSchema)
};

export function runApp(tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    const app = express();
    const PORT = 3000;

    // Setup Web3 with local Hardhat network
    const web3 = new Web3('http://127.0.0.1:8545'); // Hardhat node

    // Setup MongoDB
    connectMongoDB();

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

    routes(app, DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia);

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
}

async function connectMongoDB() {
    try {
      await mongoose.connect("mongodb+srv://fabutech:Bv25L4aRFgGHchiX@defi-db.7ary1.mongodb.net", {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log(`Connected to MongoDB`);
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
}