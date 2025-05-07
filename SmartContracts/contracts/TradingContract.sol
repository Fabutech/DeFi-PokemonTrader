// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract TradingContract is ReentrancyGuard, Pausable, Ownable {
    ERC721 public nftContract;

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

    struct DutchAuction {
        address seller;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool isActive;
    }


    // Mappings for sales and auctions
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => DutchAuction) public dutchAuctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;
    mapping(uint256 => mapping(address => Offer)) public offers;
    mapping(uint256 => address[]) public offerers;


    // Listing Events
    event NFTListed(uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event NFTDelisted(uint256 indexed tokenId, address seller);

    // Auction Events
    event AuctionStarted(uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime);
    event NewBid(uint256 indexed tokenId, address bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount);
    event BidWithdrawn(uint256 indexed tokenId, address bidder, uint256 amount);
    
    // Dutch-Auction Events
    event DutchAuctionStarted(uint256 indexed tokenId, address seller, uint256 startPrice, uint256 endPrice, uint256 endTime);
    event DutchAuctionEnded(uint256 indexed tokenId, address buyer, uint256 amount);

    // Offer Events
    event OfferMade(uint256 indexed tokenId, address indexed offerer, uint256 amount, uint256 expiration);
    event OfferCancelled(uint256 indexed tokenId, address indexed offerer);
    event OfferAccepted(uint256 indexed tokenId, address indexed offerer, uint256 amount);


    // ********************** MODIFIERS **********************

    // Ensures the caller is the owner of the given tokenId
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

    constructor(address _nftContract) Ownable(msg.sender) {
        nftContract = ERC721(_nftContract);
    }


    // ********************** FIXED-PRICE LISTING **********************

    function listNFT(uint256 tokenId, uint256 price, uint256 expiration) external onlyTokenOwner(tokenId) nonReentrant whenNotPaused {
        // Check if marketplace is approved to transfer NFT on behalf of owner
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");
        require(expiration > block.timestamp, "Expiration must be in the future");
        require(!auctions[tokenId].isActive && !dutchAuctions[tokenId].isActive, "Cannot list during an active auction");

        listings[tokenId] = Listing(msg.sender, price, expiration, true);
        emit NFTListed(tokenId, msg.sender, price);
    }

    function buyNFT(uint256 tokenId) external payable isListed(tokenId) nonReentrant whenNotPaused {
        Listing memory listedNFT = listings[tokenId];
        require(msg.value >= listedNFT.price, "Insufficient funds");
        require(block.timestamp <= listedNFT.expiration, "Listing has expired");

        // Remove listing after sale
        delete listings[tokenId];

        _clearOffers(tokenId); // Refund and clear all offers for this token

        // Transfer the NFT to buyer
        nftContract.safeTransferFrom(listedNFT.seller, msg.sender, tokenId);

        // Pay the seller directly to prevent holding funds in contract
        (bool sentSeller, ) = payable(listedNFT.seller).call{value: listedNFT.price}("");
        require(sentSeller, "ETH transfer failed");

        // Refund excess ETH if sent
        if (msg.value > listedNFT.price) {
            (bool sentRefund, ) = payable(msg.sender).call{value: msg.value - listedNFT.price}("");
            require(sentRefund, "ETH transfer failed");
        }

        emit NFTSold(tokenId, listedNFT.seller, msg.sender, listedNFT.price);
    }

    function delistNFT(uint256 tokenId) external onlyTokenOwner(tokenId) isListed(tokenId) nonReentrant whenNotPaused {
        delete listings[tokenId];
        emit NFTDelisted(tokenId, msg.sender);
    }


    // ********************** AUCTIONS **********************

    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 endTimeStamp) external onlyTokenOwner(tokenId) nonReentrant whenNotPaused {
        // Approval check is needed so marketplace can transfer NFT if auction is successful
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");
        require(!listings[tokenId].isActive && !dutchAuctions[tokenId].isActive, "Cannot start auction: NFT is listed or in Dutch auction");

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
        Auction storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTimestamp, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        // Refund previous highest bidder by crediting their pending returns
        if (auction.highestBid > 0) {
            pendingReturns[tokenId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        // Auction extension: If a bid is placed in the last 2 minutes, extend auction by 2 minutes to prevent sniping
        if (auction.endTimestamp - block.timestamp <= 2 minutes) {
            auction.endTimestamp += 2 minutes;
        }

        emit NewBid(tokenId, msg.sender, msg.value);
    }

    function withdrawBid(uint256 tokenId) external nonReentrant whenNotPaused {
        // Allow users to withdraw their overbid funds
        uint256 amount = pendingReturns[tokenId][msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[tokenId][msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit BidWithdrawn(tokenId, msg.sender, amount);
    }

    function finalizeAuction(uint256 tokenId) external isAuctionEnded(tokenId) nonReentrant whenNotPaused {
        Auction storage auction = auctions[tokenId];
        require(auction.highestBidder != address(0), "No bids placed");

        uint256 reward = auction.highestBid / 100; // 1% reward for finalizer
        uint256 payout = auction.highestBid - reward;

        // Transfer NFT to auction winner
        nftContract.safeTransferFrom(auction.seller, auction.highestBidder, tokenId);

        // Pay seller (minus reward) and finalizer safely
        (bool sentSeller, ) = payable(auction.seller).call{value: payout}("");
        require(sentSeller, "ETH transfer failed");
        (bool sentFinalizer, ) = payable(msg.sender).call{value: reward}("");
        require(sentFinalizer, "ETH transfer failed");

        _clearOffers(tokenId); // Refund and clear any outstanding offers for this token

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);

        // Remove auction record after completion
        delete auctions[tokenId];
    }

    function cancelAuction(uint256 tokenId) external onlyTokenOwner(tokenId) isAuctionActive(tokenId) nonReentrant whenNotPaused {
        Auction storage auction = auctions[tokenId];

        // Refund highest bidder if there was a bid
        if (auction.highestBid > 0) {
            (bool sent, ) = payable(auction.highestBidder).call{value: auction.highestBid}("");
            require(sent, "ETH transfer failed");
        }

        // Remove auction record
        delete auctions[tokenId];

        emit NFTDelisted(tokenId, msg.sender);
    }

    function hasPendingReturns(uint256 tokenId, address user) external view returns (bool) {
        return pendingReturns[tokenId][user] > 0;
    }


    // ********************** DUTCH-AUCTIONS **********************

    function startDutchAuction(uint256 tokenId, uint256 startPrice, uint256 endPrice, uint256 duration) external onlyTokenOwner(tokenId) nonReentrant whenNotPaused {
        // Approval check needed so contract can transfer NFT upon sale
        require(nftContract.getApproved(tokenId) == address(this) || nftContract.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved to manage this NFT");
        require(startPrice > endPrice, "Start price must be greater than end price");
        require(duration > 0, "Duration must be greater than zero");
        require(!listings[tokenId].isActive && !auctions[tokenId].isActive, "Cannot start Dutch auction: NFT is listed or in regular auction");

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

    function buyFromDutchAuction(uint256 tokenId, uint256 clientTimestamp) external payable {
        DutchAuction storage auction = dutchAuctions[tokenId];
        require(auction.isActive, "Dutch auction not active");
        // Allow for some clock drift between client and chain for UX in testnets
        require(clientTimestamp <= block.timestamp + 60, "Timestamp too far in the future"); // +60s margin for slow block mining
        require(clientTimestamp <= auction.endTimestamp, "Auction expired");
        require(clientTimestamp >= auction.startTimestamp, "Auction not started");

        uint256 elapsed = clientTimestamp - auction.startTimestamp;
        uint256 duration = auction.endTimestamp - auction.startTimestamp;
        uint256 priceDiff = auction.startPrice - auction.endPrice;
        uint256 divisor = duration == 0 ? 1 : duration; // Avoid division by zero
        uint256 currentPrice = auction.startPrice - (priceDiff * elapsed / divisor);

        // Clamp to endPrice if auction is expired
        if (clientTimestamp >= auction.endTimestamp) {
            currentPrice = auction.endPrice;
        }

        require(msg.value >= currentPrice, "Insufficient funds");

        auction.isActive = false;

        // Transfer NFT to buyer and pay seller directly
        nftContract.safeTransferFrom(auction.seller, msg.sender, tokenId);
        (bool sentSeller, ) = payable(auction.seller).call{value: currentPrice}("");
        require(sentSeller, "ETH transfer failed");

        // Refund excess ETH if sent
        if (msg.value > currentPrice) {
            (bool sentRefund, ) = payable(msg.sender).call{value: msg.value - currentPrice}("");
            require(sentRefund, "ETH transfer failed");
        }

        _clearOffers(tokenId); // Refund and clear all offers for this token

        emit DutchAuctionEnded(tokenId, msg.sender, currentPrice);
    }

    function cancelDutchAuction(uint256 tokenId) external onlyTokenOwner(tokenId) nonReentrant whenNotPaused {
        DutchAuction storage auction = dutchAuctions[tokenId];
        require(auction.isActive, "Dutch auction not active");

        auction.isActive = false;
        emit NFTDelisted(tokenId, msg.sender);
    }


    // ********************** OFFERS **********************

    function makeOffer(uint256 tokenId, uint256 expiration) external payable nonReentrant whenNotPaused {
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

    function cancelOffer(uint256 tokenId) external nonReentrant whenNotPaused {
        Offer memory offer = offers[tokenId][msg.sender];
        require(offer.amount > 0, "No offer to cancel");

        uint256 refundAmount = offer.amount;
        delete offers[tokenId][msg.sender];

        // Remove offerer from the list to keep offerers array in sync
        address[] storage addrs = offerers[tokenId];
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == msg.sender) {
                addrs[i] = addrs[addrs.length - 1];
                addrs.pop();
                break;
            }
        }

        // Refund the offer amount to offerer
        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "ETH transfer failed");
        emit OfferCancelled(tokenId, msg.sender);
    }

    function acceptOffer(uint256 tokenId, address offerer) external onlyTokenOwner(tokenId) nonReentrant whenNotPaused {
        Offer memory offer = offers[tokenId][offerer];
        require(offer.amount > 0, "No valid offer");
        require(block.timestamp <= offer.expiration, "Offer expired");

        delete offers[tokenId][offerer];

        // Pay the seller directly to minimize holding funds in contract
        (bool sent, ) = payable(msg.sender).call{value: offer.amount}("");
        require(sent, "ETH transfer failed");

        // Remove fixed-price listing if present
        delete listings[tokenId];

        _clearOffers(tokenId); // Refund and clear all other offers for this token

        // Transfer the NFT to buyer
        nftContract.safeTransferFrom(msg.sender, offerer, tokenId);

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


    // ********************** INTERNAL FUNCTIONS **********************

    // Refunds all outstanding offers for a token and clears the offers mapping and array.
    function _clearOffers(uint256 tokenId) internal {
        address[] storage addrs = offerers[tokenId];
        for (uint256 i = 0; i < addrs.length; i++) {
            address offerer = addrs[i];
            uint256 refundAmount = offers[tokenId][offerer].amount;
            if (refundAmount > 0) {
                delete offers[tokenId][offerer];
                (bool sent, ) = payable(offerer).call{value: refundAmount}("");
                require(sent, "ETH transfer failed");
            }
        }
        // Remove all offerers for this tokenId
        delete offerers[tokenId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function paused() public view override returns (bool) {
        return Pausable.paused();
    }
}