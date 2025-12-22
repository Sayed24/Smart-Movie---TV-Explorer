// script.js
const apiKey = 'YOUR_TMDB_API_KEY';
const searchInput = document.getElementById('search');
const movieContainer = document.getElementById('movie-container');

async function searchMovies(query) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results;
}

function displayMovies(movies) {
  movieContainer.innerHTML = '';
  movies.forEach(movie => {
    const movieCard = document.createElement('div');
    movieCard.classList.add('movie-card');
    movieCard.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
      <div class="info">
        <h3>${movie.title}</h3>
        <p>Rating: ${movie.vote_average}</p>
      </div>
    `;
    movieContainer.appendChild(movieCard);
  });
}

searchInput.addEventListener('keyup', async (e) => {
  const query = e.target.value;
  if (query.length > 2) {
    const movies = await searchMovies(query);
    displayMovies(movies);
  }
});

