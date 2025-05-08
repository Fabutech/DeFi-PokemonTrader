import express from 'express';
import { unixfs } from '@helia/unixfs';
import { fromString } from 'uint8arrays/from-string';

// This function sets up and returns the main API router with routes for wallet connection, transaction history, offers, and IPFS interactions.
export default function index(DB, tradingContract, signer, helia) {
    // Main API router initialization
    const MainRouter = express.Router();
    const fs = unixfs(helia);

    // Save the user's wallet address in the session
    MainRouter.route("/connect")
    .post((req, res) => {
        const walletAddress = req.body.address;
        req.session.walletAddress = walletAddress; // Store wallet address in session
        res.send({ status: "ok" });
    });

    // Get bids on the current auction for a specific token
    MainRouter.route("/history/token/:tokenId/bidsOnCurrentAuction")
    .get(async (req, res) => {
        const tokenId = req.params.tokenId;
        const page = parseInt(req.query.page) || 0;
        const limit = 100;
        const skip = page * limit;

        const auctionData = await tradingContract.connect(signer).auctions(tokenId);
        const auctionStartTime = Number(auctionData.startTimestamp.toString());

        // Convert auctionStartTime (seconds) to a JS Date object
        const auctionStartDate = new Date(auctionStartTime * 1000);

        // Fetch bids from DB that occurred after the auction start time
        const history = await DB.transactions.find({ 
            tokenId, 
            eventType: "NewBid",
            timestamp: { $gte: auctionStartDate } // Filter using JS Date
        })
        .sort({ timestamp: -1 }) // Most recent first
        .skip(skip)
        .limit(limit);

        res.json(history);
    });

    // Get full history of a specific token
    MainRouter.route("/history/token/:tokenId")
    .get(async (req, res) => {
        const tokenId = req.params.tokenId;
        const page = parseInt(req.query.page) || 0;
        const limit = 100;
        const skip = page * limit;

        const history = await DB.transactions.find({ tokenId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        res.json(history);
    });

    // Get transaction history for a given wallet address
    MainRouter.route("/history/address/:address")
    .get(async (req, res) => {
        const address = req.params.address.toLowerCase();
        const page = parseInt(req.query.page) || 0;
        const limit = 100;
        const skip = page * limit;

        const history = await DB.transactions.find({
            $or: [{ from: address }, { to: address }]
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

        res.json(history);
    });

    // Get all transaction history (paginated)
    MainRouter.route("/history")
    .get(async (req, res) => {
        const page = parseInt(req.query.page) || 0;
        const limit = 100;
        const skip = page * limit;

        const all = await DB.transactions.find({})
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        res.json(all);
    });

    // Get all offers for a token, ordered by active/expired status
    MainRouter.route("/offers/:tokenId")
    .get(async (req, res) => {
        const tokenId = req.params.tokenId;

        let offers = await tradingContract.connect(signer).getOffers(tokenId);
        let listing = await tradingContract.connect(signer).listings(tokenId);

        // Convert BigInt values to strings to make JSON-serializable
        const serializeBigInts = (obj) => JSON.parse(
            JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
        );

        let filteredOffers = [];
        if (offers) {
            const now = Math.floor(Date.now() / 1000);
            const activeOffers = [];
            const expiredOffers = [];

            offers
              .map(o => [...o]) // Convert to mutable array
              .filter(offer => offer[0] != 0n) // Filter out invalid offers
              .forEach(offer => {
                if (Number(offer[2]) > now) {
                  activeOffers.push(offer);
                } else {
                  expiredOffers.push(offer);
                }
              });

            // Sort offers by price (descending)
            activeOffers.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
            expiredOffers.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

            filteredOffers = activeOffers.concat(expiredOffers);
        }

        res.json(serializeBigInts({
            offers: filteredOffers,
            currentPrice: listing.price
        }));
    });

    // Fetch a file from IPFS using its CID
    MainRouter.route("/ipfs/:cid")
    .get(async (req, res) => {
        try {
            const { cid } = req.params;
            const stream = fs.cat(cid); // Async iterable for reading IPFS content
            const chunks = [];

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'image/jpeg'); // Assuming JPEG for now
            res.send(buffer);
        } catch (err) {
            console.error(err);
            res.status(500).send('Failed to fetch image from IPFS');
        }
    });

    // Upload metadata and image (fetched via URL) to IPFS
    MainRouter.route("/ipfs/upload")
      .post(express.json({ limit: '10mb' }), async (req, res) => {
        try {
          const { metadata, imageUrl } = req.body;
          const imageRes = await fetch(imageUrl);
          if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
          const arrayBuffer = await imageRes.arrayBuffer();
          const imageBytes = new Uint8Array(arrayBuffer);
          const imageCid = await fs.addBytes(imageBytes); // Upload image to IPFS
          metadata.image = imageCid.toString();
          const metadataCid = await fs.addBytes(fromString(JSON.stringify(metadata))); // Upload updated metadata
          res.send({ ipfsURI: `ipfs://${metadataCid.toString()}` });
        } catch (err) {
          console.error("Upload failed:", err);
          res.status(500).send({message: "IPFS upload failed"});
        }
      });

    // Upload metadata and base64-encoded image bytes directly to IPFS
    MainRouter.route("/ipfs/upload-bytes")
      .post(express.json({ limit: '100mb' }), async (req, res) => {
        try {
          const { metadata, imageBytesBase64 } = req.body;
          const imageBytes = Buffer.from(imageBytesBase64, 'base64'); // Decode base64 image
          const imageCid = await fs.addBytes(imageBytes); // Upload image to IPFS
          metadata.image = imageCid.toString();
          console.log("Decoded image size:", imageBytes.length);
          const metadataCid = await fs.addBytes(fromString(JSON.stringify(metadata))); // Upload updated metadata
          res.send({ ipfsURI: `ipfs://${metadataCid.toString()}` });
        } catch (err) {
          console.error("Upload-bytes failed:", err);
          res.status(500).send({message: "IPFS upload failed"});
        }
      });

    return MainRouter
}