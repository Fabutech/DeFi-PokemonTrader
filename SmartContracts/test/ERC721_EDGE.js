const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC721 Contract Edge Cases", function () {
    let ERC721, erc721, owner, addr1, addr2, addr3;

    beforeEach(async function () {
        // Deploy the contract
        ERC721 = await ethers.getContractFactory("ERC721");
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        erc721 = await ERC721.deploy("MyNFT", "MNFT");
        await erc721.waitForDeployment();
    });

    it("Should revert minting to zero address", async function () {
        await expect(
            erc721.mintTo(ethers.ZeroAddress, "ipfs://tokenURI")
        ).to.be.revertedWith("ERC721: Invalid address");
    });

    it("Should revert when querying balance of zero address", async function () {
        await expect(
            erc721.balanceOf(ethers.ZeroAddress)
        ).to.be.revertedWith("ERC721: Invalid address");
    });

    it("Should revert transferring non-existent token", async function () {
        await expect(
            erc721.transferFrom(owner.address, addr1.address, 999)
        ).to.be.revertedWith("ERC721: Token does not exist");
    });

    it("Should revert transferring token without ownership or approval", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        await expect(
            erc721.connect(addr1).transferFrom(owner.address, addr2.address, 0)
        ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should allow transferring a token multiple times", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        await erc721.transferFrom(owner.address, addr1.address, 0);
        await erc721.transferFrom(addr1.address, addr2.address, 0);
        expect(await erc721.ownerOf(0)).to.equal(addr2.address);
    });

    it("Should revert if tokenURI is queried for non-existent token", async function () {
        await expect(erc721.tokenURI(999)).to.be.revertedWith("ERC721: Token does not exist");
    });

    it("Should revert when approving a token that does not exist", async function () {
        await expect(
            erc721.approve(addr1.address, 999)
        ).to.be.revertedWith("ERC721: Token does not exist");
    });

    it("Should allow renouncing ownership", async function () {
        await erc721.renounceOwnership();
        expect(await erc721.owner()).to.equal(ethers.ZeroAddress);
    });

    it("Should revert if non-owner tries to renounce ownership", async function () {
        await expect(
            erc721.connect(addr1).renounceOwnership()
        ).to.be.revertedWith("ERC721: Only contract owner");
    });

    it("Should deploy with correct name and symbol", async function () {
        expect(await erc721.name()).to.equal("MyNFT");
        expect(await erc721.symbol()).to.equal("MNFT");
    });

    it("Should allow only the owner to mint NFTs", async function () {
        await expect(erc721.mintTo(addr1.address, "ipfs://tokenURI"))
            .to.emit(erc721, "Transfer")
            .withArgs(ethers.ZeroAddress, addr1.address, 0);

        expect(await erc721.balanceOf(addr1.address)).to.equal(1);
        expect(await erc721.ownerOf(0)).to.equal(addr1.address);
    });

    it("Should not allow non-owner to mint NFTs", async function () {
        await expect(
            erc721.connect(addr1).mintTo(addr1.address, "ipfs://tokenURI")
        ).to.be.revertedWith("ERC721: Only contract owner");
    });

    it("Should allow approved accounts to transfer NFTs", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        await erc721.approve(addr1.address, 0);
        expect(await erc721.getApproved(0)).to.equal(addr1.address);

        await expect(erc721.connect(addr1).transferFrom(owner.address, addr2.address, 0))
            .to.emit(erc721, "Transfer")
            .withArgs(owner.address, addr2.address, 0);

        expect(await erc721.ownerOf(0)).to.equal(addr2.address);
    });

    it("Should not allow unauthorized transfers", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        await expect(
            erc721.connect(addr1).transferFrom(owner.address, addr2.address, 0)
        ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should return correct token URI", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        expect(await erc721.tokenURI(0)).to.equal("ipfs://tokenURI");
    });

    it("Should correctly update balances on transfers", async function () {
        await erc721.mintTo(owner.address, "ipfs://tokenURI");
        expect(await erc721.balanceOf(owner.address)).to.equal(1);

        await erc721.transferFrom(owner.address, addr1.address, 0);
        expect(await erc721.balanceOf(owner.address)).to.equal(0);
        expect(await erc721.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should correctly track total supply", async function () {
        expect(await erc721.totalSupply()).to.equal(0);

        await erc721.mintTo(owner.address, "ipfs://tokenURI1");
        await erc721.mintTo(owner.address, "ipfs://tokenURI2");

        expect(await erc721.totalSupply()).to.equal(2);
    });

    it("Should allow setting and checking approval for all", async function () {
        await erc721.setApprovalForAll(addr1.address, true);
        expect(await erc721.isApprovedForAll(owner.address, addr1.address)).to.equal(true);
    });

    it("Should emit ApprovalForAll event", async function () {
        await expect(erc721.setApprovalForAll(addr1.address, true))
            .to.emit(erc721, "ApprovalForAll")
            .withArgs(owner.address, addr1.address, true);
    });
});