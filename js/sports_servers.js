// ==========================================
// Live Sports Servers Logic (StreamFree & WatchFooty)
// ==========================================

const API_ROUTES = {
  streamfree: 'https://streamfree.top/api/v1/streams',
  watchfooty: 'https://api.watchfooty.st/api/v1/matches/all'
};

const SPORT_EMOJIS = {
  'SOCCER': '⚽', 'FOOTBALL': '🏈', 'BASKETBALL': '🏀', 'BASEBALL': '⚾',
  'TENNIS': '🎾', 'CRICKET': '🏏', 'HOCKEY': '🏒', 'VOLLEYBALL': '🏐',
  'TABLE TENNIS': '🏓', 'BADMINTON': '🏸', 'RUGBY': '🏉', 'GOLF': '⛳',
  'MOTORSPORT': '🏎️', 'RACING': '🏎️', 'BOXING': '🥊', 'MMA': '🥋',
  'UFC': '🥋', 'COMBAT': '🥊', 'DARTS': '🎯', 'SNOOKER': '🎱',
  'CYCLING': '🚴', 'ESPORTS': '🎮'
};

// Global state
window.sportsServersData = {
  streamfree: { events: [], activeFilter: 'All', loaded: false },
  watchfooty: { events: [], activeFilter: 'All', loaded: false }
};

window.initSportsServers = async function (server) {
  if (window.sportsServersData[server].loaded) return;
  await loadSportsServerData(server);
};

async function loadSportsServerData(server) {
  const container = document.getElementById(`${server}-events-container`);
  const loading = document.getElementById(`${server}-loading`);
  const error = document.getElementById(`${server}-error`);
  const statusText = document.getElementById(`${server}-status`);

  container.innerHTML = '';
  error.classList.add('hidden');
  error.style.display = 'none';
  loading.style.display = 'block';
  statusText.textContent = 'Fetching live streams...';

  try {
    const data = await fetchSportsMatches(server);
    window.sportsServersData[server].events = data;
    window.sportsServersData[server].activeFilter = 'All';
    window.sportsServersData[server].loaded = true;

    if (data.length === 0) {
      showSportsError(server, 'No streams found', 'There are no active live streams for this server at the moment.');
    } else {
      loading.style.display = 'none';
      statusText.textContent = `Found ${data.length} active streams`;
      renderSportsFilters(server, data);
      renderSportsEvents(server, data);
    }
  } catch (err) {
    console.error(`Error loading ${server}:`, err);
    showSportsError(server, 'Connection Error', 'Could not fetch streams. CORS may be blocking the request or the server is down.');
  }
}

async function fetchSportsMatches(server) {
  const url = API_ROUTES[server];
  if (!url) return [];

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  const data = await response.json();
  return formatSportsData(server, data);
}

