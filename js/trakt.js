// trakt.js — Prisma v2.20
const TRAKT_CLIENT_ID = '422e754a4587ed1e4718e0684bba494150c5d8a20ba1bc3495de90df4643878a';
const TRAKT_API_URL = 'https://api.trakt.tv';

// Generate a random string for PKCE code_verifier
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}

// Generate code_challenge from code_verifier
async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const TraktAuth = {
    getRedirectUri() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return window.location.origin + window.location.pathname;
        }
        return 'https://gametec-hotshot.github.io/movie/';
    },

    async login() {
        const codeVerifier = generateRandomString(128);
        localStorage.setItem('trakt_code_verifier', codeVerifier);
        
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const redirectUri = this.getRedirectUri();
        
        const authUrl = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
        
        window.location.href = authUrl;
    },

    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) return false;

        const codeVerifier = localStorage.getItem('trakt_code_verifier');
        if (!codeVerifier) {
            console.error('Trakt PKCE verifier missing');
            return false;
        }

        try {
            const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    client_id: TRAKT_CLIENT_ID,
                    code_verifier: codeVerifier,
                    redirect_uri: this.getRedirectUri(),
                    grant_type: 'authorization_code'
                })
            });

            const data = await response.json();
            
            if (data.access_token) {
                localStorage.setItem('trakt_access_token', data.access_token);
                localStorage.setItem('trakt_refresh_token', data.refresh_token);
                localStorage.setItem('trakt_token_created_at', data.created_at);
                localStorage.setItem('trakt_token_expires_in', data.expires_in);
                
                // Save tokens to Supabase for cross-device sync
                if (typeof TraktConnectionSync !== 'undefined') {
                    let traktUserId = null;
                    try {
                        const profileRes = await fetch(`${TRAKT_API_URL}/users/me`, {
                            headers: {
                                'Authorization': `Bearer ${data.access_token}`,
                                'trakt-api-version': '2',
                                'trakt-api-key': TRAKT_CLIENT_ID
                            }
                        });
                        if (profileRes.ok) {
                            const profile = await profileRes.json();
                            traktUserId = profile.username || null;
                        }
                    } catch(e) { console.warn('[Trakt] Could not fetch profile for Supabase:', e); }
                    const expiresAt = new Date((data.created_at + data.expires_in) * 1000).toISOString();
                    await TraktConnectionSync.saveTraktTokens(data.access_token, data.refresh_token, traktUserId, expiresAt);
                }

                // Clean URL
                window.history.replaceState({}, document.title, this.getRedirectUri());
                return true;
            }
        } catch (error) {
            console.error('Trakt auth error:', error);
        }
        return false;
    },

    isLoggedIn() {
        return !!localStorage.getItem('trakt_access_token');
    },

    async logout() {
        // Clear from Supabase first (cross-device disconnect)
        if (typeof TraktConnectionSync !== 'undefined') {
            try { await TraktConnectionSync.clearTraktTokens(); } catch(e) {}
        }
        localStorage.removeItem('trakt_access_token');
        localStorage.removeItem('trakt_refresh_token');
        localStorage.removeItem('trakt_token_created_at');
        localStorage.removeItem('trakt_token_expires_in');
        window.location.reload();
    },

    async getValidToken() {
        if (!this.isLoggedIn()) return null;

        const createdAt = parseInt(localStorage.getItem('trakt_token_created_at'));
        const expiresIn = parseInt(localStorage.getItem('trakt_token_expires_in'));
        const now = Math.floor(Date.now() / 1000);

        // If expired, refresh
        if (now >= createdAt + expiresIn - 300) { // 5 minutes buffer
            return await this.refreshToken();
        }

        return localStorage.getItem('trakt_access_token');
    },

    async refreshToken() {
        const refreshToken = localStorage.getItem('trakt_refresh_token');
        if (!refreshToken) {
            this.logout();
            return null;
        }

        try {
            const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: refreshToken,
                    client_id: TRAKT_CLIENT_ID,
                    redirect_uri: this.getRedirectUri(),
                    grant_type: 'refresh_token'
                })
            });

            const data = await response.json();
            if (data.access_token) {
                localStorage.setItem('trakt_access_token', data.access_token);
                localStorage.setItem('trakt_refresh_token', data.refresh_token);
                localStorage.setItem('trakt_token_created_at', data.created_at);
                localStorage.setItem('trakt_token_expires_in', data.expires_in);
                
                // Keep Supabase in sync with refreshed tokens
                if (typeof TraktConnectionSync !== 'undefined') {
                    const expiresAt = new Date((data.created_at + data.expires_in) * 1000).toISOString();
                    TraktConnectionSync.updateTraktTokens(data.access_token, data.refresh_token, expiresAt);
                }
                
                return data.access_token;
            }
        } catch (e) {
            console.error('Failed to refresh Trakt token', e);
        }
        
        this.logout();
        return null;
    },

    async apiCall(endpoint, method = 'GET', body = null) {
        const token = await this.getValidToken();
        if (!token) { console.warn('[Trakt] No valid token for', endpoint); return null; }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_CLIENT_ID
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            console.log(`[Trakt] ${method} ${endpoint}`, body ? JSON.stringify(body).substring(0, 200) : '');
            const res = await fetch(`${TRAKT_API_URL}${endpoint}`, options);
            if (!res.ok) {
                const errText = await res.text();
                console.error(`[Trakt] API error ${res.status} for ${endpoint}:`, errText.substring(0, 300));
                if (res.status === 401 || res.status === 400) {
                    this.updateTraktStatusUI('unauthorized');
                } else if (res.status >= 500) {
                    this.updateTraktStatusUI('error');
                }
                throw new Error(`Trakt API error: ${res.status}`);
            }
            this.updateTraktStatusUI('connected');
            const text = await res.text();
            const parsed = (() => { try { return JSON.parse(text); } catch(e) { return text; } })();
            console.log(`[Trakt] ${method} ${endpoint} → ${res.status}`, typeof parsed === 'object' ? parsed : text.substring(0, 100));
            return parsed;
        } catch (e) {
            console.error('[Trakt] API call failed:', endpoint, e.message);
            if (e.message !== 'Trakt API error: 401' && e.message !== 'Trakt API error: 400') {
                if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
                    this.updateTraktStatusUI('error');
                }
            }
            return null;
        }
    },

    // Returns { data, headers } instead of just data — used for paginated endpoints
    async apiCallWithHeaders(endpoint, method = 'GET', body = null) {
        const token = await this.getValidToken();
        if (!token) { console.warn('[Trakt] No valid token for', endpoint); return { data: null, headers: null }; }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_CLIENT_ID
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const res = await fetch(`${TRAKT_API_URL}${endpoint}`, options);
            if (!res.ok) {
                console.error(`[Trakt] API error ${res.status} for ${endpoint}`);
                return { data: null, headers: null };
            }
            const data = await res.json();
            return { data, headers: res.headers };
        } catch (e) {
            console.error('[Trakt] API call with headers failed:', endpoint, e.message);
            return { data: null, headers: null };
        }
    },

    updateTraktStatusUI(state) {
        const container = document.getElementById('trakt-status-container');
        const info = document.getElementById('trakt-status-info');
        const tooltip = document.getElementById('trakt-status-tooltip');
        
        if (!container || !info || !tooltip) return;
        
        container.className = 'trakt-status-container';
        
        if (state === 'disconnected') {
            container.style.display = 'flex';
            container.classList.add('status-red');
            info.style.display = 'none';
        } else if (state === 'connected') {
            container.style.display = 'flex';
            container.classList.add('status-green');
            info.style.display = 'none';
        } else if (state === 'unauthorized') {
            container.style.display = 'flex';
            container.classList.add('status-yellow');
            info.style.display = 'block';
            tooltip.innerHTML = '<strong>Connection Expired</strong>Your Trakt connection has expired or is out of sync. Click here to disconnect and reconnect.';
        } else if (state === 'error') {
            container.style.display = 'flex';
            container.classList.add('status-red');
            info.style.display = 'block';
            tooltip.innerHTML = '<strong>Server Error</strong>Trakt.tv servers are currently experiencing issues. Please try again later.';
        }
    },

    async checkConnectionStatus() {
        if (!this.isLoggedIn()) {
            this.updateTraktStatusUI('disconnected');
            return;
        }
        
        // Initial optimistic UI
        this.updateTraktStatusUI('connected');
        
        try {
            const token = await this.getValidToken();
            if (!token) {
                this.updateTraktStatusUI('unauthorized');
                return;
            }
            
            const res = await fetch(`${TRAKT_API_URL}/users/me`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'trakt-api-version': '2',
                    'trakt-api-key': TRAKT_CLIENT_ID
                }
            });
            
            if (res.status === 401 || res.status === 400) {
                this.updateTraktStatusUI('unauthorized');
            } else if (!res.ok) {
                this.updateTraktStatusUI('error');
            } else {
                this.updateTraktStatusUI('connected');
            }
        } catch (e) {
            this.updateTraktStatusUI('error');
        }
    }
};

