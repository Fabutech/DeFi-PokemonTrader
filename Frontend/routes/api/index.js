import express from 'express';

export default function index(DB) {
    const MainRouter = express.Router();

    MainRouter.route("/connect")
    .post((req, res) => {
        const walletAddress = req.body.address;
        req.session.walletAddress = walletAddress;

        res.send({ status: "ok" });
    });

    return MainRouter
}