// This script enables both automatic and manual minting of NFTs using metadata fetched from the PokeAPI or user input.
// It also includes a button for toggling the pause state of the trading contract.

async function fetchPokemonData(startIndex, numbOfPokemons) {
    const baseUrl = "https://pokeapi.co/api/v2/pokemon";
    const pokemons = [];

    for (let id = startIndex; id < startIndex + numbOfPokemons; id++) {
        try {
            const res = await fetch(`${baseUrl}/${id}`);
            const data = await res.json();

            // Format and collect relevant data from PokeAPI
            pokemons.push({
                id: data.id,
                name: data.name,
                height: data.height,
                weight: data.weight,
                sprites: data.sprites,
                abilities: data.abilities.map(a => a.ability.name),
                stats: data.stats.map(s => ({
                    name: s.stat.name,
                    base_stat: s.base_stat
                })),
                types: data.types.map(t => t.type.name)
            });
        } catch (e) {
            console.error(`Failed to fetch data for Pokémon ID ${id}:`, e);
        }
    }
    return pokemons;
}

// --- Auto Mint Event Listener ---
document.getElementById('autoMintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('loadingOverlay').classList.add('active');

    const form = e.target;
    const mintTo = form.mintTo.value;
    const startIndex = parseInt(document.getElementById('startIndex').value);
    const amount = parseInt(document.getElementById('amount').value);

    try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];

        // Fetch a batch of Pokémon data
        const pokemons = await fetchPokemonData(startIndex, amount);

        // Upload metadata and images to IPFS
        const ipfsURIs = await Promise.all(pokemons.map(async (pokemon) => {
            let attributes = {};
            pokemon.stats.forEach((stat) => {
                attributes[stat.name] = stat.base_stat;
            });

            const imageUrl = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default || "";

            const metadata = {
                name: pokemon.name,
                height: pokemon.height,
                weight: pokemon.weight,
                description: pokemon.types.join(", "),
                attributes: attributes
            };

            const uploadRes = await fetch('/api/ipfs/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata, imageUrl })
            });

            const { ipfsURI } = await uploadRes.json();
            return ipfsURI;
        }));

        console.log(ipfsURIs);

        // Mint batch NFTs using the smart contract
        const web3 = new Web3(window.ethereum);
        const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);
        const estimatedGas = await nftContract.methods.batchMint(mintTo, ipfsURIs).estimateGas({ from: account });
        await nftContract.methods.batchMint(mintTo, ipfsURIs).send({
            from: account,
            gas: estimatedGas + 1000n // Add small buffer
        });

        document.getElementById('mintStatus').innerHTML = `✅ Successfully minted ${ipfsURIs.length} pokemons from pokeapi to ${mintTo}`;
    } catch (error) {
        console.error(error);
        document.getElementById('mintStatus').innerHTML = `❌ Minting failed: ${error.message || error}`;
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
});

// --- Manual Mint Event Listener ---
document.getElementById('manualMintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('loadingOverlay').classList.add('active');

    const form = e.target;
    const mintTo = form.mintTo.value;
    const name = form.name.value;
    const type = form.type.value;
    const height = parseInt(form.height.value);
    const weight = parseInt(form.weight.value);
    const hp = parseInt(form.hp.value);
    const speed = parseInt(form.speed.value);
    const defense = parseInt(form.defense.value);
    const attack = parseInt(form.attack.value);
    const imageFile = form.image.files[0];

    try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];

        const arrayBuffer = await imageFile.arrayBuffer();

        // Convert ArrayBuffer to Base64
        function arrayBufferToBase64(buffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }

        const imageBytesBase64 = arrayBufferToBase64(arrayBuffer);

        const attributes = { 
            hp: hp,
            speed: speed,
            defense: defense,
            attack: attack 
        };

        const metadata = {
            name: name,
            height: height,
            weight: weight,
            description: type,
            attributes: attributes
        };

        console.log(metadata);
        console.log(imageFile);

        // Upload metadata and image bytes to IPFS
        const uploadRes = await fetch('/api/ipfs/upload-bytes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata, imageBytesBase64 })
        });

        const { ipfsURI } = await uploadRes.json();
        console.log("Minted Metadata URI:", ipfsURI);

        // Mint single NFT using the smart contract
        const web3 = new Web3(window.ethereum);
        const nftContract = new web3.eth.Contract(nftContractABI, nftContractAddress);
        const estimatedGas = await nftContract.methods.mintTo(mintTo, ipfsURI).estimateGas({ from: account });
        await nftContract.methods.mintTo(mintTo, ipfsURI).send({
            from: account,
            gas: estimatedGas + 1000n
        });

        document.getElementById('mintStatus').innerHTML = `✅ Successfully minted your custom pokemon to ${mintTo}`;
    } catch (error) {
        console.error(error);
        document.getElementById('mintStatus').innerHTML = `❌ Minting failed: ${error.message || error}`;
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
});

// --- Contract Pause Toggle ---
const pauseButton = document.getElementById('togglePauseBtn');
const web3 = new Web3(window.ethereum);
const tradingContract = new web3.eth.Contract(tradingContractABI, tradingContractAddress);

async function updatePauseButton() {
    try {
        const isPaused = await tradingContract.methods.paused().call();
        pauseButton.textContent = isPaused ? 'Unpause Contract' : 'Pause Contract';
        pauseButton.className = isPaused ? 'yellow-btn' : 'red-btn';
    } catch (error) {
        pauseButton.textContent = 'Error checking status';
        console.error(error);
    }
}

// Toggle contract pause state
pauseButton.onclick = async function () {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const account = accounts[0];

    try {
        const isPaused = await tradingContract.methods.paused().call();
        if (isPaused) {
            await tradingContract.methods.unpause().send({ from: account });
        } else {
            await tradingContract.methods.pause().send({ from: account });
        }
        updatePauseButton();
    } catch (error) {
        console.error("Error toggling pause:", error);
    }
};

window.addEventListener('load', updatePauseButton);