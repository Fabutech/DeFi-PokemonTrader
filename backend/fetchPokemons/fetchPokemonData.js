// Function to fetch Pokémon data from API
async function fetchPokemonData(numbOfPokemons) {
    const query = `
      {
        pokemon_v2_pokemon(limit: ${numbOfPokemons}) {
          id
          name
          height
          weight
          pokemon_v2_pokemonsprites {
            sprites
          }
          pokemon_v2_pokemonabilities {
            pokemon_v2_ability {
                name
            }
          }
          pokemon_v2_pokemonstats {
            pokemon_v2_stat {
                name
            }
            base_stat
          }
          pokemon_v2_pokemontypes {
            pokemon_v2_type {
              name
            }
          }
        }
      }
    `;

    const response = await fetch("https://beta.pokeapi.co/graphql/v1beta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    return data.data.pokemon_v2_pokemon;
}

module.exports = fetchPokemonData;