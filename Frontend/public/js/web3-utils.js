window.addEventListener('DOMContentLoaded', async () => {
    const connectBtn = document.getElementById('connectWallet-btn');
    const connectText = document.getElementById('connectWallet-text');
    const connectIcon = document.getElementById('connectWallet-icon');

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

        connectBtn.onclick = async () => {
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
        };

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

    const setupListNFTHandler = () => {
        const listBtn = document.getElementById("listNFTbtn");
        const delistBtn = document.getElementById("delistNFTbtn");

        const web3 = new Web3(window.ethereum);
        const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);
        const tradingContract = new web3.eth.Contract(tradingABI, tradingAddress);

        if (listBtn) {
            const showApprovalPopup = () => {
                const popup = document.createElement('div');
                popup.className = 'approval-popup';
                popup.innerHTML = `
                  <div class="popup-content">
                    <h2>Approval Needed</h2>
                    <p>To list your Pokémon NFT, you must first approve the trading contract to manage your NFT.</p>
                    <p>You can choose to approve just this NFT or all your NFTs.</p>
                    <div class="popup-buttons">
                      <button id="approve-single" class="blue-btn">Approve This NFT</button>
                      <button id="approve-all" class="white-btn">Approve All NFTs</button>
                    </div>
                    <div id="approval-status"></div>
                  </div>
                `;
                document.body.appendChild(popup);
          
                const cleanup = () => popup.remove();
          
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
            };

            listBtn.addEventListener("click", async () => {
                const approvedAddress = await nftContract.methods.getApproved(tokenId).call();
                const isOperatorApproved = await nftContract.methods.isApprovedForAll(userAddress, tradingAddress).call();
          
                if (approvedAddress.toLowerCase() !== tradingAddress.toLowerCase() && !isOperatorApproved) {
                    showApprovalPopup();
                    return;
                }

                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];
                    if (!account) {
                        alert("Please connect your wallet first.");
                        return;
                    }
    
                    if (typeof window.ethereum === 'undefined') {
                        alert("MetaMask is not installed. Please install it to use this feature.");
                        return;
                    }
        
                    const estimatedGas = await tradingContract.methods.listNFT(tokenId, 1000).estimateGas({ from: account });
                    await tradingContract.methods.listNFT(tokenId, 1000).send({
                        from: account,
                        gas: estimatedGas + 1000n
                    });
    
                    alert("NFT delisted successfully!");
                    location.reload();
                } catch (err) {
                    console.error("Failed to list NFT", err);
                    alert("Error: " + err.message);
                }
            });
        }

        if (delistBtn) {
            delistBtn.addEventListener("click", async () => {
                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];
                    if (!account) {
                        alert("Please connect your wallet first.");
                        return;
                    }
    
                    if (typeof window.ethereum === 'undefined') {
                        alert("MetaMask is not installed. Please install it to use this feature.");
                        return;
                    }
    
                    const estimatedGas = await tradingContract.methods.delistNFT(tokenId).estimateGas({ from: account });
                    await tradingContract.methods.delistNFT(tokenId).send({
                        from: account,
                        gas: estimatedGas + 1000n
                    });
    
                    alert("NFT listed successfully!");
                    location.reload();
                } catch (err) {
                    console.error("Failed to list NFT", err);
                    alert("Error: " + err.message);
                }
            });
        }
    }
        
    const setupBuyNFTHandler = () => {
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

                    console.log("PRICE: " + price)

                    if (!tokenId || !price) {
                        alert("Token ID or price not provided.");
                        return;
                    }

                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    const account = accounts[0];
                    if (!account) {
                        alert("Please connect your wallet first.");
                        return;
                    }

                    if (typeof window.ethereum === 'undefined') {
                        alert("MetaMask is not installed. Please install it to use this feature.");
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

                    alert("NFT purchased successfully!");
                    location.reload();
                } catch (err) {
                    console.error("Failed to buy NFT", err);
                    alert("Error: " + err.message);
                }
            });
        }
    };

    setupListNFTHandler();
    setupBuyNFTHandler();
});