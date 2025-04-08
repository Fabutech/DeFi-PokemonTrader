import { TextDecoder } from 'util';
import { unixfs } from "@helia/unixfs";

export default async function getUserNFTs(req, res, DB, nftContract, signer, helia) {
    const userAddress = req.session.walletAddress;

    if (!userAddress) {
        return res.redirect("/");
    }

    const decoder = new TextDecoder();
    const fs = unixfs(helia);

    const nftsFromDB = await DB.find({ "ownerAddress": userAddress });

    const nfts = await Promise.all(nftsFromDB.map(async (nft) => {
        try {
            const tokenUri = await nftContract.connect(signer).tokenURI(nft.tokenId);
            const ipfsHash = tokenUri.replace("ipfs://", "");
    
            let content = '';
            for await (const chunk of fs.cat(ipfsHash)) {
                content += decoder.decode(chunk);
            }
            const metadata = JSON.parse(content);
    
            return {
                ...nft.toObject(),
                ...metadata
            };
        } catch (err) {
            console.error(`Error fetching metadata for token ${nft.tokenId}:`, err);
            return nft.toObject(); // fallback
        }
    }));

    res.render("myNFTs", { nfts });
}