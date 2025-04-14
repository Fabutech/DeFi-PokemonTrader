export async function fetchPokemonData(numbOfPokemons) {
  const baseUrl = "https://pokeapi.co/api/v2/pokemon";
  const pokemons = [];

  for (let id = 1; id <= numbOfPokemons; id++) {
    try {
      const res = await fetch(`${baseUrl}/${id}`);
      const data = await res.json();

      pokemons.push({
        id: data.id,
        name: data.name,
        height: data.height,
        weight: data.weight,
        sprites: data.sprites, // includes front_default, other artwork, etc.
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