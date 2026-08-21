# 🎬 CineScope — Smart Movie & TV Explorer

CineScope is a polished, mobile-first movie and TV discovery app built with **HTML5, CSS3 and Vanilla JavaScript**. It uses the **TMDB API** for live entertainment data and runs directly on **GitHub Pages** with no build step.

## Highlights

- Mobile-first responsive UI with 2-column phone cards and fluid tablet/desktop grids
- Movies / TV switching
- Trending, popular, top-rated, upcoming / on-air views
- Fast search with debounced, keyboard-friendly suggestions
- Genre, year, rating and sort filters
- Full details experience with trailers, cast, runtime/season metadata and streaming provider logos
- Personal **My List** saved with `localStorage`
- Random title discovery
- Persistent dark/light theme
- Skeleton loaders, empty states, offline indicator and API error recovery
- Keyboard shortcuts (`/` focuses search, `Esc` closes overlays)
- Reduced-motion support and accessible labels
- No React, dependencies, bundler or build system

## Files

```text
Smart-Movie-TV-Explorer/
├── index.html
├── style.css
├── script.js
└── README.md
```

## TMDB API Connection

The portfolio build is preconfigured with the existing TMDB v3 API key used by this project, so visitors can open CineScope and load live movie and TV data immediately. There is no first-run API-key prompt and no setup step required in the interface.

> Note: GitHub Pages is static hosting, so any API credential used directly by browser JavaScript is visible in the deployed source. For a future production deployment, a small serverless/backend proxy is the stronger architecture for keeping credentials private.

## Run locally

Because this is a static project, you can use VS Code Live Server or any local static server.

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## GitHub Pages

1. Replace your repository files with the files in this project.
2. Commit and push to `main`.
3. Go to **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.

Your URL will follow this pattern:

```text
https://Sayed24.github.io/Smart-Movie---TV-Explorer/
```

## Portfolio Talking Points

- Designed a responsive entertainment discovery UI from mobile through large desktop screens.
- Built API-driven state management, filtering, pagination, search and details flows in Vanilla JavaScript.
- Added persistent client-side state for favorites and theme preferences.
- Designed graceful loading, offline, empty and error states instead of relying on happy-path UI only.
- Improved accessibility with semantic controls, focus management, keyboard navigation and reduced-motion support.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming provider data is supplied through TMDB's JustWatch integration and requires JustWatch attribution.

Built by **Sayedrahim Sadat**.
