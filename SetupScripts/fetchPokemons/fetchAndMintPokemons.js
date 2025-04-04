import fs from "fs";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { fromString } from "uint8arrays/from-string";
import { ethers } from "ethers";  

import { fetchPokemonData } from "./fetchPokemonData.js";


// CONSTANTS
const ownerAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"


async function deployNFTContract() {
  const provider = new ethers.JsonRpcProvider("http://localhost:8545"); // Hardhat local node
  const signer = await provider.getSigner(); // Get first signer (default deployer)
  
  // Load contract ABI and bytecode (from compilation output)
  const contractJSON = JSON.parse(fs.readFileSync("../../SmartContracts/artifacts/contracts/ERC721.sol/ERC721.json", "utf8"));
  
  // Deploy the contract
  const NFTContract = new ethers.ContractFactory(contractJSON.abi, contractJSON.bytecode, signer);
  const nftContract = await NFTContract.deploy("PokeNFT", "PKN");
  await nftContract.waitForDeployment(); // Wait for deployment
  
  const contractAddress = await nftContract.getAddress();
  
  return contractAddress;
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
  // Deploy new ERC721 contract on the local hardhat testnet
  console.log(`${time()} Script successfully started.`);
  console.log(`${time()} Starting to deploy ERC721 contract...`);
  const contractAddress = await deployNFTContract();
  console.log(`${time()} 🚀 Contract deployed at: ${contractAddress} Owner: ${ownerAddress}`);

  // Fetch Pokemon metadata from pokeapi
  console.log(`${time()} Starting to fetch Pokemon metadata from pokeapi...`);
  const pokemons = await fetchPokemonData(numbOfPokemons);
  console.log(`${time()} ✅ Fetched Pokemon metadata for ${numbOfPokemons} NFTS.`);

  // Create Helia Node for the IPFS metadata storage
  const helia = await createHeliaNode();

  // Ethereum and contract setup (Hardhat local node)
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const signer = await provider.getSigner();
  const nftContractAddress = contractAddress;
  const nftABI = [
    "function batchMint(address _to, string[] memory _uris) public"
  ];
  const nftContract = new ethers.Contract(nftContractAddress, nftABI, signer);

  // Array which saves all ipfsURIs in order to backMint all NFTs at once
  var ipfsURIs = [];

  console.log(`${time()} Starting to upload NFT metadata to IPFS...`);
  for (const pokemon of pokemons) {
    // Prepare metadata
    const metadata = {
      name: pokemon.name,
      description: `A ${pokemon.pokemon_v2_pokemontypes.map((t) => t.pokemon_v2_type.name).join(", ")} type Pokémon.`,
      image: pokemon.pokemon_v2_pokemonsprites?.[0]?.sprites || "",
      attributes: pokemon.pokemon_v2_pokemonstats.map((stat) => ({
        trait_type: stat.pokemon_v2_stat.name,
        value: stat.base_stat,
      })),
    };

    // Upload to IPFS
    const ipfsURI = await uploadToIPFS(helia, metadata);

    ipfsURIs.push(ipfsURI);  
  }
  console.log(`${time()} ✅ Uploaded all NFT metadata to IPFS!`);

  // Batch-Minting all NFTS using the cids from helia IPFS as the NFT Uri
  console.log(`${time()} Starting to mint NFTs...`);
  await batchMintNFTs(signer, nftContract, ownerAddress, ipfsURIs);
  console.log(`${time()} ✅ All Pokémon NFTs minted to: ${ownerAddress}`);

  console.log(`${time()} 🚀 Script finished successfully, all NFTS are ready!`);

  return;
}
  
fetchAndMintPokemons(ownerAddress, 100).catch(console.error);
