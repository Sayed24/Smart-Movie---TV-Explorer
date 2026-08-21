"use strict";

/* =========================================================
   CineScope — Smart Movie & TV Explorer
   TMDB v3 API + Vanilla JavaScript
   ========================================================= */

const APP = {
  name: "CineScope",
  apiBase: "https://api.themoviedb.org/3",
  apiKey: "dc56314274bca0c41b789627e1f235da",
  imageBase: "https://image.tmdb.org/t/p",
  storage: {
    apiKey: "cinescope_tmdb_api_key",
    favorites: "cinescope_favorites_v2",
    theme: "cinescope_theme"
  }
};

const state = {
  type: "movie",
  mode: "trending",
  query: "",
  page: 1,
  totalPages: 1,
  totalResults: 0,
  genres: [],
  items: [],
  featured: null,
  favoritesOnly: false,
  filters: {
    genre: "",
    year: "",
    rating: "",
    sort: "popularity.desc"
  },
  apiKey: APP.apiKey,
  favorites: loadFavorites(),
  requestController: null,
  suggestionController: null,
  suggestionIndex: -1,
  lastFocusedElement: null
};

const cache = new Map();

const els = {
  body: document.body,
  searchInput: document.getElementById("searchInput"),
  searchClear: document.getElementById("searchClear"),
  suggestions: document.getElementById("suggestions"),
  themeToggle: document.getElementById("themeToggle"),
  apiSettingsButton: document.getElementById("apiSettingsButton"),
  hero: document.getElementById("hero"),
  heroBackdrop: document.getElementById("heroBackdrop"),
  heroEyebrow: document.getElementById("heroEyebrow"),
  heroTitle: document.getElementById("heroTitle"),
  heroDescription: document.getElementById("heroDescription"),
  heroMeta: document.getElementById("heroMeta"),
  heroDetailsButton: document.getElementById("heroDetailsButton"),
  randomButton: document.getElementById("randomButton"),
  sectionKicker: document.getElementById("sectionKicker"),
  sectionTitle: document.getElementById("sectionTitle"),
  sectionDescription: document.getElementById("sectionDescription"),
  filterToggle: document.getElementById("filterToggle"),
  filterCount: document.getElementById("filterCount"),
  filterPanel: document.getElementById("filterPanel"),
  genreFilter: document.getElementById("genreFilter"),
  yearFilter: document.getElementById("yearFilter"),
  ratingFilter: document.getElementById("ratingFilter"),
  sortFilter: document.getElementById("sortFilter"),
  clearFiltersButton: document.getElementById("clearFiltersButton"),
  applyFiltersButton: document.getElementById("applyFiltersButton"),
  resultsLabel: document.getElementById("resultsLabel"),
  contentGrid: document.getElementById("contentGrid"),
  favoritesCount: document.getElementById("favoritesCount"),
  favoritesInlineCount: document.getElementById("favoritesInlineCount"),
  mobileFavoritesCount: document.getElementById("mobileFavoritesCount"),
  favoritesViewButton: document.getElementById("favoritesViewButton"),
  offlineNotice: document.getElementById("offlineNotice"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyMessage: document.getElementById("emptyMessage"),
  emptyActionButton: document.getElementById("emptyActionButton"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  retryButton: document.getElementById("retryButton"),
  errorApiButton: document.getElementById("errorApiButton"),
  pagination: document.getElementById("pagination"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageCurrent: document.getElementById("pageCurrent"),
  pageTotal: document.getElementById("pageTotal"),
  detailsModal: document.getElementById("detailsModal"),
  detailsClose: document.getElementById("detailsClose"),
  detailsContent: document.getElementById("detailsContent"),
  apiModal: document.getElementById("apiModal"),
  apiClose: document.getElementById("apiClose"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiStatus: document.getElementById("apiStatus"),
  toggleApiVisibility: document.getElementById("toggleApiVisibility"),
  saveApiKeyButton: document.getElementById("saveApiKeyButton"),
  removeApiKeyButton: document.getElementById("removeApiKeyButton"),
  toastRegion: document.getElementById("toastRegion")
};

init();

function init() {
  applyStoredTheme();
  populateYears();
  bindEvents();
  updateFavoritesUI();
  updateOnlineState();
  syncControls();

  loadGenres().finally(() => loadContent());
}

/* =========================================================
   API
   ========================================================= */
function buildApiUrl(path, params = {}) {
  const url = new URL(`${APP.apiBase}${path}`);
  const merged = { language: "en-US", ...params, api_key: state.apiKey };
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function api(path, params = {}, options = {}) {
  if (!state.apiKey) throw new Error("TMDB API key is not configured.");

  const url = buildApiUrl(path, params);
  const cacheKey = `${path}?${new URL(url).searchParams.toString()}`;
  if (!options.skipCache && cache.has(cacheKey)) return cache.get(cacheKey);

  const response = await fetch(url, { signal: options.signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    let message = `TMDB request failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (payload.status_message) message = payload.status_message;
    } catch (_) {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (!options.skipCache) cache.set(cacheKey, data);
  return data;
}

async function testApiKey(key) {
  const url = new URL(`${APP.apiBase}/configuration`);
  url.searchParams.set("api_key", key.trim());
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  return response.ok;
}

/* =========================================================
   Loading content / state routing
   ========================================================= */
async function loadContent({ scroll = false } = {}) {
  if (!state.apiKey) {
    renderNoApiState();
    return;
  }

  if (state.favoritesOnly) {
    renderFavorites();
    return;
  }

  if (state.requestController) state.requestController.abort();
  state.requestController = new AbortController();

  showLoading();
  try {
    const params = { page: state.page };
    let path;

    if (state.query) {
      path = `/search/${state.type}`;
      params.query = state.query;
      params.include_adult = false;
    } else if (hasActiveFilters()) {
      path = `/discover/${state.type}`;
      params.include_adult = false;
      params.include_video = false;
      params.sort_by = normalizedSortForType();
      params[yearParam()] = state.filters.year;
      params.with_genres = state.filters.genre;
      if (state.filters.rating) {
        params["vote_average.gte"] = state.filters.rating;
        params["vote_count.gte"] = 100;
      }
    } else if (state.mode === "trending") {
      path = `/trending/${state.type}/week`;
    } else {
      path = listEndpoint();
    }

    const data = await api(path, params, { signal: state.requestController.signal, skipCache: false });
    state.items = Array.isArray(data.results) ? data.results : [];
    state.totalPages = Math.min(Number(data.total_pages) || 1, 500);
    state.totalResults = Number(data.total_results) || state.items.length;

    renderItems();
    updateHeroFromItems();
    updatePageText();
    updatePagination();
    hideStates();

    if (scroll) scrollToExplorer();
  } catch (error) {
    if (error.name === "AbortError") return;
    showError(error);
  } finally {
    els.contentGrid.setAttribute("aria-busy", "false");
  }
}

function listEndpoint() {
  if (state.type === "movie") {
    const endpoints = {
      popular: "/movie/popular",
      top_rated: "/movie/top_rated",
      upcoming: "/movie/upcoming"
    };
    return endpoints[state.mode] || "/movie/popular";
  }
  const endpoints = {
    popular: "/tv/popular",
    top_rated: "/tv/top_rated",
    upcoming: "/tv/on_the_air"
  };
  return endpoints[state.mode] || "/tv/popular";
}

function yearParam() {
  return state.type === "movie" ? "primary_release_year" : "first_air_date_year";
}

function normalizedSortForType() {
  if (state.type === "tv" && ["primary_release_date.desc", "revenue.desc"].includes(state.filters.sort)) {
    return "first_air_date.desc";
  }
  return state.filters.sort;
}

function hasActiveFilters() {
  return Boolean(state.filters.genre || state.filters.year || state.filters.rating || state.filters.sort !== "popularity.desc");
}

/* =========================================================
   Render cards
   ========================================================= */
function renderItems() {
  els.contentGrid.innerHTML = "";
  if (!state.items.length) {
    showEmpty("No titles found", "Try a different search, category, or filter combination.");
    return;
  }

  const fragment = document.createDocumentFragment();
  state.items.forEach(item => fragment.appendChild(createMediaCard(normalizeItem(item, state.type))));
  els.contentGrid.appendChild(fragment);
}

function createMediaCard(item) {
  const article = document.createElement("article");
  article.className = "media-card";
  article.dataset.id = String(item.id);
  article.dataset.type = item.mediaType;

  const saved = isFavorite(item.id, item.mediaType);
  const year = getYear(item.date);
  const rating = formatRating(item.rating);
  const poster = item.poster
    ? `<img class="poster" src="${imageUrl(item.poster, "w500")}" alt="${escapeHtml(item.title)} poster" loading="lazy" decoding="async">`
    : `<div class="poster-placeholder" role="img" aria-label="No poster available">${escapeHtml(item.title)}</div>`;

  article.innerHTML = `
    <button class="poster-button" type="button" aria-label="View details for ${escapeHtml(item.title)}">
      <div class="poster-wrap">
        ${poster}
        <span class="media-badge">${item.mediaType === "movie" ? "Movie" : "TV"}</span>
        ${rating !== "—" ? `<span class="card-rating"><svg class="icon" viewBox="0 0 24 24"><use href="#icon-star"></use></svg>${rating}</span>` : ""}
      </div>
      <div class="card-copy">
        <h3 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <div class="card-meta"><span>${year || "Date TBA"}</span><span class="card-dot"></span><span>${genreName(item.genreIds?.[0]) || (item.mediaType === "movie" ? "Movie" : "Series")}</span></div>
      </div>
    </button>
    <button class="favorite-button ${saved ? "is-saved" : ""}" type="button" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(item.title)} ${saved ? "from" : "to"} My List" aria-pressed="${saved}">
      <svg class="icon" viewBox="0 0 24 24"><use href="#icon-${saved ? "heart-filled" : "heart"}"></use></svg>
    </button>`;

  article.querySelector(".poster-button").addEventListener("click", () => openDetails(item));
  article.querySelector(".favorite-button").addEventListener("click", event => {
    event.stopPropagation();
    toggleFavorite(item);
  });

  return article;
}

function showLoading() {
  hideStates();
  els.contentGrid.setAttribute("aria-busy", "true");
  els.resultsLabel.textContent = "Loading titles…";
  els.pagination.hidden = true;
  els.contentGrid.innerHTML = Array.from({ length: 12 }, () => `
    <article class="media-card skeleton-card" aria-hidden="true">
      <div class="poster-wrap skeleton-block"></div>
      <div class="skeleton-line skeleton-block"></div>
      <div class="skeleton-line short skeleton-block"></div>
    </article>`).join("");
}

/* =========================================================
   Hero
   ========================================================= */
function updateHeroFromItems() {
  const candidate = state.items.find(item => item.backdrop_path) || state.items[0];
  if (!candidate) return;
  state.featured = normalizeItem(candidate, state.type);
  const item = state.featured;

  els.heroTitle.textContent = item.title;
  els.heroDescription.textContent = item.overview || "Discover details, ratings, cast information and trailers.";
  els.heroEyebrow.textContent = state.query ? `Search result · ${state.type === "movie" ? "Movie" : "TV"}` : heroEyebrowText();
  els.heroMeta.innerHTML = [
    item.rating ? `<span class="hero-meta-item rating"><svg class="icon" viewBox="0 0 24 24"><use href="#icon-star"></use></svg>${formatRating(item.rating)}</span>` : "",
    getYear(item.date) ? `<span class="hero-meta-item"><svg class="icon" viewBox="0 0 24 24"><use href="#icon-calendar"></use></svg>${getYear(item.date)}</span>` : "",
    `<span class="hero-pill">${item.mediaType === "movie" ? "Movie" : "TV Series"}</span>`,
    genreName(item.genreIds?.[0]) ? `<span class="hero-pill">${escapeHtml(genreName(item.genreIds[0]))}</span>` : ""
  ].filter(Boolean).join("");

  els.heroBackdrop.style.backgroundImage = item.backdrop ? `url("${imageUrl(item.backdrop, "original")}")` : "";
  els.heroDetailsButton.disabled = false;
}

function heroEyebrowText() {
  const names = { trending: "Trending this week", popular: "Popular right now", top_rated: "Top rated", upcoming: state.type === "movie" ? "Coming soon" : "On the air" };
  return names[state.mode] || "Featured";
}

function resetHero() {
  state.featured = null;
  els.heroBackdrop.style.backgroundImage = "";
  els.heroEyebrow.textContent = "Smart discovery";
  els.heroTitle.textContent = "Find your next great watch.";
  els.heroDescription.textContent = "Explore movies and TV shows with search, smart filters, trailers, ratings, cast details, and a watchlist that stays on your device.";
  els.heroMeta.innerHTML = "";
  els.heroDetailsButton.disabled = true;
}

/* =========================================================
   Details modal
   ========================================================= */
async function openDetails(itemLike) {
  const item = normalizeItem(itemLike, itemLike.mediaType || state.type);
  if (!state.apiKey) {
    openApiModal(true);
    return;
  }

  state.lastFocusedElement = document.activeElement;
  els.detailsContent.innerHTML = `<div class="details-loading"><div class="spinner"></div><p>Loading details…</p></div>`;
  showModal(els.detailsModal);

  try {
    const [details, providers] = await Promise.all([
      api(`/${item.mediaType}/${item.id}`, { append_to_response: "videos,credits,recommendations" }),
      api(`/${item.mediaType}/${item.id}/watch/providers`).catch(() => ({ results: {} }))
    ]);
    renderDetails(details, providers, item.mediaType);
  } catch (error) {
    els.detailsContent.innerHTML = `<div class="details-loading"><p>${escapeHtml(error.message || "Could not load details.")}</p></div>`;
  }
}

function renderDetails(details, providersData, mediaType) {
  const item = normalizeItem(details, mediaType);
  const backdrop = item.backdrop || item.poster;
  const trailer = pickTrailer(details.videos?.results || []);
  const cast = (details.credits?.cast || []).slice(0, 8);
  const genres = (details.genres || []).map(g => g.name);
  const runtime = mediaType === "movie" ? details.runtime : details.episode_run_time?.[0];
  const providerRegion = providersData.results?.US || Object.values(providersData.results || {})[0];
  const providers = uniqueProviders([...(providerRegion?.flatrate || []), ...(providerRegion?.rent || []), ...(providerRegion?.buy || [])]).slice(0, 8);
  const saved = isFavorite(item.id, mediaType);

  els.detailsContent.innerHTML = `
    <div class="details-hero">
      <div class="details-backdrop" style="${backdrop ? `background-image:url('${imageUrl(backdrop, "original")}')` : ""}"></div>
      <div class="details-heading">
        <h2 id="modalTitle">${escapeHtml(item.title)}</h2>
        ${details.tagline ? `<p class="details-tagline">${escapeHtml(details.tagline)}</p>` : ""}
        <div class="details-meta">
          ${item.rating ? `<span class="detail-chip">★ ${formatRating(item.rating)}</span>` : ""}
          ${getYear(item.date) ? `<span class="detail-chip">${getYear(item.date)}</span>` : ""}
          ${runtime ? `<span class="detail-chip">${formatRuntime(runtime)}</span>` : ""}
          ${genres.slice(0, 3).map(g => `<span class="detail-chip">${escapeHtml(g)}</span>`).join("")}
        </div>
      </div>
    </div>
    <div class="details-body">
      <div class="details-main">
        <div>
          <section class="details-overview">
            <h3>Storyline</h3>
            <p>${escapeHtml(item.overview || "No overview is available for this title yet.")}</p>
          </section>
          <div class="details-actions">
            ${trailer ? `<a class="primary-button" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}" target="_blank" rel="noreferrer"><svg class="icon" viewBox="0 0 24 24"><use href="#icon-play"></use></svg>Watch trailer</a>` : ""}
            <button class="secondary-button" id="modalFavoriteButton" type="button"><svg class="icon" viewBox="0 0 24 24"><use href="#icon-${saved ? "heart-filled" : "heart"}"></use></svg>${saved ? "Saved to My List" : "Add to My List"}</button>
          </div>
          ${cast.length ? `<section class="cast-section" style="margin-top:24px"><h3>Top cast</h3><div class="cast-scroller">${cast.map(renderCastCard).join("")}</div></section>` : ""}
        </div>
        <aside class="details-sidebar">
          <div class="info-list">
            <div class="info-item"><span>Status</span><strong>${escapeHtml(details.status || "Unknown")}</strong></div>
            <div class="info-item"><span>Language</span><strong>${escapeHtml((details.original_language || "—").toUpperCase())}</strong></div>
            <div class="info-item"><span>${mediaType === "movie" ? "Release" : "First aired"}</span><strong>${formatDate(item.date)}</strong></div>
            <div class="info-item"><span>${mediaType === "movie" ? "Runtime" : "Seasons"}</span><strong>${mediaType === "movie" ? (runtime ? formatRuntime(runtime) : "—") : (details.number_of_seasons ?? "—")}</strong></div>
          </div>
          ${providers.length ? `<section class="provider-section"><h3>Available on</h3><div class="provider-list">${providers.map(p => `<img class="provider-logo" src="${imageUrl(p.logo_path,"w92")}" alt="${escapeHtml(p.provider_name)}" title="${escapeHtml(p.provider_name)}" loading="lazy">`).join("")}</div><p class="provider-note">Streaming availability data by JustWatch via TMDB. Availability varies by region.</p></section>` : ""}
          <a class="text-button" href="https://www.themoviedb.org/${mediaType}/${item.id}" target="_blank" rel="noreferrer">View on TMDB <svg class="icon" viewBox="0 0 24 24"><use href="#icon-external"></use></svg></a>
        </aside>
      </div>
    </div>`;

  const favoriteButton = document.getElementById("modalFavoriteButton");
  if (favoriteButton) favoriteButton.addEventListener("click", () => {
    toggleFavorite({ ...item, genres: details.genres });
    const nowSaved = isFavorite(item.id, mediaType);
    favoriteButton.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><use href="#icon-${nowSaved ? "heart-filled" : "heart"}"></use></svg>${nowSaved ? "Saved to My List" : "Add to My List"}`;
  });
}

function renderCastCard(person) {
  const photo = person.profile_path
    ? `<img class="cast-photo" src="${imageUrl(person.profile_path, "w185")}" alt="${escapeHtml(person.name)}" loading="lazy">`
    : `<div class="cast-fallback" aria-hidden="true">${escapeHtml(initials(person.name))}</div>`;
  return `<article class="cast-card">${photo}<p class="cast-name" title="${escapeHtml(person.name)}">${escapeHtml(person.name)}</p><p class="cast-role" title="${escapeHtml(person.character || "")}">${escapeHtml(person.character || "Cast")}</p></article>`;
}

function pickTrailer(videos) {
  return videos.find(v => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
         videos.find(v => v.site === "YouTube" && v.type === "Trailer") ||
         videos.find(v => v.site === "YouTube");
}

/* =========================================================
   Search + suggestions
   ========================================================= */
const debouncedSuggestions = debounce(loadSuggestions, 280);

async function loadSuggestions() {
  const query = els.searchInput.value.trim();
  if (query.length < 2 || !state.apiKey) {
    closeSuggestions();
    return;
  }

  if (state.suggestionController) state.suggestionController.abort();
  state.suggestionController = new AbortController();

  try {
    const data = await api(`/search/${state.type}`, { query, page: 1, include_adult: false }, { signal: state.suggestionController.signal, skipCache: true });
    renderSuggestions((data.results || []).slice(0, 7));
  } catch (error) {
    if (error.name !== "AbortError") closeSuggestions();
  }
}

function renderSuggestions(items) {
  state.suggestionIndex = -1;
  if (!items.length) {
    els.suggestions.innerHTML = `<div class="suggestion-item" aria-disabled="true"><div></div><div class="suggestion-copy"><strong>No suggestions</strong><span>Try another title</span></div></div>`;
  } else {
    els.suggestions.innerHTML = items.map((raw, index) => {
      const item = normalizeItem(raw, state.type);
      const poster = item.poster ? imageUrl(item.poster, "w92") : "";
      return `<button class="suggestion-item" type="button" role="option" data-index="${index}" data-id="${item.id}">
        ${poster ? `<img class="suggestion-poster" src="${poster}" alt="" loading="lazy">` : `<div class="suggestion-poster poster-placeholder">${escapeHtml(initials(item.title))}</div>`}
        <span class="suggestion-copy"><strong>${escapeHtml(item.title)}</strong><span>${getYear(item.date) || "Date TBA"} · ${state.type === "movie" ? "Movie" : "TV"}</span></span>
        <span class="suggestion-score">${item.rating ? `<svg class="icon" viewBox="0 0 24 24"><use href="#icon-star"></use></svg>${formatRating(item.rating)}` : ""}</span>
      </button>`;
    }).join("");

    [...els.suggestions.querySelectorAll(".suggestion-item")].forEach((button, index) => {
      button.addEventListener("click", () => {
        const item = normalizeItem(items[index], state.type);
        els.searchInput.value = item.title;
        state.query = item.title;
        state.page = 1;
        state.favoritesOnly = false;
        updateSearchUI();
        closeSuggestions();
        loadContent({ scroll: true });
      });
    });
  }
  els.suggestions.hidden = false;
  els.searchInput.setAttribute("aria-expanded", "true");
}

function submitSearch() {
  const query = els.searchInput.value.trim();
  state.query = query;
  state.page = 1;
  state.favoritesOnly = false;
  updateSearchUI();
  closeSuggestions();
  if (query) {
    setActiveNav("");
    loadContent({ scroll: true });
  } else {
    loadContent({ scroll: true });
  }
}

function closeSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  els.searchInput.setAttribute("aria-expanded", "false");
  state.suggestionIndex = -1;
}

function handleSearchKeydown(event) {
  const options = [...els.suggestions.querySelectorAll(".suggestion-item:not([aria-disabled])")];
  if (!els.suggestions.hidden && options.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    state.suggestionIndex += event.key === "ArrowDown" ? 1 : -1;
    if (state.suggestionIndex < 0) state.suggestionIndex = options.length - 1;
    if (state.suggestionIndex >= options.length) state.suggestionIndex = 0;
    options.forEach((el, i) => el.classList.toggle("is-active", i === state.suggestionIndex));
    options[state.suggestionIndex].scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (!els.suggestions.hidden && options[state.suggestionIndex]) options[state.suggestionIndex].click();
    else submitSearch();
  } else if (event.key === "Escape") {
    closeSuggestions();
    els.searchInput.blur();
  }
}

/* =========================================================
   Genres + filters
   ========================================================= */
async function loadGenres() {
  if (!state.apiKey) return;
  try {
    const data = await api(`/genre/${state.type}/list`);
    state.genres = data.genres || [];
    renderGenreOptions();
  } catch (_) {
    state.genres = [];
    renderGenreOptions();
  }
}

function renderGenreOptions() {
  const value = state.filters.genre;
  els.genreFilter.innerHTML = `<option value="">All genres</option>${state.genres.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}`;
  els.genreFilter.value = value;
}

function populateYears() {
  const current = new Date().getFullYear() + 2;
  const options = [];
  for (let year = current; year >= 1950; year--) options.push(`<option value="${year}">${year}</option>`);
  els.yearFilter.insertAdjacentHTML("beforeend", options.join(""));
}

function applyFiltersFromControls() {
  state.filters.genre = els.genreFilter.value;
  state.filters.year = els.yearFilter.value;
  state.filters.rating = els.ratingFilter.value;
  state.filters.sort = els.sortFilter.value;
  state.query = "";
  state.page = 1;
  state.favoritesOnly = false;
  els.searchInput.value = "";
  updateSearchUI();
  updateFilterCount();
  loadContent({ scroll: true });
}

function clearFilters({ load = true } = {}) {
  state.filters = { genre: "", year: "", rating: "", sort: "popularity.desc" };
  syncControls();
  updateFilterCount();
  if (load) {
    state.page = 1;
    state.query = "";
    els.searchInput.value = "";
    state.favoritesOnly = false;
    loadContent({ scroll: true });
  }
}

function updateFilterCount() {
  const count = [state.filters.genre, state.filters.year, state.filters.rating].filter(Boolean).length + (state.filters.sort !== "popularity.desc" ? 1 : 0);
  els.filterCount.textContent = String(count);
  els.filterCount.hidden = count === 0;
}

function genreName(id) {
  return state.genres.find(g => Number(g.id) === Number(id))?.name || "";
}

/* =========================================================
   Favorites / My List
   ========================================================= */
function loadFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(APP.storage.favorites) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(APP.storage.favorites, JSON.stringify(state.favorites));
  updateFavoritesUI();
}

function favoriteKey(id, type) { return `${type}:${id}`; }
function isFavorite(id, type) { return state.favorites.some(item => favoriteKey(item.id, item.mediaType) === favoriteKey(id, type)); }

function toggleFavorite(itemLike) {
  const item = normalizeItem(itemLike, itemLike.mediaType || state.type);
  const index = state.favorites.findIndex(saved => favoriteKey(saved.id, saved.mediaType) === favoriteKey(item.id, item.mediaType));
  if (index >= 0) {
    state.favorites.splice(index, 1);
    toast(`Removed “${item.title}” from My List`);
  } else {
    state.favorites.unshift(item);
    toast(`Saved “${item.title}” to My List`);
  }
  saveFavorites();
  refreshFavoriteButtons(item.id, item.mediaType);
  if (state.favoritesOnly) renderFavorites();
}

function renderFavorites() {
  hideStates();
  state.items = [...state.favorites];
  state.totalPages = 1;
  state.totalResults = state.items.length;
  els.pagination.hidden = true;
  els.contentGrid.setAttribute("aria-busy", "false");

  if (!state.items.length) {
    els.contentGrid.innerHTML = "";
    showEmpty("Your list is waiting", "Save movies and TV shows with the heart button and they’ll appear here.", "Discover titles");
    resetHero();
  } else {
    renderItems();
    updateHeroFromItems();
  }
  updatePageText();
}

function showFavorites() {
  state.favoritesOnly = true;
  state.query = "";
  state.page = 1;
  els.searchInput.value = "";
  updateSearchUI();
  setActiveNav("favorites");
  renderFavorites();
  scrollToExplorer();
}

function updateFavoritesUI() {
  const count = state.favorites.length;
  els.favoritesCount.textContent = String(count);
  els.favoritesInlineCount.textContent = String(count);
  els.mobileFavoritesCount.textContent = count > 99 ? "99+" : String(count);
  els.mobileFavoritesCount.hidden = count === 0;
}

function refreshFavoriteButtons(id, type) {
  const saved = isFavorite(id, type);
  document.querySelectorAll(`.media-card[data-id="${CSS.escape(String(id))}"][data-type="${CSS.escape(type)}"] .favorite-button`).forEach(button => {
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><use href="#icon-${saved ? "heart-filled" : "heart"}"></use></svg>`;
  });
}

/* =========================================================
   View switching
   ========================================================= */
async function switchType(type) {
  if (!['movie', 'tv'].includes(type) || state.type === type && !state.favoritesOnly) return;
  state.type = type;
  state.page = 1;
  state.query = "";
  state.favoritesOnly = false;
  els.searchInput.value = "";
  clearFilters({ load: false });
  if (state.type === "tv" && state.mode === "upcoming") state.mode = "upcoming";
  await loadGenres();
  syncControls();
  updateSearchUI();
  setActiveNav(type);
  loadContent({ scroll: true });
}

function switchMode(mode) {
  state.mode = mode;
  state.page = 1;
  state.query = "";
  state.favoritesOnly = false;
  els.searchInput.value = "";
  clearFilters({ load: false });
  syncControls();
  updateSearchUI();
  loadContent({ scroll: true });
}

function goHome() {
  state.type = "movie";
  state.mode = "trending";
  state.page = 1;
  state.query = "";
  state.favoritesOnly = false;
  els.searchInput.value = "";
  clearFilters({ load: false });
  syncControls();
  setActiveNav("home");
  updateSearchUI();
  loadGenres().finally(() => loadContent());
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

async function randomTitle() {
  try {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const path = state.type === "movie" ? "/movie/popular" : "/tv/popular";
    const data = await api(path, { page: randomPage }, { skipCache: true });
    const pool = data.results || [];
    if (!pool.length) return;
    const raw = pool[Math.floor(Math.random() * pool.length)];
    openDetails(normalizeItem(raw, state.type));
  } catch (error) {
    toast("Couldn’t pick a random title. Try again.");
  }
}

/* =========================================================
   API settings
   ========================================================= */
function openApiModal(firstRun = false) {
  state.lastFocusedElement = document.activeElement;
  els.apiKeyInput.value = state.apiKey;
  els.apiStatus.textContent = firstRun && !state.apiKey ? "Add a key to load live movie and TV data." : "";
  els.apiStatus.className = "api-status";
  els.removeApiKeyButton.hidden = !state.apiKey;
  showModal(els.apiModal);
  setTimeout(() => els.apiKeyInput.focus(), 50);
}

async function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    setApiStatus("Enter a TMDB API key first.", "error");
    return;
  }
  setApiStatus("Testing connection…", "");
  els.saveApiKeyButton.disabled = true;
  try {
    const valid = await testApiKey(key);
    if (!valid) throw new Error("TMDB rejected this API key.");
    state.apiKey = key;
    localStorage.setItem(APP.storage.apiKey, key);
    cache.clear();
    setApiStatus("Connected successfully.", "success");
    els.removeApiKeyButton.hidden = false;
    toast("TMDB connected");
    setTimeout(async () => {
      closeModal(els.apiModal);
      await loadGenres();
      loadContent();
    }, 450);
  } catch (error) {
    setApiStatus(error.message || "Could not connect to TMDB.", "error");
  } finally {
    els.saveApiKeyButton.disabled = false;
  }
}

function removeApiKey() {
  localStorage.removeItem(APP.storage.apiKey);
  state.apiKey = "";
  cache.clear();
  els.apiKeyInput.value = "";
  setApiStatus("Saved API key removed from this browser.", "success");
  els.removeApiKeyButton.hidden = true;
  renderNoApiState();
}

function setApiStatus(message, type) {
  els.apiStatus.textContent = message;
  els.apiStatus.className = `api-status${type ? ` is-${type}` : ""}`;
}

function renderNoApiState() {
  state.items = [];
  resetHero();
  els.contentGrid.innerHTML = "";
  els.resultsLabel.textContent = "TMDB connection required";
  els.pagination.hidden = true;
  hideStates();
  els.errorState.hidden = false;
  els.errorMessage.textContent = "Connect a TMDB API key to load live movies, TV shows, trailers, cast and ratings. Your existing public project should not keep an API key committed in script.js.";
}

/* =========================================================
   Theme / online
   ========================================================= */
function applyStoredTheme() {
  const saved = localStorage.getItem(APP.storage.theme);
  const shouldUseLight = saved ? saved === "light" : false;
  els.body.classList.toggle("light-theme", shouldUseLight);
  updateThemeButton();
}

function toggleTheme() {
  const isLight = els.body.classList.toggle("light-theme");
  localStorage.setItem(APP.storage.theme, isLight ? "light" : "dark");
  updateThemeButton();
}

function updateThemeButton() {
  const isLight = els.body.classList.contains("light-theme");
  els.themeToggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} theme`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isLight ? "#f5f7fb" : "#080b12");
}

function updateOnlineState() {
  els.offlineNotice.hidden = navigator.onLine;
}

/* =========================================================
   UI helpers
   ========================================================= */
function updatePageText() {
  const typeLabel = state.type === "movie" ? "movies" : "TV shows";
  if (state.favoritesOnly) {
    els.sectionKicker.textContent = "Personal watchlist";
    els.sectionTitle.textContent = "My List";
    els.sectionDescription.textContent = "Saved locally on this device.";
    els.resultsLabel.textContent = `${state.favorites.length} saved ${state.favorites.length === 1 ? "title" : "titles"}`;
    return;
  }
  if (state.query) {
    els.sectionKicker.textContent = "Search results";
    els.sectionTitle.textContent = `“${state.query}”`;
    els.sectionDescription.textContent = `Matching ${typeLabel} from TMDB.`;
  } else if (hasActiveFilters()) {
    els.sectionKicker.textContent = "Filtered discovery";
    els.sectionTitle.textContent = state.type === "movie" ? "Browse movies" : "Browse TV shows";
    els.sectionDescription.textContent = "Results matched to your filters.";
  } else {
    const modeCopy = {
      trending: ["Discover", `Trending ${typeLabel}`, "What people are watching this week."],
      popular: ["Popular", `Popular ${typeLabel}`, "Big audience favorites right now."],
      top_rated: ["Critics & viewers", `Top rated ${typeLabel}`, "Highly rated picks worth your time."],
      upcoming: [state.type === "movie" ? "Coming soon" : "Now airing", state.type === "movie" ? "Upcoming movies" : "TV on the air", state.type === "movie" ? "Movies headed your way." : "Shows currently airing new episodes."]
    };
    const [kicker, title, desc] = modeCopy[state.mode] || modeCopy.trending;
    els.sectionKicker.textContent = kicker;
    els.sectionTitle.textContent = title;
    els.sectionDescription.textContent = desc;
  }
  const shown = state.items.length;
  const total = state.totalResults ? compactNumber(state.totalResults) : shown;
  els.resultsLabel.textContent = state.totalResults ? `${shown} shown · ${total} results` : `${shown} ${shown === 1 ? "title" : "titles"}`;
}

function updatePagination() {
  const shouldShow = !state.favoritesOnly && state.totalPages > 1;
  els.pagination.hidden = !shouldShow;
  els.pageCurrent.textContent = String(state.page);
  els.pageTotal.textContent = String(state.totalPages);
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= state.totalPages;
}

function syncControls() {
  document.querySelectorAll("[data-type]").forEach(button => {
    const active = button.dataset.type === state.type;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-mode]").forEach(button => button.classList.toggle("is-active", button.dataset.mode === state.mode));
  document.querySelector('[data-mode="upcoming"]')?.replaceChildren(document.createTextNode(state.type === "movie" ? "Upcoming" : "On Air"));
  els.genreFilter.value = state.filters.genre;
  els.yearFilter.value = state.filters.year;
  els.ratingFilter.value = state.filters.rating;
  els.sortFilter.value = state.filters.sort;
  [...els.sortFilter.options].forEach(option => {
    if (option.dataset.movieOnly) option.hidden = state.type !== "movie";
  });
  if (state.type === "tv" && els.sortFilter.value === "revenue.desc") {
    state.filters.sort = "popularity.desc";
    els.sortFilter.value = state.filters.sort;
  }
  updateFilterCount();
}

function updateSearchUI() {
  els.searchClear.hidden = !els.searchInput.value;
}

function setActiveNav(name) {
  document.querySelectorAll("[data-nav]").forEach(button => button.classList.toggle("is-active", button.dataset.nav === name));
  document.querySelectorAll("[data-mobile-nav]").forEach(button => button.classList.toggle("is-active", button.dataset.mobileNav === (name || "home")));
}

function showEmpty(title, message, actionLabel = "Reset view") {
  els.emptyTitle.textContent = title;
  els.emptyMessage.textContent = message;
  els.emptyActionButton.textContent = actionLabel;
  els.emptyState.hidden = false;
  els.errorState.hidden = true;
  els.pagination.hidden = true;
}

function showError(error) {
  els.contentGrid.innerHTML = "";
  els.errorState.hidden = false;
  els.emptyState.hidden = true;
  els.pagination.hidden = true;
  els.errorMessage.textContent = error?.status === 401 ? "TMDB could not authorize this request. Please try again later." : (error?.message || "Check your connection and try again.");
  els.resultsLabel.textContent = "Could not load titles";
}

function hideStates() {
  els.emptyState.hidden = true;
  els.errorState.hidden = true;
}

function showModal(modal) {
  modal.hidden = false;
  document.body.classList.add("modal-open");
  const panel = modal.querySelector("[tabindex='-1']");
  setTimeout(() => panel?.focus({ preventScroll: true }), 20);
}

function closeModal(modal) {
  modal.hidden = true;
  if (els.detailsModal.hidden && els.apiModal.hidden) document.body.classList.remove("modal-open");
  state.lastFocusedElement?.focus?.({ preventScroll: true });
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  els.toastRegion.appendChild(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 220);
  }, 2300);
}

function scrollToExplorer() {
  document.querySelector(".explorer")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

/* =========================================================
   Data normalization / formatting
   ========================================================= */
function normalizeItem(raw, fallbackType = "movie") {
  const mediaType = raw.media_type === "tv" || raw.mediaType === "tv" || fallbackType === "tv" ? "tv" : "movie";
  const title = raw.title || raw.name || raw.original_title || raw.original_name || "Untitled";
  return {
    id: Number(raw.id),
    mediaType,
    title,
    overview: raw.overview || "",
    poster: raw.poster_path || raw.poster || "",
    backdrop: raw.backdrop_path || raw.backdrop || "",
    rating: Number(raw.vote_average ?? raw.rating ?? 0),
    date: raw.release_date || raw.first_air_date || raw.date || "",
    genreIds: raw.genre_ids || raw.genreIds || (raw.genres || []).map(g => g.id)
  };
}

function imageUrl(path, size = "w500") { return path ? `${APP.imageBase}/${size}${path}` : ""; }
function formatRating(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n.toFixed(1) : "—"; }
function getYear(date) { return date ? String(date).slice(0, 4) : ""; }
function formatDate(date) { if (!date) return "—"; const parsed = new Date(`${date}T00:00:00`); return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(parsed); }
function formatRuntime(minutes) { const n = Number(minutes); if (!n) return "—"; const h = Math.floor(n / 60); const m = n % 60; return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`; }
function compactNumber(value) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function initials(value = "") { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?"; }
function uniqueProviders(providers) { const seen = new Set(); return providers.filter(p => !seen.has(p.provider_id) && seen.add(p.provider_id)); }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch])); }
function debounce(fn, delay = 250) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
function prefersReducedMotion() { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; }

/* =========================================================
   Events
   ========================================================= */
function bindEvents() {
  els.themeToggle.addEventListener("click", toggleTheme);
  els.apiSettingsButton?.addEventListener("click", () => openApiModal());
  els.apiClose.addEventListener("click", () => closeModal(els.apiModal));
  els.detailsClose.addEventListener("click", () => closeModal(els.detailsModal));
  document.querySelectorAll("[data-close-modal='details']").forEach(el => el.addEventListener("click", () => closeModal(els.detailsModal)));
  document.querySelectorAll("[data-close-modal='api']").forEach(el => el.addEventListener("click", () => closeModal(els.apiModal)));

  els.saveApiKeyButton.addEventListener("click", saveApiKey);
  els.removeApiKeyButton.addEventListener("click", removeApiKey);
  els.apiKeyInput.addEventListener("keydown", event => { if (event.key === "Enter") saveApiKey(); });
  els.toggleApiVisibility.addEventListener("click", () => {
    const show = els.apiKeyInput.type === "password";
    els.apiKeyInput.type = show ? "text" : "password";
    els.toggleApiVisibility.setAttribute("aria-label", `${show ? "Hide" : "Show"} API key`);
  });

  els.searchInput.addEventListener("input", () => {
    updateSearchUI();
    debouncedSuggestions();
  });
  els.searchInput.addEventListener("keydown", handleSearchKeydown);
  els.searchClear.addEventListener("click", () => {
    els.searchInput.value = "";
    state.query = "";
    state.page = 1;
    updateSearchUI();
    closeSuggestions();
    loadContent({ scroll: true });
    els.searchInput.focus();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#headerSearch")) closeSuggestions();
  });

  document.querySelectorAll("[data-type]").forEach(button => button.addEventListener("click", () => switchType(button.dataset.type)));
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  document.querySelectorAll("[data-action='home']").forEach(el => el.addEventListener("click", event => { event.preventDefault(); goHome(); }));

  document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.nav;
    if (target === "home") goHome();
    else if (target === "favorites") showFavorites();
    else switchType(target);
  }));

  document.querySelectorAll("[data-mobile-nav]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.mobileNav;
    if (target === "home") goHome();
    else if (target === "search") { els.searchInput.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (target === "favorites") showFavorites();
    else if (target === "random") randomTitle();
  }));

  els.filterToggle.addEventListener("click", () => {
    const willOpen = els.filterPanel.hidden;
    els.filterPanel.hidden = !willOpen;
    els.filterToggle.setAttribute("aria-expanded", String(willOpen));
  });
  els.applyFiltersButton.addEventListener("click", applyFiltersFromControls);
  els.clearFiltersButton.addEventListener("click", () => clearFilters());
  els.favoritesViewButton.addEventListener("click", showFavorites);
  els.emptyActionButton.addEventListener("click", () => state.favoritesOnly ? goHome() : goHome());
  els.retryButton.addEventListener("click", () => loadContent());

  els.prevPage.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadContent({ scroll: true });
  });
  els.nextPage.addEventListener("click", () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    loadContent({ scroll: true });
  });

  els.heroDetailsButton.addEventListener("click", () => state.featured && openDetails(state.featured));
  els.randomButton.addEventListener("click", randomTitle);

  window.addEventListener("online", () => { updateOnlineState(); if (!state.items.length) loadContent(); });
  window.addEventListener("offline", updateOnlineState);

  document.addEventListener("keydown", event => {
    if (event.key === "/" && !isTypingTarget(event.target) && els.detailsModal.hidden && els.apiModal.hidden) {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
    if (event.key === "Escape") {
      if (!els.detailsModal.hidden) closeModal(els.detailsModal);
      else if (!els.apiModal.hidden && state.apiKey) closeModal(els.apiModal);
      else closeSuggestions();
    }
  });
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
