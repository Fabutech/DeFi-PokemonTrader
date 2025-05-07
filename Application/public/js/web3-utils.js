window.addEventListener('DOMContentLoaded', async () => {
    // Helper to show status messages in popup
    const connectBtn = document.getElementById('connectWallet-btn');
    const connectText = document.getElementById('connectWallet-text');
    const connectIcon = document.getElementById('connectWallet-icon');

    const secondaryConnectBtn = document.getElementById('connectWallet-btn-2');

    const updateUI = (account) => {
        if (account) {
            connectText.innerText = `Connected`;
            connectIcon.className = 'bx bx-user-check icon'; // Logout icon
        } else {
            connectText.innerText = 'Connect';
            connectIcon.className = 'bx bx-log-in icon'; // Login icon
        }
    };

    const checkMetaMaskLockStatus = async () => {
        if (window.ethereum) {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            const account = accounts[0] || null;
    
            if (account !== currentAccount) {
                currentAccount = account;
                updateUI(currentAccount);
    
                fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
                });
    
                window.location.reload(); // Optional: only if needed
            }
        }
    };

    let currentAccount = null;

    if (window.ethereum) {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        currentAccount = accounts[0] || null;
        updateUI(currentAccount);

        fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
        });

        const handleConnectOnClick = async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
                if (accounts.length === 0) {
                    alert("Please log in to MetaMask and try again.");
                    return;
                }
        
                currentAccount = accounts[0];
                updateUI(currentAccount);
        
                fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
                });
        
                window.location.reload();
            } catch (err) {
                console.error(err);
                if (err.code === 4001) {
                    alert("Connection request was rejected.");
                } else {
                    alert("MetaMask is locked. Please unlock it and try again.");
                }
            }
        }

        connectBtn.onclick = handleConnectOnClick;

        if (secondaryConnectBtn) {
            secondaryConnectBtn.onclick = handleConnectOnClick;
        }

        window.ethereum.on('accountsChanged', (accounts) => {
            currentAccount = accounts[0] || null;
            updateUI(currentAccount);

            fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
            });

            window.location.reload();
        });

        setInterval(checkMetaMaskLockStatus, 3000);
    } else {
        connectText.innerText = "MetaMask Not Found";
        connectBtn.disabled = true;
    }
});

