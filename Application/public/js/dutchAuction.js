/*****************************************************
 * Calculates the current price of a Dutch auction and updates the DOM accordingly.
 * @param {string|number} startPriceEth - The starting price in ETH.
 * @param {string|number} endPriceEth - The ending price in ETH.
 * @param {string|number} startTimeStampStr - The auction start time (UNIX timestamp in seconds).
 * @param {string|number} endTimeStampStr - The auction end time (UNIX timestamp in seconds).
 * @param {number} ethToUsdRate - The current ETH to USD exchange rate.
 *****************************************************/
async function updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, ethToUsdRate) {
    const ethElement = document.getElementById("dutch-auction-currentPrice-eth");
    const usdElement = document.getElementById("dutch-auction-currentPrice-usd");
    const buyBtn = document.getElementById("buy-from-dutch-auction");

    if (ethElement) {
        const startTime = parseInt(startTimeStampStr, 10);
        const endTime = parseInt(endTimeStampStr, 10);
        const currentTime = Math.floor(Date.now() / 1000);

        const startPrice = parseFloat(Web3.utils.fromWei(startPriceEth.toString(), 'ether'));
        const endPrice = parseFloat(Web3.utils.fromWei(endPriceEth.toString(), 'ether'));

        let currentPrice = startPrice;

        if (currentTime < endTime && currentTime >= startTime) {
            const priceDiff = startPrice - endPrice;
            const duration = endTime - startTime;
            const elapsed = currentTime - startTime;
            currentPrice = startPrice - (priceDiff * elapsed / duration);
        } else if (currentTime >= endTime) {
            currentPrice = endPrice;
        } else {
            currentPrice = startPrice;
        }

        ethElement.textContent = `${parseFloat(currentPrice).toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.0')} ETH`;
        if (usdElement && ethToUsdRate) {
            const usdPrice = currentPrice * ethToUsdRate;
            usdElement.textContent = `$${usdPrice.toFixed(2)}`;
        }

        if (buyBtn) {
            buyBtn.setAttribute("data-price", currentPrice);
        }
    }
}

/*****************************************************
 * Starts an interval that updates the Dutch auction price every second.
 * Fetches ETH to USD exchange rate once and passes it to the updater.
 * @param {string|number} startPriceEth - The starting price in ETH.
 * @param {string|number} endPriceEth - The ending price in ETH.
 * @param {string|number} startTimeStampStr - The auction start time (UNIX timestamp in seconds).
 * @param {string|number} endTimeStampStr - The auction end time (UNIX timestamp in seconds).
 *****************************************************/
function startDutchAuctionPriceUpdater(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr) {
    const ethElement = document.getElementById("dutch-auction-currentPrice-eth");
    if (!ethElement) return;

    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        .then(response => response.json())
        .then(data => {
            const rate = data.ethereum.usd;

            updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, rate);
            setInterval(() => {
                updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, rate);
            }, 1000);
        })
        .catch(err => {
            console.error("Failed to fetch ETH price:", err);
            updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, null);
            setInterval(() => {
                updateDutchAuctionPrice(startPriceEth, endPriceEth, startTimeStampStr, endTimeStampStr, null);
            }, 1000);
        });
}