// This function sets up the auction listing handler, enabling a user to list an NFT for auction through a Web3 contract interaction.

function setupAuctionHandler() {
    const auctionBtn = document.getElementById("auctionNFTbtn");

    if (auctionBtn) {
        auctionBtn.addEventListener("click", async () => {
            const startingPriceInEth = document.getElementById("auction-price").value;
            // Convert ETH to Wei
            const startingPrice = Web3.utils.toWei(startingPriceInEth, "ether");

            const startDate = document.getElementById("auction-start-date").value;
            const startTime = document.getElementById("auction-start-time").value;
            const endDate = document.getElementById("auction-end-date").value;
            const endTime = document.getElementById("auction-end-time").value;

            // Validate that all fields are filled
            if (!startingPriceInEth || !startDate || !startTime || !endDate || !endTime) {
                document.getElementById("auction-status").innerText = "⚠️ Please fill in all fields.";
                document.getElementById("auction-status").style.color = "red";
                return;
            }

            // Convert date and time strings to Unix timestamps
            const startTimestamp = Math.floor(new Date(`${startDate}T${startTime}`).getTime() / 1000);
            const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);

            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                // Estimate and send the transaction for starting the auction
                const estimatedGas = await contract.methods.startAuction(tokenId, startingPrice, startTimestamp, endTimestamp).estimateGas({ from: account });
                await contract.methods.startAuction(tokenId, startingPrice, startTimestamp, endTimestamp).send({
                    from: account,
                    gas: estimatedGas + 1000n
                });

                // Show success message
                document.getElementById("auction-status").innerText = "✅ Auction started successfully!";
                document.getElementById("auction-status").style.color = "green";
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } catch (err) {
                // Handle error and show error message in UI
                console.error("Failed to start auction", err);
                document.getElementById("auction-status").innerText = "❌ " + err.message;
                document.getElementById("auction-status").style.color = "red";
            }
        });
    }
}
function setupListNFTHandler() {
    const listBtn = document.getElementById("listNFTbtn");
    const delistBtn = document.getElementById("delistNFTbtn");

    // Initialize Web3 instance and contract objects for NFT and trading contract interactions
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