function formatSportsData(server, data) {
  const formatted = [];

  if (server === 'streamfree') {
    const streamsList = Array.isArray(data) ? data : (data.streams || []);
    streamsList.forEach(item => {
      formatted.push({
        server: server,
        id: item.stream_key || item.id || Math.random().toString(),
        title: item.name || 'Unknown Event',
        sport: item.category ? item.category.toUpperCase() : 'SPORTS',
        league: item.league || '',
        time: item.match_timestamp || 'LIVE',
        viewers: item.viewers !== undefined ? item.viewers : null,
        thumbnail: item.thumbnail_url || null,
        team1: item.team1 || null,
        team2: item.team2 || null,
        embedUrl: item.embed_url || `https://streamfree.top/embed/${item.category}/${item.stream_key || item.id}`
      });
    });
  } else if (server === 'watchfooty') {
    const matches = Array.isArray(data) ? data : [];
    matches.forEach(item => {
      if (item.streams && item.streams.length > 0) {
        const stream = item.streams[0];
        let sportName = item.sport ? item.sport.toUpperCase() : 'SPORTS';
        if (sportName === 'FOOTBALL') sportName = 'SOCCER';
        if (sportName === 'AMERICAN-FOOTBALL' || sportName === 'AMERICAN FOOTBALL') sportName = 'FOOTBALL';

        formatted.push({
          server: server,
          id: item.matchId || Math.random().toString(),
          title: item.title || 'Unknown Event',
          sport: sportName,
          league: item.league || '',
          time: item.timestamp ? Math.floor(item.timestamp / 1000) : 'LIVE',
          viewers: null,
          thumbnail: item.poster ? `https://api.watchfooty.st${item.poster}` : null,
          team1: item.teams && item.teams.home ? {
            name: item.teams.home.name,
            logo: item.teams.home.logoUrl ? `https://api.watchfooty.st${item.teams.home.logoUrl}` : null,
            score: item.scores && item.scores.home !== -1 ? item.scores.home : null
          } : null,
          team2: item.teams && item.teams.away ? {
            name: item.teams.away.name,
            logo: item.teams.away.logoUrl ? `https://api.watchfooty.st${item.teams.away.logoUrl}` : null,
            score: item.scores && item.scores.away !== -1 ? item.scores.away : null
          } : null,
          minute: item.currentMinute && item.currentMinute !== 'Scheduled' ? item.currentMinute : null,
          embedUrl: stream.url,
          alternateStreams: item.streams.map(s => ({
            name: `${s.source} (${s.quality} - ${s.language})`,
            url: s.url
          }))
        });
      }
    });
  }
  return formatted;
}

function showSportsError(server, title, message) {
  const loading = document.getElementById(`${server}-loading`);
  const error = document.getElementById(`${server}-error`);
  const statusText = document.getElementById(`${server}-status`);
  loading.style.display = 'none';
  error.classList.remove('hidden');
  error.style.display = 'block';
  document.getElementById(`${server}-error-title`).textContent = title;
  document.getElementById(`${server}-error-message`).textContent = message;
  statusText.textContent = 'Offline';
}

function formatSportsTime(timestamp) {
  if (!timestamp || isNaN(timestamp)) return 'LIVE';
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff <= 300) return 'LIVE NOW';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: window.sportsUse12HourFormat
  });
}

function renderSportsFilters(server, events) {
  const selectElement = document.getElementById(`${server}-filter-select`);
  if (!selectElement) return;

  const grouped = {};
  events.forEach(e => {
    const baseSport = e.sport.split(' • ')[0].trim().toUpperCase();
    if (baseSport && baseSport !== 'SPORTS') {
      if (!grouped[baseSport]) grouped[baseSport] = 0;
      grouped[baseSport]++;
    }
  });

  const sortedSports = Object.keys(grouped).sort();
  const activeFilter = window.sportsServersData[server].activeFilter;
  
  let allCount = events.length; // use total events for "All Sports" count
  
  let html = `<option value="All">All Sports (${allCount})</option>`;
  
  sortedSports.forEach(sport => {
    const selected = activeFilter === sport ? 'selected' : '';
    html += `<option value="${sport}" ${selected}>${sport} (${grouped[sport]})</option>`;
  });
  
  selectElement.innerHTML = html;

  // Add event listener only once
  if (!selectElement.dataset.listenerAttached) {
    selectElement.dataset.listenerAttached = 'true';
    selectElement.addEventListener('change', (e) => {
      const selectedServer = server;
      const selectedSport = e.target.value;
      window.sportsServersData[selectedServer].activeFilter = selectedSport;
      renderSportsEvents(selectedServer, window.sportsServersData[selectedServer].events);
    });
  }
}

