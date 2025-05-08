// This script manages the MetaMask wallet connection UI and server sync logic for a web3 application.

window.addEventListener('DOMContentLoaded', async () => {
    // Wait for DOM to load before accessing elements

    // Get references to wallet connection UI elements
    const connectBtn = document.getElementById('connectWallet-btn');
    const connectText = document.getElementById('connectWallet-text');
    const connectIcon = document.getElementById('connectWallet-icon');

    const secondaryConnectBtn = document.getElementById('connectWallet-btn-2');

    // Update the UI based on connection status
    const updateUI = (account) => {
        if (account) {
            connectText.innerText = `Connected`;
            connectIcon.className = 'bx bx-user-check icon'; // Show connected icon
        } else {
            connectText.innerText = 'Connect';
            connectIcon.className = 'bx bx-log-in icon'; // Show disconnected icon
        }
    };

    // Check if MetaMask is locked or account changed
    const checkMetaMaskLockStatus = async () => {
        if (window.ethereum) {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            const account = accounts[0] || null;

            // If account has changed, update state and reload
            if (account !== currentAccount) {
                currentAccount = account;
                updateUI(currentAccount);

                fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
                });

                window.location.reload(); // Optional reload if needed
            }
        }
    };

    let currentAccount = null;

    if (window.ethereum) {
        // Get current connected account, if any
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        currentAccount = accounts[0] || null;
        updateUI(currentAccount);

        // Inform backend of connected address
        fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
        });

        // Handle connect button click
        const handleConnectOnClick = async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

                if (accounts.length === 0) {
                    alert("Please log in to MetaMask and try again.");
                    return;
                }

                currentAccount = accounts[0];
                updateUI(currentAccount);

                // Inform backend of new address
                fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
                });

                window.location.reload(); // Refresh to sync state
            } catch (err) {
                console.error(err);
                if (err.code === 4001) {
                    alert("Connection request was rejected."); // User denied access
                } else {
                    alert("MetaMask is locked. Please unlock it and try again.");
                }
            }
        };

        connectBtn.onclick = handleConnectOnClick;

        if (secondaryConnectBtn) {
            secondaryConnectBtn.onclick = handleConnectOnClick;
        }

        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            currentAccount = accounts[0] || null;
            updateUI(currentAccount);

            fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: currentAccount?.toLowerCase() || null })
            });

            window.location.reload(); // Sync app state
        });

        // Periodically check if MetaMask was locked or changed externally
        setInterval(checkMetaMaskLockStatus, 3000);
    } else {
        // MetaMask not detected
        connectText.innerText = "MetaMask Not Found";
        connectBtn.disabled = true;
    }
});

// Show temporary status popup for success/error messages
function showStatusMessage(message, isSuccess = true) {
    const popup = document.getElementById("status-popup");
    const statusDiv = document.getElementById("status");

    statusDiv.innerText = message;
    statusDiv.style.color = isSuccess ? "green" : "red";

    popup.style.display = "flex";
    setTimeout(() => {
        popup.style.display = "none";
        if (isSuccess) {
            location.reload(); // Refresh on success
        }
    }, 2000);
};