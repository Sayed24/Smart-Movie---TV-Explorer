/* ==================================================
   CONFIG
================================================== */
const API_KEY = "YOUR_TMDB_API_KEY"; // 🔴 Replace with your key
const BASE_URL = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

let currentPage = 1;
let totalPages = 1;
let currentType = "movie";
let currentQuery = "";
let currentGenre = "";
let currentYear = "";

/* ==================================================
   ELEMENTS
================================================== */
const grid = document.getElementById("movieGrid");
const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");
const typeFilter = document.getElementById("typeFilter");
const genreFilter = document.getElementById("genreFilter");
const yearFilter = document.getElementById("yearFilter");
const randomBtn = document.getElementById("randomBtn");
const modal = document.getElementById("movieModal");
const pageInfo = document.getElementById("pageInfo");

/* ==================================================
   INIT
================================================== */
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  populateYears();
  loadGenres();
  fetchTrending();
});

/* ==================================================
   THEME
================================================== */
const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-theme") ? "light" : "dark"
  );
});

function loadTheme() {
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
  }
}

/* ==================================================
   SKELETON
================================================== */
function showSkeleton() {
  grid.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const div = document.createElement("div");
    div.className = "skeleton skeleton-card";
    grid.appendChild(div);
  }
}

/* ==================================================
   FETCH FUNCTIONS
================================================== */
async function fetchData(endpoint) {
  showSkeleton();
  const res = await fetch(`${BASE_URL}${endpoint}&api_key=${API_KEY}`);
  const data = await res.json();
  totalPages = data.total_pages || 1;
  renderMovies(data.results || []);
}

function fetchTrending() {
  currentQuery = "";
  fetchData(`/trending/${currentType}/week?page=${currentPage}`);
}

/* ==================================================
   RENDER
================================================== */
function renderMovies(items) {
  grid.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <span class="favorite"><i class="fa fa-heart"></i></span>
      <img src="${item.poster_path ? IMG + item.poster_path : ''}" />
      <div class="movie-info">
        <h3>${item.title || item.name}</h3>
        <p>⭐ ${item.vote_average}</p>
      </div>
    `;

    card.addEventListener("click", () => openModal(item));
    grid.appendChild(card);
  });

  pageInfo.textContent = `Page ${currentPage}`;
}

/* ==================================================
   MODAL
================================================== */
async function openModal(item) {
  modal.classList.remove("hidden");

  document.getElementById("modalPoster").src =
    item.poster_path ? IMG + item.poster_path : "";
  document.getElementById("modalTitle").textContent =
    item.title || item.name;
  document.getElementById("modalOverview").textContent =
    item.overview || "No description available.";
  document.getElementById("modalDate").textContent =
    item.release_date || item.first_air_date || "N/A";
  document.getElementById("modalRating").textContent =
    item.vote_average || "N/A";

  const trailer = await fetch(
    `${BASE_URL}/${currentType}/${item.id}/videos?api_key=${API_KEY}`
  ).then(r => r.json());

  const yt = trailer.results?.find(v => v.site === "YouTube");
  const link = document.getElementById("trailerLink");

  if (yt) {
    link.href = `https://youtube.com/watch?v=${yt.key}`;
    link.style.display = "inline-block";
  } else {
    link.style.display = "none";
  }
}

document.querySelector(".close-modal").onclick = () =>
  modal.classList.add("hidden");

/* ==================================================
   SEARCH + SUGGESTIONS
================================================== */
searchInput.addEventListener("input", async e => {
  const q = e.target.value.trim();
  if (q.length < 2) {
    suggestionsBox.innerHTML = "";
    return;
  }

  const res = await fetch(
    `${BASE_URL}/search/${currentType}?query=${q}&api_key=${API_KEY}`
  );
  const data = await res.json();

  suggestionsBox.innerHTML = "";
  data.results.slice(0, 5).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.title || item.name;
    li.onclick = () => {
      searchInput.value = li.textContent;
      suggestionsBox.innerHTML = "";
      currentQuery = li.textContent;
      currentPage = 1;
      searchMovies();
    };
    suggestionsBox.appendChild(li);
  });
});

function searchMovies() {
  fetchData(
    `/search/${currentType}?query=${currentQuery}&page=${currentPage}`
  );
}

/* ==================================================
   FILTERS
================================================== */
async function loadGenres() {
  const res = await fetch(
    `${BASE_URL}/genre/${currentType}/list?api_key=${API_KEY}`
  );
  const data = await res.json();

  genreFilter.innerHTML = `<option value="">All Genres</option>`;
  data.genres.forEach(g => {
    genreFilter.innerHTML += `<option value="${g.id}">${g.name}</option>`;
  });
}

function populateYears() {
  const year = new Date().getFullYear();
  for (let y = year; y >= 1980; y--) {
    yearFilter.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function applyFilters() {
  let url = `/discover/${currentType}?page=${currentPage}`;

  if (currentGenre) url += `&with_genres=${currentGenre}`;
  if (currentYear) url += `&primary_release_year=${currentYear}`;

  fetchData(url);
}

typeFilter.onchange = () => {
  currentType = typeFilter.value;
  currentPage = 1;
  loadGenres();
  fetchTrending();
};

genreFilter.onchange = () => {
  currentGenre = genreFilter.value;
  currentPage = 1;
  applyFilters();
};

yearFilter.onchange = () => {
  currentYear = yearFilter.value;
  currentPage = 1;
  applyFilters();
};

/* ==================================================
   RANDOM
================================================== */
randomBtn.onclick = async () => {
  const res = await fetch(
    `${BASE_URL}/discover/${currentType}?api_key=${API_KEY}&page=${Math.floor(Math.random() * 10) + 1}`
  );
  const data = await res.json();
  openModal(data.results[Math.floor(Math.random() * data.results.length)]);
};

/* ==================================================
   PAGINATION
================================================== */
document.getElementById("nextPage").onclick = () => {
  if (currentPage < totalPages) {
    currentPage++;
    currentQuery ? searchMovies() : applyFilters();
  }
};

document.getElementById("prevPage").onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    currentQuery ? searchMovies() : applyFilters();
  }
};
