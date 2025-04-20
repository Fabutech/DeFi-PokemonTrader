async function loadTransactionHistory(type, page="0") {
    try {
      let response;

      if (type === "single") {
        response = await fetch(`/api/history/token/${tokenId}?page=${page}`);
      } else if (type === "address") {
        response = await fetch(`/api/history/address/${userAddress}?page=${page}`);
      }

      const transactions = await response.json();

      const historyContainer = document.getElementById('transaction-history');

      transactions.forEach(tx => {
        const date = new Date(tx.timestamp).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}),? ?(\d{2}:\d{2}) ?(AM|PM)?/, (match, d, m, y, t, ap) => {
          return `${d}.${m}.${y}, ${t}${ap ? ' ' + ap : ''}`;
        })

        const card = document.createElement('div');
        card.className = 'long-card';
        card.innerHTML = `
          <div class="testing">${tx.eventType}</div>
          <div class="testing">${tx.price ? (tx.price + ' ETH') : '-'}</div>
          <div class="testing">${tx.from ? truncateAddress(tx.from) : '-'}</div>
          <div class="testing">${tx.to ? truncateAddress(tx.to) : '-'}</div>
          <div class="testing">${date}</div>
        `;
        historyContainer.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load transaction history", err);
    }
  }

  function truncateAddress(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }