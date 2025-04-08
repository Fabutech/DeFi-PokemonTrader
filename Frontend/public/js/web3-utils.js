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

    let currentAccount = null;

    if (window.ethereum) {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        currentAccount = accounts[0] || null;
        updateUI(currentAccount);

        console.log(accounts);

        fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: currentAccount.toLowerCase() })
        });

        connectBtn.onclick = async () => {
            try {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                currentAccount = accounts[0];
                updateUI(currentAccount);

                fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: currentAccount.toLowerCase() })
                });

                window.location.reload();
            } catch (err) {
                console.error(err);
                alert("Wallet connection failed.");
            }
        };

        window.ethereum.on('accountsChanged', (accounts) => {
            currentAccount = accounts[0] || null;
            updateUI(currentAccount);

            fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: currentAccount.toLowerCase() })
            });

            window.location.reload();
        });
    } else {
        connectText.innerText = "MetaMask Not Found";
        connectBtn.disabled = true;
    }
});