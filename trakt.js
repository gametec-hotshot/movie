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
        return window.location.origin + window.location.pathname;
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

    logout() {
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
        if (!token) return null;

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
            if (!res.ok) throw new Error(`Trakt API error: ${res.status}`);
            if (method !== 'POST') return await res.json();
            return await res.text();
        } catch (e) {
            console.error(e);
            return null;
        }
    }
};

const TraktSync = {
    async markWatched(tmdbId, type, season = null, episode = null) {
        if (!TraktAuth.isLoggedIn()) return;

        const payload = { movies: [], episodes: [] };
        
        if (type === 'movie') {
            payload.movies.push({ ids: { tmdb: parseInt(tmdbId) } });
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
        if (res && res.added) {
            this.showToast('✅ Saved to Trakt.tv');
        }
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

        const payload = { movies: [], shows: [] };
        let count = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Export Movies from progress
            if (key.startsWith('progress_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.progress >= 90 && (data.mediaType === 'movie' || data.type === 'movie')) {
                        payload.movies.push({
                            ids: { tmdb: parseInt(data.id) },
                            watched_at: new Date(data.updatedAt || Date.now()).toISOString()
                        });
                        count++;
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
                        payload.shows.push(showPayload);
                    }
                } catch (e) { console.error("Error parsing watched series", e); }
            }
        }

        if (count === 0) {
            if (!silent) alert('No completed movies or episodes found locally to export.');
            return;
        }

        if (!silent) alert(`Exporting ${count} items to Trakt. This might take a moment...`);
        const result = await TraktAuth.apiCall('/sync/history', 'POST', payload);
        if (result && result.added && !silent) {
            alert(`Successfully exported to Trakt! Added ${result.added.movies} movies and ${result.added.episodes} episodes.`);
        } else if (!silent) {
            alert('Export might have failed or items were already on Trakt.');
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

            // Fetch watched shows
            const shows = await TraktAuth.apiCall('/sync/history/shows?limit=10000');
            if (shows && Array.isArray(shows)) {
                shows.forEach(s => {
                    if (s.show && s.show.ids && s.show.ids.tmdb) {
                        const id = s.show.ids.tmdb;
                        const key = `watched_series_${id}`;
                        let seriesData = { _updatedAt: Date.now() };
                        try { seriesData = JSON.parse(localStorage.getItem(key)) || { _updatedAt: Date.now() }; } catch(e){}
                        
                        // Wait, Trakt history for shows returns each episode watched individually, not structured by show.
                        // Actually, /sync/history/shows might return the show object, but to get episodes we need /sync/watched/shows.
                        // Wait, /sync/watched/shows is much better for importing!
                    }
                });
            }
            
            // Fetch watched shows structured (sync/watched/shows)
            const watchedShows = await TraktAuth.apiCall('/sync/watched/shows');
            if (watchedShows && Array.isArray(watchedShows)) {
                watchedShows.forEach(ws => {
                    if (ws.show && ws.show.ids && ws.show.ids.tmdb) {
                        const id = ws.show.ids.tmdb;
                        const key = `watched_series_${id}`;
                        let seriesData = { _updatedAt: Date.now() };
                        try { seriesData = JSON.parse(localStorage.getItem(key)) || { _updatedAt: Date.now() }; } catch(e){}
                        
                        if (ws.seasons) {
                            ws.seasons.forEach(season => {
                                if (!seriesData[season.number]) seriesData[season.number] = [];
                                season.episodes.forEach(ep => {
                                    if (!seriesData[season.number].includes(ep.number)) {
                                        seriesData[season.number].push(ep.number);
                                    }
                                });
                            });
                        }
                        localStorage.setItem(key, JSON.stringify(seriesData));
                    }
                });
            }
            console.log("Trakt import complete");
            return true;
        } catch (e) {
            console.error("Error pulling Trakt history", e);
            return false;
        }
    },

    async fullSync() {
        if (!TraktAuth.isLoggedIn()) return alert('Please connect to Trakt first.');
        
        alert("Starting Two-Way Sync with Trakt.tv...\n\n1. Pushing your local history to Trakt.\n2. Pulling your Trakt history to your local device.\n\nThis might take a minute.");
        
        await this.exportLocalToTrakt(true); // pass true to suppress its own success alert
        const importSuccess = await this.importTraktToLocal();
        
        if (importSuccess) {
            alert("Two-Way Sync Complete! Your local tracking and Trakt.tv history are perfectly matched.");
            window.location.reload(); // Reload to reflect UI changes (like tick marks)
        } else {
            alert("Sync completed, but there were some errors pulling data from Trakt.");
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
