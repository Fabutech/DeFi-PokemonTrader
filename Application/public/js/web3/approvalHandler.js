// This function displays an approval popup allowing the user to approve either a single NFT or all NFTs for trading.
// Depending on the origin (listing or auction), it triggers the appropriate action after approval.

function showApprovalPopup(isFromListing = false, isFromAuction = false) {
    // Initialize Web3 and NFT contract instance
    const web3 = new Web3(window.ethereum);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);

    // Display the approval popup
    const popup = document.getElementById("approval-popup");
    popup.style.display = "flex";

    // Cleanup: Hide popup and re-trigger listing or auction actions if necessary
    const cleanup = () => {
        popup.style.display = "none";
        if (isFromListing) {
            const listBtn = document.getElementById("listNFTbtn");
            listBtn.click(); // Retry listing after approval
        } else if (isFromAuction) {
            const auctionBtn = document.getElementById("startAuctionBtn");
            auctionBtn.click(); // Retry auction after approval
        }
    };

    // Status message updater for approval results
    const statusDiv = document.getElementById("approval-status");
    const updateStatus = (msg, success = true) => {
        statusDiv.innerText = msg;
        statusDiv.style.color = success ? 'green' : 'red';
    };

    // Approve a single NFT for trading
    document.getElementById("approve-single").onclick = async () => {
        try {
            await nftContract.methods.approve(tradingAddress, tokenId).send({ from: userAddress });
            updateStatus("✅ Single NFT approved!");
            setTimeout(cleanup, 2000); // Close popup after short delay
        } catch (err) {
            console.log(err);
            updateStatus("❌ Approval failed.", false);
        }
    };

    // Approve all NFTs for trading
    document.getElementById("approve-all").onclick = async () => {
        try {
            await nftContract.methods.setApprovalForAll(tradingAddress, true).send({ from: userAddress });
            updateStatus("✅ All NFTs approved!");
            setTimeout(cleanup, 2000); // Close popup after short delay
        } catch (err) {
            updateStatus("❌ Approval failed.", false);
        }
    };

    // Close popup without performing any approval
    document.getElementById("close-approval-popup").onclick = () => {
        popup.style.display = "none";
    };
};