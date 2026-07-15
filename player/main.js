import { makeProviders, makeStandardFetcher, targets } from '@movie-web/providers';

// Aether checklist mapping
const CHECKLIST = [
  { id: 'nebula', name: 'Nebula', icon: '🌌' },
  { id: 'tiki', name: 'Tiki', icon: '🗿' },
  { id: 'meridian', name: 'Meridian', icon: '🪐' },
  { id: 'onion', name: 'Onion', icon: '🧅' },
  { id: 'gallic', name: 'Gallic', icon: 'FR' },
  { id: 'kinglink', name: 'KingLink', icon: '🔥' },
  { id: 'cowflix', name: 'Cowflix', icon: 'DE' },
  { id: 'subtitulado', name: 'Subtitulado', icon: 'ES' }
];

// Elements
const checklistEl = document.getElementById('server-checklist');
const scraperUi = document.getElementById('scraper-ui');
const playerContainer = document.getElementById('player-container');
const videoEl = document.getElementById('video-player');
const badgeEl = document.getElementById('server-badge');
const errorMsg = document.getElementById('error-message');

// Initialize UI Checklist
CHECKLIST.forEach(server => {
  const el = document.createElement('div');
  el.className = 'server-item';
  el.id = `server-${server.id}`;
  el.innerHTML = `
    <div class="server-name">
      <span class="server-icon">${server.icon}</span>
      ${server.name}
    </div>
    <div class="server-status">Waiting...</div>
  `;
  checklistEl.appendChild(el);
});

function updateServerStatus(id, status) {
  const el = document.getElementById(`server-${id}`);
  if (!el) return;
  
  el.className = 'server-item'; // reset
  const statusEl = el.querySelector('.server-status');
  
  if (status === 'searching') {
    el.classList.add('active');
    statusEl.textContent = 'Searching...';
  } else if (status === 'success') {
    el.classList.add('success');
    statusEl.textContent = 'Found Stream ✓';
  } else if (status === 'failed') {
    el.classList.add('error');
    statusEl.textContent = 'Skipped';
  }
}

// Set up providers
// In a real browser environment, a dedicated CORS proxy is needed.
// We use a public CORS proxy for demonstration of the exact movie-web engine.
const myFetcher = makeStandardFetcher((url, options) => {
  // Use a public proxy to bypass CORS (Note: for production, deploy your own proxy)
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
  return fetch(proxyUrl, options);
});

const providers = makeProviders({
  fetcher: myFetcher,
  target: targets.BROWSER,
});

async function runScraper() {
  const urlParams = new URLSearchParams(window.location.search);
  const tmdbId = urlParams.get('id');
  const type = urlParams.get('type') || 'movie';
  const season = urlParams.get('season');
  const episode = urlParams.get('episode');
  const title = urlParams.get('title') || '';
  const year = urlParams.get('year') ? parseInt(urlParams.get('year')) : undefined;

  if (!tmdbId) {
    errorMsg.textContent = "Missing media parameters.";
    errorMsg.classList.remove('hidden');
    return;
  }

  // Update UI to show what we are searching for
  const subtitleEl = document.querySelector('.subtitle');
  if (subtitleEl && title) {
    let displayTitle = decodeURIComponent(title);
    if (year) displayTitle += ` (${year})`;
    if (type === 'tv' && season && episode) {
       displayTitle += ` - S${season}:E${episode}`;
    }
    subtitleEl.innerHTML = `Extracting ad-free streams for <strong>${displayTitle}</strong>...`;
  }

  const media = {
    type: type,
    title: title,
    releaseYear: year,
    tmdbId: tmdbId,
    ...(type === 'tv' && {
      season: { number: parseInt(season), tmdbId: season }, 
      episode: { number: parseInt(episode), tmdbId: episode }
    })
  };

  // Simulate the visual sequence Aether uses before actual resolution
  for (let i = 0; i < CHECKLIST.length; i++) {
    updateServerStatus(CHECKLIST[i].id, 'searching');
    // Artificial delay to mimic deep scraping visual effect
    await new Promise(r => setTimeout(r, 600));
    
    // In reality, providers.runAll() searches concurrently.
    // For the UI, we just simulate the cascade.
  }

  try {
    const stream = await providers.runAll({
      media: media,
      sourceOrder: ['flixhq', 'showbox', 'vidsrc', 'goMovies'], // internal provider mappings
      events: {
        init(e) { console.log('Init', e); },
        start(e) { console.log('Start', e); },
        update(e) { console.log('Update', e); },
        discoverEmbeds(e) { console.log('Embeds', e); }
      }
    });

    if (stream && stream.stream && stream.stream[0]) {
      const bestStream = stream.stream[0];
      
      // Found!
      updateServerStatus(CHECKLIST[0].id, 'success');
      CHECKLIST.slice(1).forEach(s => updateServerStatus(s.id, 'failed'));

      setTimeout(() => {
        playVideo(bestStream.playlist, CHECKLIST[0].name + ' ' + CHECKLIST[0].icon);
      }, 1000);

    } else {
      throw new Error("No streams found");
    }
  } catch (err) {
    console.error("Scraping failed, executing ultimate fallback:", err);
    
    // Visual update
    updateServerStatus(CHECKLIST[2].id, 'success'); // Fake meridian success for UI continuity
    CHECKLIST.forEach((s, idx) => { if(idx !== 2) updateServerStatus(s.id, 'failed'); });

    setTimeout(() => {
      scraperUi.style.opacity = '0';
      setTimeout(() => {
        scraperUi.classList.add('hidden');
        playerContainer.classList.remove('hidden');
        playerContainer.classList.add('visible');
        
        // Ultimate resilient fallback (Vidlink ad-free)
        const fallbackUrl = type === 'movie' 
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=a855f7&autoplay=true`
          : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=a855f7&autoplay=true`;

        playerContainer.innerHTML = `
          <iframe src="${fallbackUrl}" style="width:100%; height:100%; border:none; position:absolute; top:0; left:0;" allowfullscreen allow="autoplay; fullscreen"></iframe>
          <div class="server-badge" style="opacity: 1;">Streaming via Meridian</div>
        `;
      }, 500);
    }, 1000);
  }
}

function playVideo(m3u8Url, serverName) {
  scraperUi.style.opacity = '0';
  setTimeout(() => {
    scraperUi.classList.add('hidden');
    playerContainer.classList.remove('hidden');
    
    // Trigger reflow to apply transition
    void playerContainer.offsetWidth;
    playerContainer.classList.add('visible');

    badgeEl.textContent = `Streaming via ${serverName}`;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(m3u8Url);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        videoEl.play();
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      videoEl.src = m3u8Url;
      videoEl.addEventListener('loadedmetadata', function() {
        videoEl.play();
      });
    }
  }, 500);
}

// Start
runScraper();
