const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contract with address:", deployer.address);

    const PokemonNFT = await hre.ethers.getContractFactory("ERC721");
    const nftContract = await PokemonNFT.deploy("PokemonNFT", "PKN");
    await nftContract.waitForDeployment();

    console.log("PokemonNFT deployed to:", await nftContract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});