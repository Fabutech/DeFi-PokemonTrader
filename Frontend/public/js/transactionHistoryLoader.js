async function loadTransactionHistory(type, page="0") {
    try {
      let response;

      if (type === "single") {
        response = await fetch(`/api/history/token/${tokenId}?page=${page}`);
      } else if (type === "address") {
        response = await fetch(`/api/history/address/${userAddress}?page=${page}`);
      } else if (type === "all") {
        response = await fetch(`/api/history?page=${page}`);
      } else {
        return;
      }

      const transactions = await response.json();

      const historyContainer = document.getElementById('transaction-history');
      historyContainer.innerHTML = "";

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

async function loadTokenOffers(isOwner) {
  try {
    const response = await fetch(`/api/offers/${tokenId}`);
    const data = await response.json();

    const offers = data.offers;
    const currentPrice =  parseFloat(Web3.utils.fromWei(data.currentPrice.toString(), "ether")); // Assuming ETH price string

    const offersTable = document.getElementById('offers-table');
    const offersContainer = document.getElementById('offers-container');

    if (!offersContainer) return;

    offersTable.innerHTML = "";

    if (offers.length === 0) {
      offersContainer.style.display = "none";
    } else {
      offersContainer.style.display = "";
    }

    offers.forEach(offer => {
      const offerPrice = parseFloat(Web3.utils.fromWei(offer[1].toString(), "ether"));
      const expiration = new Date(offer[2] * 1000);
      const now = new Date();
      let expirationDate;

      if (expiration.toDateString() === now.toDateString()) {
        expirationDate = expiration.toLocaleString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        expirationDate = expiration.toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}),?/, (match, d, m, y) => {
          return `${d}.${m}.${y}`;
        });
      }

      const diff = currentPrice > 0 ? (((offerPrice - currentPrice) / currentPrice) * 100).toFixed(1) : "0";
      const diffLabel = currentPrice > 0 ? `${Math.abs(diff)}% ${diff < 0 ? "below" : "above"}` : "-";
      const isExpired = expiration.getTime() < now.getTime();

      const card = document.createElement('div');
      card.className = isExpired ? 'long-card expired' : 'long-card';

      card.innerHTML = `
        <div class="testing">${offerPrice} ETH</div>
        <div class="testing">${diffLabel}</div>
        <div class="testing">${expirationDate}</div>
        <div class="testing">${truncateAddress(offer[0])}</div>
        ${isOwner === "true" && !isExpired ? `<button class="accept-offer-btn" data="${offer[0]}"></button>` : ''}
      `;

      offersTable.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load token offers", err);
  }
}

async function loadAuctionHistory(isOnAuction, startingPrice) {
  if (isOnAuction == "false") return;

  try {
    const response = await fetch(`/api/history/token/${tokenId}/bidsOnCurrentAuction/?page=0`);
    const transactions = await response.json();

    const auctionHistoryTable = document.getElementById('auction-history-table');
    auctionHistoryTable.innerHTML = "";

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

      const diff = (((tx.price - Number(startingPrice)) / Number(startingPrice)) * 100).toFixed(1);
      const diffLabel = `${Math.abs(diff)}% ${diff < 0 ? "below" : "above"}`;

      const card = document.createElement('div');
      card.className = 'long-card';
      card.innerHTML = `
        <div class="testing">${tx.price + ' ETH'}</div>
        <div class="testing">${diffLabel}</div>
        <div class="testing">${tx.from ? truncateAddress(tx.from) : '-'}</div>
        <div class="testing">${date}</div>
      `;
      auctionHistoryTable.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load transaction history", err);
  }
}

function truncateAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}