const TraktSync = {
    async markWatched(tmdbId, type, season = null, episode = null) {
        if (!TraktAuth.isLoggedIn()) return;
        if (type === 'anime') type = 'tv'; // Trakt treats anime as TV shows

        const payload = {};
        console.log(`[Trakt Sync] Sending watched signal for ${type === 'movie' ? 'Movie' : 'TV Show'} TMDB ID: ${tmdbId} (Season: ${season}, Episode: ${episode})`);
        
        
        if (type === 'movie') {
            payload.movies = [{ ids: { tmdb: parseInt(tmdbId) } }];
        } else if (type === 'tv' && season !== null && episode !== null) {
            payload.shows = [{
                ids: { tmdb: parseInt(tmdbId) },
                seasons: [{
                    number: parseInt(season),
                    episodes: [{ number: parseInt(episode) }]
                }]
            }];
        }

        const res = await TraktAuth.apiCall('/sync/history', 'POST', payload);
        console.log('[Trakt Sync] Full response:', JSON.stringify(res));
        if (res && res.added) {
            const addedEps = (res.added.episodes || 0) + (res.added.movies || 0);
            const notFoundEps = res.not_found ? ((res.not_found.shows || []).length + (res.not_found.movies || []).length) : 0;
            console.log(`[Trakt Sync] ✅ Added: ${addedEps}, Not Found: ${notFoundEps}`);
            if (addedEps > 0) {
                this.showToast('✅ Saved to Trakt.tv');
            } else if (notFoundEps > 0) {
                console.warn('[Trakt Sync] ⚠️ Trakt could not find this item! TMDB ID may not be mapped.');
                this.showToast('⚠️ Trakt could not find this item');
            } else {
                this.showToast('✅ Already in Trakt history');
            }
        } else {
            console.error('[Trakt Sync] ❌ API call failed or returned no data');
        }
    },

    async addToWatchlist(tmdbId, type) {
        if (!TraktAuth.isLoggedIn()) return;
        if (type === 'anime') type = 'tv'; // Trakt treats anime as TV shows
        const payload = {};
        if (type === 'movie') payload.movies = [{ ids: { tmdb: parseInt(tmdbId) } }];
        else payload.shows = [{ ids: { tmdb: parseInt(tmdbId) } }];

        const res = await TraktAuth.apiCall('/sync/watchlist', 'POST', payload);
        if (res && res.added) {
            this.showToast('✅ Added to Trakt Watchlist');
        }
    },

    async removeFromWatchlist(tmdbId, type) {
        if (!TraktAuth.isLoggedIn()) return;
        if (type === 'anime') type = 'tv'; // Trakt treats anime as TV shows
        const payload = {};
        if (type === 'movie') payload.movies = [{ ids: { tmdb: parseInt(tmdbId) } }];
        else payload.shows = [{ ids: { tmdb: parseInt(tmdbId) } }];

        const res = await TraktAuth.apiCall('/sync/watchlist/remove', 'POST', payload);
        if (res && res.deleted) {
            this.showToast('❌ Removed from Trakt Watchlist');
        }
    },

    async scrobbleProgress(tmdbId, type, season = null, episode = null, progressPercentage) {
        if (!TraktAuth.isLoggedIn() || progressPercentage <= 0) return;
        if (type === 'anime') type = 'tv'; // Trakt treats anime as TV shows
        
        let payload = {
            progress: parseFloat(progressPercentage.toFixed(2)),
            app_version: "2.2",
            app_date: "2026-06-13"
        };

        if (type === 'movie') {
            payload.movie = { ids: { tmdb: parseInt(tmdbId) } };
        } else if (type === 'tv' && season !== null && episode !== null) {
            payload.show = { ids: { tmdb: parseInt(tmdbId) } };
            payload.episode = { season: parseInt(season), number: parseInt(episode) };
        } else {
            return;
        }

        // We use /scrobble/pause to record progress without completing
        await TraktAuth.apiCall('/scrobble/pause', 'POST', payload);
    },

    showToast(message) {
        let toast = document.getElementById('trakt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'trakt-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(229, 9, 20, 0.9)';
            toast.style.color = '#fff';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '30px';
            toast.style.fontFamily = 'sans-serif';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = 'bold';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            toast.style.zIndex = '9999';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.display = 'block';
        
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 3000);
    },

    async exportLocalToTrakt(silent = false) {
        if (!TraktAuth.isLoggedIn()) {
            if (!silent) alert('Please connect to Trakt first.');
            return;
        }

        const payload = {};
        let count = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Export Movies from progress
            if (key.startsWith('progress_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    let mediaType = data.mediaType || data.type;
                    if (!mediaType) {
                        // Deduce from watchlist if possible, otherwise assume movie if no season/ep data
                        mediaType = 'movie';
                    }
                    if (mediaType === 'anime') mediaType = 'tv'; // Normalize for Trakt
                    if (mediaType === 'movie') {
                        if (data.progress >= 90) {
                            if (!payload.movies) payload.movies = [];
                            payload.movies.push({
                                ids: { tmdb: parseInt(data.id) },
                                watched_at: new Date(data.updatedAt || Date.now()).toISOString()
                            });
                            count++;
                        } else if (data.progress >= 1 && data.progress <= 100) {
                            TraktSync.scrobbleProgress(data.id, 'movie', null, null, data.progress).catch(e => console.log('Scrobble export failed', e));
                            count++;
                        }
                    } else if (mediaType === 'tv' && data.progress >= 1 && data.progress <= 100) {
                        // TV/anime partially watched — scrobble progress to Trakt
                        const s = data.currentSeason || data.season || null;
                        const e = data.currentEpisode || data.episode || null;
                        if (s && e) {
                            TraktSync.scrobbleProgress(data.id, 'tv', s, e, data.progress).catch(err => console.log('Scrobble export failed', err));
                            count++;
                        }
                    }
                } catch (e) { console.error("Error parsing progress", e); }
            }
            
            // Export TV Shows from watched_series
            if (key.startsWith('watched_series_')) {
                try {
                    const showId = key.replace('watched_series_', '');
                    const data = JSON.parse(localStorage.getItem(key));
                    const showPayload = { ids: { tmdb: parseInt(showId) }, seasons: [] };
                    
                    for (const season in data) {
                        if (season === '_updatedAt') continue;
                        const episodes = data[season];
                        if (Array.isArray(episodes) && episodes.length > 0) {
                            showPayload.seasons.push({
                                number: parseInt(season),
                                episodes: episodes.map(ep => ({ number: parseInt(ep), watched_at: new Date(data._updatedAt || Date.now()).toISOString() }))
                            });
                            count += episodes.length;
                        }
                    }
                    
                    if (showPayload.seasons.length > 0) {
                        if (!payload.shows) payload.shows = [];
                        payload.shows.push(showPayload);
                    }
                } catch (e) { console.error("Error parsing watched series", e); }
            }
        }

        if (count === 0) {
            if (!silent) alert('No completed movies or episodes found locally to export.');
        } else {
            if (!silent) alert(`Exporting ${count} items to Trakt. This might take a moment...`);
            const result = await TraktAuth.apiCall('/sync/history', 'POST', payload);
            if (result && result.added && !silent) {
                alert(`Successfully exported to Trakt! Added ${result.added.movies} movies and ${result.added.episodes} episodes.`);
            }
        }

        // Export Watchlist
        let localWatchlist = [];
        try { localWatchlist = JSON.parse(localStorage.getItem('watchlist')) || []; } catch(e){}
        if (localWatchlist.length > 0) {
            const watchlistPayload = {};
            localWatchlist.forEach(item => {
                let type = item.media_type || item.type || item.mediaType || (item.title ? 'movie' : 'tv');
                if (type === 'movie') {
                    if (!watchlistPayload.movies) watchlistPayload.movies = [];
                    watchlistPayload.movies.push({ ids: { tmdb: parseInt(item.id) } });
                } else {
                    if (!watchlistPayload.shows) watchlistPayload.shows = [];
                    watchlistPayload.shows.push({ ids: { tmdb: parseInt(item.id) } });
                }
            });
            await TraktAuth.apiCall('/sync/watchlist', 'POST', watchlistPayload);
        }
    },

    async importTraktToLocal() {
        if (!TraktAuth.isLoggedIn()) return;
        
        try {
            // Fetch watched movies
            const movies = await TraktAuth.apiCall('/sync/history/movies?limit=10000');
            if (movies && Array.isArray(movies)) {
                movies.forEach(m => {
                    if (m.movie && m.movie.ids && m.movie.ids.tmdb) {
                        const id = m.movie.ids.tmdb;
                        const key = `progress_${id}`;
                        if (!localStorage.getItem(key)) {
                            // Mock a 100% progress object
                            localStorage.setItem(key, JSON.stringify({
                                id: id,
                                mediaType: 'movie',
                                progress: 100,
                                title: m.movie.title,
                                updatedAt: new Date(m.watched_at).getTime()
                            }));
                        }
                    }
                });
            }


            // Fetch watched episodes via history endpoint (sync/watched/shows doesn't return seasons)
            // Use pagination with header-based page count — no arbitrary cap
            let allEpisodes = [];
            const firstPage = await TraktAuth.apiCallWithHeaders('/sync/history/episodes?page=1&limit=500');
            if (firstPage.data && Array.isArray(firstPage.data)) {
                allEpisodes = allEpisodes.concat(firstPage.data);

                const totalPages = parseInt(firstPage.headers?.get('X-Pagination-Page-Count') || '1');
                const totalItems = firstPage.headers?.get('X-Pagination-Item-Count') || '?';
                console.log(`[Trakt] Episode history: ${totalPages} pages (${totalItems} total items) to fetch`);

                // Update loading screen if visible
                if (typeof TraktSync !== 'undefined' && TraktSync._updateLoadingProgress) {
                    TraktSync._updateLoadingProgress('episodes', 1, totalPages, allEpisodes.length, totalItems);
                }

                // Fetch remaining pages
                for (let page = 2; page <= totalPages; page++) {
                    const pageData = await TraktAuth.apiCall(`/sync/history/episodes?page=${page}&limit=500`);
                    if (pageData && Array.isArray(pageData)) {
                        allEpisodes = allEpisodes.concat(pageData);
                    }
                    // Update loading screen progress
                    if (typeof TraktSync !== 'undefined' && TraktSync._updateLoadingProgress) {
                        TraktSync._updateLoadingProgress('episodes', page, totalPages, allEpisodes.length, totalItems);
                    }
                }
            }
            console.log(`[Trakt] Fetched ${allEpisodes.length} episode history entries`);

            if (allEpisodes.length > 0) {
                // Group episodes by show TMDB ID → season → episode numbers
                const showMap = {};
                allEpisodes.forEach(entry => {
                    if (entry.show && entry.show.ids && entry.show.ids.tmdb && entry.episode) {
                        const showId = entry.show.ids.tmdb;
                        const seasonNum = entry.episode.season;
                        const epNum = entry.episode.number;
                        if (seasonNum === undefined || epNum === undefined) return;
                        
                        if (!showMap[showId]) showMap[showId] = {};
                        if (!showMap[showId][seasonNum]) showMap[showId][seasonNum] = new Set();
                        showMap[showId][seasonNum].add(epNum);
                    }
                });

                // Store grouped data into localStorage
                for (const showId of Object.keys(showMap)) {
                    const key = `watched_series_${showId}`;
                    let seriesData = { _updatedAt: Date.now() };
                    try { seriesData = JSON.parse(localStorage.getItem(key)) || { _updatedAt: Date.now() }; } catch(e){}

                    for (const season of Object.keys(showMap[showId])) {
                        if (!seriesData[season]) seriesData[season] = [];
                        showMap[showId][season].forEach(epNum => {
                            if (!seriesData[season].includes(epNum)) {
                                seriesData[season].push(epNum);
                            }
                        });
                    }
                    seriesData._updatedAt = Date.now();
                    localStorage.setItem(key, JSON.stringify(seriesData));
                }
                console.log(`[Trakt] Imported episodes for ${Object.keys(showMap).length} shows`);
            }

            // Import Watchlist
            const traktWatchlist = await TraktAuth.apiCall('/sync/watchlist');
            if (traktWatchlist && Array.isArray(traktWatchlist)) {
                let localWatchlist = [];
                try { localWatchlist = JSON.parse(localStorage.getItem('watchlist')) || []; } catch(e){}
                // Auto-repair existing items that are missing posters (fixes invisible items in UI)
                let changed = false;
                const brokenWatchlist = localWatchlist.filter(w => !w.poster_path);
                if (brokenWatchlist.length > 0) {
                    for (const w of brokenWatchlist) {
                        try {
                            const wType = w.media_type || w.type || (w.title ? 'movie' : 'tv');
                            const meta = await fetchApi(`/${wType}/${w.id}?api_key=${TMDB_API_KEY}`);
                            if (meta) { 
                                w.poster_path = meta.poster_path; 
                                w.id = parseInt(w.id);
                                w.media_type = wType; // Normalize field name
                            }
                        } catch(e){}
                        await new Promise(r => setTimeout(r, 50)); // Prevent rate limit
                    }
                    changed = true;
                    localStorage.setItem('watchlist', JSON.stringify(localWatchlist));
                }

                const newItems = traktWatchlist.filter(item => {
                    let id = (item.movie || item.show)?.ids?.tmdb;
                    return id && !localWatchlist.find(w => w.id == id);
                });
                
                if (newItems.length > 0) {
                    for (const item of newItems) {
                        let id, type, title, release_date;
                        if (item.type === 'movie') { id = item.movie.ids.tmdb; type = 'movie'; title = item.movie.title; }
                        else if (item.type === 'show') { id = item.show.ids.tmdb; type = 'tv'; title = item.show.title; }
                        
                        let poster_path = null;
                        try {
                            const meta = await fetchApi(`/${type}/${id}?api_key=${TMDB_API_KEY}`);
                            if (meta) {
                                poster_path = meta.poster_path;
                                title = meta.title || meta.name || title;
                                release_date = meta.release_date || meta.first_air_date;
                            }
                        } catch(e) {}
                        
                        localWatchlist.push({ 
                            id: parseInt(id), // Integer to fix the === bug in UI
                            media_type: type, // Must match toggleWatchlist format in index.html
                            title: type === 'movie' ? title : undefined,
                            name: type === 'tv' ? title : undefined,
                            poster_path: poster_path,
                            release_date: release_date,
                            timestamp: new Date(item.listed_at).getTime() 
                        });
                        await new Promise(r => setTimeout(r, 50)); // Prevent rate limit
                    }
                    localStorage.setItem('watchlist', JSON.stringify(localWatchlist));
                }
            }

            // Import Playback Progress
            const playback = await TraktAuth.apiCall('/sync/playback');
            if (playback && Array.isArray(playback)) {
                let cw = [];
                try { cw = JSON.parse(localStorage.getItem('continue_watching')) || []; } catch(e){}

                for (const item of playback) {
                    let id, type, title;
                    if (item.type === 'movie' && item.movie && item.movie.ids && item.movie.ids.tmdb) {
                        id = item.movie.ids.tmdb; type = 'movie'; title = item.movie.title;
                    } else if (item.type === 'episode' && item.show && item.show.ids && item.show.ids.tmdb) {
                        id = item.show.ids.tmdb; type = 'tv'; title = item.show.title;
                        var epSeason = item.episode && item.episode.season;
                        var epNumber = item.episode && item.episode.number;
                    }

                    if (id) {
                        const key = `progress_${id}`;
                        let progData = { progress: item.progress, id: parseInt(id), type: type, mediaType: type, title: title, isEstimated: true, updatedAt: new Date(item.paused_at).getTime() };
                        if (type === 'tv' && epSeason !== undefined && epNumber !== undefined) {
                            progData.currentSeason = epSeason;
                            progData.currentEpisode = epNumber;
                        }
                        
                        try { 
                            const existing = JSON.parse(localStorage.getItem(key)); 
                            if (existing && existing.updatedAt && existing.updatedAt > progData.updatedAt) {
                                progData = null; // Local is newer
                            } else if (existing) {
                                progData = { ...existing, progress: item.progress, updatedAt: progData.updatedAt, isEstimated: true };
                            }
                        } catch(e) {}
                        
                        if (progData) {
                            // If we don't have a poster, fetch it so the UI renders it
                            if (!progData.poster && !progData.poster_path) {
                                try {
                                    const meta = await fetchApi(`/${type}/${id}?api_key=${TMDB_API_KEY}`);
                                    if (meta) {
                                        progData.poster_path = meta.poster_path;
                                        // Store full poster URL too — renderContinueWatching uses item.poster
                                        progData.poster = meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : '';
                                        progData.title = meta.title || meta.name || title;
                                    }
                                } catch(e){}
                                await new Promise(r => setTimeout(r, 50)); // Prevent rate limit
                            }
                            // Ensure poster field always exists for renderContinueWatching
                            if (!progData.poster && progData.poster_path) {
                                progData.poster = `https://image.tmdb.org/t/p/w500${progData.poster_path}`;
                            }
                            localStorage.setItem(key, JSON.stringify(progData));
                            cw = cw.filter(c_id => parseInt(c_id) !== parseInt(id));
                            cw.unshift(parseInt(id));
                        }
                    }
                }
                localStorage.setItem('continue_watching', JSON.stringify(cw));
            }

            console.log("Trakt import complete");
            return true;
        } catch (e) {
            console.error("Error pulling Trakt history", e);
            return false;
        }
    },

    async syncIfNewer() {
        if (!TraktAuth.isLoggedIn()) return false;
        
        try {
            const activities = await TraktAuth.apiCall('/sync/last_activities');
            if (!activities) return false;

            const lastLocalSync = parseInt(localStorage.getItem('trakt_last_auto_import') || '0');
            
            // Get the newest remote timestamp
            const times = [
                new Date(activities.all).getTime(),
                new Date(activities.movies.watched_at).getTime(),
                new Date(activities.episodes.watched_at).getTime(),
                new Date(activities.watchlist.updated_at).getTime()
            ];
            const newestRemoteTime = Math.max(...times.filter(t => !isNaN(t)));

            if (newestRemoteTime > lastLocalSync) {
                console.log('[Trakt] Remote changes detected. Starting smart auto-import...');
                const success = await this.importTraktToLocal();
                if (success) {
                    localStorage.setItem('trakt_last_auto_import', newestRemoteTime.toString());
                    return true;
                }
            } else {
                console.log('[Trakt] Local data is up to date with remote.');
            }
        } catch (e) {
            console.error('[Trakt] Smart sync check failed:', e);
        }
        return false;
    },

    // Internal: update loading overlay progress
    _updateLoadingProgress(phase, currentPage, totalPages, itemCount, totalItems) {
        const overlay = document.getElementById('trakt-sync-overlay');
        if (!overlay || overlay.style.display === 'none') return;

        const statusEl = overlay.querySelector('.trakt-sync-status');
        const progressBar = overlay.querySelector('.trakt-sync-progress-fill');
        const detailEl = overlay.querySelector('.trakt-sync-detail');

        if (phase === 'export') {
            if (statusEl) statusEl.textContent = 'Pushing local history to Trakt...';
            if (progressBar) progressBar.style.width = '15%';
            if (detailEl) detailEl.textContent = 'Uploading your movies, episodes & watchlist';
        } else if (phase === 'episodes') {
            const pct = Math.min(15 + (currentPage / totalPages) * 70, 85);
            if (statusEl) statusEl.textContent = `Fetching episode history...`;
            if (progressBar) progressBar.style.width = pct + '%';
            if (detailEl) detailEl.textContent = `Page ${currentPage} of ${totalPages}  •  ${itemCount.toLocaleString()} episodes so far`;
        } else if (phase === 'finishing') {
            if (statusEl) statusEl.textContent = 'Importing watchlist & playback...';
            if (progressBar) progressBar.style.width = '90%';
            if (detailEl) detailEl.textContent = 'Almost done!';
        } else if (phase === 'done') {
            if (statusEl) statusEl.textContent = 'Sync Complete!';
            if (progressBar) progressBar.style.width = '100%';
            if (detailEl) detailEl.textContent = 'Your history is perfectly matched.';
        }
    },

    // Show the sync loading overlay
    _showSyncOverlay() {
        // Remove existing overlay if present
        let overlay = document.getElementById('trakt-sync-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'trakt-sync-overlay';
        overlay.innerHTML = `
            <div class="trakt-sync-modal">
                <button class="trakt-sync-close" id="trakt-sync-close-btn" aria-label="Close">&times;</button>
                <div class="trakt-sync-icon">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                    </svg>
                </div>
                <h3 class="trakt-sync-title">Syncing with Trakt.tv</h3>
                <p class="trakt-sync-status">Preparing sync...</p>
                <div class="trakt-sync-progress-track">
                    <div class="trakt-sync-progress-fill"></div>
                </div>
                <p class="trakt-sync-detail">This may take a minute for large libraries</p>
                <p class="trakt-sync-hint">You can safely close this — sync will continue in the background</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Close button — hides overlay but sync continues in background
        document.getElementById('trakt-sync-close-btn').addEventListener('click', () => {
            overlay.classList.add('trakt-sync-overlay-hiding');
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.classList.remove('trakt-sync-overlay-hiding');
            }, 300);
        });

        // Trigger entrance animation
        requestAnimationFrame(() => overlay.classList.add('trakt-sync-overlay-visible'));
    },

    // Hide and remove the sync overlay
    _hideSyncOverlay(delay = 800) {
        const overlay = document.getElementById('trakt-sync-overlay');
        if (!overlay) return;
        setTimeout(() => {
            overlay.classList.add('trakt-sync-overlay-hiding');
            setTimeout(() => overlay.remove(), 400);
        }, delay);
    },

    async fullSync() {
        if (!TraktAuth.isLoggedIn()) return alert('Please connect to Trakt first.');

        // Show premium loading overlay
        this._showSyncOverlay();

        try {
            // Phase 1: Export
            this._updateLoadingProgress('export');
            await this.exportLocalToTrakt(true);

            // Phase 2: Import (episode progress is updated from inside importTraktToLocal)
            this._updateLoadingProgress('finishing');
            const importSuccess = await this.importTraktToLocal();

            // Phase 3: Done
            this._updateLoadingProgress('done');

            if (importSuccess) {
                this._hideSyncOverlay(1200);
                setTimeout(() => window.location.reload(), 1600);
            } else {
                const overlay = document.getElementById('trakt-sync-overlay');
                if (overlay) {
                    const statusEl = overlay.querySelector('.trakt-sync-status');
                    if (statusEl) statusEl.textContent = 'Sync completed with some errors.';
                    const detailEl = overlay.querySelector('.trakt-sync-detail');
                    if (detailEl) detailEl.textContent = 'Some data may not have imported correctly.';
                }
                this._hideSyncOverlay(3000);
            }
        } catch (e) {
            console.error('[Trakt] Full sync error:', e);
            this._hideSyncOverlay(0);
            alert('Sync failed: ' + e.message);
        }
    }
};

// Auto-handle callback on load
window.addEventListener('load', async () => {
    if (window.location.search.includes('code=')) {
        const success = await TraktAuth.handleCallback();
        if (success) {
            alert('Successfully connected to Trakt.tv! We will now sync your history.');
            await TraktSync.fullSync();
        }
    }
});