function renderSportsEvents(server, events) {
  const container = document.getElementById(`${server}-events-container`);
  container.innerHTML = '';
  
  // Apply Search
  const searchInput = document.getElementById('search-input');
  let displayEvents = events;
  if (searchInput && searchInput.value) {
    const query = searchInput.value.toLowerCase();
    displayEvents = events.filter(e => e.title.toLowerCase().includes(query) || e.sport.toLowerCase().includes(query));
  }
  
  const grouped = {};
  displayEvents.forEach(event => {
    const baseSport = event.sport.split(' • ')[0].trim().toUpperCase();
    if (!grouped[baseSport]) grouped[baseSport] = [];
    grouped[baseSport].push(event);
  });

  const activeFilter = window.sportsServersData[server].activeFilter;
  const sportsToRender = activeFilter === 'All' ? Object.keys(grouped).sort() : [activeFilter];
  
  if (sportsToRender.length === 0 || (sportsToRender.length === 1 && !grouped[sportsToRender[0]])) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; padding-top: 40px;">No matches found for this selection.</p>`;
    return;
  }

  sportsToRender.forEach(sport => {
    if (!grouped[sport] || grouped[sport].length === 0) return;
    
    const section = document.createElement('div');
    section.className = 'sports-category-section';
    section.innerHTML = `
      <h2 class="sports-category-header">${sport} <span style="font-size: 0.9rem; color: #888; font-weight: 500; margin-left: 8px;">(${grouped[sport].length})</span></h2>
      <div class="sports-events-grid"></div>
    `;
    
    const grid = section.querySelector('.sports-events-grid');

    grouped[sport].forEach(event => {
      const card = document.createElement('div');
      
      let bgHtml = '';
      if (event.thumbnail) {
        bgHtml = `<div class="sports-event-card-bg" style="background-image: linear-gradient(to top, rgba(20,20,20,1) 0%, rgba(20,20,20,0.6) 50%, rgba(20,20,20,0.2) 100%), url('${event.thumbnail}');"></div>`;
      }

      let teamsHtml = '';
      if (event.team1 && event.team2 && event.team1.logo && event.team2.logo) {
        let scoreHtml = '<span class="sports-teams-vs">VS</span>';
        if (event.team1.score !== null && event.team1.score !== undefined && event.team2.score !== null && event.team2.score !== undefined) {
          scoreHtml = `
            <div class="sports-score-container">
               <span class="sports-score">${event.team1.score}</span>
               <span class="sports-teams-vs">-</span>
               <span class="sports-score">${event.team2.score}</span>
            </div>
          `;
        }
        teamsHtml = `
          <div class="sports-teams-container">
            <img src="${event.team1.logo}" alt="${event.team1.name}" class="sports-team-logo" onerror="this.style.display='none'" />
            ${scoreHtml}
            <img src="${event.team2.logo}" alt="${event.team2.name}" class="sports-team-logo" onerror="this.style.display='none'" />
          </div>
        `;
      }

      let fallbackHtml = '';
      if (!teamsHtml) {
        // We will replace emojis with premium SVGs later
        const sportIcon = getPremiumSportSVG(event.sport);
        let fallbackTitle = event.title || '';
        if (fallbackTitle.length > 30) fallbackTitle = fallbackTitle.substring(0, 30) + '...';
        
        fallbackHtml = `
          <div class="sports-fallback-container">
            <div class="sports-fallback-icon">${sportIcon}</div>
            <div class="sports-fallback-title">${fallbackTitle}</div>
          </div>
        `;
      }

      card.className = teamsHtml ? 'sports-event-card' : 'sports-event-card is-fallback';

      let viewersHtml = '';
      if (event.viewers !== null && event.viewers !== undefined) {
        viewersHtml = `<div class="sports-event-viewers"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> ${event.viewers.toLocaleString()}</div>`;
      }

      const sportTag = event.league ? `${event.sport} • ${event.league.toUpperCase()}` : event.sport;
      let timeStr = event.time;
      if (!isNaN(timeStr) && timeStr !== null && timeStr !== '') timeStr = formatSportsTime(Number(timeStr));
      
      const isLive = timeStr.includes('LIVE') || event.minute;
      const timeIcon = isLive 
        ? '<div class="sports-pulse-icon"></div>' 
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      const displayTime = event.minute ? event.minute : timeStr;

      let countdownHtml = '';
      if (!isLive && !isNaN(event.time) && event.time !== null && event.time !== '') {
        countdownHtml = `
          <div class="esportex-countdown" data-start="${Number(event.time) * 1000}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.2); z-index: 5;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>--:--:--</span>
          </div>
        `;
      }

      card.innerHTML = `
        ${bgHtml}
        <div class="sports-event-card-content">
          <div class="sports-event-header-row">
            <div class="sports-event-badge ${isLive ? 'is-live' : ''}">${timeIcon}${displayTime}</div>
            ${countdownHtml}
            ${viewersHtml}
          </div>
          ${teamsHtml}
          ${fallbackHtml}
          <div class="sports-event-meta">
            <div class="sports-event-sport">${sportTag}</div>
            <h3 class="sports-event-title">${event.title}</h3>
          </div>
          <div class="sports-event-footer">
            <button class="sports-play-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 
              Watch Stream
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openSportsPlayer(event));
      grid.appendChild(card);
    });

    container.appendChild(section);
  });
}

// Modal Player Logic
let sportsCurrentEvent = null;
let sportsStreamPollInterval = null;

function showStartingSoonOverlay() {
  let overlay = document.getElementById('sports-starting-soon-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sports-starting-soon-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = '#0a0a0b';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.textAlign = 'center';
    overlay.style.fontFamily = "'Hanken Grotesk', -apple-system, sans-serif";
    
    overlay.innerHTML = `
      <h2 style="color: #e50914; font-family: 'Archivo', sans-serif; font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 12px 0; text-shadow: 0 0 20px rgba(229, 9, 20, 0.4);">Starting Soon</h2>
      <p style="color: rgba(255, 255, 255, 0.55); font-size: clamp(0.85rem, 2vw, 1rem); max-width: 80%; line-height: 1.5; margin: 0 0 24px 0;">Streams go live a few minutes before start time. Sit tight &mdash; the broadcast will begin automatically.</p>
      <div style="width: 40px; height: 40px; border: 3px solid rgba(229, 9, 20, 0.2); border-top-color: #e50914; border-radius: 50%; animation: sports-spin 1s linear infinite; margin-bottom: 24px;"></div>
      <button id="sports-dismiss-overlay" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: 'Hanken Grotesk', sans-serif; font-size: 0.85rem; transition: all 0.2s;">Stream already started? Click to view</button>
      <style>
        @keyframes sports-spin { to { transform: rotate(360deg); } }
        #sports-dismiss-overlay:hover { background: rgba(255,255,255,0.1); color: #fff; }
      </style>
    `;
    const container = document.getElementById('sports-video-container');
    if (container) container.appendChild(overlay);

    // Attach event listener for the dismiss button
    const dismissBtn = overlay.querySelector('#sports-dismiss-overlay');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            clearSportsStreamPolling();
            hideStartingSoonOverlay();
            const iframe = container.querySelector('iframe');
            if (iframe) iframe.src = iframe.src; // Reload iframe to get the live stream
        });
    }
  }
  overlay.style.display = 'flex';
  
  // Hide the iframe so it doesn't overlap or show its own spinner
  const container = document.getElementById('sports-video-container');
  if (container) {
      const iframe = container.querySelector('iframe');
      if (iframe) iframe.style.opacity = '0';
  }
}

function hideStartingSoonOverlay() {
  const overlay = document.getElementById('sports-starting-soon-overlay');
  if (overlay) overlay.style.display = 'none';
  
  // Restore iframe visibility
  const container = document.getElementById('sports-video-container');
  if (container) {
      const iframe = container.querySelector('iframe');
      if (iframe) iframe.style.opacity = '1';
  }
}

function clearSportsStreamPolling() {
  if (sportsStreamPollInterval) {
    clearInterval(sportsStreamPollInterval);
    sportsStreamPollInterval = null;
  }
}

async function checkAndPollStreamFree(event) {
    const handleCorsFallback = () => {
        const now = Math.floor(Date.now() / 1000);
        if (event.time === 'LIVE' || isNaN(event.time) || now >= Number(event.time)) {
            clearSportsStreamPolling();
            hideStartingSoonOverlay();
            return true;
        }
        return false;
    };

    const startPolling = () => {
        if (!sportsStreamPollInterval) {
            sportsStreamPollInterval = setInterval(async () => {
                try {
                    const pollRes = await fetch(`https://streamfree.top/api/stream-status/${event.id}`);
                    if (pollRes.ok) {
                        clearSportsStreamPolling();
                        hideStartingSoonOverlay();
                        const container = document.getElementById('sports-video-container');
                        if (container) {
                            const iframe = container.querySelector('iframe');
                            if (iframe) iframe.src = iframe.src;
                        }
                    }
                } catch(e) {
                    // Fallback for CORS: if we can't read the 200 OK because of CORS,
                    // we check if the match time has passed to auto-dismiss the overlay.
                    const now = Math.floor(Date.now() / 1000);
                    if (event.time === 'LIVE' || isNaN(event.time) || now >= Number(event.time)) {
                        clearSportsStreamPolling();
                        hideStartingSoonOverlay();
                        const container = document.getElementById('sports-video-container');
                        if (container) {
                            const iframe = container.querySelector('iframe');
                            if (iframe) iframe.src = iframe.src;
                        }
                    }
                }
            }, 15000);
        }
    };

    try {
        const res = await fetch(`https://streamfree.top/api/stream-status/${event.id}`);
        if (res.ok) {
            hideStartingSoonOverlay();
        } else {
            // Handle 404s
            if (!handleCorsFallback()) {
                showStartingSoonOverlay();
                startPolling();
            }
        }
    } catch(e) {
        // StreamFree 404/200 responses lack CORS headers, causing a TypeError here.
        if (!handleCorsFallback()) {
            showStartingSoonOverlay();
            startPolling();
        }
    }
}

