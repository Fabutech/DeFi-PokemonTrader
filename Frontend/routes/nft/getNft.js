import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getNft(req, res, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    const tokenId = req.params.tokenId;
    const userAddress = req.session.walletAddress;

    const tokenUri = await nftContract.connect(signer).tokenURI(tokenId);
    const tokenOwner = await nftContract.connect(signer).ownerOf(tokenId);

    const isOwner = userAddress == tokenOwner.toLowerCase();

    let listing = await tradingContract.connect(signer).listings(tokenId);
    if (listing.isActive == false) {
        listing = null;
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

    const stats = {
        views: 0,
        favorites: 0
    }

    const nft = {
        tokenId: tokenId,
        owner: tokenOwner,
        metadata: metadata,
        listing: listing,
        stats: stats,
        isForSale: listing != null
    }


    res.render("nft", {
        nft: nft, 
        isOwner: isOwner,
        tradingContractAddress: await tradingContract.getAddress(),
        tradingContractABI: tradingContractABI,
        nftContractAddress: await nftContract.getAddress(),
        nftContractABI: nftContractABI
    });
}