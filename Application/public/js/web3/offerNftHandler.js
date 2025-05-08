// This function sets up event listeners for NFT offer actions: submitting, withdrawing, and accepting offers via a smart contract.

function setupOfferNFTHandler() {
    const offerBtn = document.getElementById("submit-offer");
    const withdrawBtn = document.getElementById("withdraw-offer-btn");

    if (offerBtn) {
        offerBtn.addEventListener("click", async () => {
            const offerAmount = document.getElementById("offer-amount").value;
            const date = document.getElementById("offer-date").value;
            const time = document.getElementById("offer-time").value;

            const offerStatus = document.getElementById("offer-status");

            // Ensure all required input fields are filled
            if (!offerAmount || !date || !time) {
                offerStatus.innerText = "⚠️ Please fill in all fields.";
                offerStatus.style.color = "red";
                return;
            }

            // Convert expiration time to Unix timestamp
            const expiration = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
            const amountInWei = Web3.utils.toWei(offerAmount, "ether"); // Convert ETH to Wei

            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];

                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                // Estimate gas for making the offer
                const estimatedGas = await contract.methods.makeOffer(tokenId, expiration).estimateGas({
                    from: account,
                    value: amountInWei
                });

                // Submit the offer transaction
                await contract.methods.makeOffer(tokenId, expiration).send({
                    from: account,
                    value: amountInWei,
                    gas: estimatedGas + 1000n
                });

                offerStatus.innerText = "✅ Offer submitted successfully!";
                offerStatus.style.color = "green";
                setTimeout(() => {
                    location.reload(); // Refresh page to reflect state
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

                // Estimate gas and cancel the offer
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

    // Set up event listeners for each 'Accept Offer' button on the page
    const acceptBtns = document.querySelectorAll(".accept-offer-btn");
    console.log(acceptBtns);
    acceptBtns.forEach(btn => {
        console.log("SETUP");
        btn.addEventListener("click", async () => {
            console.log("click noticed");
            const offerer = btn.getAttribute("data"); // Get the offerer's address from button attribute
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                const web3 = new Web3(window.ethereum);
                const contract = new web3.eth.Contract(tradingABI, tradingAddress);

                // Estimate gas and accept the offer
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