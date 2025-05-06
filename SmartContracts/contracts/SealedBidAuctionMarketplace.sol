// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract SealedBidAuctionMarketplace {
    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 endRevealTimestamp;
        bool isActive;
    }

    ERC721 public nftContract;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => bytes32)) public bidCommits;
    mapping(uint256 => mapping(address => uint256)) public revealedBids;
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
        require(auctions[tokenId].isActive, "Auction not active");
        _;
    }

    modifier isAuctionEnded(uint256 tokenId) {
        require(block.timestamp > auctions[tokenId].endRevealTimestamp, "Reveal phase not over yet");
        _;
    }

    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 endTimestamp) external onlyTokenOwner(tokenId) {
        require(!auctions[tokenId].isActive, "Auction already active");
        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            startTimestamp: block.timestamp,
            endTimestamp: endTimestamp,
            endRevealTimestamp: endTimestamp + 180, // 3 minutes for reveal phase   
            isActive: true
        });
        emit AuctionStarted(tokenId, msg.sender, startingPrice, endTimestamp);
    }

    function commitBid(uint256 tokenId, bytes32 bidHash) external isAuctionActive(tokenId) {
        require(block.timestamp < auctions[tokenId].endTimestamp, "Commit phase ended");
        bidCommits[tokenId][msg.sender] = bidHash;
    }

    function revealBid(uint256 tokenId, uint256 bidAmount, string calldata secret) external payable isAuctionActive(tokenId) {
        require(block.timestamp >= auctions[tokenId].endTimestamp, "Reveal phase not started");
        require(block.timestamp <= auctions[tokenId].endRevealTimestamp, "Reveal phase ended");
        require(bidCommits[tokenId][msg.sender] != bytes32(0), "No bid committed");
        require(msg.value == bidAmount, "ETH sent mismatch with bid");

        bytes32 hash = keccak256(abi.encodePacked(bidAmount, secret, tokenId));
        require(hash == bidCommits[tokenId][msg.sender], "Invalid reveal");

        revealedBids[tokenId][msg.sender] = bidAmount;

        Auction storage auction = auctions[tokenId];
        require(bidAmount >= auction.startingPrice, "Bid must be >= starting price");

        if (bidAmount > auction.highestBid) {
            if (auction.highestBid > 0) {
                // Refund previous highest bidder
                pendingReturns[tokenId][auction.highestBidder] += auction.highestBid;
            }
            auction.highestBid = bidAmount;
            auction.highestBidder = msg.sender;
            emit NewBid(tokenId, msg.sender, bidAmount);
        } else {
            // Not a winning bid, refund
            pendingReturns[tokenId][msg.sender] += bidAmount;
        }
    }

    function finalizeAuction(uint256 tokenId) external isAuctionEnded(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(auction.highestBidder != address(0), "No bids placed");

        auction.isActive = false;

        nftContract.safeTransferFrom(auction.seller, auction.highestBidder, tokenId);
        (bool sent, ) = payable(auction.seller).call{value: auction.highestBid}("");
        require(sent, "Payment failed");

        delete auctions[tokenId];

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);
    }

    function withdrawBid(uint256 tokenId) external {
        uint256 amount = pendingReturns[tokenId][msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[tokenId][msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");

        emit BidWithdrawn(tokenId, msg.sender, amount);
    }

    function cancelAuction(uint256 tokenId) external onlyTokenOwner(tokenId) isAuctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTimestamp || auction.highestBid == 0, "Cannot cancel after bidding has ended with bids");

        // Refund the current highest bid if any
        if (auction.highestBid > 0) {
            pendingReturns[tokenId][auction.highestBidder] += auction.highestBid;
        }

        auction.isActive = false;

        delete auctions[tokenId];

        emit AuctionEnded(tokenId, address(0), 0);
    }

    function hasPendingReturns(uint256 tokenId, address user) external view returns (bool) {
        return pendingReturns[tokenId][user] > 0;
    }
}