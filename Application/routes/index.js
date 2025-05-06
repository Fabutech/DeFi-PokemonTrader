import user from './user/index.js';
import general from './general/index.js';
import api from './api/index.js';
import nft from './nft/index.js';

export function routes(app, DB, CONTRACTS, ABIS, signer, helia) {
    app.use("/api", api(DB, CONTRACTS, ABIS, signer, helia));
    app.use("/user", user(DB, CONTRACTS, ABIS, signer, helia));
    app.use("/nft", nft(DB, CONTRACTS, ABIS, signer, helia));
    app.use("", general(DB, CONTRACTS, ABIS, signer, helia));
}