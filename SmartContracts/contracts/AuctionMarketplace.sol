// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract AuctionMarketplace {
    ERC721 public nftContract;

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTimestamp;
        uint256 startTimestamp;
        bool isActive;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    event AuctionStarted(uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime);
    event NewBid(uint256 indexed tokenId, address bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount);
    event BidWithdrawn(uint256 indexed tokenId, address bidder, uint256 amount);

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    modifier isAuctionActive(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction is not active");
        _;
    }

    modifier isAuctionEnded(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction is not active");
        require(block.timestamp >= auctions[tokenId].endTimestamp, "Auction is still ongoing");
        _;
    }

    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 endTimeStamp) external onlyTokenOwner(tokenId) {
        require(nftContract.isApprovedForToken(tokenId, address(this)) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");

        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTimestamp: endTimeStamp,
            startTimestamp: block.timestamp,
            isActive: true
        });

        emit AuctionStarted(tokenId, msg.sender, startingPrice, endTimeStamp);
    }

    function placeBid(uint256 tokenId) external payable isAuctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTimestamp, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        if (auction.highestBid > 0) {
            pendingReturns[tokenId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        // Extend if within last 2 minutes
        if (auction.endTimestamp - block.timestamp <= 2 minutes) {
            auction.endTimestamp += 2 minutes;
        }

        emit NewBid(tokenId, msg.sender, msg.value);
    }

    function withdrawBid(uint256 tokenId) external {
        uint256 amount = pendingReturns[tokenId][msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[tokenId][msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");

        emit BidWithdrawn(tokenId, msg.sender, amount);
    }

    function finalizeAuction(uint256 tokenId) external isAuctionEnded(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(auction.highestBidder != address(0), "No bids placed");

        uint256 reward = auction.highestBid / 100;
        uint256 payout = auction.highestBid - reward;

        nftContract.safeTransferFrom(auction.seller, auction.highestBidder, tokenId);

        (bool sentToSeller, ) = payable(auction.seller).call{value: payout}("");
        require(sentToSeller, "Seller payment failed");

        (bool sentToFinalizer, ) = payable(msg.sender).call{value: reward}("");
        require(sentToFinalizer, "Finalizer reward failed");

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);

        delete auctions[tokenId];
    }

    function cancelAuction(uint256 tokenId) external onlyTokenOwner(tokenId) isAuctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];

        if (auction.highestBid > 0) {
            (bool refunded, ) = payable(auction.highestBidder).call{value: auction.highestBid}("");
            require(refunded, "Refund failed");
        }

        delete auctions[tokenId];
    }

    function hasPendingReturns(uint256 tokenId, address user) external view returns (bool) {
        return pendingReturns[tokenId][user] > 0;
    }
}