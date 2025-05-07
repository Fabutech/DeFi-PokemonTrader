
function setupFrontendEventListener() {
    const web3 = new Web3(window.ethereum);
    const tradingContract = new web3.eth.Contract(tradingABI, tradingAddress);

    // ********************** LISTING EVENTS **********************
    tradingContract.events.NFTListed().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.NFTSold().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.NFTDelisted().on('data', (event) => {
        location.reload();
    });


    // ********************** AUCTION EVENTS **********************
    tradingContract.events.AuctionStarted().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.NewBid().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.BidWithdrawn().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.AuctionEnded().on('data', (event) => {
        location.reload();
    });


    // ********************** DUTCH-AUCTION EVENTS **********************
    tradingContract.events.DutchAuctionStarted().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.DutchAuctionEnded().on('data', (event) => {
        location.reload();
    });


    // ********************** OFFER EVENTS **********************
    tradingContract.events.OfferMade().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.OfferCancelled().on('data', (event) => {
        location.reload();
    });

    tradingContract.events.OfferAccepted().on('data', (event) => {
        location.reload();
    });   
}