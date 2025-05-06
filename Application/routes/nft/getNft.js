import { ethers } from "ethers";
import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getNft(req, res, CONTRACTS, ABIS, signer, helia) {

    async function getEthUsdPrice() {
        try {
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const data = await response.json();
            return data.ethereum.usd;
        } catch (e) {
            console.log("Error while fetching eth to usd exchange rate: " + e);
            return null;
        }
    }

    const tokenId = req.params.tokenId;
    const userAddress = req.session.walletAddress;

    const contractOwner = await CONTRACTS.nftContract.connect(signer).contractOwner();

    const tokenUri = await CONTRACTS.nftContract.connect(signer).tokenURI(tokenId);
    const tokenOwner = await CONTRACTS.nftContract.connect(signer).ownerOf(tokenId);

    const isOwner = userAddress == tokenOwner.toLowerCase();

    let hasActiveOffer = false;
    if (userAddress) {
        const offer = await CONTRACTS.offerContract.connect(signer).offers(tokenId, userAddress);
        hasActiveOffer = offer.amount > 0;
    }

    let nftPriceUSD;
    let listing = await CONTRACTS.fixedContract.connect(signer).listings(tokenId);
    if (listing.isActive === false) {
        listing = null;
        nftPriceUSD = null;
    } else {
        const ethUsd = await getEthUsdPrice();
        if (ethUsd !== null) {
            nftPriceUSD = Number(ethers.formatEther(listing.price.toString())) * ethUsd;
        }
    }

    const auctionData = await CONTRACTS.auctionContract.connect(signer).auctions(tokenId);
    let auction = null;
    if (!listing && auctionData.isActive) {
        let startingPriceUSD, highestBidUSD;
        const ethUsd = await getEthUsdPrice();
        if (ethUsd !== null) {
            startingPriceUSD = Number(ethers.formatEther(auctionData.startingPrice.toString())) * ethUsd;
            highestBidUSD = Number(ethers.formatEther(auctionData.highestBid.toString())) * ethUsd;
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

    const dutchAuctionData = await CONTRACTS.dutchContract.connect(signer).dutchAuctions(tokenId);
    let dutchAuction = null;
    if (!listing && !auctionData.isActive && dutchAuctionData.isActive) {
        let startPriceUSD, endPriceUSD;
        const ethUsd = await getEthUsdPrice();
        if (ethUsd !== null) {
            startPriceUSD = Number(ethers.formatEther(dutchAuctionData.startPrice.toString())) * ethUsd;
            endPriceUSD = Number(ethers.formatEther(dutchAuctionData.endPrice.toString())) * ethUsd;
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
    
    const sealedBidAuctionData = await CONTRACTS.sealedBidContract.connect(signer).auctions(tokenId);
    
    console.log(sealedBidAuctionData);
    
    let sealedBidAuction = null;
    if (!listing && !auctionData.isActive && !dutchAuctionData.isActive && sealedBidAuctionData.isActive) {
        let startingPriceUSD, highestBidUSD;
        const ethUsd = await getEthUsdPrice();
        if (ethUsd !== null) {
            startingPriceUSD = Number(ethers.formatEther(sealedBidAuctionData.startingPrice.toString())) * ethUsd;
            highestBidUSD = Number(ethers.formatEther(sealedBidAuctionData.highestBid.toString())) * ethUsd;
        }

        sealedBidAuction = {
            auction: sealedBidAuctionData,
            startingPriceETH: ethers.formatEther(sealedBidAuctionData.startingPrice.toString()),
            startingPriceUSD: startingPriceUSD,
            highestBidETH: ethers.formatEther(sealedBidAuctionData.highestBid.toString()),
            highestBidUSD: highestBidUSD,
            hasBid: sealedBidAuctionData.highestBid.toString() != 0,
            hasEnded: sealedBidAuctionData.endTimestamp.toString() != "0" && Number(sealedBidAuctionData.endTimestamp.toString()) <= Math.floor(Date.now() / 1000)
        }
    }

    console.log(sealedBidAuction);

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

    const stats = {
        views: 0,
        favorites: 0
    }

    const nft = {
        tokenId: tokenId,
        owner: tokenOwner,
        metadata: metadata,
        listing: listing,
        auction: auction,
        dutchAuction: dutchAuction,
        sealedBidAuction: sealedBidAuction,
        priceETH: listing != null ? ethers.formatEther(listing.price.toString()) : 0,
        priceUSD: nftPriceUSD,
        stats: stats,
        isListed: listing != null,
        isOnAuction: auction != null,
        isOnDutchAuction: dutchAuction != null,
        isOnSealedBidAuction: sealedBidAuction != null
    }

    const contractAddresses = {
        nftContractAddress: await CONTRACTS.nftContract.getAddress(),
        tradingContractAddress: await CONTRACTS.tradingContract.getAddress(),
        auctionContractAddress: await CONTRACTS.auctionContract.getAddress(),
        dutchContractAddress: await CONTRACTS.dutchContract.getAddress(),
        sealedBidContractAddress: await CONTRACTS.sealedBidContract.getAddress(),
        offerContractAddress: await CONTRACTS.offerContract.getAddress(),
        fixedContractAddress: await CONTRACTS.fixedContract.getAddress(),
    }

    const hasPendingReturns = userAddress ? 
        await CONTRACTS.auctionContract.connect(signer).hasPendingReturns(tokenId, userAddress) || 
        await CONTRACTS.sealedBidContract.connect(signer).hasPendingReturns(tokenId, userAddress) :
        false;

    res.render("singleNft/nft", {
        nft: nft, 
        isLoggedIn: userAddress ? true : false,
        isOwner: isOwner,
        isContractOwner: contractOwner && userAddress && contractOwner.toLowerCase() === userAddress.toLowerCase(),
        hasActiveOffer: hasActiveOffer,
        hasPendingReturns: hasPendingReturns,        
        ABIS: ABIS,
        contractAddresses: contractAddresses
    });
}