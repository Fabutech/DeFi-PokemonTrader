import express from 'express';
import { unixfs } from '@helia/unixfs';
import { fromString } from 'uint8arrays/from-string';

export default function index(DB, CONTRACTS, ABIS, signer, helia) {
    const MainRouter = express.Router();

    const fs = unixfs(helia);

    MainRouter.route("/connect")
    .post((req, res) => {
        const walletAddress = req.body.address;
        req.session.walletAddress = walletAddress;

        res.send({ status: "ok" });
    });

    MainRouter.route("/history/token/:tokenId/bidsOnCurrentAuction")
    .get(async (req, res) => {
        const tokenId = req.params.tokenId;
        const page = parseInt(req.query.page) || 0;
        const limit = 100;
        const skip = page * limit;

        const auctionData = await CONTRACTS.auctionContract.connect(signer).auctions(tokenId);
        const auctionStartTime = Number(auctionData.startTimestamp.toString());

        // Convert auctionStartTime (seconds) to a JS Date
        const auctionStartDate = new Date(auctionStartTime * 1000);

        const history = await DB.transactions.find({ 
            tokenId, 
            eventType: "NewBid",
            timestamp: { $gte: auctionStartDate } // Now comparing Date to Date!
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

        res.json(history);
    });

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

    MainRouter.route("/offers/:tokenId")
    .get(async (req, res) => {
        const tokenId = req.params.tokenId;

        let offers = await CONTRACTS.offerContract.connect(signer).getOffers(tokenId);
        let listing = await CONTRACTS.fixedContract.connect(signer).listings(tokenId);

        const serializeBigInts = (obj) => JSON.parse(
            JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
        );

        let filteredOffers = [];
        if (offers) {
            const now = Math.floor(Date.now() / 1000);
            const activeOffers = [];
            const expiredOffers = [];

            offers
              .map(o => [...o]) // clone into plain arrays since original array is immutable
              .filter(offer => offer[0] != 0n) // filter out zero address
              .forEach(offer => {
                if (Number(offer[2]) > now) {
                  activeOffers.push(offer);
                } else {
                  expiredOffers.push(offer);
                }
              });

            activeOffers.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)); // Sort active offers descending
            expiredOffers.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)); // Sort expired offers descending (optional)

            filteredOffers = activeOffers.concat(expiredOffers);
        }
          
        res.json(serializeBigInts({
            offers: filteredOffers,
            currentPrice: listing.price
        }));
    });

    MainRouter.route("/ipfs/:cid")
    .get(async (req, res) => {
        try {
            const { cid } = req.params;
        
            const stream = fs.cat(cid); // returns an async iterable
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
        
            const buffer = Buffer.concat(chunks);
        
            // Optional: detect or assume content type
            res.setHeader('Content-Type', 'image/jpeg'); // or detect from file
            res.send(buffer);
          } catch (err) {
            console.error(err);
            res.status(500).send('Failed to fetch image from IPFS');
          }
    });

    // POST /upload-nft: Accepts metadata and image URL, fetches image, uploads both to IPFS, returns metadata CID
    MainRouter.route("/ipfs/upload")
      .post(express.json({ limit: '10mb' }), async (req, res) => {
        try {
          const { metadata, imageUrl } = req.body;
          const imageRes = await fetch(imageUrl);
          if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
          const arrayBuffer = await imageRes.arrayBuffer();
          const imageBytes = new Uint8Array(arrayBuffer);
          const imageCid = await fs.addBytes(imageBytes);
          metadata.image = imageCid.toString();
          const metadataCid = await fs.addBytes(fromString(JSON.stringify(metadata)));
          res.send({ ipfsURI: `ipfs://${metadataCid.toString()}` });
        } catch (err) {
          console.error("Upload failed:", err);
          res.status(500).send({message: "IPFS upload failed"});
        }
      });

      MainRouter.route("/ipfs/upload-bytes")
      .post(express.json({ limit: '100mb' }), async (req, res) => {
        try {
          const { metadata, imageBytesBase64 } = req.body;
          const imageBytes = Buffer.from(imageBytesBase64, 'base64');
          const imageCid = await fs.addBytes(imageBytes);
          metadata.image = imageCid.toString();
          console.log("Decoded image size:", imageBytes.length);
          const metadataCid = await fs.addBytes(fromString(JSON.stringify(metadata)));
          res.send({ ipfsURI: `ipfs://${metadataCid.toString()}` });
        } catch (err) {
          console.error("Upload-bytes failed:", err);
          res.status(500).send({message: "IPFS upload failed"});
        }
      });

    return MainRouter
}