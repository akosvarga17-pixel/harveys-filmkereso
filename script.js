"use strict";
const searchInput = document.getElementById("titleInput");
const yearInput = document.getElementById("yearInput");
const minRatingInput = document.getElementById("minRatingInput");
const searchButton = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const paginationDiv = document.getElementById("pagination");
// 🔑 Saját API kulcsok
const OMDB_API_KEY = "1ad58397";
const TMDB_API_KEY = "a68a9c3681d298279ace726e1ff815d3";
let currentPage = 1;
let currentSearch = "";
let currentYear = "";
let currentMinRating = "";
searchButton.addEventListener("click", () => {
    currentSearch = searchInput.value.trim();
    currentYear = yearInput.value.trim();
    currentMinRating = minRatingInput.value.trim();
    currentPage = 1;
    fetchMovies(currentPage);
});
async function fetchMovies(page = 1) {
    if (!currentSearch) {
        resultsDiv.innerHTML = `<p>Please enter a movie title to search.</p>`;
        return;
    }
    const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(currentSearch)}&type=movie&page=${page}${currentYear ? `&y=${currentYear}` : ""}`;
    try {
        const response = await fetch(omdbUrl);
        const data = await response.json();
        if (data.Response === "False") {
            resultsDiv.innerHTML = `<p>No results found for your search.</p>`;
            paginationDiv.innerHTML = "";
            return;
        }
        const detailedMovies = await Promise.all(data.Search.map(async (movie) => {
            const detailsResponse = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${movie.imdbID}&plot=full`);
            return await detailsResponse.json();
        }));
        const withFullData = await Promise.all(detailedMovies.map(async (movie) => {
            try {
                const tmdbFind = await fetch(`https://api.themoviedb.org/3/find/${movie.imdbID}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
                const tmdbFindData = await tmdbFind.json();
                const tmdbMovie = tmdbFindData.movie_results?.[0];
                if (tmdbMovie) {
                    const tmdbDetails = await fetch(`https://api.themoviedb.org/3/movie/${tmdbMovie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,reviews`);
                    const tmdbFull = await tmdbDetails.json();
                    const director = tmdbFull.credits?.crew?.find((p) => p.job === "Director")?.name || "N/A";
                    const cast = tmdbFull.credits?.cast
                        ?.slice(0, 3)
                        .map((a) => a.name)
                        .join(", ") || "N/A";
                    const criticReview = tmdbFull.reviews?.results?.[0]?.content ||
                        "No critic reviews available.";
                    movie.director = director;
                    movie.cast = cast;
                    movie.audience_vote = tmdbFull.vote_average || "N/A";
                    movie.critic_review = criticReview;
                    movie.tmdb_overview = tmdbFull.overview || movie.Plot;
                }
                else {
                    movie.director = "N/A";
                    movie.cast = "N/A";
                    movie.audience_vote = "N/A";
                    movie.critic_review = "No critic reviews available.";
                    movie.tmdb_overview = movie.Plot;
                }
            }
            catch {
                movie.director = "N/A";
                movie.cast = "N/A";
                movie.audience_vote = "N/A";
                movie.critic_review = "Error loading critic data.";
                movie.tmdb_overview = movie.Plot;
            }
            movie.rotten_score =
                movie.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value || "N/A";
            return movie;
        }));
        const filteredMovies = withFullData.filter((m) => {
            const imdbRating = parseFloat(m.imdbRating);
            return !currentMinRating || imdbRating >= parseFloat(currentMinRating);
        });
        // ✅ IMDb szavazatszám szerinti rendezés
        filteredMovies.sort((a, b) => {
            const votesA = parseInt(a.imdbVotes?.replace(/,/g, "") || "0");
            const votesB = parseInt(b.imdbVotes?.replace(/,/g, "") || "0");
            return votesB - votesA;
        });
        displayMovies(filteredMovies, page, data.totalResults);
    }
    catch (error) {
        console.error("Error fetching data:", error);
        resultsDiv.innerHTML = `<p>Error loading movie data.</p>`;
    }
}
function displayMovies(movies, page, totalResults) {
    resultsDiv.innerHTML = "";
    movies.slice(0, 10).forEach((movie) => {
        const poster = movie.Poster !== "N/A"
            ? movie.Poster
            : "https://via.placeholder.com/150x225?text=No+image";
        const detailId = `details-${movie.imdbID}`;
        const detailSection = `
      <div class="extra-info" id="${detailId}" style="display:none;">
        <p><strong>Rendező:</strong> ${movie.director}</p>
        <p><strong>Szereplők:</strong> ${movie.cast}</p>
        <p><strong>IMDb:</strong> ⭐ ${movie.imdbRating}</p>
        <p><strong>Rotten Tomatoes:</strong> 🍅 ${movie.rotten_score}</p>
        <p><strong>TMDb átlagos pontszám:</strong> ${movie.audience_vote}/10</p>
        <p><strong>Kritika:</strong><br>${movie.critic_review}</p>
        <p>${movie.tmdb_overview}</p>
      </div>
      <button class="toggle-btn" onclick="toggleDetails('${detailId}', this)">More details</button>
    `;
        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = `
      <img src="${poster}" alt="${movie.Title}" />
      <div class="movie-text">
        <h3>${movie.Title}</h3>
        <p>${movie.Plot}</p>
        <div class="details">
          <p>Type: ${movie.Type}</p>
          <p>Year: ${movie.Year}</p>
          <p>IMDb rating: ⭐ ${movie.imdbRating}</p>
          <p>Votes: ${movie.imdbVotes || "N/A"}</p>
        </div>
        ${detailSection}
      </div>
    `;
        resultsDiv.appendChild(card);
    });
    paginationDiv.innerHTML = "";
    const totalPages = Math.ceil(totalResults / 10);
    if (totalPages > 1) {
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "Previous";
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => fetchMovies(page - 1);
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Next";
        nextBtn.disabled = page === totalPages;
        nextBtn.onclick = () => fetchMovies(page + 1);
        paginationDiv.appendChild(prevBtn);
        paginationDiv.appendChild(nextBtn);
    }
}
// ✅ Lenyitás / visszazárás
window.toggleDetails = function (id, button) {
    const section = document.getElementById(id);
    if (section) {
        const isHidden = section.style.display === "none";
        section.style.display = isHidden ? "block" : "none";
        button.textContent = isHidden ? "Less details" : "More details";
    }
};
