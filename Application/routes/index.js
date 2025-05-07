import user from './user/index.js';
import general from './general/index.js';
import api from './api/index.js';
import nft from './nft/index.js';

export function routes(app, DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia) {
    app.use("/api", api(DB, tradingContract, signer, helia));
    app.use("/user", user(DB, nftContract, nftContractABI, tradingContract, tradingContractABI, signer, helia));
    app.use("/nft", nft(DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia));
    app.use("", general(DB, tradingContract, tradingContractABI, nftContract, signer, helia));
}