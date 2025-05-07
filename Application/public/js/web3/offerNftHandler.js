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