"use strict";
// 🎬 OMDb + TMDb alapú filmkereső
// OMDb API beállítások
const omdbApiKey = "1ad58397"; // <-- ezt majd beilleszted
const omdbBaseUrl = "https://www.omdbapi.com/";
// TMDb API beállítások
const tmdbApiKey = "a68a9c3681d298279ace726e1ff815d3";
const tmdbBaseUrl = "https://api.themoviedb.org/3";
// HTML elemek
const searchInput = document.getElementById("titleInput");
const yearInput = document.getElementById("yearInput");
const minRatingInput = document.getElementById("minRatingInput");
const searchButton = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const paginationDiv = document.getElementById("pagination");
// 🔍 Keresés indítása
searchButton.addEventListener("click", () => {
    fetchMovies(1);
});
// OMDb filmkeresés
async function fetchMovies(page = 1) {
    const title = searchInput.value.trim();
    const year = yearInput.value.trim();
    if (!title)
        return alert("Adj meg egy filmcímet!");
    resultsDiv.innerHTML = "<p>Keresés folyamatban...</p>";
    paginationDiv.innerHTML = "";
    try {
        const url = `${omdbBaseUrl}?apikey=${omdbApiKey}&s=${encodeURIComponent(title)}&type=movie&page=${page}${year ? `&y=${year}` : ""}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.Response === "False") {
            resultsDiv.innerHTML = "<p>Nincs találat.</p>";
            return;
        }
        const moviesWithDetails = await Promise.all(data.Search.map(async (movie) => {
            const detailsRes = await fetch(`${omdbBaseUrl}?apikey=${omdbApiKey}&i=${movie.imdbID}&plot=full`);
            const detailsData = await detailsRes.json();
            return detailsData;
        }));
        displayResults(moviesWithDetails, page, data.totalResults);
    }
    catch (error) {
        console.error("Hiba az OMDb-lekérésnél:", error);
        resultsDiv.innerHTML = "<p>Hiba történt a lekérés során.</p>";
    }
}
// 🎨 Eredmények megjelenítése
function displayResults(movies, page, totalResults) {
    resultsDiv.innerHTML = "";
    movies.forEach((movie) => {
        const card = document.createElement("div");
        card.classList.add("movie-card");
        card.innerHTML = `
      <div class="movie-info">
        <img src="${movie.Poster !== "N/A"
            ? movie.Poster
            : "https://via.placeholder.com/300x450?text=Nincs+poszter"}" alt="${movie.Title}" />
        <div class="movie-text">
          <h3>${movie.Title}</h3>
          <p>📅 ${movie.Year}</p>
          <p>⭐ IMDb: ${movie.imdbRating}</p>
          <p>🎞️ ${movie.Type}</p>
          <p class="plot">${movie.Plot || "Nincs leírás elérhető."}</p>
          <button class="details-btn">Részletek</button>
          <div class="details hidden"></div>
        </div>
      </div>
    `;
        // Részletek gomb esemény
        const detailsBtn = card.querySelector(".details-btn");
        const detailsDiv = card.querySelector(".details");
        detailsBtn.addEventListener("click", async () => {
            if (!detailsDiv.classList.contains("hidden")) {
                detailsDiv.classList.add("hidden");
                detailsDiv.innerHTML = "";
                detailsBtn.textContent = "Részletek";
                return;
            }
            detailsBtn.textContent = "Betöltés...";
            try {
                // OMDb részletek
                const detailsRes = await fetch(`${omdbBaseUrl}?apikey=${omdbApiKey}&i=${movie.imdbID}&plot=full`);
                const detailsData = await detailsRes.json();
                // Rotten Tomatoes pont
                let rottenCritics = "N/A";
                if (detailsData.Ratings && Array.isArray(detailsData.Ratings)) {
                    const rtCritic = detailsData.Ratings.find((r) => r.Source === "Rotten Tomatoes");
                    if (rtCritic)
                        rottenCritics = rtCritic.Value;
                }
                // TMDb extra adatok
                const tmdbExtras = await fetchTmdbExtras(movie.Title);
                detailsDiv.innerHTML = `
          <p><strong>Cím:</strong> ${detailsData.Title}</p>
          <p><strong>Rendező:</strong> ${detailsData.Director}</p>
          <p><strong>Szereplők:</strong> ${detailsData.Actors}</p>
          <p><strong>IMDb:</strong> ${detailsData.imdbRating}</p>
          <p><strong>Rotten Tomatoes:</strong> ${rottenCritics}</p>
          ${tmdbExtras
                    ? `<p><strong>TMDb átlagos pontszám:</strong> ⭐ ${tmdbExtras.avgScore}/10</p>
                 <p><em>${tmdbExtras.criticTeaser}</em></p>`
                    : ""}
          <p>${detailsData.Plot}</p>
        `;
                detailsDiv.classList.remove("hidden");
                detailsBtn.textContent = "Bezárás";
            }
            catch (err) {
                console.error("Hiba a részletes adatnál:", err);
                detailsDiv.innerHTML = "<p>Nem sikerült lekérni a részletes adatokat.</p>";
            }
        });
        resultsDiv.appendChild(card);
    });
    // Lapozás
    const totalPages = Math.ceil(totalResults / 10);
    paginationDiv.innerHTML = "";
    if (page > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "⬅️ Előző oldal";
        prevBtn.addEventListener("click", () => fetchMovies(page - 1));
        paginationDiv.appendChild(prevBtn);
    }
    if (page < totalPages) {
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Következő oldal ➡️";
        nextBtn.addEventListener("click", () => fetchMovies(page + 1));
        paginationDiv.appendChild(nextBtn);
    }
}
// 🧩 TMDb kiegészítő adatok
async function fetchTmdbExtras(title) {
    try {
        const searchRes = await fetch(`${tmdbBaseUrl}/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`);
        const searchData = await searchRes.json();
        if (!searchData.results || searchData.results.length === 0)
            return null;
        const movieId = searchData.results[0].id;
        const detailsRes = await fetch(`${tmdbBaseUrl}/movie/${movieId}?api_key=${tmdbApiKey}`);
        const detailsData = await detailsRes.json();
        const reviewsRes = await fetch(`${tmdbBaseUrl}/movie/${movieId}/reviews?api_key=${tmdbApiKey}`);
        const reviewsData = await reviewsRes.json();
        const criticTeaser = reviewsData.results && reviewsData.results.length > 0
            ? reviewsData.results[0].content
            : "Nincs elérhető kritikai idézet.";
        return {
            avgScore: Math.round(detailsData.vote_average * 10) / 10,
            criticTeaser,
        };
    }
    catch (error) {
        console.error("TMDb hiba:", error);
        return null;
    }
}
