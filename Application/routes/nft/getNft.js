import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getNft(req, res, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    const tokenId = req.params.tokenId;
    const userAddress = req.session.walletAddress;

    const contractOwner = await nftContract.connect(signer).contractOwner();

    let tokenUri, tokenOwner;
    try {
        tokenUri = await nftContract.connect(signer).tokenURI(tokenId);
        tokenOwner = await nftContract.connect(signer).ownerOf(tokenId);
    } catch (err) {
        console.error(`Error fetching token URI or owner for token ${tokenId}:`, err);
        return res.redirect("/");
    }

    const isOwner = userAddress == tokenOwner.toLowerCase();

    let hasActiveOffer = false;
    if (userAddress) {
        const offer = await tradingContract.connect(signer).offers(tokenId, userAddress);
        hasActiveOffer = offer.amount > 0;
    }

    let nftPriceUSD;
    let listing = await tradingContract.connect(signer).listings(tokenId);
    if (listing.isActive === false) {
        listing = null;
        nftPriceUSD = null;
    } else {
        try {
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const data = await response.json();
            const ethUsd = data.ethereum.usd;
            nftPriceUSD = Number(ethers.formatEther(listing.price.toString())) * ethUsd;
        } catch (e) {
            console.log("Error while fetching eth to usd exchange rate: " + e);
        }
    }

    const auctionData = await tradingContract.connect(signer).auctions(tokenId);
    let auction = null;
    if (!listing && auctionData.isActive) {
        let startingPriceUSD, highestBidUSD;
        try {
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const data = await response.json();
            const ethUsd = data.ethereum.usd;

            startingPriceUSD = Number(ethers.formatEther(auctionData.startingPrice.toString())) * ethUsd
            highestBidUSD = Number(ethers.formatEther(auctionData.highestBid.toString())) * ethUsd
        } catch (e) {
            console.log("Error while fetching eth to usd exchange rate: " + e);
        }

        auction = {
            auction: auctionData,
            startingPriceETH: ethers.formatEther(auctionData.startingPrice.toString()),
            startingPriceUSD: startingPriceUSD,
            highestBidETH: ethers.formatEther(auctionData.highestBid.toString()),
            highestBidUSD: highestBidUSD,
            hasBid: auctionData.highestBid.toString() != 0,
            hasEnded: auctionData.endTimestamp.toString() != "0" && Number(auctionData.endTimestamp.toString()) <= Math.floor(Date.now() / 1000)
        }
    }

    const dutchAuctionData = await tradingContract.connect(signer).dutchAuctions(tokenId);
    let dutchAuction = null;
    if (!listing && !auctionData.isActive && dutchAuctionData.isActive) {
        let startPriceUSD, endPriceUSD;
        try {
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const data = await response.json();
            const ethUsd = data.ethereum.usd;

            startPriceUSD = Number(ethers.formatEther(dutchAuctionData.startPrice.toString())) * ethUsd
            endPriceUSD = Number(ethers.formatEther(dutchAuctionData.endPrice.toString())) * ethUsd
        } catch (e) {
            console.log("Error while fetching eth to usd exchange rate: " + e);
        }

        dutchAuction = {
            auction: dutchAuctionData,
            startPriceETH: ethers.formatEther(dutchAuctionData.startPrice.toString()),
            startPriceUSD: startPriceUSD,
            endPriceETH: ethers.formatEther(dutchAuctionData.endPrice.toString()),
            endPriceUSD: endPriceUSD,
            hasEnded: dutchAuctionData.endTimestamp.toString() != "0" && Number(dutchAuctionData.endTimestamp.toString()) <= Math.floor(Date.now() / 1000)
        }
    }
    

    // Fetch NFT metadata from the IPFS storage
    const decoder = new TextDecoder();
    const fs = unixfs(helia);
    let metadata;
    try {
        const ipfsHash = tokenUri.replace("ipfs://", "");

        let content = '';
        for await (const chunk of fs.cat(ipfsHash)) {
            content += decoder.decode(chunk);
        }
        metadata = JSON.parse(content);
    } catch (err) {
        console.error(`Error fetching metadata for token ${tokenId}:`, err);
        res.redirect("/");
    }

    const nft = {
        tokenId: tokenId,
        owner: tokenOwner,
        metadata: metadata,
        listing: listing,
        auction: auction,
        dutchAuction: dutchAuction,
        priceETH: listing != null ? ethers.formatEther(listing.price.toString()) : 0,
        priceUSD: nftPriceUSD,
        isListed: listing != null,
        isOnAuction: auction != null,
        isOnDutchAuction: dutchAuction != null
    }

    res.render("singleNft/nft", {
        nft: nft, 
        isLoggedIn: userAddress ? true : false,
        isOwner: isOwner,
        isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase(),
        hasActiveOffer: hasActiveOffer,
        hasPendingReturns: userAddress ? await tradingContract.connect(signer).hasPendingReturns(tokenId, userAddress) : false,
        tradingContractAddress: await tradingContract.getAddress(),
        tradingContractABI: tradingContractABI,
        nftContractAddress: await nftContract.getAddress(),
        nftContractABI: nftContractABI
    });
}