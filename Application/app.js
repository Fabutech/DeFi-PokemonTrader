import express from 'express';
import session from 'express-session';
import path from 'path';
import { createHelia } from "helia";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { routes } from './routes/index.js';

export async function runApp(DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer) {
    const app = express();
    app.use(express.json({ limit: '100mb' })); // needed to set this manually for the image upload of manual minting
    const PORT = 3000;

    // Create Helia Node for the IPFS metadata storage
    const helia = await createHelia();

    // Setup Express Sessions
    app.use(session({
        secret: 'Pokemon',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } 
    }));


    // Middleware
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());


    // ROUTES
    routes(app, DB, tradingContract, tradingContractABI, nftContract, nftContractABI, signer, helia);

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
}

