function setupDutchAuctionHandler() {
    const confirmDutchBtn = document.getElementById("confirm-dutch-auction-start");
    const buyBtn = document.getElementById("buy-from-dutch-auction");
    const cancelAuctionBtn = document.getElementById("cancel-dutch-auction");

    const web3 = new Web3(window.ethereum);
    const tradingContract = new web3.eth.Contract(tradingABI, tradingAddress);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);

    if (confirmDutchBtn) {
        confirmDutchBtn.addEventListener("click", async () => {
            const startPriceEth = document.getElementById("dutch-start-price").value;
            const endPriceEth = document.getElementById("dutch-end-price").value;
            const endDate = document.getElementById("dutch-end-date").value;
            const endTime = document.getElementById("dutch-end-time").value;

            if (!startPriceEth || !endPriceEth || !endDate || !endTime) {
                document.getElementById("start-dutch-auction-status").innerText = "⚠️ Please fill in all fields.";
                document.getElementById("start-dutch-auction-status").style.color = "red";
                return;
            }

            const startPrice = Web3.utils.toWei(startPriceEth, "ether");
            const endPrice = Web3.utils.toWei(endPriceEth, "ether");
            const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);
            const duration = endTimestamp - Math.floor(Date.now() / 1000);

            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                const estimatedGas = await tradingContract.methods.startDutchAuction(tokenId, startPrice, endPrice, duration).estimateGas({ from: account });
                await tradingContract.methods.startDutchAuction(tokenId, startPrice, endPrice, duration).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                document.getElementById("start-dutch-auction-status").innerText = "✅ Dutch auction started successfully!";
                document.getElementById("start-dutch-auction-status").style.color = "green";
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } catch (err) {
                console.error("Failed to start Dutch auction", err);
                document.getElementById("start-dutch-auction-status").innerText = "❌ " + err.message;
                document.getElementById("start-dutch-auction-status").style.color = "red";
            }
        });
    }

    if (buyBtn) {
        buyBtn.addEventListener("click", async () => {
            try {
                const priceInEth = buyBtn.getAttribute("data-price");
                const price = Web3.utils.toWei(priceInEth, "ether");

                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                console.log(account);
                console.log(price);
                console.log(priceInEth);

                const currentTimestamp = Math.floor(Date.now() / 1000);
                const estimatedGas = await tradingContract.methods.buyFromDutchAuction(tokenId, currentTimestamp).estimateGas({
                    from: account,
                    value: price
                });
                await tradingContract.methods.buyFromDutchAuction(tokenId, currentTimestamp).send({
                    from: account,
                    value: price,
                    gas: estimatedGas + 1000n
                });


                showStatusMessage("✅ NFT purchased via Dutch auction!");
            } catch (err) {
                console.error("Failed to buy from Dutch auction", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }

    if (cancelAuctionBtn) {
        cancelAuctionBtn.addEventListener("click", async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                const estimatedGas = await tradingContract.methods.cancelDutchAuction(tokenId).estimateGas({ from: account });
                await tradingContract.methods.cancelDutchAuction(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Dutch auction canceled successfully!");
            } catch (err) {
                console.error("Failed to cancel Dutch auction", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }
}