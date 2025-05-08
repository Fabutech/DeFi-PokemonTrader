// This function sets up a handler to purchase an NFT using a Web3 call when the "Buy" button is clicked.

function setupBuyNFTHandler() {
    const buyBtn = document.getElementById("buy-btn");

    // Ensure ABI is in object format; parse if it's a JSON string
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
                // Get price from button attribute and convert to Wei
                const priceInEth = buyBtn.getAttribute("data-price"); // e.g., "0.1"
                const price = Web3.utils.toWei(priceInEth, "ether");

                // Ensure tokenId and price are provided
                if (!tokenId || !price) {
                    showStatusMessage("Token ID or price not provided.", false);
                    return;
                }

                // Prompt user to connect wallet if not already connected
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                if (!account) {
                    showStatusMessage("Please connect your wallet first.", false);
                    return;
                }

                // Check if MetaMask is installed
                if (typeof window.ethereum === 'undefined') {
                    showStatusMessage("MetaMask is not installed. Please install it to use this feature.", false);
                    return;
                }

                // Create Web3 instance and contract reference
                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                // Estimate gas and execute purchase transaction
                const estimatedGas = await contract.methods.buyNFT(tokenId).estimateGas({ from: account, value: price });
                await contract.methods.buyNFT(tokenId).send({
                    from: account,
                    value: price,
                    gas: estimatedGas + 1000n // Add a small buffer to the estimated gas
                });

                // Show success message
                showStatusMessage("✅ NFT purchased successfully!");
            } catch (err) {
                console.error("Failed to buy NFT", err);
                showStatusMessage("❌ " + err.message, false);
            }
        });
    }
};