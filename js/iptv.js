window.isInPages = window.location.pathname.includes('/pages/');
window.getRootPath = () => window.isInPages ? '../' : './';
window.getPagePath = (page) => window.isInPages ? page : `pages/${page}`;

// IPTV Logic for Prisma

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('iptv.html')) return;

    const API_BASE = 'https://iptv-org.github.io/api';

    let db = {
        countries: [], categories: [], channels: [], streams: [],
        channelMap: new Map(), streamMap: new Map()
    };

    let state = {
        view: 'loading',
        selectedCountry: null,
        selectedCategory: null,
        subFilterQuery: '',
        globalSearchQuery: '',
        displayedChannels: [],
        page: 1,
        pageSize: 50,
        cameFromCountriesView: false,
        sportsSortBy: 'default',
        sportsFilterType: 'all'
    };

    function getMockViews(channelId) {
        let hash = 0;
        if (!channelId) return 1000;
        for (let i = 0; i < channelId.length; i++) {
            hash = ((hash << 5) - hash) + channelId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 50000 + 1000;
    }

    function getMockPopularity(channel) {
        const name = (channel.name || '').toLowerCase();
        let pop = getMockViews(channel.id);
        if (/espn|sky sports|bein|fox sports|supersport|eurosport|arena sport|sport tv/i.test(name)) {
            pop += 50000;
        }
        return pop;
    }

    function getSportsType(channelName) {
        const name = (channelName || '').toLowerCase();
        if (/football|soccer|laliga|premier|fifa|mutv|lfctv|real madrid/i.test(name)) return 'football';
        if (/nba|basketball|hoops/i.test(name)) return 'basketball';
        if (/cricket|willow|star sports/i.test(name)) return 'cricket';
        if (/f1|racing|motorsport|nascar|speed/i.test(name)) return 'racing';
        if (/tennis|atp/i.test(name)) return 'tennis';
        if (/golf|pga/i.test(name)) return 'golf';
        if (/wwe|ufc|boxing|fight|mma|tna/i.test(name)) return 'fighting';
        return 'general';
    }

    const DOM = {
        loading: document.getElementById('iptv-loading'),
        header: document.getElementById('iptv-header'),
        title: document.getElementById('iptv-page-title'),
        backBtn: document.getElementById('iptv-back-btn'),
        homeView: document.getElementById('iptv-home-view'),
        countriesView: document.getElementById('iptv-countries-view'),
        channelsView: document.getElementById('iptv-channels-view'),
        filterBar: document.getElementById('iptv-filter-bar'),
        subfilterContainer: document.getElementById('iptv-subfilter-container'),
        subfilterInput: document.getElementById('iptv-subfilter-input'),
        channelsGrid: document.getElementById('iptv-channels-grid'),
        loadMoreContainer: document.getElementById('iptv-load-more-container'),
        loadMoreBtn: document.getElementById('iptv-load-more-btn'),
        playerModal: document.getElementById('iptv-player-modal'),
        closePlayerBtn: document.getElementById('close-iptv-player'),
        playerTitle: document.getElementById('iptv-player-title'),
        playerCategory: document.getElementById('iptv-player-category'),
        vlcBtn: document.getElementById('iptv-vlc-btn'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn')
    };

    let player = null;

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }

    async function init() {
        try {
            const [countries, categories, channels, streams, logos] = await Promise.all([
                fetchJson(`${API_BASE}/countries.json`),
                fetchJson(`${API_BASE}/categories.json`),
                fetchJson(`${API_BASE}/channels.json`),
                fetchJson(`${API_BASE}/streams.json`),
                fetchJson(`${API_BASE}/logos.json`)
            ]);

            db.countries = countries;
            db.categories = categories;
            db.streams = streams;

            const logoMap = new Map();
            logos.forEach(l => {
                if (!logoMap.has(l.channel)) {
                    logoMap.set(l.channel, l.url);
                }
            });

            channels.forEach(c => {
                c.logo = logoMap.get(c.id) || null;
            });
            db.channels = channels;

            db.channels.forEach(c => db.channelMap.set(c.id, c));
            db.streams.forEach(s => {
                if (!db.streamMap.has(s.channel)) db.streamMap.set(s.channel, []);
                db.streamMap.get(s.channel).push(s);
            });

            let expandedChannels = [];
            db.channels.forEach(c => {
                const streams = db.streamMap.get(c.id) || [];
                if (streams.length === 0) return;

                const uniqueTitles = new Set();
                streams.forEach(s => {
                    let title = s.title && s.title !== c.name ? s.title : c.name;
                    if (!uniqueTitles.has(title)) {
                        uniqueTitles.add(title);
                        expandedChannels.push({
                            ...c, id: `${c.id}_${uniqueTitles.size}`, name: title, _streamUrl: s.url
                        });
                    }
                });
            });
            
            db.channelsSearchMap = new Map();
            expandedChannels.forEach(c => {
                const cName = c.name.toLowerCase();
                const cAlphaNum = cName.replace(/[^a-z0-9]/g, '');
                
                // Precalculate fields for fast filtering and matching
                c._searchName = cName;
                c._searchAlphaNum = cAlphaNum;
                
                // Populate the O(1) exact-match hash map
                if (!db.channelsSearchMap.has(cAlphaNum)) {
                    db.channelsSearchMap.set(cAlphaNum, c);
                }
            });
            db.channels = expandedChannels;

            setupEvents();
            showHomeView();
        } catch (error) {
            console.error('Failed to load IPTV data:', error);
            DOM.loading.innerHTML = `<p style="color: #ff4444;">Failed to load IPTV data. Please check your connection.</p>`;
        }
    }

    function setupEvents() {
        DOM.backBtn.addEventListener('click', () => {
            if (state.selectedCategory || !state.cameFromCountriesView) {
                showHomeView();
            } else {
                showCountriesView();
            }
        });

        DOM.loadMoreBtn.addEventListener('click', () => {
            state.page++;
            renderChannelsPage();
        });

        DOM.subfilterInput.addEventListener('input', (e) => {
            state.subFilterQuery = e.target.value.toLowerCase();
            state.page = 1;
            filterAndRenderChannels();
        });

        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('input', (e) => {
                state.globalSearchQuery = e.target.value.toLowerCase();
                if (state.globalSearchQuery.length > 0) {
                    if (state.view !== 'channels') {
                        state.selectedCountry = null;
                        state.selectedCategory = null;
                        state.view = 'channels';
                        updateHeader('Search Results', false);
                        DOM.homeView.style.display = 'none';
                        DOM.countriesView.style.display = 'none';
                        DOM.channelsView.style.display = 'block';
                    }
                    DOM.backBtn.style.display = 'flex';
                }
                state.page = 1;
                filterAndRenderChannels();
            });
            if (DOM.clearSearchBtn) {
                DOM.clearSearchBtn.addEventListener('click', () => {
                    DOM.searchInput.value = '';
                    state.globalSearchQuery = '';
                    if (!state.selectedCountry && !state.selectedCategory) {
                        showHomeView();
                    } else {
                        state.page = 1;
                        filterAndRenderChannels();
                    }
                });
            }
        }
        DOM.closePlayerBtn.addEventListener('click', closePlayer);
    }

    function updateHeader(titleText, showBack = true) {
        DOM.header.style.display = 'flex';
        DOM.title.textContent = titleText;
        DOM.backBtn.style.display = showBack ? 'flex' : 'none';
    }

    const PREMIUM_SPORTS = [
        'bein sports', 'sky sports', 'espn', 'fox sports', 'eurosport',
        'supersport', 'bt sport', 'tnt sports', 'dazn', 'tudn', 'viaplay', 'fifa'
    ];

    function fuzzyMatchChannel(broadcasterName) {
        if (!broadcasterName) return null;
        const bName = broadcasterName.toLowerCase().trim();
        const bAlphaNum = bName.replace(/[^a-z0-9]/g, '');

        // 1. O(1) Instant Lookup using pre-calculated Map
        if (db.channelsSearchMap && db.channelsSearchMap.has(bAlphaNum)) {
            return db.channelsSearchMap.get(bAlphaNum);
        }

        // 2. Partial match using pre-calculated properties
        let match = db.channels.find(c => {
            if (c._searchName.includes(bName) || (bAlphaNum.includes(c._searchAlphaNum) && c._searchAlphaNum.length > 4)) return true;
            return false;
        });
        if (match) return match;

        // 3. Word matching using pre-calculated properties
        const bWords = bName.split(/[^a-z0-9]+/).filter(w => w.length > 1 && !['hd', 'fhd', 'tv', 'us', 'uk'].includes(w));
        if (bWords.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            db.channels.forEach(c => {
                let score = 0;
                bWords.forEach(w => { if (c._searchName.includes(w)) score++; });
                if (score > bestScore && c._searchName.includes(bWords[0])) {
                    bestScore = score; bestMatch = c;
                }
            });
            if (bestScore > 0) return bestMatch;
        }
        return null;
    }

    function addScrollButtons(rowElement, scrollContainer) {
        rowElement.style.position = 'relative';

        const leftBtn = document.createElement('button');
        leftBtn.innerHTML = '&#10094;';
        leftBtn.style.cssText = 'position: absolute; left: 0; top: 50px; bottom: 15px; width: 50px; background: linear-gradient(90deg, rgba(10,10,10,1) 0%, transparent 100%); border: none; color: white; font-size: 2.5rem; cursor: pointer; z-index: 10; opacity: 0; transition: opacity 0.2s; text-shadow: 0 2px 10px rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: flex-start; padding-left: 10px;';

        const rightBtn = document.createElement('button');
        rightBtn.innerHTML = '&#10095;';
        rightBtn.style.cssText = 'position: absolute; right: 0; top: 50px; bottom: 15px; width: 50px; background: linear-gradient(-90deg, rgba(10,10,10,1) 0%, transparent 100%); border: none; color: white; font-size: 2.5rem; cursor: pointer; z-index: 10; opacity: 0; transition: opacity 0.2s; text-shadow: 0 2px 10px rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: flex-end; padding-right: 10px;';

        leftBtn.onclick = () => scrollContainer.scrollBy({ left: -window.innerWidth * 0.6, behavior: 'smooth' });
        rightBtn.onclick = () => scrollContainer.scrollBy({ left: window.innerWidth * 0.6, behavior: 'smooth' });

        rowElement.appendChild(leftBtn);
        rowElement.appendChild(rightBtn);

        rowElement.onmouseover = () => { leftBtn.style.opacity = '1'; rightBtn.style.opacity = '1'; };
        rowElement.onmouseout = () => { leftBtn.style.opacity = '0'; rightBtn.style.opacity = '0'; };
    }

    function playIframeStream(url) {
        const iframe = document.getElementById('player-iframe');
        const modal = document.getElementById('player-modal');
        if (iframe && modal) {
            iframe.removeAttribute('sandbox');
            iframe.src = url;
            modal.classList.add('active');

            // Bulletproof close button: replace node to kill any old/crashing main.js listeners
            const closeBtn = document.getElementById('close-modal');
            if (closeBtn) {
                const newCloseBtn = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                newCloseBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                    iframe.src = '';
                    iframe.removeAttribute('sandbox');
                });
            }
        } else {
            window.open(url, '_blank');
        }
    }



    async function fetchAndRenderLiveMatches(container) {
        const skeletonWrapper = document.createElement('div');
        skeletonWrapper.style.cssText = 'margin-bottom: 40px; padding: 0;';

        const styleId = 'glass-skeleton-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes glass-skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .glass-skeleton {
                    background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
                    background-size: 200% 100%;
                    animation: glass-skeleton-loading 1.5s infinite ease-in-out;
                    border-radius: 12px;
                }
            `;
            document.head.appendChild(style);
        }

        const skeletonHeader = document.createElement('div');
        skeletonHeader.className = 'glass-skeleton';
        skeletonHeader.style.cssText = 'width: 250px; height: 35px; border-radius: 8px; margin-bottom: 20px;';

        const skeletonRow = document.createElement('div');
        skeletonRow.style.cssText = 'display: flex; gap: 15px; overflow: hidden;';

        for (let i = 0; i < 5; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'glass-skeleton';
            skeletonCard.style.cssText = 'width: 280px; min-width: 280px; height: 210px; border-radius: 12px;';
            skeletonRow.appendChild(skeletonCard);
        }

        skeletonWrapper.appendChild(skeletonHeader);
        skeletonWrapper.appendChild(skeletonRow);
        container.appendChild(skeletonWrapper);

        try {
            const response = await fetch('https://api.cdnlivetv.tv/api/v1/events/sports/?user=cdnlivetv&plan=free');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const sportsData = data['cdn-live-tv'];

            skeletonWrapper.remove();

            if (!sportsData || sportsData.total_events === 0) return;

            const categories = Object.keys(sportsData).filter(k => k !== 'total_events' && Array.isArray(sportsData[k]));
            let allEvents = [];
            categories.forEach(cat => {
                sportsData[cat].forEach(ev => { ev.categoryName = cat; allEvents.push(ev); });
            });

            allEvents.sort((a, b) => {
                if (a.status === 'live' && b.status !== 'live') return -1;
                if (a.status !== 'live' && b.status === 'live') return 1;
                return 0;
            });

            let optionsHtml = '<option value="all">All Sports</option>';
            categories.forEach(cat => {
                optionsHtml += `<option value="${cat}">${cat.toUpperCase()}</option>`;
            });

            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding: 0;';
            headerDiv.innerHTML = `
                <style>#iptv-live-category-select option { background: #222; color: #fff; }</style>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <h2 style="margin: 0; font-size: 1.5rem; font-family: var(--heading-font);">Live Matches</h2>
                    <select id="iptv-live-category-select" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; outline: none; cursor: pointer;">
                        ${optionsHtml}
                    </select>
                </div>
                <span class="view-all-live" style="color: var(--primary-color); font-size: 0.9rem; font-weight: 600; cursor: pointer;">View All ></span>
            `;
            container.appendChild(headerDiv);

            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'row-scroll';
            scrollContainer.style.cssText = 'display: flex; gap: 15px; overflow-x: auto; padding: 40px 10px; margin: -20px -10px 20px -10px; scrollbar-width: none; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; touch-action: pan-x pan-y;';
            container.appendChild(scrollContainer);

            addScrollButtons(container, scrollContainer);

            function createLiveMatchCard(match) {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;
                    display: flex; flex-direction: column; position: relative; padding: 15px; justify-content: space-between; gap: 15px;
                `;

                const isDefaultHomeIMG = !match.homeTeamIMG || match.homeTeamIMG.includes('logo.png');
                const isDefaultAwayIMG = !match.awayTeamIMG || match.awayTeamIMG.includes('logo.png');

                const finalHomeIMG = isDefaultHomeIMG ? `https://tse2.mm.bing.net/th?q=${encodeURIComponent(match.homeTeam + ' logo')}&w=100&h=100&c=7` : match.homeTeamIMG;
                const finalAwayIMG = isDefaultAwayIMG ? `https://tse2.mm.bing.net/th?q=${encodeURIComponent(match.awayTeam + ' logo')}&w=100&h=100&c=7` : match.awayTeamIMG;

                let statusBadge = match.status === 'live'
                    ? `<div style="background: rgba(229, 9, 20, 0.9); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; gap: 4px; align-self: flex-start;"><span style="width: 6px; height: 6px; background: #fff; border-radius: 50%; display: inline-block;"></span>LIVE</div>`
                    : `<div style="background: rgba(255, 255, 255, 0.1); color: #aaa; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; align-self: flex-start;">${match.status.toUpperCase()}</div>`;

                const ch = (match.channels && match.channels.length > 0) ? match.channels[0] : null;
                const matchedChannel = ch ? fuzzyMatchChannel(ch.channel_name) : null;

                let watchBtnHtml = '';
                if (ch) {
                    const isAdFree = !!matchedChannel;
                    if (isAdFree) {
                        watchBtnHtml = `
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <button class="play-adfree-btn" style="width: 100%; background: rgba(0, 200, 83, 0.2); border: 1px solid rgba(0, 200, 83, 0.5); color: white; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: transform 0.2s;">
                                        ▶ Watch on ${ch.channel_name} <span style="font-size: 0.65rem; background: #00c853; padding: 2px 6px; border-radius: 4px; margin-left: auto;">AD-FREE</span>
                                    </button>
                                    <button class="play-original-btn" style="width: 100%; background: rgba(229, 9, 20, 0.2); border: 1px solid rgba(229, 9, 20, 0.5); color: white; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: transform 0.2s; font-size: 0.85rem;">
                                        ▶ Original Stream <span style="font-size: 0.65rem; background: #e50914; padding: 2px 6px; border-radius: 4px; margin-left: auto;">ADS</span>
                                    </button>
                                </div>
                            `;
                    } else {
                        watchBtnHtml = `
                                <button class="play-original-btn" style="width: 100%; background: rgba(229, 9, 20, 0.2); border: 1px solid rgba(229, 9, 20, 0.5); color: white; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: transform 0.2s;">
                                    ▶ Watch on ${ch.channel_name} <span style="font-size: 0.65rem; background: #e50914; padding: 2px 6px; border-radius: 4px; margin-left: auto;">ADS</span>
                                </button>
                            `;
                    }
                } else {
                    watchBtnHtml = `<div style="text-align: center; color: #888; font-size: 0.8rem; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">No channels available</div>`;
                }

                card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            ${statusBadge}
                            <div style="font-size: 0.7rem; color: #aaa; font-weight: 600; text-transform: uppercase;">
                                <img src="${match.countryIMG || 'https://flagcdn.com/w40/us.png'}" style="width: 16px; height: 12px; border-radius: 2px; vertical-align: middle;"> ${match.tournament || match.categoryName}
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 8px;">
                                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; padding: 10px; display: flex; justify-content: center; align-items: center;">
                                    <span style="font-size: 1.5rem; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; display: none;">${match.homeTeam ? match.homeTeam.substring(0, 2) : '?'}</span>
                                    <img src="${finalHomeIMG}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 5px;" onerror="this.style.display='none'; this.previousElementSibling.style.display='block';">
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; text-align: center; color: #fff;">${match.homeTeam}</span>
                            </div>
                            <div style="font-weight: 800; font-size: 1.1rem; padding: 0 10px;">VS</div>
                            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 8px;">
                                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; padding: 10px; display: flex; justify-content: center; align-items: center;">
                                    <span style="font-size: 1.5rem; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; display: none;">${match.awayTeam ? match.awayTeam.substring(0, 2) : '?'}</span>
                                    <img src="${finalAwayIMG}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 5px;" onerror="this.style.display='none'; this.previousElementSibling.style.display='block';">
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; text-align: center; color: #fff;">${match.awayTeam}</span>
                            </div>
                        </div>
                        ${watchBtnHtml}
                    `;

                if (ch) {
                    const adFreeBtn = card.querySelector('.play-adfree-btn');
                    const originalBtn = card.querySelector('.play-original-btn');

                    if (adFreeBtn) {
                        adFreeBtn.onmouseover = () => adFreeBtn.style.transform = 'scale(1.02)';
                        adFreeBtn.onmouseout = () => adFreeBtn.style.transform = 'scale(1)';
                        adFreeBtn.onclick = () => {
                            openPlayer(matchedChannel, matchedChannel._streamUrl);
                        };
                    }

                    if (originalBtn) {
                        originalBtn.onmouseover = () => originalBtn.style.transform = 'scale(1.02)';
                        originalBtn.onmouseout = () => originalBtn.style.transform = 'scale(1)';
                        originalBtn.onclick = () => {
                            playIframeStream(ch.url);
                        };
                    }
                }
                return card;
            }

            function renderEvents(filterCat) {
                scrollContainer.innerHTML = '';
                const filtered = filterCat === 'all' ? allEvents : allEvents.filter(e => e.categoryName === filterCat);
                if (filtered.length === 0) {
                    scrollContainer.innerHTML = '<div style="color: #aaa; padding: 20px;">No matches found for this category.</div>';
                    return;
                }
                
                let i = 0;
                const batchSize = 10; // Process 10 cards per frame
                function renderBatch() {
                    const fragment = document.createDocumentFragment();
                    const end = Math.min(i + batchSize, filtered.length);
                    for (; i < end; i++) {
                        const match = filtered[i];
                        const card = createLiveMatchCard(match);
                        card.style.width = '280px';
                        card.style.minWidth = '280px';
                        card.style.maxWidth = '280px';
                        card.style.flexShrink = '0';
                        card.style.scrollSnapAlign = 'start';
                        fragment.appendChild(card);
                    }
                    scrollContainer.appendChild(fragment);
                    
                    if (i < filtered.length) {
                        requestAnimationFrame(renderBatch); // Yield to main thread
                    }
                }
                requestAnimationFrame(renderBatch);
            }

            const viewAllBtn = headerDiv.querySelector('.view-all-live');
            if (viewAllBtn) {
                function renderLiveMatchesGrid(filterCat) {
                    DOM.channelsGrid.innerHTML = '';
                    const filtered = filterCat === 'all' ? allEvents : allEvents.filter(e => e.categoryName === filterCat);

                    if (filtered.length === 0) {
                        DOM.channelsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 40px;">No matches found.</div>';
                        return;
                    }

                    let i = 0;
                    const batchSize = 10;
                    function renderBatch() {
                        const fragment = document.createDocumentFragment();
                        const end = Math.min(i + batchSize, filtered.length);
                        for (; i < end; i++) {
                            const match = filtered[i];
                            const card = createLiveMatchCard(match);
                            card.style.width = '100%';
                            card.style.maxWidth = 'none';
                            fragment.appendChild(card);
                        }
                        DOM.channelsGrid.appendChild(fragment);
                        
                        if (i < filtered.length) {
                            requestAnimationFrame(renderBatch);
                        }
                    }
                    requestAnimationFrame(renderBatch);
                }

                viewAllBtn.onclick = () => {
                    state.selectedCategory = null;
                    state.cameFromCountriesView = false;
                    DOM.homeView.style.display = 'none';
                    DOM.countriesView.style.display = 'none';
                    DOM.channelsView.style.display = 'block';
                    updateHeader('Live Matches', true);
                    DOM.filterBar.innerHTML = '';
                    DOM.subfilterContainer.style.display = 'none';
                    DOM.loadMoreContainer.style.display = 'none';

                    DOM.channelsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';

                    const selectMenu = document.createElement('select');
                    selectMenu.style.cssText = 'background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 15px; border-radius: 8px; outline: none; cursor: pointer; font-family: var(--body-font); font-size: 0.9rem;';

                    let optionsHtml = '<option value="all" style="background: #222; color: #fff;">All Sports</option>';
                    categories.forEach(cat => {
                        optionsHtml += `<option value="${cat}" style="background: #222; color: #fff;">${cat.toUpperCase()}</option>`;
                    });
                    selectMenu.innerHTML = optionsHtml;

                    selectMenu.addEventListener('change', (e) => {
                        renderLiveMatchesGrid(e.target.value);
                    });

                    DOM.filterBar.appendChild(selectMenu);

                    renderLiveMatchesGrid('all');
                };
            }

            renderEvents('all');

            headerDiv.querySelector('#iptv-live-category-select').addEventListener('change', (e) => {
                renderEvents(e.target.value);
            });

        } catch (e) {
            skeletonWrapper.remove();
            console.error('Failed to load Live Matches:', e);
        }
    }

    function showHomeView() {
        state.view = 'home';
        state.selectedCountry = null;
        state.selectedCategory = null;
        state.subFilterQuery = '';
        state.globalSearchQuery = '';
        if (DOM.searchInput) DOM.searchInput.value = '';

        DOM.loading.style.display = 'none';
        DOM.channelsView.style.display = 'none';
        DOM.countriesView.style.display = 'none';
        DOM.homeView.style.display = 'block';
        updateHeader('IPTV Home', false);

        DOM.homeView.innerHTML = '';

        const liveMatchesContainer = document.createElement('div');
        DOM.homeView.appendChild(liveMatchesContainer);
        fetchAndRenderLiveMatches(liveMatchesContainer);

        // Sports Row
        const sportsChannels = db.channels.filter(c => c.categories.includes('sports') && PREMIUM_SPORTS.some(ps => c.name.toLowerCase().includes(ps))).slice(0, 20);
        if (sportsChannels.length > 0) {
            DOM.homeView.appendChild(createCarouselRow('Sports', sportsChannels, () => {
                state.selectedCategory = 'sports';
                state.cameFromCountriesView = false;
                DOM.homeView.style.display = 'none';
                DOM.channelsView.style.display = 'block';
                updateHeader('Live Sports', true);
                DOM.filterBar.innerHTML = '';

                DOM.filterBar.innerHTML = `
                    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center; width: 100%;">
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <label style="font-size: 0.8rem; color: #aaa; font-weight: 600;">Sort By</label>
                            <select id="sports-sort-select">
                                <option value="default">Default</option>
                                <option value="viewed">Most Viewed</option>
                                <option value="popular">Most Popular</option>
                                <option value="type">By Sports Type</option>
                            </select>
                        </div>
                        <div id="sports-type-container" style="display: none; flex-direction: column; gap: 5px;">
                            <label style="font-size: 0.8rem; color: #aaa; font-weight: 600;">Sports Type</label>
                            <select id="sports-type-select">
                                <option value="all">All Sports</option>
                                <option value="football">Football / Soccer</option>
                                <option value="basketball">Basketball</option>
                                <option value="cricket">Cricket</option>
                                <option value="racing">Racing / Motorsport</option>
                                <option value="tennis">Tennis</option>
                                <option value="golf">Golf</option>
                                <option value="fighting">Fighting / WWE</option>
                                <option value="general">General / Other</option>
                            </select>
                        </div>
                    </div>
                `;

                const sortSelect = document.getElementById('sports-sort-select');
                const typeSelect = document.getElementById('sports-type-select');
                const typeContainer = document.getElementById('sports-type-container');

                sortSelect.value = state.sportsSortBy;
                typeSelect.value = state.sportsFilterType;
                if (state.sportsSortBy === 'type') typeContainer.style.display = 'flex';

                sortSelect.addEventListener('change', (e) => {
                    state.sportsSortBy = e.target.value;
                    typeContainer.style.display = state.sportsSortBy === 'type' ? 'flex' : 'none';
                    state.page = 1;
                    filterAndRenderChannels();
                });

                typeSelect.addEventListener('change', (e) => {
                    state.sportsFilterType = e.target.value;
                    state.page = 1;
                    filterAndRenderChannels();
                });

                filterAndRenderChannels();
            }));
        }

        // Global News Row
        const newsChannels = db.channels.filter(c => c.categories.includes('news')).slice(0, 20);
        if (newsChannels.length > 0) {
            DOM.homeView.appendChild(createCarouselRow('Global News', newsChannels, () => {
                state.selectedCategory = 'news';
                state.cameFromCountriesView = false;
                DOM.homeView.style.display = 'none';
                DOM.channelsView.style.display = 'block';
                updateHeader('Global News', true);
                DOM.filterBar.innerHTML = ''; // Clear filter bar as we are browsing all countries for this category
                filterAndRenderChannels();
            }));
        }

        // Entertainment Row
        const entChannels = db.channels.filter(c => c.categories.includes('entertainment')).slice(0, 20);
        if (entChannels.length > 0) {
            DOM.homeView.appendChild(createCarouselRow('Entertainment', entChannels, () => {
                state.selectedCategory = 'entertainment';
                state.cameFromCountriesView = false;
                DOM.homeView.style.display = 'none';
                DOM.channelsView.style.display = 'block';
                updateHeader('Entertainment', true);
                DOM.filterBar.innerHTML = ''; // Clear filter bar as we are browsing all countries for this category
                filterAndRenderChannels();
            }));
        }

        // Browse By Country Row
        const sortedCountries = [...db.countries].sort((a, b) => a.name.localeCompare(b.name)).filter(country => {
            return db.channels.filter(c => c.country === country.code).length > 0;
        });

        if (sortedCountries.length > 0) {
            const countryRow = document.createElement('div');
            countryRow.style.marginBottom = '40px';
            countryRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding: 0;">
                    <h2 style="margin: 0; font-size: 1.5rem; font-family: var(--heading-font);">Browse by Country</h2>
                    <span class="view-all-btn" style="color: var(--primary-color); font-size: 0.9rem; font-weight: 600; cursor: pointer;">View All ></span>
                </div>
                <div class="row-scroll" style="display: flex; gap: 15px; overflow-x: auto; padding: 40px 10px; margin: -20px -10px 20px -10px; scrollbar-width: none; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; touch-action: pan-x pan-y;">
                </div>
            `;
            const scrollContainer = countryRow.querySelector('.row-scroll');
            addScrollButtons(countryRow, scrollContainer);
            const countriesToRender = sortedCountries.slice(0, 20);
            const fragment = document.createDocumentFragment();
            countriesToRender.forEach(country => {
                const card = document.createElement('div');
                card.className = 'country-card';
                card.style.cssText = `
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
                    padding: 15px; text-align: center; cursor: pointer; transition: transform 0.2s, background 0.2s;
                    min-width: 140px; flex-shrink: 0; scroll-snap-align: start;
                `;
                card.onmouseover = () => card.style.background = 'rgba(255,255,255,0.1)';
                card.onmouseout = () => card.style.background = 'rgba(255,255,255,0.05)';
                card.onclick = () => {
                    state.cameFromCountriesView = false;
                    DOM.homeView.style.display = 'none';
                    selectCountry(country);
                };

                const channelCount = db.channels.filter(c => c.country === country.code).length;
                card.innerHTML = `
                    <div style="height: 40px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
                        <img src="https://flagcdn.com/w80/${country.code.toLowerCase()}.png" alt="${country.name} flag" style="max-height: 100%; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 2rem;\\'>${country.flag}</span>';">
                    </div>
                    <h3 style="margin: 0 0 5px 0; font-size: 1rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${country.name}">${country.name}</h3>
                    <span style="font-size: 0.8rem; color: #aaa;">${channelCount} channels</span>
                `;
                fragment.appendChild(card);
            });
            scrollContainer.appendChild(fragment);
            countryRow.querySelector('.view-all-btn').onclick = () => {
                state.cameFromCountriesView = true;
                showCountriesView();
            };
            DOM.homeView.appendChild(countryRow);
        }
    }

    function createCarouselRow(title, channels, onViewAll) {
        const row = document.createElement('div');
        row.style.marginBottom = '40px';
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; padding: 0;">
                <h2 style="margin: 0; font-size: 1.5rem; font-family: var(--heading-font);">${title}</h2>
                <span class="view-all-btn" style="color: var(--primary-color); font-size: 0.9rem; font-weight: 600; cursor: pointer;">View All ></span>
            </div>
            <div class="row-scroll" style="display: flex; gap: 15px; overflow-x: auto; padding: 40px 10px; margin: -20px -10px 20px -10px; scrollbar-width: none; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; touch-action: pan-x pan-y;">
            </div>
        `;
        const scrollContainer = row.querySelector('.row-scroll');
        addScrollButtons(row, scrollContainer);
        row.querySelector('.view-all-btn').onclick = onViewAll;

        const fragment = document.createDocumentFragment();
        channels.forEach(channel => {
            const card = createChannelCard(channel);
            if (card) {
                card.style.width = '200px';
                card.style.minWidth = '200px';
                card.style.maxWidth = '200px';
                card.style.flexShrink = '0';
                card.style.scrollSnapAlign = 'start';
                fragment.appendChild(card);
            }
        });
        scrollContainer.appendChild(fragment);
        return row;
    }

    function createChannelCard(channel) {
        const streamUrl = channel._streamUrl;
        if (!streamUrl) return null;

        const card = document.createElement('div');
        card.className = 'channel-card';
        card.style.cssText = `
            background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;
            cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column;
            width: 100%; min-width: 0;
        `;
        card.onmouseover = () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
        };
        card.onmouseout = () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        };
        card.onclick = () => openPlayer(channel, streamUrl);

        card.innerHTML = `
            <div style="aspect-ratio: 16/9; width: 100%; background: #222; display: flex; align-items: center; justify-content: center; padding: 10px; overflow: hidden;">
                ${channel.logo ? `<img src="${channel.logo}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                <span style="font-size: 2rem; font-weight: 800; color: rgba(255,255,255,0.2); ${channel.logo ? 'display:none;' : ''}">${channel.name.substring(0, 2).toUpperCase()}</span>
            </div>
            <div style="padding: 12px;">
                <h3 style="margin: 0 0 5px 0; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${channel.name}">${channel.name}</h3>
                <span style="font-size: 0.75rem; color: #888; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${channel.categories && channel.categories[0] ? channel.categories[0] : 'Uncategorized'}</span>
            </div>
        `;
        return card;
    }

    function showCountriesView() {
        state.view = 'countries';
        state.selectedCountry = null;
        state.selectedCategory = null;
        state.subFilterQuery = '';
        state.globalSearchQuery = '';
        if (DOM.searchInput) DOM.searchInput.value = '';

        DOM.loading.style.display = 'none';
        DOM.channelsView.style.display = 'none';
        DOM.homeView.style.display = 'none';
        DOM.countriesView.style.display = 'grid';
        updateHeader('All Countries', true);

        DOM.countriesView.innerHTML = '';

        const sortedCountries = [...db.countries].sort((a, b) => a.name.localeCompare(b.name));

        const fragment = document.createDocumentFragment();
        sortedCountries.forEach(country => {
            const channelCount = db.channels.filter(c => c.country === country.code).length;
            if (channelCount === 0) return;

            const card = document.createElement('div');
            card.className = 'country-card';
            card.style.cssText = `
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
                padding: 15px; text-align: center; cursor: pointer; transition: transform 0.2s, background 0.2s;
            `;
            card.onmouseover = () => card.style.background = 'rgba(255,255,255,0.1)';
            card.onmouseout = () => card.style.background = 'rgba(255,255,255,0.05)';
            card.onclick = () => selectCountry(country);

            card.innerHTML = `
                <div style="height: 40px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
                    <img src="https://flagcdn.com/w80/${country.code.toLowerCase()}.png" alt="${country.name} flag" style="max-height: 100%; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 2rem;\\'>${country.flag}</span>';">
                </div>
                <h3 style="margin: 0 0 5px 0; font-size: 1rem; color: #fff;">${country.name}</h3>
                <span style="font-size: 0.8rem; color: #aaa;">${channelCount} channels</span>
            `;
            fragment.appendChild(card);
        });
        DOM.countriesView.appendChild(fragment);
    }

    function selectCountry(country) {
        state.selectedCountry = country;
        state.selectedCategory = null;
        state.subFilterQuery = '';
        DOM.subfilterInput.value = '';
        state.page = 1;

        DOM.homeView.style.display = 'none';
        DOM.countriesView.style.display = 'none';
        DOM.channelsView.style.display = 'block';
        updateHeader(country.name, true);

        renderFilterBar();
        filterAndRenderChannels();
    }

    function renderFilterBar() {
        DOM.filterBar.innerHTML = '';

        // Find all categories available for this country
        const countryChannels = db.channels.filter(c => c.country === state.selectedCountry.code);
        const availableCategoryIds = new Set();
        countryChannels.forEach(c => c.categories.forEach(cat => availableCategoryIds.add(cat)));

        const availableCategories = db.categories.filter(c => availableCategoryIds.has(c.id));
        availableCategories.sort((a, b) => a.name.localeCompare(b.name));

        // "All" button
        const allBtn = document.createElement('button');
        allBtn.textContent = 'All';
        allBtn.className = 'iptv-filter-btn active';
        allBtn.style.cssText = `
            background: var(--primary-color); color: white; border: none; padding: 8px 16px; border-radius: 20px;
            font-family: var(--body-font); font-weight: 600; cursor: pointer; white-space: nowrap;
        `;
        allBtn.onclick = () => selectCategory(null, allBtn);
        DOM.filterBar.appendChild(allBtn);

        availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.name;
            btn.className = 'iptv-filter-btn';
            btn.style.cssText = `
                background: rgba(255,255,255,0.1); color: white; border: none; padding: 8px 16px; border-radius: 20px;
                font-family: var(--body-font); font-weight: 600; cursor: pointer; white-space: nowrap;
                transition: background 0.2s;
            `;
            btn.onclick = () => selectCategory(cat.id, btn, cat.name);
            DOM.filterBar.appendChild(btn);
        });
    }

    function selectCategory(categoryId, btnElement, name = '') {
        document.querySelectorAll('.iptv-filter-btn').forEach(btn => {
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.classList.remove('active');
        });

        if (btnElement) {
            btnElement.style.background = 'var(--primary-color)';
            btnElement.classList.add('active');
        }

        state.selectedCategory = categoryId;
        state.subFilterQuery = '';
        DOM.subfilterInput.value = '';
        state.page = 1;

        if (state.selectedCountry) {
            if (categoryId) {
                DOM.subfilterContainer.style.display = 'block';
                DOM.subfilterInput.placeholder = `What kind of ${name.toLowerCase()}?`;
            } else {
                DOM.subfilterContainer.style.display = 'none';
            }
        }

        filterAndRenderChannels();
    }

    function filterAndRenderChannels() {
        let filtered = db.channels;

        if (state.globalSearchQuery) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(state.globalSearchQuery));
        } else {
            if (state.selectedCountry) {
                filtered = filtered.filter(c => c.country === state.selectedCountry.code);
            }
            if (state.selectedCategory) {
                filtered = filtered.filter(c => c.categories.includes(state.selectedCategory));
            }
            if (state.subFilterQuery) {
                filtered = filtered.filter(c => c.name.toLowerCase().includes(state.subFilterQuery));
            }

            if (state.selectedCategory === 'sports' && !state.selectedCountry) {
                if (state.sportsSortBy === 'type' && state.sportsFilterType !== 'all') {
                    filtered = filtered.filter(c => getSportsType(c.name) === state.sportsFilterType);
                }

                if (state.sportsSortBy === 'viewed') {
                    filtered.sort((a, b) => getMockViews(b.id) - getMockViews(a.id));
                } else if (state.sportsSortBy === 'popular') {
                    filtered.sort((a, b) => getMockPopularity(b) - getMockPopularity(a));
                } else if (state.sportsSortBy === 'type') {
                    filtered.sort((a, b) => a.name.localeCompare(b.name));
                }
            }
        }

        state.displayedChannels = filtered;
        DOM.channelsGrid.innerHTML = '';

        if (filtered.length === 0) {
            DOM.channelsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 40px;">No channels found.</div>`;
            DOM.loadMoreContainer.style.display = 'none';
            return;
        }

        renderChannelsPage();
    }

    function renderChannelsPage() {
        DOM.channelsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        const start = (state.page - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageChannels = state.displayedChannels.slice(start, end);

        const fragment = document.createDocumentFragment();
        pageChannels.forEach(channel => {
            const card = createChannelCard(channel);
            if (card) {
                card.style.minWidth = 'auto'; // Reset minWidth for grid view
                fragment.appendChild(card);
            }
        });
        DOM.channelsGrid.appendChild(fragment);

        if (end < state.displayedChannels.length) {
            DOM.loadMoreContainer.style.display = 'block';
        } else {
            DOM.loadMoreContainer.style.display = 'none';
        }
    }

    function openPlayer(channel, streamUrl) {
        DOM.playerModal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        DOM.playerTitle.textContent = channel.name;

        const cats = channel.categories ? channel.categories.map(c => {
            const catObj = db.categories.find(cat => cat.id === c);
            return catObj ? catObj.name : c;
        }).join(', ') : 'General';

        DOM.playerCategory.textContent = cats;
        // Deep link directly to VLC using URI scheme
        DOM.vlcBtn.href = `vlc://${streamUrl}`;
        DOM.vlcBtn.removeAttribute('download');

        const videoElement = DOM.playerModal.querySelector('#iptv-video');

        if (!player) {
            player = videojs(videoElement, {
                fluid: true,
                liveui: true
            });
        }

        player.src({
            src: streamUrl,
            type: 'application/x-mpegURL'
        });

        player.play().catch(e => console.log('Autoplay prevented:', e));
    }

    function closePlayer() {
        DOM.playerModal.style.display = 'none';
        document.body.style.overflow = '';
        if (player) {
            player.pause();
            player.reset();
        }
    }

    init();
});
