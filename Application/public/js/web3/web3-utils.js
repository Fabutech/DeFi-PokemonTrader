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