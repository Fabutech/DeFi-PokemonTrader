import user from './user/index.js';
import general from './general/index.js';
import api from './api/index.js';
import nft from './nft/index.js';

export function routes(app, DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    app.use("/api", api(DB));
    app.use("/user", user(DB, nftContract, signer, helia));
    app.use("/nft", nft(DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia));
    app.use("", general(DB, tradingContract, nftContract, signer, helia));
}