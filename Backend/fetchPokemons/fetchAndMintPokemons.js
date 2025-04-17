import fs from "fs";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { fromString } from "uint8arrays/from-string";
import { ethers } from "ethers";  

import { setupEventListener } from "./../trackOwnership/eventListener.js";
import { fetchPokemonData } from "./fetchPokemonData.js";
import { runApp} from "../../Frontend/app.js";

// CONSTANTS
const ownerAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

// ABIs
const ERC721_JSON = JSON.parse(fs.readFileSync("../../SmartContracts/artifacts/contracts/ERC721.sol/ERC721.json", "utf8"));
const TRADING_JSON = JSON.parse(fs.readFileSync("../../SmartContracts/artifacts/contracts/TradingContract.sol/TradingContract.json", "utf8"));



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

async function approveTradingContract(signer, nftContract, tradingContractAddress) {
  const tx = await nftContract.connect(signer).setApprovalForAll(tradingContractAddress, true);
  await tx.wait();
  console.log(`${time()} ✅ Trading contract approved to manage all NFTs!`);
}

// Initialize Helia
async function createHeliaNode() {
  return await createHelia();
}

// Upload metadata & image to IPFS using Helia
async function uploadToIPFS(helia, metadata) {
  const fs = unixfs(helia);

  // Convert metadata to a string and upload to IPFS
  const metadataCid = await fs.addBytes(fromString(JSON.stringify(metadata)));
  return `ipfs://${metadataCid.toString()}`;
}
  
// Mint NFT on Ethereum (Hardhat local node)
async function mintNFT(signer, nftContract, recipient, ipfsURI) {
  const tx = await nftContract.connect(signer).mintTo(recipient, ipfsURI);
  await tx.wait();
  console.log(`${time()} Minted NFT for: ${recipient}, TokenURI: ${ipfsURI}`);
}

// BatchMint NFTs on Ethereum (Hardhat local node)
async function batchMintNFTs(signer, nftContract, recipient, ipfsURIs) {
  const tx = await nftContract.connect(signer).batchMint(recipient, ipfsURIs);
  await tx.wait();
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

  console.log(`${time()} Starting to setup contract event listener`);
  await setupEventListener(await nftContract.getAddress(), ERC721_JSON.abi, await tradingContract.getAddress(), TRADING_JSON.abi, true);
  console.log(`${time()} ✅ Successfully setup event listener`);

  // Fetch Pokemon metadata from pokeapi
  console.log(`${time()} Starting to fetch Pokemon metadata from pokeapi...`);
  const pokemons = await fetchPokemonData(numbOfPokemons);
  console.log(`${time()} ✅ Fetched Pokemon metadata for ${numbOfPokemons} NFTS.`);

  // Create Helia Node for the IPFS metadata storage
  const helia = await createHeliaNode();

  // Array which saves all ipfsURIs in order to backMint all NFTs at once
  var ipfsURIs = [];

  console.log(`${time()} Starting to upload NFT metadata to IPFS...`);
  for (const pokemon of pokemons) {
    let attributes = {};
    pokemon.stats.forEach((stat) => {
      attributes[stat.name] = stat.base_stat;
    });

    const image = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default || "";

    const metadata = {
      name: pokemon.name,
      height: pokemon.height,
      weight: pokemon.weight,
      description: pokemon.types.join(", "),
      image: image,
      attributes: attributes
    };

    const ipfsURI = await uploadToIPFS(helia, metadata);
    ipfsURIs.push(ipfsURI);  
  }
  console.log(`${time()} ✅ Uploaded all NFT metadata to IPFS!`);

  // Batch-Minting all NFTS using the cids from helia IPFS as the NFT Uri
  console.log(`${time()} Starting to mint NFTs...`);
  await batchMintNFTs(signer, nftContract, ownerAddress, ipfsURIs);
  console.log(`${time()} ✅ All Pokémon NFTs minted to: ${ownerAddress}`);

  // console.log(`${time()} Approving Trading Contract...`);
  // await approveTradingContract(signer, nftContract, await tradingContract.getAddress());
  // console.log(`${time()} ✅ Trading contract is approved to trade all NFT's of ${ownerAddress}`);

  console.log(`${time()} Deploying Frontend website...`);
  runApp(
    tradingContract, 
    TRADING_JSON.abi, 
    nftContract, 
    ERC721_JSON.abi,
    signer, 
    helia
  );
  console.log(`${time()} ✅ Successfully deployed website at: localhost:3000`);

  console.log(`${time()} {\n 🚀 Script finished successfully!\n    - ERC721 Contract launched\n    - Trading Contract launched\n    - All NFT's minted \n    - Trading Contract approved to trade NFT's\n    - Event Listener setup and MongoDB connected\n}`);
}
  
fetchAndMintPokemons(ownerAddress, 100).catch(console.error);
