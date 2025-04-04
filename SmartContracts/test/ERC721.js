const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC721 Contract", function () {
    let ERC721, erc721, owner, addr1, addr2;

    beforeEach(async function () {
        // Deploy the contract
        ERC721 = await ethers.getContractFactory("ERC721");
        [owner, addr1, addr2] = await ethers.getSigners();
        erc721 = await ERC721.deploy("MyNFT", "MNFT");
        await erc721.waitForDeployment();
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




// Test Case                                   Description
// Deployment Test                             Verifies that the contract is deployed with the correct name and symbol.
// Minting NFT                                 Ensures only the owner can mint NFTs.
// Unauthorized Minting                        Checks that non-owners cannot mint.
// Token Transfers                             Allows transfers only by owners or approved accounts.
// Unauthorized Transfers                      Ensures unauthorized accounts cannot transfer NFTs.
// Token URI                                   Ensures correct token URI is returned.
// Balance Updates                             Confirms token balances update on transfers.
// Total Supply                                Verifies total supply tracking.
// Approval for All                            Tests batch approvals for NFT transfers.
// Approval Events                             Ensures the event is emitted correctly.
