

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ERC721.sol";

contract OfferManager {
    ERC721 public nftContract;

    struct Offer {
        address offerer;
        uint256 amount;
        uint256 expiration;
    }

    // Mapping from tokenId to offerer to Offer
    mapping(uint256 => mapping(address => Offer)) public offers;
    // Mapping from tokenId to array of offerer addresses
    mapping(uint256 => address[]) public offerers;

    event OfferMade(uint256 indexed tokenId, address indexed offerer, uint256 amount, uint256 expiration);
    event OfferCancelled(uint256 indexed tokenId, address indexed offerer);
    event OfferAccepted(uint256 indexed tokenId, address indexed offerer, uint256 amount);

    constructor(address _nftContract) {
        nftContract = ERC721(_nftContract);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
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

        offerers[tokenId].push(msg.sender);

        emit OfferMade(tokenId, msg.sender, msg.value, expiration);
    }

    function cancelOffer(uint256 tokenId) external {
        Offer memory offer = offers[tokenId][msg.sender];
        require(offer.amount > 0, "No offer to cancel");

        uint256 refundAmount = offer.amount;
        delete offers[tokenId][msg.sender];

        address[] storage addrs = offerers[tokenId];
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == msg.sender) {
                addrs[i] = addrs[addrs.length - 1];
                addrs.pop();
                break;
            }
        }

        (bool refunded, ) = payable(msg.sender).call{value: refundAmount}("");
        require(refunded, "Refund failed");

        emit OfferCancelled(tokenId, msg.sender);
    }

    function acceptOffer(uint256 tokenId, address offerer) external onlyTokenOwner(tokenId) {
        Offer memory offer = offers[tokenId][offerer];
        require(offer.amount > 0, "No valid offer");
        require(block.timestamp <= offer.expiration, "Offer expired");

        delete offers[tokenId][offerer];

        (bool sent, ) = payable(msg.sender).call{value: offer.amount}("");
        require(sent, "Payment failed");

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

    function clearOffers(uint256 tokenId) external {
        address[] storage addrs = offerers[tokenId];
        for (uint256 i = 0; i < addrs.length; i++) {
            address offerer = addrs[i];
            uint256 refundAmount = offers[tokenId][offerer].amount;
            if (refundAmount > 0) {
                delete offers[tokenId][offerer];
                (bool refunded, ) = payable(offerer).call{value: refundAmount}("");
                require(refunded, "Offer refund failed");
            }
        }
        delete offerers[tokenId];
    }
}