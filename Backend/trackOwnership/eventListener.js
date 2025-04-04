import { ethers } from 'ethers';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: "../.env"});

const nftOwnershipSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now },
  });
  
const NFTOwnership = mongoose.model('NFTOwnership', nftOwnershipSchema);

let mongooseConnected = false;

export function setupEventListener(contractAddress) {
    connectMongoDB()

    // Set up Ethers.js provider to connect to local Hardhat network
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');

    // ERC721 contract address and ABI
    const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ];

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, abi, provider);

    // Listen for Transfer events
    contract.on("Transfer", async (from, to, tokenId) => {
        console.log(`${time()} Token ID ${tokenId} transferred from ${from} to ${to}`);

        try {
            // Check if tokenId exists in the DB
            const existingRecord = await NFTOwnership.findOne({ tokenId });

            if (existingRecord) {
                // If the token is already in the DB, update the owner address
                existingRecord.ownerAddress = to;
                existingRecord.lastUpdated = Date.now();
                await existingRecord.save();
            } else {
                // If the token is new, create a new record
                const newOwnership = new NFTOwnership({ tokenId, ownerAddress: to });
                await newOwnership.save();
            }
        } catch (error) {
            console.log(`${time()} Error processing Transfer event: ${error}`);
        }
    });
}

async function connectMongoDB() {
    if (mongooseConnected) return;
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      mongooseConnected = true;
      console.log(`${time()} Connected to MongoDB`);
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
  }

  // Helper function to get current time
function time() {
    const today = new Date();
    const date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    const time = (today.getHours() + 2) + ":" + today.getMinutes() + ":" + today.getSeconds();
  
    return "[" + date + " " + time + "]";
  }