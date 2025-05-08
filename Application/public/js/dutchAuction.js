// Updates the current price of a Dutch auction in ETH and USD on the UI, recalculating based on elapsed time.
async function updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, ethToUsdRate) {
    const ethElement = document.getElementById("dutch-auction-currentPrice-eth");
    const usdElement = document.getElementById("dutch-auction-currentPrice-usd");
    const buyBtn = document.getElementById("buy-from-dutch-auction");

    if (ethElement) {
        // Convert timestamp strings to integers
        const startTime = parseInt(startTimeStampStr, 10);
        const endTime = parseInt(endTimeStampStr, 10);
        const currentTime = Math.floor(Date.now() / 1000);

        // Convert Wei to ETH values
        const startPrice = parseFloat(Web3.utils.fromWei(startPriceEth.toString(), 'ether'));
        const endPrice = parseFloat(Web3.utils.fromWei(endPriceEth.toString(), 'ether'));

        let currentPrice = startPrice;

        // Calculate current price using linear interpolation if auction is ongoing
        if (currentTime < endTime && currentTime >= startTime) {
            const priceDiff = startPrice - endPrice;
            const duration = endTime - startTime;
            const elapsed = currentTime - startTime;
            currentPrice = startPrice - (priceDiff * elapsed / duration);
        } else if (currentTime >= endTime) {
            currentPrice = endPrice; // Auction ended
        } else {
            currentPrice = startPrice; // Auction not started
        }

        // Format and display ETH price with trimmed trailing zeros
        ethElement.textContent = `${parseFloat(currentPrice).toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.0')} ETH`;

        // Display price in USD if conversion rate available
        if (usdElement && ethToUsdRate) {
            const usdPrice = currentPrice * ethToUsdRate;
            usdElement.textContent = `$${usdPrice.toFixed(2)}`;
        }

        // Update buy button with current ETH price as data attribute
        if (buyBtn) {
            buyBtn.setAttribute("data-price", currentPrice);
        }
    }
}

// Starts an interval to repeatedly update the Dutch auction price in the UI using live ETH/USD conversion
function startDutchAuctionPriceUpdater(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr) {
    const ethElement = document.getElementById("dutch-auction-currentPrice-eth");
    if (!ethElement) return;

    // Fetch ETH/USD price from CoinGecko and start update loop
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        .then(response => response.json())
        .then(data => {
            const rate = data.ethereum.usd;

            updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, rate);
            setInterval(() => {
                updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, rate);
            }, 1000); // Update every second
        })
        .catch(err => {
            console.error("Failed to fetch ETH price:", err);

            // Fallback: update auction price without USD conversion
            updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, null);
            setInterval(() => {
                updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, null);
            }, 1000);
        });
}