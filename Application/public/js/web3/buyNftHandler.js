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