function openSportsPlayer(event) {
  sportsCurrentEvent = event;
  clearSportsStreamPolling();
  hideStartingSoonOverlay();
  const modal = document.getElementById('sports-player-modal');
  const modalTitle = document.getElementById('sports-modal-title');
  const modalServers = document.getElementById('sports-modal-servers');
  
  modalTitle.textContent = event.title;
  modalServers.innerHTML = '<span class="server-label" style="color: #aaa; font-size: 0.85rem;">Select Source:</span>';

  const streams = [];
  if (event.alternateStreams && event.alternateStreams.length > 0) {
    event.alternateStreams.forEach((stream, index) => {
      streams.push({ id: index.toString(), label: stream.name, url: stream.url });
    });
  } else {
    streams.push({ id: 'main', label: 'Main Server', url: event.embedUrl });
    streams.push({ id: 'backup1', label: 'Backup 1', url: event.embedUrl });
    streams.push({ id: 'backup2', label: 'Backup 2', url: event.embedUrl });
  }

  streams.forEach((stream, index) => {
    const btn = document.createElement('button');
    btn.className = `sports-server-btn ${index === 0 ? 'active' : ''}`;
    btn.textContent = stream.label;
    
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.sports-server-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      loadSportsIframe(stream.id, stream.url);
    });

    modalServers.appendChild(btn);
  });

  // Add Refresh Stream Button
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'sports-server-btn sports-refresh-btn';
  refreshBtn.style.padding = '8px 12px';
  refreshBtn.style.marginLeft = '8px';
  refreshBtn.style.background = 'rgba(255, 255, 255, 0.1)';
  refreshBtn.title = 'Reload Stream';
  refreshBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Reload';
  refreshBtn.addEventListener('click', () => {
    const container = document.getElementById('sports-video-container');
    if (container) {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        // add animation class for visual feedback
        refreshBtn.style.opacity = '0.5';
        setTimeout(() => refreshBtn.style.opacity = '1', 200);
        iframe.src = iframe.src;
      }
    }
  });
  modalServers.appendChild(refreshBtn);

  loadSportsIframe(streams[0].id, streams[0].url);
  
  if (event.server === 'streamfree') {
      const now = Math.floor(Date.now() / 1000);
      const isFuture = (event.time !== 'LIVE' && !isNaN(event.time) && Number(event.time) > now - 300);
      if (isFuture) showStartingSoonOverlay();
      checkAndPollStreamFree(event);
      
      const statsContainer = document.getElementById('sports-stats-container');
      if (statsContainer) statsContainer.style.display = 'none';
  } else if (event.server === 'watchfooty') {
      // It's a WatchFooty stream, load the stats!
      if (typeof window.loadMatchStats === 'function') {
          window.loadMatchStats(event.id, 'sports-stats-container');
      }
  }
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function loadSportsIframe(serverId, baseEmbedUrl) {
  if (!sportsCurrentEvent) return;
  const container = document.getElementById('sports-video-container');
  
  const oldIframe = container.querySelector('iframe');
  if (oldIframe) oldIframe.remove();

  const iframe = document.createElement('iframe');
  let finalUrl = baseEmbedUrl;
  
  if (serverId === 'main' || serverId.startsWith('backup')) {
    if (finalUrl.includes('?')) {
      finalUrl += `&server=${serverId}`;
    } else {
      finalUrl += `?server=${serverId}`;
    }
  }
  
  iframe.src = finalUrl;
  iframe.allowFullscreen = true;
  iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  
  container.appendChild(iframe);
}

