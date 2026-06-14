// supabase.js — Prisma v2.5
// Supabase Client Initialization
const SUPABASE_URL = 'https://bjomxfjqqyhxmgjptesi.supabase.co'; // Provided from user dashboard
const SUPABASE_ANON_KEY = 'sb_publishable_CPS37TO2Y9iHbFBQNNan5Q_V2GJjg4A'; // Provided by user

let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof supabase === 'undefined') {
        console.error("Supabase script failed to load from CDN. Please check your network or adblocker.");
    } else {
        console.warn("Supabase is not configured yet. Please add your URL and Anon Key to supabase.js");
    }
} catch (e) {
    console.error("Error initializing Supabase:", e);
}

const SITE_URL = 'https://gametec-hotshot.github.io/movie/';

const SupabaseAuth = {
    async signUp(email, password) {
        if (!supabaseClient) return { error: { message: "Supabase not configured." } };
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: SITE_URL
            }
        });
        return { data, error };
    },

    async signIn(email, password) {
        if (!supabaseClient) return { error: { message: "Supabase not configured." } };
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });
        if (data.session) {
            localStorage.setItem('supabase_session', JSON.stringify(data.session));
        }
        return { data, error };
    },

    async signOut() {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            localStorage.removeItem('supabase_session');
            window.location.reload();
        }
    },

    async getSession() {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.auth.getSession();
        if (data && data.session) {
            return data.session;
        }
        return null;
    },

    async getUser() {
        const session = await this.getSession();
        return session ? session.user : null;
    }
};

// Handle Supabase email confirmation redirect (GitHub Pages)
// When user clicks confirm link, they land back with #access_token=... in the URL
(async function handleAuthRedirect() {
    if (!supabaseClient) return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        // Supabase JS v2 automatically handles the hash and sets the session
        const { data, error } = await supabaseClient.auth.getSession();
        if (data && data.session) {
            // Clean up the URL hash without reloading
            history.replaceState(null, '', window.location.pathname);
            console.log('Supabase: Email confirmed and signed in as', data.session.user.email);
        }
    }
})();

