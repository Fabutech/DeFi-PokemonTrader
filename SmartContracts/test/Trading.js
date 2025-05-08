


const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TradingContract", function () {
    let owner, seller, buyer, bidder, other;
    let nft, trading;
    const tokenId = 0;

    beforeEach(async function () {
        [owner, seller, buyer, bidder, other] = await ethers.getSigners();

        const NFT = await ethers.getContractFactory("ERC721");
        nft = await NFT.deploy("TestNFT", "TNFT");

        const Trading = await ethers.getContractFactory("TradingContract");
        trading = await Trading.deploy(nft.target);

        await nft.mintTo(seller.address, "ipfs://token");
        await nft.connect(seller).setApprovalForAll(trading.target, true);
    });

    describe("Fixed-price listings", function () {
        it("should list and buy an NFT", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await expect(() =>
                trading.connect(buyer).buyNFT(tokenId, { value: ethers.parseEther("1") })
            ).to.changeEtherBalances([buyer, seller], [-ethers.parseEther("1"), ethers.parseEther("1")]);

            expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
        });

        it("should reject buying with insufficient funds", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await expect(
                trading.connect(buyer).buyNFT(tokenId, { value: ethers.parseEther("0.5") })
            ).to.be.revertedWith("Insufficient funds");
        });

        it("should allow seller to delist", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await trading.connect(seller).delistNFT(tokenId);
            const listing = await trading.listings(tokenId);
            expect(listing.isActive).to.be.false;
        });

        it("should reject listing with past expiration", async function () {
            const past = Math.floor(Date.now() / 1000) - 100;
            await expect(
                trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), past)
            ).to.be.revertedWith("Expiration must be in the future");
        });

        it("should reject listing if already in auction", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 100;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);

            await expect(
                trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000)
            ).to.be.revertedWith("Cannot list during an active auction");
        });

        it("should reject delisting by non-owner", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await expect(
                trading.connect(buyer).delistNFT(tokenId)
            ).to.be.revertedWith("Not token owner");
        });

        it("should not allow buying unlisted NFT", async function () {
            await expect(
                trading.connect(buyer).buyNFT(tokenId, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("NFT is not listed for sale");
        });

        it("should not allow listing from non-owner", async function () {
            await expect(
                trading.connect(buyer).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000)
            ).to.be.revertedWith("Not token owner");
        });
    });

    describe("Auctions", function () {
        it("should start and bid on auction", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 300;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);

            await trading.connect(bidder).placeBid(tokenId, { value: ethers.parseEther("1.5") });
            const auction = await trading.auctions(tokenId);
            expect(auction.highestBidder).to.equal(bidder.address);
            expect(auction.highestBid).to.equal(ethers.parseEther("1.5"));
        });

        it("should reject low bid", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 300;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);
            await trading.connect(bidder).placeBid(tokenId, { value: ethers.parseEther("1.5") });

            await expect(
                trading.connect(other).placeBid(tokenId, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("Bid too low");
        });

        it("should allow bid withdrawal", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 300;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);
            await trading.connect(bidder).placeBid(tokenId, { value: ethers.parseEther("1.5") });

            // Overbid to enable withdrawal
            await trading.connect(other).placeBid(tokenId, { value: ethers.parseEther("2") });

            await expect(() =>
                trading.connect(bidder).withdrawBid(tokenId)
            ).to.changeEtherBalance(bidder, ethers.parseEther("1.5"));
        });

        it("should reject auction start if already listed", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await expect(
                trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), Date.now() + 2000)
            ).to.be.revertedWith("Cannot start auction: NFT is listed or in Dutch auction");
        });

        it("should reject auction if not approved", async function () {
            await nft.connect(seller).setApprovalForAll(trading.target, false);
            await expect(
                trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), Date.now() + 300)
            ).to.be.revertedWith("Marketplace not approved to manage this NFT");
        });

        it("should reject placing a bid after auction ends", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 5;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);

            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");

            await expect(
                trading.connect(bidder).placeBid(tokenId, { value: ethers.parseEther("2") })
            ).to.be.revertedWith("Auction ended");
        });

        it("should not finalize auction with no bids", async function () {
            const endTime = Math.floor(Date.now() / 1000) + 5;
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), endTime);

            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");

            await expect(
                trading.connect(other).finalizeAuction(tokenId)
            ).to.be.revertedWith("No bids placed");
        });

        it("should cancel auction and refund bidder", async function () {
            await trading.connect(seller).startAuction(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await trading.connect(bidder).placeBid(tokenId, { value: ethers.parseEther("1.5") });

            const before = await ethers.provider.getBalance(bidder.address);
            const tx = await trading.connect(seller).cancelAuction(tokenId);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const after = await ethers.provider.getBalance(bidder.address);

            expect(after).to.be.closeTo(before + ethers.parseEther("1.5") - gasUsed, ethers.parseEther("0.01"));
        });
    });

    describe("Offers", function () {
        it("should allow making and accepting an offer", async function () {
            await trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") });
            
            const before = await ethers.provider.getBalance(seller.address);
            const tx = await trading.connect(seller).acceptOffer(tokenId, buyer.address);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const after = await ethers.provider.getBalance(seller.address);

            expect(after).to.be.closeTo(before + ethers.parseEther("1") - gasUsed, ethers.parseEther("0.01"));

            expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
        });

        it("should allow cancelling offer", async function () {
            await trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") });
            await expect(() =>
                trading.connect(buyer).cancelOffer(tokenId)
            ).to.changeEtherBalance(buyer, ethers.parseEther("1"));
        });

        it("should reject making an offer with zero value", async function () {
            await expect(
                trading.connect(buyer).makeOffer(tokenId, Date.now() + 1000, { value: 0 })
            ).to.be.revertedWith("Offer amount must be greater than zero");
        });

        it("should reject making an offer with past expiration", async function () {
            const pastExpiration = Math.floor(Date.now() / 1000) - 60;
            await expect(
                trading.connect(buyer).makeOffer(tokenId, pastExpiration, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("Expiration must be in the future");
        });

        it("should reject making multiple active offers by the same user", async function () {
            await trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") });

            await expect(
                trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("You already have an active offer");
        });

        it("should reject cancelling nonexistent offer", async function () {
            await expect(
                trading.connect(buyer).cancelOffer(tokenId)
            ).to.be.revertedWith("No offer to cancel");
        });

        it("should clear all offers on accept", async function () {
            await trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") });
            await trading.connect(other).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("2") });

            await trading.connect(seller).acceptOffer(tokenId, buyer.address);

            const offers = await trading.getOffers(tokenId);
            expect(offers.length).to.equal(0);
        });

        it("should refund offer on cancel", async function () {
            await trading.connect(buyer).makeOffer(tokenId, Date.now() + 100000, { value: ethers.parseEther("1") });

            const before = await ethers.provider.getBalance(buyer.address);
            const tx = await trading.connect(buyer).cancelOffer(tokenId);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const after = await ethers.provider.getBalance(buyer.address);

            expect(after).to.be.closeTo(before + ethers.parseEther("1") - gasUsed, ethers.parseEther("0.01"));
        });
    });
    describe("Dutch Auctions", function () {
        it("should start and buy from Dutch auction", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600);

            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");

            const block = await ethers.provider.getBlock("latest");
            const ts = block.timestamp;

            const beforeSeller = await ethers.provider.getBalance(seller.address);
            const beforeBuyer = await ethers.provider.getBalance(buyer.address);

            const tx = await trading.connect(buyer).buyFromDutchAuction(tokenId, ts, { value: ethers.parseEther("2") });
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const afterSeller = await ethers.provider.getBalance(seller.address);
            const afterBuyer = await ethers.provider.getBalance(buyer.address);

            expect(afterSeller).to.be.closeTo(beforeSeller + ethers.parseEther("2"), ethers.parseEther("0.1"));
            expect(afterBuyer).to.be.closeTo(beforeBuyer - ethers.parseEther("2") - gasUsed, ethers.parseEther("0.1"));

            expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
        });

        it("should reject Dutch auction buy with insufficient funds", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600);
            
            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");

            const block = await ethers.provider.getBlock("latest");
            const ts = block.timestamp;

            await expect(
                trading.connect(buyer).buyFromDutchAuction(tokenId, ts, { value: ethers.parseEther("0.5") })
            ).to.be.revertedWith("Insufficient funds");
        });

        it("should allow seller to cancel Dutch auction", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600);
            await trading.connect(seller).cancelDutchAuction(tokenId);
            const auction = await trading.dutchAuctions(tokenId);
            expect(auction.isActive).to.be.false;
        });

        it("should reject Dutch auction with start price <= end price", async function () {
            await expect(
                trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("1"), ethers.parseEther("1"), 3600)
            ).to.be.revertedWith("Start price must be greater than end price");
        });

        it("should reject Dutch auction with zero duration", async function () {
            await expect(
                trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 0)
            ).to.be.revertedWith("Duration must be greater than zero");
        });

        it("should reject buying from expired Dutch auction", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 1);
            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");

            const block = await ethers.provider.getBlock("latest");
            const ts = block.timestamp;

            await expect(
                trading.connect(buyer).buyFromDutchAuction(tokenId, ts, { value: ethers.parseEther("2") })
            ).to.be.revertedWith("Auction expired");
        });

        it("should not start Dutch auction if already listed", async function () {
            await trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000);
            await expect(
                trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600)
            ).to.be.revertedWith("Cannot start Dutch auction: NFT is listed or in regular auction");
        });

        it("should not cancel Dutch auction if not owner", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600);
            await expect(
                trading.connect(buyer).cancelDutchAuction(tokenId)
            ).to.be.revertedWith("Not token owner");
        });

        it("should reject buy with client timestamp too far ahead", async function () {
            await trading.connect(seller).startDutchAuction(tokenId, ethers.parseEther("2"), ethers.parseEther("1"), 3600);
            
            await ethers.provider.send("evm_increaseTime", [10]);
            await ethers.provider.send("evm_mine");
            const block = await ethers.provider.getBlock("latest");
            const ts = block.timestamp;

            const now = Math.floor(ts + 120);
            await expect(
                trading.connect(buyer).buyFromDutchAuction(tokenId, now, { value: ethers.parseEther("2") })
            ).to.be.revertedWith("Timestamp too far in the future");
        });
    });

    describe("Admin Controls", function () {
        it("should pause and unpause the contract", async function () {
            await trading.pause();
            await expect(
                trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000)
            ).to.be.reverted;

            await trading.unpause();
            await expect(
                trading.connect(seller).listNFT(tokenId, ethers.parseEther("1"), Date.now() + 1000)
            ).to.not.be.reverted;
        });
    });
});

// Test Case                                           Description
// should list and buy an NFT                         Tests fixed-price listing and purchase
// should reject buying with insufficient funds       Prevents underpayment on purchase
// should allow seller to delist                      Allows sellers to remove their listings
// should start and bid on auction                    Validates auction setup and bidding
// should reject low bid                              Prevents invalid low bids
// should allow bid withdrawal                        Ensures bidders can withdraw overbids
// should allow making and accepting an offer         Tests offer-making and acceptance
// should allow cancelling offer                      Enables buyers to cancel offers
// should reject accepting an expired offer             Prevents sellers from accepting expired offers
// should reject making an offer with zero value        Ensures non-zero ETH for offers
// should reject making an offer with past expiration     Validates that offer expiration must be in future
// should reject making multiple active offers...       Avoids duplicate active offers from same user
// should start and buy from Dutch auction            Covers Dutch auction setup and purchase
// should reject Dutch auction buy with...            Ensures buy fails if funds are too low
// should allow seller to cancel Dutch auction        Allows cancellation of active Dutch auction
// should pause and unpause the contract              Tests administrative pause/unpause