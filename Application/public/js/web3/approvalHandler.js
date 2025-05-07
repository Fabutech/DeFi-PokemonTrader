function showApprovalPopup(isFromListing = false, isFromAuction = false) {
    const web3 = new Web3(window.ethereum);
    const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);

    const popup = document.getElementById("approval-popup");
    popup.style.display = "flex";

    const cleanup = () => {
        popup.style.display = "none";
        if (isFromListing) {
            const listBtn = document.getElementById("listNFTbtn");
            listBtn.click();
        } else if (isFromAuction) {
            const auctionBtn = document.getElementById("startAuctionBtn");
            auctionBtn.click();
        }
    };

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
            console.log(err)
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

    document.getElementById("close-approval-popup").onclick = () => {popup.style.display = "none"};
};