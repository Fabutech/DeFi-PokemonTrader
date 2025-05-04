// Countdown logic goes here
document.querySelectorAll('.countdown').forEach(countdown => {
    const expiration = parseInt(countdown.getAttribute('data-expiration')) * 1000;
    const timeRemaining = countdown.querySelector('.time-remaining');

    const updateCountdown = () => {
        const now = Date.now();
        const remainingTime = expiration - now;

        if (remainingTime <= 0) {
            timeRemaining.textContent = "Expired";
            clearInterval(interval);
        } else {
            const seconds = Math.floor((remainingTime / 1000) % 60);
            const minutes = Math.floor((remainingTime / 1000 / 60) % 60);
            const hours = Math.floor((remainingTime / 1000 / 60 / 60) % 24);
            const days = Math.floor(remainingTime / 1000 / 60 / 60 / 24);
            timeRemaining.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    };

    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();
});

// Neutral state: all filters enabled means no filtering applied
let activeFilterState = {
    listed: true,
    auction: true,
    delisted: true,
    hasOffers: true
};

function toggleFilterPopup() {
    const popup = document.getElementById('filterPopup');
    if(popup.classList.contains('hidden')) {
        popup.classList.remove('hidden');
    } else {
        popup.classList.add('hidden');
    }
}

function applyFilters() {
    activeFilterState.listed = document.getElementById('filterListed').checked;
    activeFilterState.auction = document.getElementById('filterAuction').checked;
    activeFilterState.delisted = document.getElementById('filterDelisted').checked;
    activeFilterState.hasOffers = document.getElementById('filterHasOffers').checked;
    updateFilterTags();
    filterNFTs();
    toggleFilterPopup();
}

function clearFilters(closePopup = true) {
    document.getElementById('filterListed').checked = true;
    document.getElementById('filterAuction').checked = true;
    document.getElementById('filterDelisted').checked = true;
    document.getElementById('filterHasOffers').checked = true;

    activeFilterState.listed = true;
    activeFilterState.auction = true;
    activeFilterState.delisted = true;
    activeFilterState.hasOffers = true;

    updateFilterTags();
    filterNFTs();

    if (closePopup) toggleFilterPopup();
}

function updateFilterTags() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = '';

    const allSelected = activeFilterState.listed && activeFilterState.auction && activeFilterState.delisted && activeFilterState.hasOffers;
    if (allSelected) return;

    Object.entries(activeFilterState).forEach(([key, value]) => {
        if (!value) return;
        const tag = document.createElement('span');
        tag.className = 'filter-tag';
        tag.textContent = key.charAt(0).toUpperCase() + key.slice(1);

        const close = document.createElement('span');
        close.className = 'filter-tag-close';
        close.textContent = '×';
        close.onclick = () => {
            activeFilterState[key] = false;
            document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}`).checked = false;

            const remainingActive = Object.values(activeFilterState).some(v => v);
            if (!remainingActive) {
                clearFilters(false);
            } else {
                updateFilterTags();
                filterNFTs();
            }
        };

        tag.appendChild(close);
        container.appendChild(tag);
    });
}

function filterNFTs() {
    const input = document.getElementById('marketplaceSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.nft-link');

    cards.forEach(card => {
        const name = card.querySelector('.nft-name')?.textContent.toLowerCase() || "";
        const tokenId = card.getAttribute('href').split('/').pop();
        const isListed = card.classList.contains('nft-listed');
        const isOnAuction = card.classList.contains('nft-auction');
        const hasOffers = card.classList.contains('nft-hasOffers');

        const passesFilter = 
            (activeFilterState.listed && isListed) ||
            (activeFilterState.auction && isOnAuction) ||
            (activeFilterState.delisted && !isListed && !isOnAuction) ||
            (activeFilterState.hasOffers && hasOffers);


        if ((name.includes(input) || tokenId.includes(input)) && passesFilter) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    // Check visibility of each section
    document.querySelectorAll('.marketplace-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.nft-link:not([style*="display: none"])');
        const sectionTitle = section.querySelector('.section-title');
        if (visibleCards.length === 0) {
            section.style.display = 'none';
        } else {
            section.style.display = '';
        }
    });
}

updateFilterTags();