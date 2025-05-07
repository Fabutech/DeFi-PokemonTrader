import fs from "fs";
import { ethers } from "ethers";  
import mongoose from 'mongoose';
import { setupEventListener } from "./eventListener.js";
import { runApp} from "../app.js";

// CONSTANTS
const ownerAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

// ABIs
const ERC721_JSON = JSON.parse(fs.readFileSync("../../SmartContracts/artifacts/contracts/ERC721.sol/ERC721.json", "utf8"));
const TRADING_JSON = JSON.parse(fs.readFileSync("../../SmartContracts/artifacts/contracts/TradingContract.sol/TradingContract.json", "utf8"));

// MongoDB Setup
const nftOwnershipSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true },
    currentlyForSale: { type: Boolean, default: false },
    currentValue: { type: Number, default: 0 },
    lastTransfer: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
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


async function deployNFTContract(signer) {    
  // Deploy the contract
  const NFTContract = new ethers.ContractFactory(ERC721_JSON.abi, ERC721_JSON.bytecode, signer);
  const nftContract = await NFTContract.deploy("PokeNFT", "PKN");
  await nftContract.waitForDeployment(); // Wait for deployment
    
  return nftContract;
}

async function deployTradingContract(signer, nftContractAddress) {
  const TradingContract = new ethers.ContractFactory(TRADING_JSON.abi, TRADING_JSON.bytecode, signer);
  const tradingContract = await TradingContract.deploy(nftContractAddress);
  await tradingContract.waitForDeployment();
  
  const contractAddress = await tradingContract.getAddress();
  console.log(`${time()} 🚀 Trading Contract deployed at: ${contractAddress}`);
  
  return tradingContract;
}

// Helper function to get current time
function time() {
  const today = new Date();
  const date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  const time = (today.getHours() + 2) + ":" + today.getMinutes() + ":" + today.getSeconds();

  return "[" + date + " " + time + "]";
}
  
  // Main function
async function fetchAndMintPokemons(ownerAddress, numbOfPokemons) {
  console.log(`${time()} Script successfully started.`);

  // Ethereum and contract setup (Hardhat local node)
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const signer = await provider.getSigner();

  // Deploy new ERC721 contract on the local hardhat testnet
  console.log(`${time()} Starting to deploy ERC721 contract...`);
  const nftContract = await deployNFTContract(signer);
  console.log(`${time()} 🚀 Contract deployed at: ${await nftContract.getAddress()} Owner: ${ownerAddress}`);

  console.log(`${time()} Deploying Trading Contract...`);
  const tradingContract = await deployTradingContract(signer, await nftContract.getAddress());
  console.log(`${time()} ✅ Trading contract is deployed to: ${await tradingContract.getAddress()}`);

  connectMongoDB();

  console.log(`${time()} Starting to setup contract event listener`);
  await setupEventListener(DB, await nftContract.getAddress(), ERC721_JSON.abi, await tradingContract.getAddress(), TRADING_JSON.abi, true);
  console.log(`${time()} ✅ Successfully setup event listener`);

  console.log(`${time()} Deploying Frontend website...`);
  runApp(
    DB,
    tradingContract, 
    TRADING_JSON.abi, 
    nftContract, 
    ERC721_JSON.abi,
    signer
  );
  console.log(`${time()} ✅ Successfully deployed website at: localhost:3000`);

  console.log(`${time()} {\n 🚀 Script finished successfully!\n    - ERC721 Contract launched\n    - Trading Contract launched\n    - All NFT's minted \n    - Trading Contract approved to trade NFT's\n    - Event Listener setup and MongoDB connected\n}`);
}
  
fetchAndMintPokemons(ownerAddress, 100).catch(console.error);

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