const SupabaseSync = {
    async syncAllToCloud() {
        const user = await SupabaseAuth.getUser();
        if (!user) return;

        // Sync Watchlist
        try {
            const localWatchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
            for (const item of localWatchlist) {
                await supabaseClient.from('my_list').upsert({
                    user_id: user.id,
                    tmdb_id: parseInt(item.id),
                    media_type: item.media_type || (item.title ? 'movie' : 'tv'),
                    title: item.title || item.name || null,
                    poster_path: item.poster_path || null,
                    added_at: new Date(item.timestamp || Date.now()).toISOString()
                }, { onConflict: 'user_id, tmdb_id, media_type' });
            }
        } catch (e) {
            console.error("Error syncing watchlist to cloud:", e);
        }

        // Sync Continue Watching
        try {
            const cwIds = JSON.parse(localStorage.getItem('continue_watching')) || [];
            for (const id of cwIds) {
                const progStr = localStorage.getItem(`progress_${id}`);
                if (progStr) {
                    const progData = JSON.parse(progStr);
                    await supabaseClient.from('continue_watching').upsert({
                        user_id: user.id,
                        tmdb_id: parseInt(id),
                        media_type: progData.mediaType || progData.type || 'movie',
                        season_number: progData.season || progData.currentSeason || null,
                        episode_number: progData.episode || progData.currentEpisode || null,
                        progress_seconds: progData.progress || progData.currentTime || 0,
                        title: progData.title || null,
                        poster_path: progData.poster || progData.poster_path || null,
                        updated_at: new Date(progData.updatedAt || Date.now()).toISOString()
                    }, { onConflict: 'user_id, tmdb_id, media_type' });
                }
            }
        } catch (e) {
            console.error("Error syncing continue watching to cloud:", e);
        }
    },

    async pullAllFromCloud() {
        const user = await SupabaseAuth.getUser();
        if (!user) return;

        // Pull Watchlist — with title and poster_path
        try {
            const { data: cloudWatchlist } = await supabaseClient.from('my_list').select('*').eq('user_id', user.id);
            if (cloudWatchlist && cloudWatchlist.length > 0) {
                let localWatchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
                let changed = false;

                for (const cloudItem of cloudWatchlist) {
                    if (!localWatchlist.find(w => parseInt(w.id) === cloudItem.tmdb_id)) {
                        localWatchlist.push({
                            id: cloudItem.tmdb_id,
                            media_type: cloudItem.media_type,
                            title: cloudItem.title || null,
                            poster_path: cloudItem.poster_path || null,
                            timestamp: cloudItem.added_at ? new Date(cloudItem.added_at).getTime() : Date.now()
                        });
                        changed = true;
                    }
                }
                if (changed) localStorage.setItem('watchlist', JSON.stringify(localWatchlist));
            }
        } catch (e) {
            console.error("Error pulling watchlist:", e);
        }

        // Pull Continue Watching
        try {
            const { data: cloudCW } = await supabaseClient.from('continue_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
            if (cloudCW && cloudCW.length > 0) {
                let cw = JSON.parse(localStorage.getItem('continue_watching')) || [];

                for (const cloudItem of cloudCW) {
                    const key = `progress_${cloudItem.tmdb_id}`;
                    let progData = {
                        id: cloudItem.tmdb_id,
                        mediaType: cloudItem.media_type,
                        type: cloudItem.media_type,
                        season: cloudItem.season_number,
                        episode: cloudItem.episode_number,
                        currentSeason: cloudItem.season_number,
                        currentEpisode: cloudItem.episode_number,
                        progress: cloudItem.progress_seconds,
                        currentTime: cloudItem.progress_seconds,
                        title: cloudItem.title || null,
                        poster: cloudItem.poster_path || null,
                        poster_path: cloudItem.poster_path || null,
                        updatedAt: new Date(cloudItem.updated_at).getTime()
                    };

                    let existing;
                    try { existing = JSON.parse(localStorage.getItem(key)); } catch (e) { }

                    // Merge: prefer existing local data (has more detail), but fill in missing fields from cloud
                    if (!existing) {
                        localStorage.setItem(key, JSON.stringify(progData));
                    } else if (existing.updatedAt < progData.updatedAt) {
                        // Cloud is newer — merge but keep existing poster/title if cloud doesn't have them
                        progData = {
                            ...progData,
                            ...existing,
                            progress: progData.progress,
                            currentTime: progData.currentTime,
                            updatedAt: progData.updatedAt,
                            // Fill in poster/title from cloud if local is missing them
                            poster: existing.poster || progData.poster,
                            title: existing.title || progData.title
                        };
                        localStorage.setItem(key, JSON.stringify(progData));
                    }

                    cw = cw.filter(id => parseInt(id) !== cloudItem.tmdb_id);
                    cw.unshift(cloudItem.tmdb_id);
                }
                localStorage.setItem('continue_watching', JSON.stringify(cw));
            }
        } catch (e) {
            console.error("Error pulling continue watching:", e);
        }
    },

    async addWatchlist(id, type) {
        const user = await SupabaseAuth.getUser();
        if (!user) return;
        await supabaseClient.from('my_list').upsert({
            user_id: user.id,
            tmdb_id: parseInt(id),
            media_type: type,
            added_at: new Date().toISOString()
        }, { onConflict: 'user_id, tmdb_id, media_type' });
    },

    async removeWatchlist(id, type) {
        const user = await SupabaseAuth.getUser();
        if (!user) return;
        await supabaseClient.from('my_list').delete().match({ user_id: user.id, tmdb_id: parseInt(id), media_type: type });
    },

    async updateProgress(id, type, progress, season = null, episode = null) {
        const user = await SupabaseAuth.getUser();
        if (!user) return;

        await supabaseClient.from('continue_watching').upsert({
            user_id: user.id,
            tmdb_id: parseInt(id),
            media_type: type,
            season_number: season,
            episode_number: episode,
            progress_seconds: progress,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, tmdb_id, media_type' });
    },

    async removeFromContinueWatching(id, type) {
        const user = await SupabaseAuth.getUser();
        if (!user) return;
        await supabaseClient.from('continue_watching').delete().match({ user_id: user.id, tmdb_id: parseInt(id), media_type: type });
    }
};

// Trakt Connection Sync — Persist Trakt OAuth tokens in Supabase
const TraktConnectionSync = {
    async saveTraktTokens(accessToken, refreshToken, traktUserId = null) {
        const user = await SupabaseAuth.getUser();
        if (!user || !supabaseClient) return;

        try {
            await supabaseClient.from('trakt_connections').upsert({
                user_id: user.id,
                trakt_user_id: traktUserId,
                access_token: accessToken,
                refresh_token: refreshToken
            }, { onConflict: 'user_id' });
            console.log('[Supabase] Trakt tokens saved to cloud');
        } catch (e) {
            console.warn('[Supabase] Could not save Trakt tokens:', e);
        }
    },

    async loadTraktTokens() {
        const user = await SupabaseAuth.getUser();
        if (!user || !supabaseClient) return false;

        // Don't override if Trakt is already connected locally
        if (localStorage.getItem('trakt_access_token')) return false;

        try {
            const { data } = await supabaseClient
                .from('trakt_connections')
                .select('access_token, refresh_token')
                .eq('user_id', user.id)
                .single();

            if (data && data.access_token) {
                localStorage.setItem('trakt_access_token', data.access_token);
                localStorage.setItem('trakt_refresh_token', data.refresh_token);
                // Force a token refresh on first API call to get fresh metadata
                localStorage.setItem('trakt_token_created_at', '0');
                localStorage.setItem('trakt_token_expires_in', '1');
                console.log('[Supabase] Trakt tokens restored from cloud');
                return true;
            }
        } catch (e) {
            console.warn('[Supabase] Could not load Trakt tokens:', e);
        }
        return false;
    },

    async clearTraktTokens() {
        const user = await SupabaseAuth.getUser();
        if (!user || !supabaseClient) return;

        try {
            await supabaseClient.from('trakt_connections').delete().match({ user_id: user.id });
            console.log('[Supabase] Trakt tokens cleared from cloud');
        } catch (e) {
            console.warn('[Supabase] Could not clear Trakt tokens:', e);
        }
    },

    async updateTraktTokens(accessToken, refreshToken) {
        const user = await SupabaseAuth.getUser();
        if (!user || !supabaseClient) return;

        try {
            await supabaseClient.from('trakt_connections').update({
                access_token: accessToken,
                refresh_token: refreshToken
            }).eq('user_id', user.id);
        } catch (e) {
            console.warn('[Supabase] Could not update Trakt tokens:', e);
        }
    }
};

// UI and DOM Logic
async function initSupabaseUI() {
    const accountToggleBtn = document.getElementById('account-toggle-btn');
    const accountDropdown = document.getElementById('account-dropdown');
    const navSigninBtn = document.getElementById('nav-signin-btn');
    const navSignoutBtn = document.getElementById('nav-signout-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');
    const authSwitchBtn = document.getElementById('auth-switch-btn');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authError = document.getElementById('auth-error');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authSwitchText = document.getElementById('auth-switch-text');
    const statusDot = document.getElementById('supabase-status-dot');
    const statusText = document.getElementById('supabase-status-text');
    const emailDisplay = document.getElementById('supabase-email-display');

    let isSignUpMode = false;

    // Note: account dropdown toggle is handled via inline onclick in index.html
    // so it works even if supabase.js has a delayed or failed load.

    // Modal Visibility
    const openModal = () => {
        authModal.style.display = 'flex';
        // Small delay for transition
        setTimeout(() => {
            authModal.style.opacity = '1';
            authModal.querySelector('.modal-content').style.transform = 'translateY(0)';
        }, 10);
        accountDropdown.style.display = 'none';
    };

    const closeModal = () => {
        authModal.style.opacity = '0';
        authModal.querySelector('.modal-content').style.transform = 'translateY(20px)';
        setTimeout(() => {
            authModal.style.display = 'none';
            authError.style.display = 'none';
            authEmail.value = '';
            authPassword.value = '';
        }, 300);
    };

    if (navSigninBtn) navSigninBtn.addEventListener('click', openModal);
    if (closeAuthModal) closeAuthModal.addEventListener('click', closeModal);

    // Switch between Sign In and Sign Up
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isSignUpMode = !isSignUpMode;
            authModalTitle.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
            authSwitchText.textContent = isSignUpMode ? 'Already have an account?' : 'Don\'t have an account?';
            authSwitchBtn.textContent = isSignUpMode ? 'Sign In' : 'Sign Up';
            authError.style.display = 'none';
        });
    }

    // Handle Submit
    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const email = authEmail.value.trim();
            const password = authPassword.value;

            if (!email || !password) {
                authError.textContent = 'Please enter both email and password.';
                authError.style.display = 'block';
                return;
            }

            authSubmitBtn.textContent = 'Loading...';
            authSubmitBtn.disabled = true;
            authError.style.display = 'none';

            let result;
            if (isSignUpMode) {
                result = await SupabaseAuth.signUp(email, password);
                if (!result.error) {
                    authError.style.color = '#46d369';
                    authError.style.background = 'rgba(70,211,105,0.1)';
                    authError.textContent = 'Success! Please check your email to confirm your account (if enabled), or Sign In.';
                    authError.style.display = 'block';
                    isSignUpMode = false;
                    authModalTitle.textContent = 'Sign In';
                    authSubmitBtn.textContent = 'Sign In';
                    authSwitchText.textContent = 'Don\'t have an account?';
                    authSwitchBtn.textContent = 'Sign Up';
                    authPassword.value = '';
                    authSubmitBtn.disabled = false;
                    return;
                }
            } else {
                result = await SupabaseAuth.signIn(email, password);
                if (!result.error) {
                    closeModal();
                    updateUIState();

                    // Sync cloud and local data
                    await SupabaseSync.pullAllFromCloud();
                    await SupabaseSync.syncAllToCloud();

                    // Auto-restore Trakt tokens from Supabase before reload
                    await TraktConnectionSync.loadTraktTokens();

                    // Refresh the page so UI renders the merged data
                    window.location.reload();
                }
            }

            if (result.error) {
                authError.style.color = '#ff4444';
                authError.style.background = 'rgba(255,68,68,0.1)';
                authError.textContent = result.error.message;
                authError.style.display = 'block';
            }

            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
            authSubmitBtn.disabled = false;
        });
    }

    // Handle Sign Out
    if (navSignoutBtn) {
        navSignoutBtn.addEventListener('click', async () => {
            await SupabaseAuth.signOut();
        });
    }

    // Update UI based on session
    async function updateUIState() {
        const user = await SupabaseAuth.getUser();
        if (user) {
            statusDot.style.background = '#46d369';
            statusDot.style.boxShadow = '0 0 8px rgba(70, 211, 105, 0.6)';
            statusText.textContent = 'Connected';
            emailDisplay.textContent = user.email;
            emailDisplay.style.display = 'block';

            navSigninBtn.style.display = 'none';
            navSignoutBtn.style.display = 'flex';
        } else {
            statusDot.style.background = '#ff4444';
            statusDot.style.boxShadow = '0 0 8px rgba(255, 68, 68, 0.6)';
            statusText.textContent = 'Not Signed In';
            emailDisplay.style.display = 'none';

            navSigninBtn.style.display = 'flex';
            navSignoutBtn.style.display = 'none';
        }
    }

    // Initial Check
    await updateUIState();

    // Auto-restore Trakt tokens from Supabase on page load
    // If user is signed into Supabase but Trakt is not connected, try to pull tokens
    const currentUser = await SupabaseAuth.getUser();
    if (currentUser && !localStorage.getItem('trakt_access_token')) {
        const restored = await TraktConnectionSync.loadTraktTokens();
        if (restored) {
            // Reload so Trakt UI initializes with the restored tokens
            window.location.reload();
            return;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseUI);
} else {
    initSupabaseUI();
}

window.SupabaseAuth = SupabaseAuth;
window.supabaseClient = supabaseClient;
window.TraktConnectionSync = TraktConnectionSync;
