// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract TradingContract {
    ERC721 public nftContract;
    address public owner;

    struct Listing {
        address seller;
        uint256 price;
        uint256 expiration;
        bool isActive;
    }

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool isActive;
    }

    // Mappings for sales and auctions
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    // NFT Events
    event NFTListed(uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address buyer, uint256 price);
    event NFTDelisted(uint256 indexed tokenId, address seller);

    // Auction Events
    event AuctionStarted(uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime);
    event NewBid(uint256 indexed tokenId, address bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount);
    event BidWithdrawn(uint256 indexed tokenId, address bidder, uint256 amount);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only marketplace owner can call this");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    modifier isListed(uint256 tokenId) {
        require(listings[tokenId].isActive, "NFT is not listed for sale");
        _;
    }

    modifier isAuctionActive(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction is not active");
        require(block.timestamp < auctions[tokenId].endTime, "Auction has ended");
        _;
    }

    modifier isAuctionEnded(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction is not active");
        require(block.timestamp >= auctions[tokenId].endTime, "Auction is still ongoing");
        _;
    }

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
        owner = msg.sender;
    }

    // ********************** FIXED-PRICE LISTING **********************

    function listNFT(uint256 tokenId, uint256 price, uint256 expiration) external onlyTokenOwner(tokenId) {
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");
        require(expiration > block.timestamp, "Expiration must be in the future");

        listings[tokenId] = Listing(msg.sender, price, expiration, true);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function buyNFT(uint256 tokenId) external payable isListed(tokenId) {
        Listing memory listedNFT = listings[tokenId];
        require(msg.value >= listedNFT.price, "Insufficient funds");
        require(block.timestamp <= listedNFT.expiration, "Listing has expired");

        // Pay the seller
        payable(listedNFT.seller).transfer(msg.value);

        // Transfer the NFT to buyer
        nftContract.safeTransferFrom(listedNFT.seller, msg.sender, tokenId);

        // Remove listing
        delete listings[tokenId];

        emit NFTSold(tokenId, msg.sender, msg.value);
    }

    function delistNFT(uint256 tokenId) external onlyTokenOwner(tokenId) isListed(tokenId) {
        delete listings[tokenId];
        emit NFTDelisted(tokenId, msg.sender);
    }

    // ********************** AUCTION SYSTEM **********************

    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 duration) external onlyTokenOwner(tokenId) {
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");

        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            isActive: true
        });

        emit AuctionStarted(tokenId, msg.sender, startingPrice, block.timestamp + duration);
    }

    function placeBid(uint256 tokenId) external payable isAuctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(msg.value > auction.highestBid, "Bid must be higher than current highest");

        // Refund previous highest bidder
        if (auction.highestBid > 0) {
            pendingReturns[tokenId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit NewBid(tokenId, msg.sender, msg.value);
    }

    function withdrawBid(uint256 tokenId) external {
        uint256 amount = pendingReturns[tokenId][msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[tokenId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit BidWithdrawn(tokenId, msg.sender, amount);
    }

    function finalizeAuction(uint256 tokenId) external isAuctionEnded(tokenId) {
        Auction storage auction = auctions[tokenId];
        require(auction.highestBidder != address(0), "No bids placed");

        // Transfer NFT to winner
        nftContract.safeTransferFrom(auction.seller, auction.highestBidder, tokenId);

        // Pay seller
        payable(auction.seller).transfer(auction.highestBid);

        // Remove auction
        delete auctions[tokenId];

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);
    }

    function cancelAuction(uint256 tokenId) external onlyTokenOwner(tokenId) isAuctionActive(tokenId) {
        Auction storage auction = auctions[tokenId];

        // Refund highest bidder
        if (auction.highestBid > 0) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        // Remove auction
        delete auctions[tokenId];

        emit NFTDelisted(tokenId, msg.sender);
    }

    function getAuctionDetails(uint256 tokenId) external view returns (Auction memory) {
        return auctions[tokenId];
    }
}