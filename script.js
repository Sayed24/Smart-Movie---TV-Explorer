/* ==================================================
   CONFIG
================================================== */
const API_KEY = 'REPLACE_WITH_YOUR_TMDB_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

/* ==================================================
   DOM ELEMENTS
================================================== */
const movieGrid = document.getElementById('movieGrid');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('movieModal');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalDate = document.getElementById('modalDate');
const modalRating = document.getElementById('modalRating');
const trailerLink = document.getElementById('trailerLink');
const closeModalBtn = document.querySelector('.close-modal');
const themeToggle = document.getElementById('themeToggle');
const genreFilter = document.getElementById('genreFilter');
const yearFilter = document.getElementById('yearFilter');
const randomBtn = document.getElementById('randomBtn');

/* ==================================================
   STATE
================================================== */
let allMovies = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let genres = [];

/* ==================================================
   FETCH HELPERS
================================================== */
async function fetchData(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}&api_key=${API_KEY}`);
  const data = await res.json();
  return data;
}

/* ==================================================
   INIT
================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadPopularMovies();
  loadGenres();
  populateYears();
  applySavedTheme();
});

/* ==================================================
   LOAD MOVIES
================================================== */
async function loadPopularMovies() {
  const data = await fetchData('/movie/popular?language=en-US&page=1');
  allMovies = data.results;
  renderMovies(allMovies);
}

async function searchMovies(query) {
  const data = await fetchData(`/search/movie?query=${encodeURIComponent(query)}`);
  allMovies = data.results;
  renderMovies(allMovies);
}

/* ==================================================
   RENDER MOVIES
================================================== */
function renderMovies(movies) {
  movieGrid.innerHTML = '';

  if (!movies.length) {
    movieGrid.innerHTML = '<p>No results found.</p>';
    return;
  }

  movies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';

    card.innerHTML = `
      <img src="${movie.poster_path ? IMG_URL + movie.poster_path : ''}" alt="${movie.title}">
      <div class="favorite ${favorites.includes(movie.id) ? 'active' : ''}">
        <i class="fas fa-heart"></i>
      </div>
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p>⭐ ${movie.vote_average}</p>
      </div>
    `;

    // Open modal
    card.addEventListener('click', () => openModal(movie));

    // Favorite toggle
    card.querySelector('.favorite').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(movie.id, e.currentTarget);
    });

    movieGrid.appendChild(card);
  });
}

/* ==================================================
   MODAL
================================================== */
async function openModal(movie) {
  modalPoster.src = movie.poster_path ? IMG_URL + movie.poster_path : '';
  modalTitle.textContent = movie.title;
  modalOverview.textContent = movie.overview || 'No description available.';
  modalDate.textContent = movie.release_date || 'N/A';
  modalRating.textContent = movie.vote_average;

  const trailerData = await fetchData(`/movie/${movie.id}/videos?language=en-US`);
  const trailer = trailerData.results.find(v => v.type === 'Trailer');

  trailerLink.href = trailer
    ? `https://www.youtube.com/watch?v=${trailer.key}`
    : '#';

  modal.classList.remove('hidden');
}

closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.add('hidden');
});

/* ==================================================
   FAVORITES
================================================== */
function toggleFavorite(id, icon) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(f => f !== id);
    icon.classList.remove('active');
  } else {
    favorites.push(id);
    icon.classList.add('active');
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

/* ==================================================
   THEME TOGGLE
================================================== */
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.body.classList.add('light-theme');
  }
}

/* ==================================================
   FILTERS
================================================== */
async function loadGenres() {
  const data = await fetchData('/genre/movie/list?language=en-US');
  genres = data.genres;

  genres.forEach(g => {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent = g.name;
    genreFilter.appendChild(option);
  });
}

genreFilter.addEventListener('change', applyFilters);
yearFilter.addEventListener('change', applyFilters);

function applyFilters() {
  let filtered = [...allMovies];

  if (genreFilter.value) {
    filtered = filtered.filter(movie =>
      movie.genre_ids.includes(Number(genreFilter.value))
    );
  }

  if (yearFilter.value) {
    filtered = filtered.filter(movie =>
      movie.release_date?.startsWith(yearFilter.value)
    );
  }

  renderMovies(filtered);
}

function populateYears() {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 1980; y--) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    yearFilter.appendChild(option);
  }
}

/* ==================================================
   MOVIE OF THE DAY
================================================== */
randomBtn.addEventListener('click', () => {
  if (!allMovies.length) return;
  const random = allMovies[Math.floor(Math.random() * allMovies.length)];
  openModal(random);
});

/* ==================================================
   SEARCH INPUT
================================================== */
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();

  searchTimeout = setTimeout(() => {
    if (query.length > 2) {
      searchMovies(query);
    } else {
      loadPopularMovies();
    }
  }, 500);
});
