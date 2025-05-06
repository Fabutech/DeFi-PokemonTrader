

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract DutchAuctionMarketplace {
    ERC721 public nftContract;

    struct DutchAuction {
        address seller;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool isActive;
    }

    mapping(uint256 => DutchAuction) public dutchAuctions;

    event DutchAuctionStarted(uint256 indexed tokenId, address seller, uint256 startPrice, uint256 endPrice, uint256 endTime);
    event DutchAuctionEnded(uint256 indexed tokenId, address buyer, uint256 amount);

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    function startDutchAuction(
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration
    ) external onlyTokenOwner(tokenId) {
        require(
            nftContract.isApprovedForToken(tokenId, address(this)) ||
                nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT"
        );
        require(startPrice > endPrice, "Start price must be greater than end price");
        require(duration > 0, "Duration must be greater than zero");

        uint256 endTime = block.timestamp + duration;

        dutchAuctions[tokenId] = DutchAuction({
            seller: msg.sender,
            startPrice: startPrice,
            endPrice: endPrice,
            startTimestamp: block.timestamp,
            endTimestamp: endTime,
            isActive: true
        });

        emit DutchAuctionStarted(tokenId, msg.sender, startPrice, endPrice, endTime);
    }

    function buyFromDutchAuction(uint256 tokenId) external payable {
        DutchAuction storage auction = dutchAuctions[tokenId];
        require(auction.isActive, "Dutch auction not active");
        require(block.timestamp <= auction.endTimestamp, "Auction expired");

        uint256 elapsed = block.timestamp - auction.startTimestamp;
        uint256 duration = auction.endTimestamp - auction.startTimestamp;
        uint256 priceDiff = auction.startPrice - auction.endPrice;
        uint256 currentPrice = auction.startPrice - (priceDiff * elapsed / duration);
        if (block.timestamp >= auction.endTimestamp) {
            currentPrice = auction.endPrice;
        }

        require(msg.value >= currentPrice, "Insufficient funds");

        auction.isActive = false;

        nftContract.safeTransferFrom(auction.seller, msg.sender, tokenId);

        (bool sent, ) = payable(auction.seller).call{value: msg.value}("");
        require(sent, "Payment failed");

        emit DutchAuctionEnded(tokenId, msg.sender, msg.value);
    }

    function cancelDutchAuction(uint256 tokenId) external onlyTokenOwner(tokenId) {
        DutchAuction storage auction = dutchAuctions[tokenId];
        require(auction.isActive, "Dutch auction not active");
        auction.isActive = false;
    }

    function getCurrentDutchPrice(uint256 tokenId) public view returns (uint256) {
        DutchAuction memory auction = dutchAuctions[tokenId];
        require(auction.isActive, "Auction not active");

        if (block.timestamp >= auction.endTimestamp) {
            return auction.endPrice;
        }

        uint256 elapsed = block.timestamp - auction.startTimestamp;
        uint256 duration = auction.endTimestamp - auction.startTimestamp;
        uint256 priceDiff = auction.startPrice - auction.endPrice;

        return auction.startPrice - (priceDiff * elapsed / duration);
    }
}