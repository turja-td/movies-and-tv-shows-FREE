const API_KEY = 'c7591d8c' 
const VIDSRC_BASE = 'https://vidsrc.cc/v2/embed'

// Utility Functions 
const getParam = (name) => new URLSearchParams(window.location.search).get(name)
const el = (id) => document.getElementById(id)

// Page Router
document.addEventListener('DOMContentLoaded', () => {
    const pageId = document.body.id

    // Global Navbar Search Listener
    const navSearch = el('navSearchInput')
    if (navSearch) {
        navSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && navSearch.value.trim()) {
                window.location.href = `results.html?search=${encodeURIComponent(navSearch.value)}`
            }
        })
    }

    // Page Specific Logic
    if (pageId === 'home-page') initHome()
    if (pageId === 'results-page') initResults()
    if (pageId === 'watch-page') initWatch()
})

// Home Page Logic 
function initHome() {
    const input = el('searchInput')
    const dropdown = el('searchDropdown')
    const form = el('searchForm')
    let debounceTimer

    // 1. Live Search Preview
    input.addEventListener('input', function() {
        clearTimeout(debounceTimer)
        const query = this.value.trim()

        if (query.length < 3) {
            dropdown.style.display = 'none'
            return
        }

        debounceTimer = setTimeout(() => fetchPreview(query, dropdown), 300)
    })

    // 2. Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) dropdown.style.display = 'none'
    })

    // 3. Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault()
        if (input.value) window.location.href = `results.html?search=${encodeURIComponent(input.value)}`
    })
}

async function fetchPreview(query, dropdown) {
    try {
        const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}`)
        const data = await res.json()

        if (data.Response === "True") {
            const topResults = data.Search.slice(0, 5)
            dropdown.innerHTML = topResults.map(item => `
                <div class="dropdown-item" onclick="location.href='watch.html?id=${item.imdbID}'">
                    <img src="${item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/40x60/333/fff?text=No+Img'}" alt="">
                    <div class="dropdown-info">
                        <h4>${item.Title}</h4>
                        <span>${item.Year} • ${item.Type}</span>
                    </div>
                </div>
            `).join('')
            dropdown.style.display = 'block'
        } else {
            dropdown.style.display = 'none'
        }
    } catch (err) { console.error(err) }
}

// Results Page Logic
async function initResults() {
    const query = getParam('search')
    const grid = el('resultsGrid')
    const title = el('resultsTitle')

    if (query) {
        title.textContent = `Results for "${query}"`
        document.title = `${query} - HyperWatch`
        
        try {
            const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}`)
            const data = await res.json()

            if (data.Response === "True") {
                grid.innerHTML = ''
                data.Search.forEach((movie, index) => {
                    if (movie.Poster !== "N/A" && movie.Type !== "game") {
                        const card = document.createElement('div')
                        card.className = 'card animate-fade-up'
                        card.style.animationDelay = `${index * 0.05}s`
                        card.innerHTML = `
                            <img src="${movie.Poster}" loading="lazy" alt="${movie.Title}">
                            <div class="card-info">
                                <div class="card-title">${movie.Title}</div>
                                <div class="card-year">${movie.Year} • ${movie.Type}</div>
                            </div>
                        `
                        card.addEventListener('click', () => {
                            window.location.href = `watch.html?id=${movie.imdbID}`
                        })
                        grid.appendChild(card)
                    }
                })
            } else {
                grid.innerHTML = `<p style="color:#666 font-size:1.2rem">No results found for "${query}".</p>`
            }
        } catch (err) {
            grid.innerHTML = '<p>Something went wrong. Please try again.</p>'
        }
    } else {
        title.textContent = "Please enter a search term."
        grid.innerHTML = ''
    }
}

