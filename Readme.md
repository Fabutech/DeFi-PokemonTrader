# DeFiApp

Welcome to the **DeFiApp Poke Trader** project!

## Getting Started

Follow the steps below to set up and run the project locally.

### Prerequisites

Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)

### Installation and Running your Application

1. Clone the repository:
    ```bash
    git clone https://github.com/Fabutech/DeFi-PokemonTrader.git
    cd DeFi-PokemonTrader
    ```

2. Set up the smart contracts:
    ```bash
    cd SmartContracts
    npm install
    npx hardhat node
    ```

3. Set up the backend application (Open a new terminal and navigate to the folder you cloned the git repository to):
    ```bash
    cd DeFi-PokemonTrader/Application/backend
    npm install
    node fetchAndMintPokemons.js
    ```

4. Open your browser and navigate to `http://localhost:3000` to view the application.

5. Connect MetaMask to the Hardhat test network:
   - Open MetaMask in your browser.
   - Click on the network selector at the top and choose "Add network" (if not already connected).
   - Enter the following details:
     - **Network Name**: Hardhat Localhost
     - **New RPC URL**: http://127.0.0.1:8545
     - **Chain ID**: 31337
     - **Currency Symbol**: HL or ETH
   - Import a test account using one of the private keys printed in the terminal when you run `npx hardhat node`. These accounts come preloaded with test ETH for development.
   - Once connected, refresh the app at `http://localhost:3000` to interact using your test wallet.

### Testing

Run the test suite (navigate to SmartContracts):
```bash
npx hardhat test
```

## About the Project

**DeFiApp Poke Trader** is a decentralized finance (DeFi) application designed to bring gamified NFT trading to the Ethereum blockchain. It allows users to mint, list, auction, and trade Pokémon-themed NFTs in a fully decentralized and user-friendly environment.

- **NFT Minting**: The contract owner can mint new NFTs based on real Pokémon data fetched from the PokeAPI. Metadata and images are uploaded to IPFS for decentralized storage.
- **Batch Minting**: The contract owner can automatically mint multiple Pokémon NFTs using a batch function powered by the backend and PokeAPI.
- **Marketplace**: Users can buy, list, or delist NFTs using a traditional fixed-price sale model.
- **Auction System**: Includes both standard and Dutch auction mechanisms for NFT trading. Sellers can start timed auctions, and buyers can place and withdraw bids.
- **Offer System**: Users can make time-limited offers on any NFT, which owners can accept or ignore.
- **Wallet Integration**: MetaMask is used for wallet connection and transaction signing.
- **Real-Time Data**: Frontend updates in real time based on smart contract events, improving user feedback and interactivity.
- **ETH to USD Conversion**: Price data is fetched live from CoinGecko to display current values in USD.

### Trading Contract Functionalities

The core smart contract in this application is the **Trading Contract**, which handles all marketplace logic for NFT transactions. Below are its major functionalities:

#### 📋 Listing NFTs

- **ListNFT**: Allows an NFT owner to list their token for a fixed price and expiration time.
- **BuyNFT**: Enables any user to purchase a listed NFT by sending the exact ETH amount.
- **DelistNFT**: Permits the seller to remove their NFT from the marketplace if it hasn’t been sold yet.

#### ⏱️ Standard Auctions

- **StartAuction**: Initiates an auction for a given NFT with a starting price and an end timestamp.
- **PlaceBid**: Allows users to place higher bids before the auction ends. The highest bid is stored, and previous bidders can later reclaim their funds.
- **WithdrawBid**: Lets bidders retrieve their ETH if outbid or if they wish to cancel their bid before auction finalization.
- **FinalizeAuction**: Can be called after the auction ends to transfer the NFT to the highest bidder and release funds to the seller.

#### ⌛ Dutch Auctions

- **StartDutchAuction**: Starts a Dutch auction where the price decreases linearly from a start price to an end price over a defined duration.
- **BuyFromDutchAuction**: Lets users purchase the NFT at the current price at any time before the auction ends.
- **CancelDutchAuction**: The seller can cancel a Dutch auction before a sale is made.

#### 💬 Offers

- **MakeOffer**: Allows a user to submit a time-limited offer (bid) for any NFT, even if it’s not currently listed.
- **CancelOffer**: Enables the offer creator to cancel their offer and reclaim their ETH.
- **AcceptOffer**: NFT owners can accept any active offer, instantly transferring the NFT and receiving ETH.

#### 🧾 Finalization & Fund Safety

- **Pending Returns**: Users whose bids or offers have been outbid can safely withdraw their pending returns.
- **hasPendingReturns**: Utility function to check if a user has any reclaimable ETH due to bidding activity.

#### 📊 Event Tracking with MongoDB

All important contract interactions emit events which are tracked off-chain using a backend service and stored in **MongoDB**. These include:
- `NFTListed`, `NFTSold`, `NFTDelisted`
- `AuctionStarted`, `NewBid`, `BidWithdrawn`, `AuctionEnded`
- `DutchAuctionStarted`, `DutchAuctionEnded`
- `OfferMade`, `OfferCancelled`, `OfferAccepted`

This system supports efficient UI updates, marketplace statistics, and historical data queries.

### Tech Stack

- **Frontend**:
  - HTML, CSS, JavaScript
  - Web3.js for blockchain interactions
  - MetaMask for wallet integration

- **Backend**:
  - Node.js with Express.js
  - MongoDB for storing transaction and ownership data
  - IPFS via Helia (UnixFS) for decentralized metadata storage
  - Integration with external APIs like PokeAPI and CoinGecko

- **Smart Contracts**:
  - Solidity (written for Ethereum-compatible EVM networks)
  - Hardhat for development, testing, and deployment
  - Includes contracts for:
    - NFT (ERC-721)
    - Trading and auctions
    - Ownership and permissions

### Deployment

The application is built to run locally with Hardhat's local blockchain, but is structured to be easily adapted for deployment to public Ethereum testnets or mainnet.