function setupListNFTHandler() {
    const listBtn = document.getElementById("listNFTbtn");
    const delistBtn = document.getElementById("delistNFTbtn");

    const web3 = new Web3(window.ethereum);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);
    const tradingContract = new web3.eth.Contract(tradingABI, tradingAddress);

    if (listBtn) {
        listBtn.addEventListener("click", async () => {
            const approvedAddress = await nftContract.methods.getApproved(tokenId).call();
            const isOperatorApproved = await nftContract.methods.isApprovedForAll(userAddress, tradingAddress).call();
      
            if (approvedAddress.toLowerCase() !== tradingAddress.toLowerCase() && !isOperatorApproved) {
                showApprovalPopup(isFromListing=true);
                return;
            }

            const listingPopup = document.getElementById("listing-popup");
            listingPopup.style.display = "flex";

            const closeListing = () => {
                console.log("closed")
                listingPopup.style.display = "none"
            };
            document.getElementById("close-listing-popup").onclick = closeListing;

            document.getElementById("confirm-listing").onclick = async () => {
                const priceInEth = document.getElementById("listing-price").value;
                const price = Web3.utils.toWei(priceInEth, "ether");
                const date = document.getElementById("listing-date").value;
                const time = document.getElementById("listing-time").value;

                if (!priceInEth || !date || !time) {
                    document.getElementById("listing-status").innerText = "⚠️ Please fill in all fields.";
                    document.getElementById("listing-status").style.color = "red";
                    return;
                }

                const expiration = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);

                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];

                    const estimatedGas = await tradingContract.methods.listNFT(tokenId, price, expiration).estimateGas({ from: account });
                    await tradingContract.methods.listNFT(tokenId, price, expiration).send({
                        from: account,
                        gas: estimatedGas + 1000n
                    });

                    document.getElementById("listing-status").innerText = "✅ NFT listed successfully!";
                    document.getElementById("listing-status").style.color = "green";
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } catch (err) {
                    console.error("Failed to list NFT", err);
                    document.getElementById("listing-status").innerText = "❌ " + err.message;
                    document.getElementById("listing-status").style.color = "red";
                }
            };
        });
    }

    if (delistBtn) {
        delistBtn.addEventListener("click", async () => {
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

                const estimatedGas = await tradingContract.methods.delistNFT(tokenId).estimateGas({ from: account });
                await tradingContract.methods.delistNFT(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ NFT delisted successfully!");
            } catch (err) {
                console.error("Failed to list NFT", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }
}
    
function setupBuyNFTHandler() {
    const buyBtn = document.getElementById("buy-btn");

    if (typeof tradingABI === 'string') {
        try {
            tradingABI = JSON.parse(tradingABI);
        } catch (err) {
            console.error("Invalid ABI format:", err);
            alert("Failed to parse contract ABI.");
            return;
        }
    }

    if (buyBtn) {
        buyBtn.addEventListener("click", async () => {
            try {
                const priceInEth = buyBtn.getAttribute("data-price"); // e.g., "0.1"
                const price = Web3.utils.toWei(priceInEth, "ether");

                if (!tokenId || !price) {
                    showStatusMessage("Token ID or price not provided.", false);
                    return;
                }

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

                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                const estimatedGas = await contract.methods.buyNFT(tokenId).estimateGas({ from: account, value: price });
                await contract.methods.buyNFT(tokenId).send({
                    from: account,
                    value: price,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ NFT purchased successfully!");
            } catch (err) {
                console.error("Failed to buy NFT", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }
};

function setupOfferNFTHandler() {
    const offerBtn = document.getElementById("submit-offer");
    const withdrawBtn = document.getElementById("withdraw-offer-btn");

    if (offerBtn) {
        offerBtn.addEventListener("click", async () => {
            const offerAmount = document.getElementById("offer-amount").value;
            const date = document.getElementById("offer-date").value;
            const time = document.getElementById("offer-time").value;

            const offerStatus = document.getElementById("offer-status");

            if (!offerAmount || !date || !time) {
                offerStatus.innerText = "⚠️ Please fill in all fields.";
                offerStatus.style.color = "red";
                return;
            }

            const expiration = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
            const amountInWei = Web3.utils.toWei(offerAmount, "ether");

            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                const estimatedGas = await contract.methods.makeOffer(tokenId, expiration).estimateGas({
                    from: account,
                    value: amountInWei
                });

                await contract.methods.makeOffer(tokenId, expiration).send({
                    from: account,
                    value: amountInWei,
                    gas: estimatedGas + 1000n
                });

                offerStatus.innerText = "✅ Offer submitted successfully!";
                offerStatus.style.color = "green";
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } catch (err) {
                console.error("Failed to submit offer", err);
                offerStatus.innerText = "❌ " + err.message;
                offerStatus.style.color = "red";
            }
        });
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener("click", async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                const estimatedGas = await contract.methods.cancelOffer(tokenId).estimateGas({ from: account });

                await contract.methods.cancelOffer(tokenId).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Offer withdrawn successfully!");
            } catch (err) {
                console.error("Failed to withdraw offer", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }

    // Accept offer buttons
    const acceptBtns = document.querySelectorAll(".accept-offer-btn");
    console.log(acceptBtns);
    acceptBtns.forEach(btn => {
        console.log("SETUP")
        btn.addEventListener("click", async () => {
            console.log("click noticed")
            const offerer = btn.getAttribute("data");
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                const estimatedGas = await contract.methods.acceptOffer(tokenId, offerer).estimateGas({
                    from: account
                });

                await contract.methods.acceptOffer(tokenId, offerer).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                showStatusMessage("✅ Offer accepted successfully!");
            } catch (err) {
                console.error("Failed to accept offer", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    });
};

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

// Dutch Auction Handler
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


function showApprovalPopup(isFromListing = false, isFromAuction = false) {
    const web3 = new Web3(window.ethereum);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);

    const popup = document.getElementById("approval-popup");
    popup.style.display = "flex";

    const cleanup = () => {
        popup.style.display = "none";
        if (isFromListing) {
            const listBtn = document.getElementById("listNFTbtn");
            listBtn.click();
        } else if (isFromAuction) {
            const auctionBtn = document.getElementById("startAuctionBtn");
            auctionBtn.click();
        }
    };

    const statusDiv = document.getElementById("approval-status");
    const updateStatus = (msg, success = true) => {
        statusDiv.innerText = msg;
        statusDiv.style.color = success ? 'green' : 'red';
    };

    document.getElementById("approve-single").onclick = async () => {
        try {
            await nftContract.methods.approve(tradingAddress, tokenId).send({ from: userAddress });
            updateStatus("✅ Single NFT approved!");
            setTimeout(cleanup, 2000);
        } catch (err) {
            console.log(err)
            updateStatus("❌ Approval failed.", false);
        }
    };

    document.getElementById("approve-all").onclick = async () => {
        try {
            await nftContract.methods.setApprovalForAll(tradingAddress, true).send({ from: userAddress });
            updateStatus("✅ All NFTs approved!");
            setTimeout(cleanup, 2000);
        } catch (err) {
            updateStatus("❌ Approval failed.", false);
        }
    };

    document.getElementById("close-approval-popup").onclick = () => {popup.style.display = "none"};
};

function showStatusMessage(message, isSuccess = true) {
    const popup = document.getElementById("status-popup");
    const statusDiv = document.getElementById("status");

    statusDiv.innerText = message;
    statusDiv.style.color = isSuccess ? "green" : "red";

    popup.style.display = "flex";
    setTimeout(() => {
        popup.style.display = "none";
        if (isSuccess) {
            location.reload();
        }
    }, 2000);
};