// Watch Page Logic
async function initWatch() {
    const imdbID = getParam('id')
    if (!imdbID) return

    try {
        const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${imdbID}&plot=full`)
        const data = await res.json()
        
        // Render Details
        renderDetails(data)
        
        // Handle Video Type
        if (data.Type === 'series') {
            setupSeries(data)
        } else {
            setupMovie(data.imdbID)
        }
    } catch (err) {
        console.error("Error loading media:", err)
    }
}

function renderDetails(data) {
    document.title = `Watch ${data.Title} - HyperWatch`
    el('detailsContainer').innerHTML = `
        <img src="${data.Poster !== 'N/A' ? data.Poster : 'https://via.placeholder.com/300x450'}" class="poster-large" alt="${data.Title}">
        <div class="info-content">
            <h1>${data.Title}</h1>
            <div class="meta-row">
                <span class="badge">IMDb ${data.imdbRating}</span>
                <span>${data.Year}</span>
                <span>${data.Runtime}</span>
                <span style="color:#fff">${data.Genre}</span>
            </div>
            <p class="plot">${data.Plot}</p>
        </div>
    `
}


function updateSecurePlayer(url) {
    const player = el('videoPlayer')
    player.setAttribute('sandbox', 'allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation-by-user-activation')   
    player.src = url
}


function setupMovie(id) {
    updateSecurePlayer(`${VIDSRC_BASE}/movie/${id}`)
}

function setupSeries(data) {
    const controls = el('seriesControls')
    const epContainer = el('episodesContainer')
    const seasonSelect = el('seasonSelect')

    controls.style.display = 'flex'
    epContainer.style.display = 'block'

    const totalSeasons = parseInt(data.totalSeasons) || 1
    seasonSelect.innerHTML = '' 
    for (let i = 1; i <= totalSeasons; i++) {
        const opt = document.createElement('option')
        opt.value = i
        opt.innerText = `Season ${i}`
        seasonSelect.appendChild(opt)
    }

    loadSeason(data.imdbID, 1)
    updateSecurePlayer(`${VIDSRC_BASE}/tv/${data.imdbID}/1/1`)

    seasonSelect.addEventListener('change', (e) => {
        loadSeason(data.imdbID, e.target.value)
    })
}

async function loadSeason(imdbID, seasonNum) {
    const epList = el('epList')
    epList.innerHTML = '<div class="loader" style="width:20px height:20px"></div>'

    try {
        const res = await fetch(`https://www.omdbapi.com/?apikey=${API_KEY}&i=${imdbID}&Season=${seasonNum}`)
        const data = await res.json()

        if (data.Response === "True") {
            epList.innerHTML = ''
            data.Episodes.forEach((ep, index) => {
                const div = document.createElement('div')
                div.className = 'ep-card'
                if(index === 0 && seasonNum == 1) div.classList.add('active') 

                div.innerHTML = `
                    <div class="ep-thumb"></div>
                    <div class="ep-info">
                        <h4>${ep.Episode}. ${ep.Title}</h4>
                        <span>Released: ${ep.Released}</span>
                    </div>
                `
                
                div.addEventListener('click', () => {
                    document.querySelectorAll('.ep-card').forEach(c => c.classList.remove('active'))
                    div.classList.add('active')
                    
                    
                    updateSecurePlayer(`${VIDSRC_BASE}/tv/${imdbID}/${seasonNum}/${ep.Episode}`)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                })
                
                epList.appendChild(div)
            })
        }
    } catch (error) {
        epList.innerHTML = '<p style="color:#666 padding:10px">Could not load episode details.</p>'
    }
}

// Function to "Unlock" the player and hide the ad shield
function unlockPlayer() {
    const shield = el('adShield')
    if (shield) {
        shield.classList.add('hidden')
        console.log("Player unlocked, ads blocked.")
    }
}

// The "Nuclear" Ad Blocker Logic
function setupAdInterceptors() {
    window.open = function() { 
        console.log("Blocked a popup attempt!")
        return null 
    }
}

setupAdInterceptors()