import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { fromString } from "uint8arrays/from-string";
import { ethers } from "ethers";
import fetch from "node-fetch";
import dotenv from "dotenv";

import { fetchPokemonData } from "./fetchPokemonData.js";


// CONSTANTS
const contractAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
const ownerAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

// Initialize Helia
async function createHeliaNode() {
  const { createHelia } = await import("helia");
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
    const tx = await nftContract.mintTo(recipient, ipfsURI);
    const txResponse = await signer.sendTransaction({
        to: nftContract.address,
        data: tx.data,
        maxFeePerGas: ethers.parseUnits("20", "gwei"),  // Adjust this as needed
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      });
      await txResponse.wait();
    console.log(`✅ Minted NFT for: ${recipient}, TokenURI: ${ipfsURI}`);
  }
  
  // Main function
  async function fetchAndMintPokemons(contractAddress, ownerAddress) {
    const helia = await createHeliaNode();
    const pokemons = await fetchPokemonData(5); // Fetch 5 Pokémon
  
    // Ethereum setup (Hardhat local node)
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const signer = await provider.getSigner();
    const nftContractAddress = contractAddress;
    const nftABI = ["function mintTo(address _to, string memory _uri) public"];
    const nftContract = new ethers.Contract(nftContractAddress, nftABI, signer);
  
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
      console.log(`📌 Uploaded to IPFS: ${ipfsURI}`);
  
      // Mint NFT
      await mintNFT(signer, nftContract, ownerAddress, ipfsURI);
    }
  
    console.log("✅ All Pokémon NFTs minted!");

    return;
  }
  
  fetchAndMintPokemons(contractAddress, ownerAddress).catch(console.error);