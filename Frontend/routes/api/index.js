import express from 'express';

export default function index(DB, tradingContract, signer) {
    const MainRouter = express.Router();

    MainRouter.route("/connect")
    .post((req, res) => {
        const walletAddress = req.body.address;
        req.session.walletAddress = walletAddress;

        res.send({ status: "ok" });
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

        let offers = await tradingContract.connect(signer).getOffers(tokenId);
        let listing = await tradingContract.connect(signer).listings(tokenId);

        const serializeBigInts = (obj) => JSON.parse(
            JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
        );

        let filteredOffers = [];
        if (offers) {
            filteredOffers = offers
                .map(o => [...o]) // clone into plain arrays since original array is immutable
                .filter(offer => offer[0] != 0n) // filter out zero address
                .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)); // sort by offer price in descending order
        }
          
        res.json(serializeBigInts({
            offers: filteredOffers,
            currentPrice: listing.price
        }));
    });

    return MainRouter
}