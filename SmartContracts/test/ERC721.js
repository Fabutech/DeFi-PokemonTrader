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
        it("should revert on safeTransfer to non-receiver contract", async function () {
            const NonReceiver = await ethers.getContractFactory("ERC721");
            const nonReceiver = await NonReceiver.deploy("Fake", "FAKE");
            await nonReceiver.waitForDeployment();

            await erc721.mintTo(owner.address, "ipfs://token11");
            await expect(
                erc721["safeTransferFrom(address,address,uint256)"](owner.address, nonReceiver.target, 0)
            ).to.be.revertedWith("!ERC721Implementer");
        });
    });


    describe("ERC721 Basic Functionality", function () {
        it("should have correct name and symbol", async function () {
            expect(await erc721.name()).to.equal("MyNFT");
            expect(await erc721.symbol()).to.equal("MNFT");
        });

        it("should mint a token and assign to owner", async function () {
            await erc721.mintTo(addr1.address, "ipfs://token1");
            expect(await erc721.ownerOf(0)).to.equal(addr1.address);
            expect(await erc721.balanceOf(addr1.address)).to.equal(1);
        });

        it("should return correct token URI", async function () {
            await erc721.mintTo(addr1.address, "ipfs://token2");
            expect(await erc721.tokenURI(0)).to.equal("ipfs://token2");
        });

        it("should not allow minting from non-owner", async function () {
            await expect(erc721.connect(addr1).mintTo(addr2.address, "ipfs://token3"))
                .to.be.revertedWith("ERC721: Only contract owner");
        });

        it("should batch mint tokens correctly", async function () {
            const uris = ["ipfs://1", "ipfs://2", "ipfs://3"];
            await erc721.batchMint(addr1.address, uris);
            for (let i = 0; i < uris.length; i++) {
                expect(await erc721.ownerOf(i)).to.equal(addr1.address);
                expect(await erc721.tokenURI(i)).to.equal(uris[i]);
            }
            expect(await erc721.balanceOf(addr1.address)).to.equal(uris.length);
        });

        it("should transfer tokens safely", async function () {
            await erc721.mintTo(owner.address, "ipfs://token4");
            await erc721["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 0);
            expect(await erc721.ownerOf(0)).to.equal(addr1.address);
        });

        it("should approve and transferFrom correctly", async function () {
            await erc721.mintTo(owner.address, "ipfs://token5");
            await erc721.approve(addr1.address, 0);
            expect(await erc721.getApproved(0)).to.equal(addr1.address);

            await erc721.connect(addr1).transferFrom(owner.address, addr2.address, 0);
            expect(await erc721.ownerOf(0)).to.equal(addr2.address);
        });

        it("should set approval for all and check it", async function () {
            await erc721.setApprovalForAll(addr1.address, true);
            expect(await erc721.isApprovedForAll(owner.address, addr1.address)).to.equal(true);
        });

        it("should not allow self-approval", async function () {
            await erc721.mintTo(owner.address, "ipfs://token6");
            await expect(erc721.approve(owner.address, 0))
                .to.be.revertedWith("ERC721: cannot approve self");
        });

        it("should reject transferring non-existent tokens", async function () {
            await expect(erc721.transferFrom(owner.address, addr1.address, 99))
                .to.be.revertedWith("ERC721: Token does not exist");
        });

        it("should reject non-approved transfer attempts", async function () {
            await erc721.mintTo(addr1.address, "ipfs://token7");
            await expect(erc721.connect(addr2).transferFrom(addr1.address, addr2.address, 0))
                .to.be.revertedWith("ERC721: caller is not owner nor approved");
        });

        it("should return correct total supply", async function () {
            expect(await erc721.totalSupply()).to.equal(0);
            await erc721.mintTo(owner.address, "ipfs://token8");
            expect(await erc721.totalSupply()).to.equal(1);
        });

        it("should reject minting to the zero address", async function () {
            await expect(erc721.mintTo('0x0000000000000000000000000000000000000000', "ipfs://invalid"))
                .to.be.revertedWith("ERC721: Invalid address");
        });

        it("should reject batch minting with zero URIs", async function () {
            await expect(erc721.batchMint(addr1.address, []))
                .to.be.revertedWith("ERC721: Must provide at least one URI");
        });

        it("should emit Approval and ApprovalForAll events", async function () {
            await erc721.mintTo(owner.address, "ipfs://token9");

            await expect(erc721.approve(addr1.address, 0))
                .to.emit(erc721, "Approval").withArgs(owner.address, addr1.address, 0);

            await expect(erc721.setApprovalForAll(addr1.address, true))
                .to.emit(erc721, "ApprovalForAll").withArgs(owner.address, addr1.address, true);
        });

        it("should emit Transfer event on transferFrom", async function () {
            await erc721.mintTo(owner.address, "ipfs://token10");

            await erc721.approve(addr1.address, 0);
            await expect(erc721.connect(addr1).transferFrom(owner.address, addr2.address, 0))
                .to.emit(erc721, "Transfer").withArgs(owner.address, addr2.address, 0);
        });

        it("should support ERC721 and ERC721Metadata interfaces", async function () {
            expect(await erc721.supportsInterface("0x80ac58cd")).to.equal(true); // ERC721
            expect(await erc721.supportsInterface("0x5b5e139f")).to.equal(true); // ERC721Metadata
            expect(await erc721.supportsInterface("0x00000000")).to.equal(false); // Random interface
        });

        it("should revert on safeTransfer to non-receiver contract", async function () {
            const NonReceiver = await ethers.getContractFactory("ERC721");
            const nonReceiver = await NonReceiver.deploy("Fake", "FAKE");
            await nonReceiver.waitForDeployment();

            await erc721.mintTo(owner.address, "ipfs://token11");
            await expect(
                erc721["safeTransferFrom(address,address,uint256)"](owner.address, nonReceiver.target, 0)
            ).to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer");
        });
    });
});




// Test Case                                                      Description
// should have correct name and symbol                            Checks initial name and symbol
// should mint a token and assign to owner                        Verifies minting and owner assignment
// should return correct token URI                                Ensures tokenURI returns expected URI
// should not allow minting from non-owner                        Restricts minting access to contract owner
// should batch mint tokens correctly                             Validates batch minting and URIs
// should transfer tokens safely                                  Tests safeTransferFrom with checks
// should approve and transferFrom correctly                      Checks approval and transferFrom behavior
// should set approval for all and check it                       Validates setApprovalForAll and status check
// should not allow self-approval                                 Prevents approving self as operator
// should reject transferring non-existent tokens                 Reverts on transfer of invalid tokenId
// should reject non-approved transfer attempts                   Prevents unauthorized transfers
// should return correct total supply                             Verifies total minted tokens count
// should reject minting to the zero address                      Validates address zero rejection
// should reject batch minting with zero URIs                     Prevents empty batch minting
// should emit Approval and ApprovalForAll events                 Ensures correct events are emitted on approval
// should emit Transfer event on transferFrom                     Validates Transfer event on action
// should support ERC721 and ERC721Metadata interfaces            Interface compliance check
// should revert on safeTransfer to non-receiver contract         Handles transfer to invalid ERC721Receiver
