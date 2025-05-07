function setupAuctionNFTHandler() {
    const auctionBtn = document.getElementById("startAuctionBtn");
    const cancelAuctionBtn = document.getElementById("cancelAuctionBtn");
    const placeBidBtn = document.getElementById("place-bid-btn");
    const withdrawBidBtn = document.getElementById("withdraw-bid-btn");
    const finalizeAuctionBtn = document.getElementById("finalize-auction-btn");

    const web3 = new Web3(window.ethereum);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);
    const tradingContract = new web3.eth.Contract(tradingABI, tradingAddress);

    if (auctionBtn) {
        auctionBtn.addEventListener("click", async () => {
            const approvedAddress = await nftContract.methods.getApproved(tokenId).call();
            const isOperatorApproved = await nftContract.methods.isApprovedForAll(userAddress, tradingAddress).call();
      
            if (approvedAddress.toLowerCase() !== tradingAddress.toLowerCase() && !isOperatorApproved) {
                showApprovalPopup(isFromListing=false, isFromAuction=true);
                return;
            }

            const auctionPopup = document.getElementById("auction-popup");
            auctionPopup.style.display = "flex";

            const closeAuction = () => {
                auctionPopup.style.display = "none";
            };
            document.getElementById("close-auction-popup").onclick = closeAuction;

            document.getElementById("confirm-auction-start").onclick = async () => {
                const startingPriceEth = document.getElementById("auction-starting-price").value;
                const endDate = document.getElementById("auction-end-date").value;
                const endTime = document.getElementById("auction-end-time").value;

                if (!startingPriceEth || !endDate || !endTime) {
                    document.getElementById("start-auction-status").innerText = "⚠️ Please fill in all fields.";
                    document.getElementById("start-auction-status").style.color = "red";
                    return;
                }

                const startingPrice = Web3.utils.toWei(startingPriceEth, "ether");
                const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);

                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];

                    const estimatedGas = await tradingContract.methods.startAuction(tokenId, startingPrice, endTimestamp).estimateGas({ from: account });
                    await tradingContract.methods.startAuction(tokenId, startingPrice, endTimestamp).send({
                        from: account,
                        gas: estimatedGas + 1000n
                    });

                    document.getElementById("start-auction-status").innerText = "✅ Auction started successfully!";
                    document.getElementById("start-auction-status").style.color = "green";
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } catch (err) {
                    console.error("Failed to start auction", err);
                    document.getElementById("start-auction-status").innerText = "❌ " + err.message;
                    document.getElementById("start-auction-status").style.color = "red";
                }
            };
        });
    }

    if (cancelAuctionBtn) {
        cancelAuctionBtn.addEventListener("click", async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                if (!account) {
                    showStatusMessage("Please connect your wallet first.", false);
                    return;
                }

                if (typeof window.ethereum === 'undefined') {
                    showStatusMessage("MetaMask is not installed. Please install it to use this feature.", false);
                    return;
                }

                const estimatedGas = await tradingContract.methods.cancelAuction(tokenId).estimateGas({ from: account });
                await tradingContract.methods.cancelAuction(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Auction canceled successfully!");
            } catch (err) {
                console.error("Failed to cancel auction", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }

    if (placeBidBtn) {
        placeBidBtn.addEventListener("click", () => {
            const placeBidPopup = document.getElementById("placeBid-popup");
            placeBidPopup.style.display = "flex";

            const closePlaceBid = () => {
                placeBidPopup.style.display = "none";
            };
            document.getElementById("close-placeBid-popup").onclick = closePlaceBid;

            document.getElementById("confirm-placeBid").onclick = async () => {
                const bidPriceEth = document.getElementById("placeBid-price").value;
                if (!bidPriceEth) {
                    document.getElementById("placeBid-status").innerText = "⚠️ Please enter a bid amount.";
                    document.getElementById("placeBid-status").style.color = "red";
                    return;
                }

                const bidPriceWei = Web3.utils.toWei(bidPriceEth, "ether");

                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];

                    const estimatedGas = await tradingContract.methods.placeBid(tokenId).estimateGas({ from: account, value: bidPriceWei });
                    await tradingContract.methods.placeBid(tokenId).send({
                        from: account,
                        value: bidPriceWei,
                        gas: estimatedGas + 1000n
                    });

                    document.getElementById("placeBid-status").innerText = "✅ Bid placed successfully!";
                    document.getElementById("placeBid-status").style.color = "green";
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } catch (err) {
                    console.error("Failed to place bid", err);
                    document.getElementById("placeBid-status").innerText = "❌ " + err.message;
                    document.getElementById("placeBid-status").style.color = "red";
                }
            };
        });
    }

    // Add withdraw bid handler
    if (withdrawBidBtn) {
        withdrawBidBtn.addEventListener("click", async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                if (!account) {
                    showStatusMessage("Please connect your wallet first.", false);
                    return;
                }

                if (typeof window.ethereum === 'undefined') {
                    showStatusMessage("MetaMask is not installed. Please install it to use this feature.", false);
                    return;
                }

                const estimatedGas = await tradingContract.methods.withdrawBid(tokenId).estimateGas({ from: account });
                await tradingContract.methods.withdrawBid(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Bid withdrawn successfully!");
            } catch (err) {
                console.error("Failed to withdraw bid", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }

    if (finalizeAuctionBtn) {
        finalizeAuctionBtn.addEventListener("click", async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                if (!account) {
                    showStatusMessage("Please connect your wallet first.", false);
                    return;
                }

                if (typeof window.ethereum === 'undefined') {
                    showStatusMessage("MetaMask is not installed. Please install it to use this feature.", false);
                    return;
                }

                const estimatedGas = await tradingContract.methods.finalizeAuction(tokenId).estimateGas({ from: account });

                await tradingContract.methods.finalizeAuction(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Auction finalized successfully!");
            } catch (err) {
                console.error("Failed to finalize auction", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }
}