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

    struct Offer {
        address offerer;
        uint256 amount;
        uint256 expiration;
    }

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool isActive;
    }

    // Mappings for sales and auctions
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;
    mapping(uint256 => mapping(address => Offer)) public offers;
    mapping(uint256 => address[]) public offerers;

    // NFT Events
    event NFTListed(uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event NFTDelisted(uint256 indexed tokenId, address seller);

    // Auction Events
    event AuctionStarted(uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime);
    event NewBid(uint256 indexed tokenId, address bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount);
    event BidWithdrawn(uint256 indexed tokenId, address bidder, uint256 amount);
    event OfferMade(uint256 indexed tokenId, address indexed offerer, uint256 amount, uint256 expiration);
    event OfferCancelled(uint256 indexed tokenId, address indexed offerer);
    event OfferAccepted(uint256 indexed tokenId, address indexed offerer, uint256 amount);

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
        _;
    }

    modifier isAuctionEnded(uint256 tokenId) {
        require(auctions[tokenId].isActive, "Auction is not active");
        require(block.timestamp >= auctions[tokenId].endTimestamp, "Auction is still ongoing");
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

        emit NFTSold(tokenId, listedNFT.seller, msg.sender, msg.value);
    }

    function delistNFT(uint256 tokenId) external onlyTokenOwner(tokenId) isListed(tokenId) {
        delete listings[tokenId];
        emit NFTDelisted(tokenId, msg.sender);
    }

    // ********************** AUCTION SYSTEM **********************

    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 endTimeStamp) external onlyTokenOwner(tokenId) {
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");

        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            startTimestamp: block.timestamp,
            endTimestamp: endTimeStamp,
            isActive: true
        });

        emit AuctionStarted(tokenId, msg.sender, startingPrice, endTimeStamp);
    }

    function placeBid(uint256 tokenId) external payable isAuctionActive(tokenId) {
        require(block.timestamp < auctions[tokenId].endTimestamp, "Auction has ended");

        Auction storage auction = auctions[tokenId];
        require(msg.value >= auction.startingPrice, "Bid must be higher or equal than current highest");
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

        uint256 reward = auction.highestBid / 100; // 1% reward
        uint256 payout = auction.highestBid - reward;

        // Transfer NFT to winner
        nftContract.safeTransferFrom(auction.seller, auction.highestBidder, tokenId);

        // Pay seller minus reward
        payable(auction.seller).transfer(payout);

        // Pay finalizer reward
        payable(msg.sender).transfer(reward);

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);

        // Remove auction
        delete auctions[tokenId];
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

    function makeOffer(uint256 tokenId, uint256 expiration) external payable {
        require(msg.value > 0, "Offer amount must be greater than zero");
        require(expiration > block.timestamp, "Expiration must be in the future");

        Offer storage existingOffer = offers[tokenId][msg.sender];
        require(existingOffer.amount == 0, "You already have an active offer");

        offers[tokenId][msg.sender] = Offer({
            offerer: msg.sender,
            amount: msg.value,
            expiration: expiration
        });

        offerers[tokenId].push(msg.sender); // Track who made an offer

        emit OfferMade(tokenId, msg.sender, msg.value, expiration);
    }

    function cancelOffer(uint256 tokenId) external {
        Offer memory offer = offers[tokenId][msg.sender];
        require(offer.amount > 0, "No offer to cancel");

        uint256 refundAmount = offer.amount;
        delete offers[tokenId][msg.sender];

        // Remove offerer from the list
        address[] storage addrs = offerers[tokenId];
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == msg.sender) {
                addrs[i] = addrs[addrs.length - 1];
                addrs.pop();
                break;
            }
        }

        payable(msg.sender).transfer(refundAmount);
        emit OfferCancelled(tokenId, msg.sender);
    }

    function acceptOffer(uint256 tokenId, address offerer) external onlyTokenOwner(tokenId) {
        Offer memory offer = offers[tokenId][offerer];
        require(offer.amount > 0, "No valid offer");
        require(block.timestamp <= offer.expiration, "Offer expired");

        delete offers[tokenId][offerer];

        // Pay the seller
        payable(msg.sender).transfer(offer.amount);

        // Transfer the NFT to buyer
        nftContract.safeTransferFrom(msg.sender, offerer, tokenId);

        // Remove listing
        delete listings[tokenId];

        emit OfferAccepted(tokenId, offerer, offer.amount);
    }

    function getOffers(uint256 tokenId) external view returns (Offer[] memory) {
        address[] memory addrs = offerers[tokenId];
        uint256 count = addrs.length;

        Offer[] memory result = new Offer[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = offers[tokenId][addrs[i]];
        }
        return result;
    }

    function hasPendingReturns(uint256 tokenId, address user) external view returns (bool) {
        return pendingReturns[tokenId][user] > 0;
    }
}