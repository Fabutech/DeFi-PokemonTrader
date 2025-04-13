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
});