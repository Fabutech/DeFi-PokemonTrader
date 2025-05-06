// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";
import "./AuctionMarketplace.sol";
import "./DutchAuctionMarketplace.sol";
import "./FixedPriceMarketplace.sol";
import "./OfferManager.sol";
import "./SealedBidAuctionMarketplace.sol";

contract TradingContract {
    ERC721 public nftContract;
    address public owner;

    AuctionMarketplace public auction;
    DutchAuctionMarketplace public dutchAuction;
    FixedPriceMarketplace public fixedPrice;
    OfferManager public offerManager;
    SealedBidAuctionMarketplace public sealedBidAuction;

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
        owner = msg.sender;
        auction = new AuctionMarketplace(_nftContract);
        dutchAuction = new DutchAuctionMarketplace(_nftContract);
        fixedPrice = new FixedPriceMarketplace(_nftContract);
        offerManager = new OfferManager(_nftContract);
        sealedBidAuction = new SealedBidAuctionMarketplace(_nftContract);
    }
}