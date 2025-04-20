import express from 'express';

export default function index(DB) {
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

    return MainRouter
}