function closeSportsPlayer() {
  clearSportsStreamPolling();
  hideStartingSoonOverlay();
  const modal = document.getElementById('sports-player-modal');
  const container = document.getElementById('sports-video-container');
  modal.style.display = 'none';
  const oldIframe = container.querySelector('iframe');
  if (oldIframe) oldIframe.remove(); 
  document.body.style.overflow = '';
  sportsCurrentEvent = null;
}

document.addEventListener('DOMContentLoaded', () => {
  const closeModalBtn = document.getElementById('sports-close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeSportsPlayer);
  
  const playerModal = document.getElementById('sports-player-modal');
  if (playerModal) {
    playerModal.addEventListener('click', (e) => {
      if (e.target === playerModal) closeSportsPlayer();
    });
  }
  
  // Hook search if search-input exists
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const activeTabGroup = document.querySelector('#tab-live-matches-group');
      if (activeTabGroup && activeTabGroup.style.color === 'rgb(255, 255, 255)') { // Assuming #fff maps to rgb
         const streamfreeView = document.getElementById('sports-streamfree-view');
         if (streamfreeView && streamfreeView.style.display === 'block') {
           if(window.sportsServersData['streamfree'].events.length) {
             renderSportsEvents('streamfree', window.sportsServersData['streamfree'].events);
           }
         }
         const watchfootyView = document.getElementById('sports-watchfooty-view');
         if (watchfootyView && watchfootyView.style.display === 'block') {
           if(window.sportsServersData['watchfooty'].events.length) {
             renderSportsEvents('watchfooty', window.sportsServersData['watchfooty'].events);
           }
         }
      }
    });
  }
});

function getPremiumSportSVG(sport) {
  const s = sport.toUpperCase();
  if (s.includes('SOCCER') || s.includes('FOOTBALL')) return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 12l3.5-2V6M12 12l-3.5-2V6M12 12v5.5l-3 2.5M12 17.5l3 2.5M15.5 10H22M8.5 10H2"></path></svg>';
  if (s.includes('CRICKET')) return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L8 21l-5-5L14.5 4.5zM22 22l-3.5-3.5"></path></svg>';
  if (s.includes('BASKETBALL')) return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10"></path></svg>';
  if (s.includes('RACING') || s.includes('F1')) return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
  if (s.includes('TENNIS')) return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 22A10 10 0 0 0 12 2v20z"></path></svg>';
  // Default Play Icon
  return '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>';
}
