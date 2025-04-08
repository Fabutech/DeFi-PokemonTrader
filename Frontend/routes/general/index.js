import express from 'express';
export default function index(DB) {
    const MainRouter = express.Router();

    MainRouter.route("/")
    .get((req, res) => {
        res.render("index");
    })

    return MainRouter
}