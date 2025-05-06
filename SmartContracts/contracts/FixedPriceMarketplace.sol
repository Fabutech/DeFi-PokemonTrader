

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract FixedPriceMarketplace {
    ERC721 public nftContract;

    struct Listing {
        address seller;
        uint256 price;
        uint256 expiration;
        bool isActive;
    }

    mapping(uint256 => Listing) public listings;

    event NFTListed(uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event NFTDelisted(uint256 indexed tokenId, address seller);

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    modifier isListed(uint256 tokenId) {
        require(listings[tokenId].isActive, "NFT is not listed for sale");
        _;
    }

    function listNFT(uint256 tokenId, uint256 price, uint256 expiration) external onlyTokenOwner(tokenId) {
        require(
            nftContract.isApprovedForToken(tokenId, address(this)) ||
            nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT"
        );
        require(expiration > block.timestamp, "Expiration must be in the future");

        listings[tokenId] = Listing(msg.sender, price, expiration, true);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function buyNFT(uint256 tokenId) external payable isListed(tokenId) {
        Listing memory listedNFT = listings[tokenId];
        require(msg.value >= listedNFT.price, "Insufficient funds");
        require(block.timestamp <= listedNFT.expiration, "Listing has expired");

        (bool sent, ) = payable(listedNFT.seller).call{value: msg.value}("");
        require(sent, "Payment failed");

        nftContract.safeTransferFrom(listedNFT.seller, msg.sender, tokenId);

        delete listings[tokenId];

        emit NFTSold(tokenId, listedNFT.seller, msg.sender, msg.value);
    }

    function delistNFT(uint256 tokenId) external onlyTokenOwner(tokenId) isListed(tokenId) {
        delete listings[tokenId];
        emit NFTDelisted(tokenId, msg.sender);
    }
}