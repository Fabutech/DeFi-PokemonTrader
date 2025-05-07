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