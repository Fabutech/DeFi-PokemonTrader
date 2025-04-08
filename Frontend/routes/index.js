import user from './user/index.js';
import general from './general/index.js';
import api from './api/index.js';

export function routes(app, DB, tradingContract, nftContract, signer, helia) {
    app.use("/api", api(DB));
    app.use("/user", user(DB, nftContract, signer, helia));
    app.use("", general(DB));
}