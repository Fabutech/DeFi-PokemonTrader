// Function to upload Pokémon data to IPFS
async function uploadMetaDataToIPFS(pokemon, ipfs) {
    // Get Pokémon image URL from API response
    const sprite = pokemon.pokemon_v2_pokemonsprites[0]?.sprites.front_default

    // Upload image to IPFS
    const imageResponse = await fetch(sprite);

    console.log(imageResponse);

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log(imageBuffer);
    const imageUploadResult = await ipfs.add(imageBuffer);
    console.log(imageUploadResult);
    const imageCID = imageUploadResult.cid.toString();
    console.log(imageCID);

    // Prepare metadata
    const metadata = {
        name: pokemon.name,
        description: `A Pokémon of type(s): ${pokemon.pokemon_v2_pokemontypes.map(t => t.pokemon_v2_type.name).join(", ")}`,
        attributes: pokemon.pokemon_v2_pokemonstats.map(stat => ({
            trait_type: stat.pokemon_v2_stat.name,
            value: stat.base_stat
        })),
        image: `ipfs://${imageCID}`
    };

    console.log(metadata);

    // Upload metadata to IPFS
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    const metadataUploadResult = await ipfs.add(metadataBuffer);
    const metadataCID = metadataUploadResult.cid.toString();

    return `ipfs://${metadataCID}`;
}

module.exports = uploadMetaDataToIPFS;