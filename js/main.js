window.isInPages = window.location.pathname.includes('/pages/');
window.getRootPath = () => window.isInPages ? '../' : './';
window.getPagePath = (page) => window.isInPages ? page : `pages/${page}`;

window.channelLogos = null;
window.channelLogosPromise = fetch(window.getRootPath() + 'js/logos.json')
  .then(res => res.json())
  .then(data => { window.channelLogos = data; return data; })
  .catch(err => { console.error("Could not load logos map", err); return {}; });

    // The real API key is now securely handled by the Cloudflare Worker proxy.
    const TMDB_API_KEY = "PROXY_HANDLES_THIS";
    // OMDB API Key is securely handled by Cloudflare Master Proxy
    const OMDB_API_KEY = "PROXY_HANDLES_THIS"; 
    
    const BASE_URL = "https://tmdb-proxy.gametec1290.workers.dev/3";
    const IMG_URL = "https://image.tmdb.org/t/p/w500";
    const IMG_URL_ORIGINAL = "https://image.tmdb.org/t/p/original";
    const IMG_URL_BG = "https://image.tmdb.org/t/p/w1280";

    // --- WATCHED EPISODES MIGRATION ---
    try {
      let legacyKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('watched_') && !key.startsWith('watched_series_')) {
          legacyKeys.push(key);
        }
      }
      legacyKeys.forEach(key => {
        const parts = key.split('_');
        if (parts.length === 4) {
          const id = parts[1], season = parts[2], episode = parts[3];
          if (localStorage.getItem(key) === 'true') {
            const seriesKey = `watched_series_${id}`;
            const seriesData = JSON.parse(localStorage.getItem(seriesKey) || '{}');
            if (!seriesData[season]) seriesData[season] = [];
            if (!seriesData[season].includes(parseInt(episode))) {
              seriesData[season].push(parseInt(episode));
            }
            localStorage.setItem(seriesKey, JSON.stringify(seriesData));
          }
        }
        localStorage.removeItem(key);
      });
    } catch (e) { console.error("Migration failed", e); }
    // ----------------------------------

    let isAdBlockerActive = false;

    async function detectAdBlocker() {
      if (window.isAdBlockerActive) return true;

      return new Promise((resolve) => {
        let detectionAttempts = 0;
        const maxAttempts = 10; // Check every 500ms for 5 seconds

        // 1. Create a suite of bait elements with content
        const createBait = () => {
          const baits = [];
          const baitConfigs = [
            { id: 'ad-banner-test', class: 'adsbox ad-unit ad-container ad-placement ad-content' },
            { id: 'google-ad-slot', class: 'ad_box banner_ad top-ad' },
            { id: 'sponsored-post', class: 'advert-box ads-area' }
          ];

          baitConfigs.forEach(conf => {
            const b = document.createElement('div');
            b.id = conf.id;
            b.className = conf.class;
            // Content makes it harder for simple heuristic blockers to ignore
            b.innerHTML = '<div style="width:10px; height:10px;">Ad Advertisement Sponsored</div>';
            b.setAttribute('style', 'position:absolute; left:-1000px; top:-1000px; width:100px; height:100px; display:block !important; visibility:visible !important; opacity:1 !important;');
            document.body.appendChild(b);
            baits.push(b);
          });
          return baits;
        };

        const baitElements = createBait();

        // 2. Create a bait image (from a known ad domain)
        const baitImage = new Image();
        baitImage.src = 'https://googleads.g.doubleclick.net/pagead/imgad?id=CICAgKDIr-m1_AEQARgBMghu2m0Q3-3y-w';
        let imageBlocked = false;
        baitImage.onerror = () => { imageBlocked = true; };

        const runCheck = async () => {
          detectionAttempts++;
          let detected = false;

          // Check Bait Elements
          for (const b of baitElements) {
            const style = window.getComputedStyle(b);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              b.offsetParent === null ||
              b.offsetHeight === 0 ||
              style.opacity === '0' ||
              style.pointerEvents === 'none'
            ) {
              detected = true;
              break;
            }
          }

          // Check Bait Scripts
          if (window.isAdBlockScriptLoaded !== true) {
            detected = true;
          }

          // Check Bait Image
          if (imageBlocked) {
            detected = true;
          }

          // Final verification: Probe a known ad script endpoint
          if (!detected && detectionAttempts > 2) {
            try {
              const probe = await fetch('https://securepubads.g.doubleclick.net/tag/js/gpt.js', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store'
              }).catch(() => null);
              if (!probe) detected = true;
            } catch (e) {
              detected = true;
            }
          }

          if (detected) {
            isAdBlockerActive = true;
            console.log(`AdBlocker Detected on attempt ${detectionAttempts}`);

            // Apply UI changes
            if (detailsView.classList.contains('active') && currentDetailsData) {
              renderDetailsView(currentDetailsData.id, currentDetailsData.mediaType || (currentDetailsData.title ? 'movie' : 'tv'));
            }

            // Cleanup
            baitElements.forEach(b => b.parentNode && b.parentNode.removeChild(b));
            resolve(true);
            return;
          }

          if (detectionAttempts < maxAttempts) {
            setTimeout(runCheck, 500);
          } else {
            // All attempts failed, assume no blocker
            baitElements.forEach(b => b.parentNode && b.parentNode.removeChild(b));
            resolve(false);
          }
        };

        // Start checking
        runCheck();
      });
    }

    const SERVERS = [
      // Tier 1: Top 5 Ad-Free (Promoted as Buttons)
      { id: 'vidsrc-wtf', name: 'Vidsrc.wtf', url: 'https://vidsrc.wtf', adFree: true, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-pointer-lock', label: 'Server 1' },
      { id: 'vidnest', name: 'Vidnest', url: 'https://vidnest.fun', adFree: true, sandbox: false, label: 'Server 2' },
      { id: 'vidsync', name: 'VidSync', url: 'https://vidsync.xyz', adFree: true, sandbox: false, label: 'Server 3' },
      { id: 'zxcstream', name: 'Zxcstream', url: 'https://www.zxcstream.xyz', adFree: true, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-pointer-lock', label: 'Server 4', has4K: true },
      { id: 'rivestream', name: 'RiveStream', url: 'https://www.rivestream.app', adFree: true, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-pointer-lock', label: 'Server 5', hasDownload: true },

      // Tier 2: Additional Ad-Free (In Modal)
      { id: 'mapple', name: 'Mapple', url: 'https://mapple.rip', adFree: true, sandbox: false, label: 'Server 7', has4K: true },
      { id: 'vidsrc-cc', name: 'Vidsrc.cc', url: 'https://vidsrc.cc', adFree: true, sandbox: false, label: 'Server 8' },
      { id: 'cinesrc', name: 'Cinesrc', url: 'https://cinesrc.st', adFree: true, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-pointer-lock', label: 'Server 9', has4K: true },
      { id: '1embed', name: '1Embed', url: 'https://1embed.cc', adFree: true, sandbox: 'allow-scripts allow-same-origin allow-presentation allow-pointer-lock', label: 'Server 10', hasDownload: true },
      { id: 'vidplays', name: 'VidPlays', url: 'https://vidplays.fun', adFree: true, sandbox: true, label: 'Server 6' },

      // Tier 3: Has Ads (Requires Sandbox Workaround)
      { id: 'vidking', name: 'Vidking', url: 'https://www.vidking.net/embed/movie/550', adFree: false, sandbox: false, label: 'Server 11' },
      { id: 'videasy', name: 'Videasy', url: 'https://player.videasy.net/movie/550', adFree: false, sandbox: false, label: 'Server 12', has4K: true },
      { id: 'vidcore', name: 'Vidcore', url: 'https://vidcore.net', adFree: false, sandbox: false, label: 'Server 13', has4K: true },
      { id: 'vidlink', name: 'Vidlink', url: 'https://vidlink.pro', adFree: false, sandbox: false, label: 'Server 14' },
      { id: '111movies', name: '111Movies', url: 'https://111movies.net', adFree: false, sandbox: false, label: 'Server 16' },
      { id: 'vidfast', name: 'VidFast', url: 'https://vidfast.pro', adFree: false, sandbox: false, label: 'Server 17', has4K: true },
      { id: 'moviesapi', name: 'MoviesAPI', url: 'https://moviesapi.to', adFree: false, sandbox: false, label: 'Server 18' },
      { id: 'vidrock', name: 'Vidrock', url: 'https://vidrock.ru', adFree: false, sandbox: false, label: 'Server 19' },
      { id: 'vidup', name: 'Vidup', url: 'https://vidup.to', adFree: false, sandbox: false, label: 'Server 20', has4K: true },
      { id: 'peachify', name: 'Peachify', url: 'https://peachify.top', adFree: false, sandbox: false, label: 'Server 21' },
      { id: 'vidsrc-to', name: 'Vidsrc.to', url: 'https://vidsrc.to', adFree: false, sandbox: false, label: 'Server 25' },

      // New Servers
      { id: 'spencerdevs', name: 'Spencerdevs', url: 'https://spencerdevs.xyz', adFree: false, sandbox: false, label: 'Server 29' },
      { id: 'vixsrc', name: 'VixSrc', url: 'https://vixsrc.to', adFree: false, sandbox: false, label: 'Server 30', has4K: true },
      { id: 'vidzee', name: 'VidZee', url: 'https://vidzee.wtf', adFree: false, sandbox: false, label: 'Server 31' },
      { id: 'anyembed', name: 'AnyEmbed', url: 'https://anyembed.xyz', adFree: false, sandbox: false, label: 'Server 32' },
      { id: 'vidsrc-su', name: 'Vidsrc.su', url: 'https://vidsrc.su', adFree: false, sandbox: false, label: 'Server 33' },
      { id: 'cinemaos', name: 'Cinemaos', url: 'https://cinemaos.tech', adFree: false, sandbox: false, label: 'Server 34' },
      { id: 'nxsha', name: 'Nxsha', url: 'https://web.nxsha.app', adFree: false, sandbox: false, label: 'Server 35' },
      { id: 'xpass', name: 'Xpass', url: 'https://play.xpass.top', adFree: false, sandbox: false, label: 'Server 36' },
      { id: 'cinextream', name: 'Cinextream', url: 'https://cinextream.net', adFree: false, sandbox: false, label: 'Server 37' },
      { id: 'screenscape', name: 'Screenscape', url: 'https://screenscape.me', adFree: false, sandbox: false, label: 'Server 38' },
      { id: 'filmu', name: 'Filmu', url: 'https://embed.filmu.in', adFree: false, sandbox: false, label: 'Server 41', has4K: true },

      { id: 'tryembed', name: 'TryEmbed', url: 'https://tryembed.us.cc', adFree: false, sandbox: false, label: 'Server 39' },
      { id: 'vidnest-animepahe', name: 'AnimePahe', url: 'https://vidnest.fun', adFree: false, sandbox: false, label: 'Server 40' },
      { id: 'bingr', name: 'Bingr', url: 'https://bingr.one', adFree: false, sandbox: false, label: 'Server 42' },

      // Tier 4: Slow / Fallback (Works, but very slow)
      { id: 'vidsrc-ru', name: 'Vidsrc.ru', url: 'https://vidsrc.ru', adFree: false, sandbox: false, label: 'Server 26' },

      // Tier 5: Broken or Offline (In Modal)
      { id: 'vidsrc-me', name: 'Vidsrc.me', url: 'https://vidsrc.me', adFree: false, sandbox: false, label: 'Server 15' },
      { id: 'vidplus', name: 'Vidplus', url: 'https://player.vidplus.to', adFree: false, sandbox: false, label: 'Server 22' },
      { id: 'fmovies', name: 'FMovies', url: 'https://www.fmovies.gd', adFree: false, sandbox: false, label: 'Server 23' },
      { id: 'vidlux', name: 'Vidlux', url: 'https://vidlux.xyz', adFree: false, sandbox: false, label: 'Server 24', hasDownload: true },
      { id: 'vegamovies', name: 'VegaMovies', url: 'https://vegamovies.mq', adFree: false, sandbox: false, label: 'Server 28', hasDownload: true },

      // Alpha Testing Server
      { id: 'server-27', name: 'Server 27 (Alpha)', url: null, adFree: true, sandbox: false, label: 'Server 27', isAlpha: true, autoCheck: true }
    ];

    const navbar = document.getElementById('navbar');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const mainContent = document.getElementById('main-content');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchGrid = document.getElementById('search-grid');
    const searchQueryDisplay = document.getElementById('search-query-display');
    const sportsContainer = document.getElementById('sports-container');
    const sportsGrid = document.getElementById('sports-grid');
    const sportsLoader = document.getElementById('sports-loader');
    const sportsEmptyMsg = document.getElementById('sports-empty-msg');
    const sportsCategoryFilter = document.getElementById('sports-category-filter');
    const homeLink = document.getElementById('home-link');
    const detailsView = document.getElementById('details-view');
    const serverTestView = document.getElementById('server-test-view');
    const globalBackBtn = document.getElementById('global-back-btn');
    const detailsSearchContainer = document.getElementById('details-search-container');
    const detailsSearchInput = document.getElementById('details-search-input');
    const detailsClearSearch = document.getElementById('details-clear-search');
    let detailsSearchTimeout;
    const navItems = document.querySelectorAll('.nav-links li');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinksUl = document.querySelector('.nav-links');

    if (mobileMenuBtn) {
      mobileMenuBtn?.addEventListener('click', () => {
        navLinksUl.classList.toggle('active');
      });
    }

    navItems.forEach(li => {
      li?.addEventListener('click', () => {
        if (navLinksUl.classList.contains('active')) navLinksUl.classList.remove('active');
      });
    });

    const hero = document.getElementById('hero');
    const heroBg = document.getElementById('hero-bg');
    const heroTitle = document.getElementById('hero-title');
    const heroDesc = document.getElementById('hero-desc');
    const heroPlay = document.getElementById('hero-play');

    if (heroBg && hero) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            heroBg.style.animationPlayState = 'running';
          } else {
            heroBg.style.animationPlayState = 'paused';
          }
        });
      }, { threshold: 0 });
      heroObserver.observe(hero);
    }

    const rowsContainer = document.getElementById('rows-container');
    const playerModal = document.getElementById('player-modal');
    const playerIframe = document.getElementById('player-iframe');
    const closeModal = document.getElementById('close-modal');

    const legalModal = document.getElementById('legal-modal');
    const closeLegal = document.getElementById('close-legal');
    const legalContent = document.getElementById('legal-content');

    const serverSelectionModal = document.getElementById('server-selection-modal');
    const closeServerModal = document.getElementById('close-server-modal');
    const serverSelectionBody = document.getElementById('server-selection-body');

    closeServerModal?.addEventListener('click', () => {
      serverSelectionModal.classList.remove('active');
    });

    const downloadSelectionModal = document.getElementById('download-selection-modal');
    const closeDownloadModal = document.getElementById('close-download-modal');
    const downloadSelectionBody = document.getElementById('download-selection-body');

    if (closeDownloadModal) {
      closeDownloadModal?.addEventListener('click', () => {
        downloadSelectionModal.classList.remove('active');
      });
    }

    function openDownloadModal(id, type, season, episode) {
      let downloadServers = SERVERS.filter(s => s.hasDownload);
      // Sort servers: vegamovies first, vidlux second, rivestream third
      const order = { 'vegamovies': 1, 'vidlux': 2, 'rivestream': 3 };
      downloadServers.sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99));

      downloadSelectionBody.innerHTML = '';

      downloadServers.forEach(srv => {
        const isRecommended = srv.id === 'rivestream' || srv.id === 'vidlux' || srv.id === 'vegamovies';
        let downloadUrl = '';
        if (srv.id === '1embed') {
          downloadUrl = type === 'movie' ? `https://1embed.cc/download/movie/${id}` : `https://1embed.cc/download/tv/${id}/${season}/${episode}`;
        } else if (srv.id === 'rivestream') {
          downloadUrl = type === 'movie' ? `https://www.rivestream.app/download?type=movie&id=${id}` : `https://www.rivestream.app/download?type=tv&id=${id}&season=${season}&episode=${episode}`;
        } else if (srv.id === 'vidlux') {
          downloadUrl = type === 'movie' ? `https://02moviedownloader.site/api/download/movie/${id}` : `https://02moviedownloader.site/api/download/tv/${id}/${season}/${episode}`;
        } else if (srv.id === 'vegamovies') {
          const tmdbTitle = currentDetailsData ? (currentDetailsData.title || currentDetailsData.name || '') : '';
          downloadUrl = `https://vegamovies.mq/search.html?q=${encodeURIComponent(tmdbTitle)}`;
        }

        let recBadge = isRecommended ? `<span style="font-size: 0.65rem; font-weight: 800; color: #46d369; padding: 3px 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; text-transform: uppercase;">Recommended</span>` : '';

        const fastDlBadge = `<span style="font-size: 0.65rem; font-weight: 800; color: #00d4ff; padding: 3px 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0,212,255,0.3); border-radius: 6px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Fast Download</span>`;
        const fourKBadge = `<span style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; padding: 3px 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect><polyline points="7 10 7 14"></polyline><polyline points="10 10 7 12"></polyline><line x1="14" y1="10" x2="14" y2="14"></line><polyline points="17 10 14 12 17 14"></polyline></svg> 4K Option</span>`;

        if (srv.id === 'vidlux') {
          recBadge += fastDlBadge;
        } else if (srv.id === 'vegamovies') {
          recBadge += fastDlBadge + fourKBadge;
        }

        const dlIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

        const btn = document.createElement('button');
        btn.className = 'btn btn-play';
        btn.id = `download-btn-${srv.id}`;
        btn.style.cssText = 'background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); display: flex; flex-direction: column; gap: 8px; padding: 14px 20px; border-radius: 12px !important; min-height: 60px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; text-align: left;';
        btn.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; font-size: 1.1rem; font-weight: bold; flex-shrink: 0;">
              ${dlIcon} ${srv.name}
            </div>
            <div style="display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 6px;">
              ${recBadge}
            </div>
          </div>
          <div class="ping-status" id="download-ping-status-${srv.id}" style="font-size: 0.8rem; display: flex; align-items: center; gap: 6px; color: #9ca3af; width: 100%;">
            <span class="ping-light ping-yellow"></span> Waiting...
          </div>
        `;
        btn.onclick = () => {
          window.open(downloadUrl, '_blank');
          downloadSelectionModal.classList.remove('active');
        };
        downloadSelectionBody.appendChild(btn);
      });

      downloadSelectionModal.classList.add('active');

      const pingAllDownload = () => {
        downloadServers.forEach(async (srv) => {
          const result = await pingServer(srv.url);
          const statusEl = document.getElementById(`download-ping-status-${srv.id}`);
          const btnEl = document.getElementById(`download-btn-${srv.id}`);
          if (!statusEl) return;
          if (result.status === 'online') {
            statusEl.innerHTML = `<span class="ping-light ping-green"></span> ${result.ping}ms`;
          } else {
            statusEl.innerHTML = `<span class="ping-light ping-red"></span> Offline`;
            if (btnEl && downloadSelectionBody) {
              // Push the offline server's button to the very end of the list
              downloadSelectionBody.appendChild(btnEl);
            }
          }
        });
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(pingAllDownload, { timeout: 2000 });
      } else {
        setTimeout(pingAllDownload, 600);
      }
    }

    async function pingServer(serverUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const start = performance.now();
      try {
        await fetch(serverUrl, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - start);
        return { status: 'online', ping: latency };
      } catch (error) {
        clearTimeout(timeoutId);
        
        // --- UptimeRobot Fallback for False Offline ---
        if (window.uptimeDataCache) {
            let serverDomain = '';
            try { serverDomain = new URL(serverUrl).hostname.replace('www.', ''); } catch(e) {}
            
            const matches = window.uptimeDataCache.filter(m => {
              try { 
                let mDomain = m.url.startsWith('http') ? new URL(m.url).hostname : m.url;
                return mDomain.replace('www.', '') === serverDomain; 
              } catch(e) { return false; }
            });
            
            if (matches.length > 0) {
              matches.sort((a, b) => {
                if (a.status === 2 && b.status !== 2) return -1;
                if (b.status === 2 && a.status !== 2) return 1;
                return parseFloat(b.custom_uptime_ratio || 0) - parseFloat(a.custom_uptime_ratio || 0);
              });
              const mData = matches[0];
              
              if (mData.status === 2) {
                 // Server is actually UP in UptimeRobot
                 let fakePing = 400; // Fallback
                 if (mData.response_times && mData.response_times.length > 0) {
                     const sum = mData.response_times.reduce((acc, r) => acc + r.value, 0);
                     fakePing = Math.round(sum / mData.response_times.length);
                 }
                 return { status: 'online', ping: fakePing };
              }
            }
        }
        // ---------------------------------------------
        
        return { status: 'offline', ping: null };
      }
    }

    // Sub/Dub functions
    window.openSubDubModal = function (id, type, season, episode, server = 'vidnest') {
      const modal = document.getElementById('sub-dub-modal');
      modal.classList.add('active');
      modal.dataset.id = id;
      modal.dataset.type = type;
      modal.dataset.season = season;
      modal.dataset.episode = episode;
      modal.dataset.server = server;

      document.getElementById('sub-dub-btn-sub').innerHTML = 'SUBBED';
      document.getElementById('sub-dub-btn-dub').innerHTML = 'DUBBED';
      document.getElementById('sub-dub-btn-sub').disabled = false;
      document.getElementById('sub-dub-btn-dub').disabled = false;
      document.getElementById('sub-dub-error').style.display = 'none';
    };

    window.closeSubDubModal = function () {
      document.getElementById('sub-dub-modal').classList.remove('active');
    };

    window.handleSubDubSelection = async function (format) {
      const modal = document.getElementById('sub-dub-modal');
      const id = modal.dataset.id;
      const type = modal.dataset.type;
      const season = modal.dataset.season;
      const episode = modal.dataset.episode;
      const server = modal.dataset.server || 'vidnest';

      const subBtn = document.getElementById('sub-dub-btn-sub');
      const dubBtn = document.getElementById('sub-dub-btn-dub');

      if (format === 'sub') subBtn.innerHTML = '<span class="ping-light ping-yellow"></span> Mapping...';
      if (format === 'dub') dubBtn.innerHTML = '<span class="ping-light ping-yellow"></span> Mapping...';
      subBtn.disabled = true;
      dubBtn.disabled = true;

      try {
        const query = `
          query ($search: String) {
            Media (search: $search, type: ANIME) {
              id
              idMal
            }
          }
        `;
        const title = window.currentMediaTitle || '';
        const cleanTitle = title.replace(/\(TV\)/gi, '').trim();

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: query, variables: { search: cleanTitle } })
        });

        const data = await response.json();
        let anilistId = null;
        let malId = null;

        if (data && data.data && data.data.Media && data.data.Media.id) {
          anilistId = data.data.Media.id;
          malId = data.data.Media.idMal;
        }

        if (anilistId || malId) {
          closeSubDubModal();
          const saved = getProgressForId(id);
          const startProgress = (saved && saved.currentTime) ? `?progress=${Math.floor(saved.currentTime)}` : '';

          let src = '';
          if (server === 'vidnest-animepahe' && anilistId) {
            src = `https://vidnest.fun/animepahe/${anilistId}/${episode}/${format}${startProgress ? startProgress + '&servericon=hide' : '?servericon=hide'}`;
          } else if (server === 'tryembed' && anilistId) {
            src = `https://tryembed.us.cc/embed/anime/${anilistId}/${episode}/${format}?autoplay=true&autoSkip=true&autoNext=false&lang-type=false${startProgress ? '&startAt=' + Math.floor(saved.currentTime) : ''}`;
          } else if (server === 'vidlink' && malId) {
            src = `https://vidlink.pro/anime/${malId}/${episode}/${format}?primaryColor=46d369&autoplay=true&fallback=true${startProgress ? '&startAt=' + Math.floor(saved.currentTime) : ''}`;
          } else if (server === 'cinextream' && anilistId) {
            src = `https://cinextream.net/api/embed/anime/${format}/${anilistId}/${episode}?color=e50914&autoplay=true`;
          } else if (anilistId) {
            src = `https://vidnest.fun/anime/${anilistId}/${episode}/${format}${startProgress ? startProgress + '&servericon=hide' : '?servericon=hide'}`;
          } else {
            throw new Error("No valid ID found for selected server.");
          }
          openPlayer(id, type, season, episode, server, src);
        } else {
          throw new Error("No Anilist/MAL match found.");
        }
      } catch (err) {
        console.error("Anilist mapping failed:", err);
        document.getElementById('sub-dub-error').style.display = 'block';
        setTimeout(() => {
          closeSubDubModal();
          openPlayer(id, type, season, episode, 'vidnest');
        }, 1200);
      }
    };

    function openServerSelectionPopup(id, season, episode, type = 'tv') {
      serverSelectionModal.classList.add('active');

      let serversToRender = [...SERVERS];
      let modalNoteHtml = '';

      if (window.currentIsAnime) {
        const s40 = serversToRender.find(s => s.id === 'vidnest-animepahe');
        const s39 = serversToRender.find(s => s.id === 'tryembed');
        const s37 = serversToRender.find(s => s.id === 'cinextream');
        const s2 = serversToRender.find(s => s.id === 'vidnest');
        const s14 = serversToRender.find(s => s.id === 'vidlink');
        const s41 = serversToRender.find(s => s.id === 'filmu');
        const s13 = serversToRender.find(s => s.id === 'vidcore');
        const s42 = serversToRender.find(s => s.id === 'bingr');

        if (s42 && s40 && s2 && s39 && s37 && s14 && s41 && s13) {
          // Reorder top anime servers: Bingr, AnimePahe, 2, 39, 37, 14, 41, 13
          serversToRender = [s42, s40, s2, s39, s37, s14, s41, s13, ...serversToRender.filter(s => s.id !== 'bingr' && s.id !== 'vidnest-animepahe' && s.id !== 'vidnest' && s.id !== 'tryembed' && s.id !== 'cinextream' && s.id !== 'vidlink' && s.id !== 'filmu' && s.id !== 'vidcore')];
        }

        modalNoteHtml = `
          <div style="background: rgba(70, 211, 105, 0.1); border: 1px solid rgba(70, 211, 105, 0.2); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.85rem; color: #46d369; display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Anime Detected: Displaying dedicated anime servers. Standard servers are available below as a fallback.</span>
          </div>
        `;
      } else if (isAdBlockerActive) {
        const s12 = serversToRender.find(s => s.id === 'videasy');
        const s17 = serversToRender.find(s => s.id === 'vidfast');

        if (s12 && s17) {
          // Move them to the front
          serversToRender = serversToRender.filter(s => s.id !== 'videasy' && s.id !== 'vidfast');
          serversToRender = [s12, s17, ...serversToRender];
        }

        modalNoteHtml = `
          <div style="background: rgba(70, 211, 105, 0.1); border: 1px solid rgba(70, 211, 105, 0.2); padding: 12px; border-radius: 10px; margin-bottom: 20px; font-size: 0.85rem; color: #46d369; display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Recommended because you have ad-blocking services active.</span>
          </div>
        `;
      }

      const buttonsHtml = serversToRender.map((srv, index) => {
        const isAnimeRecommended = window.currentIsAnime && (srv.id === 'vidnest-animepahe' || srv.id === 'tryembed' || srv.id === 'vidnest' || srv.id === 'vidlink' || srv.id === 'cinextream' || srv.id === 'bingr');
        const isRecommended = isAnimeRecommended || (!window.currentIsAnime && isAdBlockerActive && (srv.id === 'videasy' || srv.id === 'vidfast'));
        const adBadgeColor = srv.adFree ? '#46d369' : (isRecommended ? '#46d369' : '#eab308');
        let adBadgeText = srv.adFree ? 'Ad-Free' : (isRecommended ? 'Optimized' : 'Ads');
        let extraClass = srv.isAlpha ? 'server-alpha' : (isRecommended ? 'server-recommended' : '');
        
        if (srv.isAlpha) {
          adBadgeText = 'Alpha Testing';
        } else if (window.currentIsAnime) {
          if (srv.id === 'bingr' || srv.id === 'vidnest-animepahe') { adBadgeText = 'Sub/Dub'; extraClass = 'server-primary'; }
          else if (srv.id === 'vidnest' || srv.id === 'tryembed' || srv.id === 'cinextream' || srv.id === 'vidlink') { adBadgeText = 'Sub/Dub'; extraClass = 'server-recommended'; }
          else if (srv.id === 'filmu' || srv.id === 'vidcore') { adBadgeText = 'Alternative'; extraClass = ''; }
        }

        const action = ((srv.id === 'vidnest-animepahe' || srv.id === 'tryembed' || srv.id === 'vidnest' || srv.id === 'vidlink' || srv.id === 'cinextream') && window.currentIsAnime)
          ? `serverSelectionModal.classList.remove('active'); openSubDubModal(${id}, '${type}', ${season}, ${episode}, '${srv.id}')`
          : `serverSelectionModal.classList.remove('active'); openPlayer(${id}, '${type}', ${season}, ${episode}, '${srv.id}')`;

        const fourKBadgeHtml = srv.has4K ? `<div style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; padding: 3px 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px; letter-spacing: 0.5px; white-space: nowrap;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect><polyline points="7 10 7 14"></polyline><polyline points="10 10 7 12"></polyline><line x1="14" y1="10" x2="14" y2="14"></line><polyline points="17 10 14 12 17 14"></polyline></svg> 4K</div>` : '';

        return `
        <button class="server-select-btn ${extraClass}" id="server-btn-${srv.id}" onclick="${action}" style="margin-bottom: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px; padding: 14px; ${srv.id === 'server-27' ? 'opacity: 0.5; filter: grayscale(1);' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
            <div style="font-size: 1.1rem; color: #fff; font-weight: bold; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${srv.label} <span style="font-weight: normal; color: #aaa; font-size: 0.9rem;">(${srv.name})</span></div>
          </div>
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; width: 100%; margin-top: auto;">
            <div class="ping-status" id="popup-ping-status-${srv.id}" style="font-size: 0.8rem; display: flex; align-items: center; gap: 6px; color: #9ca3af; white-space: nowrap;">
              <span class="ping-light ping-yellow"></span> Waiting...
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; align-items: center;">
              ${fourKBadgeHtml}
              <div style="font-size: 0.6rem; font-weight: 800; color: ${adBadgeColor}; padding: 2px 5px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; text-transform: uppercase; letter-spacing: 0px; white-space: nowrap;">${adBadgeText}</div>
            </div>
          </div>
        </button>
        `;
      });

      if (window.currentIsAnime) {
        // Slice first 8 servers (Bingr, AnimePahe, 2, 39, 37, 14, 41, 13) for the top recommended section
        const topButtonsHtml = buttonsHtml.slice(0, 8).join('');
        const otherButtonsHtml = buttonsHtml.slice(8).join('');

        const accordionHtml = `
          <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
            <button id="toggle-other-servers-btn" onclick="const c = document.getElementById('other-servers-container'); const i = document.getElementById('toggle-other-servers-icon'); const isHidden = c.style.display === 'none'; c.style.display = isHidden ? 'block' : 'none'; i.innerHTML = isHidden ? '<path d=\\\'M5 15l7-7 7 7\\\'></path>' : '<path d=\\\'M19 9l-7 7-7-7\\\'></path>';" style="width: 100%; padding: 14px; background: rgba(255, 255, 255, 0.05); color: #ccc; border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 12px; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
              <span>&#127916; Standard Movie &amp; TV Servers (&#9888;&#65039; May contain anime)</span>
              <svg id="toggle-other-servers-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div id="other-servers-container" style="display: none; margin-top: 15px;">
              ${otherButtonsHtml}
            </div>
          </div>
        `;
        serverSelectionBody.innerHTML = modalNoteHtml + topButtonsHtml + accordionHtml;
      } else {
        serverSelectionBody.innerHTML = modalNoteHtml + buttonsHtml.join('');
      }

      const pingAllPopup = () => {
        serversToRender.forEach(async (srv) => {
          const result = await pingServer(srv.url);
          const statusEl = document.getElementById(`popup-ping-status-${srv.id}`);
          const btnEl = document.getElementById(`server-btn-${srv.id}`);
          if (!statusEl) return;
          if (result.status === 'online') {
            statusEl.innerHTML = `<span class="ping-light ping-green"></span> ${result.ping}ms`;
          } else {
            statusEl.innerHTML = `<span class="ping-light ping-red"></span> Offline`;
            if (btnEl && btnEl.parentElement) {
              // Push the offline server's button to the very end of its current container
              btnEl.parentElement.appendChild(btnEl);
            }
          }
        });
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(pingAllPopup, { timeout: 2000 });
      } else {
        setTimeout(pingAllPopup, 600);
      }
    }

    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    window.nextPromptShown = false;

    window.addEventListener('message', (event) => {
      // Handle progress updates from embed players (Vidking style)
      if (event.data && event.data.event === 'onProgress') {
        // Clear background fallback tracker if native events start firing
        if (window.manualFallbackTimer) {
          clearInterval(window.manualFallbackTimer);
          window.manualFallbackTimer = null;
        }
        const meta = JSON.parse(playerIframe.dataset.meta || '{}');
        if (!meta.id) return;

        const { seconds, duration } = event.data.data;
        const progressData = {
          id: meta.id,
          currentTime: seconds,
          duration: duration,
          progress: (seconds / duration) * 100,
          updatedAt: Date.now(),
          mediaType: meta.mediaType,
          title: meta.title || meta.name,
          poster: meta.poster_path ? IMG_URL + meta.poster_path : ''
        };

        const now = Date.now();
        if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
          localStorage.setItem(`progress_${meta.id}`, JSON.stringify(progressData));
          window._lastProgressSave = now;
          if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
            TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressData.progress);
            window._lastTraktScrobble = now;
          }
        }

        // Dynamic timing: trigger next prompt near end credits
        if (!window.nextPromptShown && duration > 0) {
          const timeRemaining = duration - seconds;
          let threshold;
          if (duration <= 1800) threshold = 90;       // Short TV (< 30 min): 90s
          else if (duration <= 3600) threshold = 120;  // Long TV (30-60 min): 2 min
          else threshold = 300;                        // Movies (> 60 min): 5 min

          if (timeRemaining <= threshold && timeRemaining > 0) {
            window.nextPromptShown = true;
            showNextPrompt(meta);
          }
        }
      }

      // Handle progress updates from Vidcore
      if (event.origin === 'https://vidcore.net' && event.data) {
        const { type, data } = event.data;
        const meta = JSON.parse(playerIframe.dataset.meta || '{}');
        if (!meta.id) return;

        if (type === 'timeupdate' && data) {
          const { currentTime, duration, percent } = data;
          const progressData = {
            id: meta.id,
            currentTime: currentTime,
            duration: duration,
            progress: percent * 100,
            updatedAt: Date.now(),
            mediaType: meta.mediaType,
            title: meta.title || meta.name,
            poster: meta.poster_path ? IMG_URL + meta.poster_path : ''
          };

          const now = Date.now();
          if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
            localStorage.setItem(`progress_${meta.id}`, JSON.stringify(progressData));
            window._lastProgressSave = now;
            if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
              TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressData.progress);
              window._lastTraktScrobble = now;
            }
          }

          if (!window.nextPromptShown && duration > 0) {
            const timeRemaining = duration - currentTime;
            let threshold;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;
            else threshold = 300;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }
        }

        if (type === 'ended') {
          if (meta.mediaType === 'tv' || meta.mediaType === 'anime') {
            markEpisodeWatched(meta.id, meta.currentSeason, meta.currentEpisode);
            const icon = document.getElementById(`watch-icon-${meta.id}-${meta.currentSeason}-${meta.currentEpisode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
            // Auto play next episode if prompt is visible
            const nextPlayBtn = document.querySelector('#next-prompt-container .btn-primary');
            if (nextPlayBtn) nextPlayBtn.click();
          }
        }
      }

      // Handle progress updates from TryEmbed, VidFast, Vidrock, & Vidup
      if ((event.origin === 'https://tryembed.us.cc' || event.origin === 'https://vidfast.pro' || event.origin === 'https://vidrock.ru' || event.origin === 'https://vidrock.net' || event.origin === 'https://vidup.to') && event.data && event.data.type === 'PLAYER_EVENT') {
        const { event: eventName, currentTime, duration } = event.data.data;
        const meta = JSON.parse(playerIframe.dataset.meta || '{}');
        if (!meta.id) return;

        if (eventName === 'timeupdate' && duration > 0) {
          const progressData = {
            id: meta.id,
            currentTime: currentTime,
            duration: duration,
            progress: (currentTime / duration) * 100,
            updatedAt: Date.now(),
            mediaType: meta.mediaType,
            title: meta.title || meta.name,
            poster: meta.poster_path ? IMG_URL + meta.poster_path : ''
          };

          const now = Date.now();
          if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
            localStorage.setItem(`progress_${meta.id}`, JSON.stringify(progressData));
            window._lastProgressSave = now;
            if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
              TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressData.progress);
              window._lastTraktScrobble = now;
            }
          }

          if (!window.nextPromptShown && duration > 0) {
            const timeRemaining = duration - currentTime;
            let threshold;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;
            else threshold = 300;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }
        }
      }
      // Handle progress updates from Vidlink
      if (event.origin === 'https://vidlink.pro' && event.data && event.data.type === 'PLAYER_EVENT') {
        const { event: eventType, currentTime, duration } = event.data.data;
        const meta = JSON.parse(playerIframe.dataset.meta || '{}');
        if (!meta.id) return;

        if (eventType === 'timeupdate') {
          const progressData = {
            id: meta.id,
            currentTime: currentTime,
            duration: duration,
            progress: duration ? (currentTime / duration) * 100 : 0,
            updatedAt: Date.now(),
            mediaType: meta.mediaType,
            title: meta.title || meta.name,
            poster: meta.poster_path ? IMG_URL + meta.poster_path : ''
          };

          const now = Date.now();
          if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
            localStorage.setItem(`progress_${meta.id}`, JSON.stringify(progressData));
            window._lastProgressSave = now;
            if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
              TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressData.progress);
              window._lastTraktScrobble = now;
            }
          }

          if (!window.nextPromptShown && duration > 0) {
            const timeRemaining = duration - currentTime;
            let threshold;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;
            else threshold = 300;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }
        }

        if (eventType === 'ended') {
          if (meta.mediaType === 'tv' || meta.mediaType === 'anime') {
            markEpisodeWatched(meta.id, meta.currentSeason, meta.currentEpisode);
            const icon = document.getElementById(`watch-icon-${meta.id}-${meta.currentSeason}-${meta.currentEpisode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
            const nextPlayBtn = document.querySelector('#next-prompt-container .btn-primary');
            if (nextPlayBtn) nextPlayBtn.click();
          }
        }
      }
    });

    async function showNextPrompt(meta) {
      const container = document.getElementById('next-prompt-container');
      if (!container) return;

      const type = meta.mediaType;
      const id = meta.id;

      if (type === 'tv') {
        // --- TV Series Logic ---
        const season = meta.currentSeason;
        const episode = meta.currentEpisode;
        const server = meta.currentServer;

        // Try next episode in same season
        const seasonData = await fetchApi(`/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`);
        if (!seasonData || !seasonData.episodes) return;

        const nextEpNum = episode + 1;
        const nextEp = seasonData.episodes.find(ep => ep.episode_number === nextEpNum);

        if (nextEp) {
          // Next episode exists in same season
          const isReleased = nextEp.air_date && new Date(nextEp.air_date) <= new Date();
          renderNextPromptToast(container, {
            label: `S${season} E${nextEpNum}`,
            title: nextEp.name,
            image: nextEp.still_path ? IMG_URL + nextEp.still_path : null,
            released: isReleased,
            airDate: nextEp.air_date,
            onPlay: () => {
              dismissNextPrompt();
              openPlayer(id, 'tv', season, nextEpNum, server);
            }
          });
        } else {
          // Last episode of season — check next season
          const showData = await fetchApi(`/tv/${id}?api_key=${TMDB_API_KEY}`);
          if (!showData || !showData.seasons) return;

          const nextSeason = showData.seasons.find(s => s.season_number === season + 1);
          if (!nextSeason) return; // Series finale — do nothing

          const nextSeasonData = await fetchApi(`/tv/${id}/season/${season + 1}?api_key=${TMDB_API_KEY}`);
          if (!nextSeasonData || !nextSeasonData.episodes || nextSeasonData.episodes.length === 0) return;

          const firstEp = nextSeasonData.episodes[0];
          const isReleased = firstEp.air_date && new Date(firstEp.air_date) <= new Date();

          renderNextPromptToast(container, {
            label: `S${season + 1} E1`,
            title: firstEp.name,
            image: firstEp.still_path ? IMG_URL + firstEp.still_path : null,
            released: isReleased,
            airDate: firstEp.air_date,
            onPlay: () => {
              dismissNextPrompt();
              openPlayer(id, 'tv', season + 1, 1, server);
            }
          });
        }

      } else if (type === 'movie') {
        // --- Movie Collection Logic ---
        const collectionId = meta.belongs_to_collection ? meta.belongs_to_collection.id : null;
        if (!collectionId) return; // Standalone movie — do nothing

        const collection = await fetchApi(`/collection/${collectionId}?api_key=${TMDB_API_KEY}`);
        if (!collection || !collection.parts || collection.parts.length < 2) return;

        // Sort parts by release date
        const sorted = collection.parts
          .filter(p => p.release_date)
          .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

        const currentIdx = sorted.findIndex(p => p.id === id);
        if (currentIdx === -1 || currentIdx >= sorted.length - 1) return; // Last in collection — do nothing

        const nextMovie = sorted[currentIdx + 1];
        const isReleased = nextMovie.release_date && new Date(nextMovie.release_date) <= new Date();
        const server = meta.currentServer;

        renderNextPromptToast(container, {
          label: 'Next in Collection',
          title: nextMovie.title,
          image: nextMovie.poster_path ? IMG_URL + nextMovie.poster_path : null,
          released: isReleased,
          airDate: nextMovie.release_date,
          onPlay: () => {
            dismissNextPrompt();
            openPlayer(nextMovie.id, 'movie', 1, 1, server);
          }
        });
      }
    }

    function renderNextPromptToast(container, { label, title, image, released, airDate, onPlay }) {
      const fallbackImg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68' fill='%23333'%3E%3Crect width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-family='sans-serif' font-size='12' text-anchor='middle' dy='.3em'%3ENext%3C/text%3E%3C/svg%3E`;
      const imgSrc = image || fallbackImg;

      let actionHtml;
      if (released) {
        actionHtml = `<button class="next-prompt-btn" id="next-prompt-play-btn">? Play Next</button>`;
      } else {
        const dateStr = airDate ? new Date(airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBA';
        actionHtml = `<div style="font-size: 0.78rem; color: #facc15; margin-top: 4px; font-weight: 600;">Expected: ${dateStr}</div>`;
      }

      container.innerHTML = `
        <div class="next-prompt-toast" id="next-prompt-toast">
          <button class="next-prompt-close" id="next-prompt-close-btn">&times;</button>
          <img class="next-prompt-img" src="${imgSrc}" alt="${title}" onerror="this.onerror=null;this.src='${fallbackImg}';">
          <div class="next-prompt-info">
            <div class="next-prompt-label">${label}</div>
            <div class="next-prompt-title">${title}</div>
            ${actionHtml}
          </div>
        </div>
      `;

      // Attach event listeners
      const closeBtn = document.getElementById('next-prompt-close-btn');
      if (closeBtn) closeBtn?.addEventListener('click', dismissNextPrompt);

      if (released) {
        const playBtn = document.getElementById('next-prompt-play-btn');
        if (playBtn) playBtn?.addEventListener('click', onPlay);
      }

      // Animate in after a short delay
      requestAnimationFrame(() => {
        setTimeout(() => {
          const toast = document.getElementById('next-prompt-toast');
          if (toast) toast.classList.add('visible');
        }, 100);
      });
    }

    function dismissNextPrompt() {
      const toast = document.getElementById('next-prompt-toast');
      if (toast) {
        toast.classList.remove('visible');
        setTimeout(() => {
          const container = document.getElementById('next-prompt-container');
          if (container) container.innerHTML = '';
        }, 400);
      }
    }

    const debouncedSearch = debounce((query) => performSearch(query), 500);
    let gridState = { page: 1, providerId: null, filterType: null, query: null, isLoading: false, hasMore: true };
    let currentDetailsData = null; // Fix for watchlist and other details-based actions
    const gridFilter = document.getElementById('grid-filter');
    const genreFilter = document.getElementById('genre-filter');
    const gridLoader = document.getElementById('grid-loader');
    const scrollSentinel = document.getElementById('scroll-sentinel');

    gridFilter?.addEventListener('change', () => {
      gridState.page = 1;
      gridState.hasMore = true;
      searchGrid.innerHTML = '';
      fetchGridPage();
    });

    genreFilter?.addEventListener('change', () => {
      gridState.page = 1;
      gridState.hasMore = true;
      searchGrid.innerHTML = '';
      fetchGridPage();
    });

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && searchResultsContainer.classList.contains('active') && !detailsView.classList.contains('active')) {
        fetchGridPage();
      }
    }, { rootMargin: '300px' });

    const rowObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          rowObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    // Defer observation until DOM is fully loaded in initApp.

    const backToTop = document.getElementById('back-to-top');

    backToTop?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    // iOS CENTERING FIX: Helpers that prevent the "content shifts right" bug.
    // On desktop/Android: when overflow:hidden removes the scrollbar, we add
    // padding-right equal to the scrollbar width so layout doesn't shift.
    // On iOS: there is no real scrollbar, so we skip compensation entirely.
    // Using a CSS class + padding-right approach is more reliable than
    // setting body.style.overflow directly, because iOS sometimes recalculates
    // viewport width when overflow changes, causing a phantom right-shift.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function lockScroll() {
      if (isIOS) {
        // On iOS: just fix the body in place using position:fixed trick
        // (overflow:hidden alone doesn't prevent iOS bounce/scroll)
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.dataset.scrollY = scrollY;
      } else {
        // On desktop/Android: compensate for scrollbar disappearing
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }
    }

    function unlockScroll() {
      if (isIOS) {
        const scrollY = parseFloat(document.body.dataset.scrollY || '0');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    }


    let scrollTicking = false;
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          if (scrollY > 50) navbar.classList.add('scrolled');
          else navbar.classList.remove('scrolled');
          if (backToTop) {
            if (scrollY > 500) backToTop.classList.add('visible');
            else backToTop.classList.remove('visible');
          }
          // Parallax only on non-touch devices
          if (!isTouchDevice && scrollY < window.innerHeight && hero) {
            hero.style.transform = `translateY(${scrollY * 0.3}px)`;
          }
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });

    async function fetchApi(endpoint) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) {
          if (response.status === 429) {
            console.warn("TMDB API Rate Limit Exceeded (429).");
            alert("Rate limit exceeded. Please wait a moment before trying again.");
          }
          return null;
        }
        return await response.json();
      } catch (error) {
        return null;
      }
    }

    function handleWatchlistToggle() {
      if (!currentDetailsData) return;
      const added = toggleWatchlist(currentDetailsData);
      const btn = document.getElementById('watchlist-toggle-btn');
      if (btn) btn.textContent = added ? '✔ In My List' : '+ My List';
    }

    function renderWatchlistRow() {
      // Remove existing watchlist row if any
      const existing = document.querySelector('.row[data-row-type="My List"]');
      if (existing) existing.remove();

      const list = getWatchlist();
      if (list.length > 0) {
        // Find "Trending Now" row and insert before it, or just append
        const trending = document.querySelector('.row[data-row-type="Trending Now"]');
        createRow("My List", list, null, false);
        const newRow = document.querySelector('.row[data-row-type="My List"]');
        if (trending && newRow) {
          rowsContainer.insertBefore(newRow, trending);
        }
      }
    }

    function cleanupProgressStorage() {
      try {
        const progressKeys = [];
        const watchedSeriesKeys = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('progress_')) {
            progressKeys.push(key);
          } else if (key && key.startsWith('watched_series_')) {
            watchedSeriesKeys.push(key);
          }
        }

        // Cleanup progress_ keys
        if (progressKeys.length > 50) {
          const items = progressKeys.map(k => {
            try { return { key: k, data: JSON.parse(localStorage.getItem(k)) }; }
            catch (e) { return { key: k, data: { updatedAt: 0 } }; }
          });
          items.sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
          const toRemove = items.slice(50);
          toRemove.forEach(item => localStorage.removeItem(item.key));
        }

        // Cleanup watched_series_ keys
        if (watchedSeriesKeys.length > 50) {
          const items = watchedSeriesKeys.map(k => {
            try { return { key: k, data: JSON.parse(localStorage.getItem(k)) }; }
            catch (e) { return { key: k, data: { _updatedAt: 0 } }; }
          });
          items.sort((a, b) => (b.data._updatedAt || 0) - (a.data._updatedAt || 0));
          const toRemove = items.slice(50);
          toRemove.forEach(item => localStorage.removeItem(item.key));
        }
      } catch (e) {
        console.warn('Cleanup failed:', e);
      }
    }

    async function initApp() {
      if (window.location.pathname.includes('iptv.html')) return;
      cleanupProgressStorage();
      detectAdBlocker();

      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');

      if (window.location.pathname.includes('details.html')) {
        const id = params.get('id');
        const type = params.get('type') || 'movie';
        
        if (id) {
          history.replaceState({ view: 'details', id, type }, '', window.location.href);
          renderState({ view: 'details', id, type });
        } else {
          // If they land on details.html without an ID, kick them home
          window.location.href = window.getRootPath() + 'index.html';
        }
        return;
      }

      let initialStateRendered = false;

      if (viewParam === 'grid') {
        const title = params.get('title') || 'Movies';
        const filterType = params.get('filterType') || 'movie';
        history.replaceState({ view: 'grid', title, filterType }, '', window.location.href);
        renderState({ view: 'grid', title, filterType });
        initialStateRendered = true;
      } else if (viewParam === 'anime') {
        history.replaceState({ view: 'anime' }, '', window.location.href);
        renderState({ view: 'anime' });
        initialStateRendered = true;
      } else if (viewParam === 'sports') {
        history.replaceState({ view: 'sports' }, '', window.location.href);
        renderState({ view: 'sports' });
        initialStateRendered = true;
      } else if (viewParam === 'search') {
        const q = params.get('q');
        if (q) {
          history.replaceState({ view: 'search', query: q }, '', window.location.href);
          renderState({ view: 'search', query: q });
          initialStateRendered = true;
        }
      }


      rowsContainer.innerHTML = `
        <div class="row">
          <h2 class="row-title skeleton-text" style="width: 150px; margin-left: 4%; height: 30px; margin-bottom: 20px;"></h2>
          <div class="row-posters" style="overflow: hidden; padding-top: 0;">
            ${Array(10).fill('<div class="skeleton skeleton-card" style="width: 200px; height: 300px; flex-shrink: 0; border-radius: 12px;"></div>').join('')}
          </div>
        </div>
        <div class="row">
          <h2 class="row-title skeleton-text" style="width: 200px; margin-left: 4%; height: 30px; margin-bottom: 20px;"></h2>
          <div class="row-posters" style="overflow: hidden; padding-top: 0;">
            ${Array(10).fill('<div class="skeleton skeleton-card" style="width: 200px; height: 300px; flex-shrink: 0; border-radius: 12px;"></div>').join('')}
          </div>
        </div>
      `;

      const trending = await fetchApi(`/trending/all/week?api_key=${TMDB_API_KEY}`);
      if (trending && trending.results.length > 0) {
        setupHero(trending.results[0]);
        startHeroRotation(trending.results);
      }

      rowsContainer.innerHTML = ''; // Clear skeletons

      renderContinueWatching();
      renderWatchlistRow();

      // Smart Poster Recovery: fix watchlist items pulled from Supabase that are missing poster/title
      (async function recoverWatchlistPosters() {
        try {
          let list = getWatchlist();
          const needsRecovery = list.filter(item => !item.poster_path || !item.vote_average);
          if (needsRecovery.length === 0) return;

          let changed = false;
          for (const item of needsRecovery) {
            const type = item.media_type || 'movie';
            const data = await fetchApi(`/${type}/${item.id}?api_key=${TMDB_API_KEY}`);
            if (data) {
              const idx = list.findIndex(i => i.id == item.id);
              if (idx > -1) {
                if (data.poster_path && !list[idx].poster_path) { list[idx].poster_path = data.poster_path; changed = true; }
                if (data.title || data.name) { list[idx].title = data.title || data.name || list[idx].title; changed = true; }
                if (data.vote_average && !list[idx].vote_average) { list[idx].vote_average = data.vote_average; changed = true; }
                if (data.release_date || data.first_air_date) { list[idx].release_date = data.release_date || data.first_air_date || list[idx].release_date; changed = true; }
              }
            }
          }
          if (changed) {
            localStorage.setItem('watchlist', JSON.stringify(list));
            renderWatchlistRow();
            // Also update Supabase with the recovered data
            if (typeof SupabaseSync !== 'undefined') {
              SupabaseSync.syncAllToCloud();
            }
          }
        } catch (e) {
          console.warn('Watchlist poster recovery failed:', e);
        }
      })();

      if (trending) createRow("Trending Now", trending.results);

      const providers = [
        { id: 8, name: "Netflix" },
        { id: 9, name: "Amazon Prime Video" },
        { id: 337, name: "Disney+" },
        { id: 350, name: "Apple TV+" },
        { id: 384, name: "HBO Max" },
        { id: 15, name: "Hulu" }
      ];

      const providerResults = await Promise.all(
        providers.map(p => fetchProviderData(p.id))
      );

      providers.forEach((p, index) => {
        if (providerResults[index] && providerResults[index].length > 0) {
          createRow(p.name, providerResults[index].slice(0, 20), null, false, p.id);
        }
      });

      // Trending Anime Row
      const animeTrending = await fetchApi(`/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc`);
      if (animeTrending) createRow("Trending Anime", animeTrending.results.slice(0, 20), 'tv');

      // Load Genres
      loadGenreList();

      // Ensure initial UI state is correct
      if (!initialStateRendered) {
        renderState({ view: 'home' }, false);
      }

      // Initialize Nav Click Listeners
      navItems[0].onclick = () => updateState({ view: 'home' });
      navItems[1].onclick = () => loadGrid("Popular Movies", null, 'movie');
      navItems[2].onclick = () => loadGrid("TV Shows", null, 'tv');
      navItems[3].onclick = () => updateState({ view: 'anime' });
      navItems[4].onclick = () => updateState({ view: 'sports' });
      navItems[5].onclick = () => loadGrid("My List", null, 'watchlist');

      window.renderContinueWatching = renderContinueWatching;

      // Background Sync for Continue Watching on Page Load
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseAuth !== 'undefined') {
        SupabaseAuth.getUser().then(user => {
          if (user) {
            SupabaseSync.pullAllFromCloud().then(() => {
              if ((!history.state || history.state.view === 'home') && typeof window.renderContinueWatching === 'function') {
                window.renderContinueWatching();
              }
            }).catch(e => console.warn('Background sync failed:', e));
          }
        });
      }

      observer.observe(scrollSentinel);
    }

    async function fetchProviderData(providerId) {
      const movieRes = await fetchApi(`/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${providerId}&watch_region=US`);
      const tvRes = await fetchApi(`/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=${providerId}&watch_region=US`);

      const movies = movieRes ? movieRes.results.map(m => ({ ...m, media_type: 'movie' })) : [];
      const tvs = tvRes ? tvRes.results.map(t => ({ ...t, media_type: 'tv' })) : [];

      let combined = [...movies, ...tvs];
      // Exclude items with no poster to keep grid clean
      return combined.filter(c => c.poster_path != null).sort((a, b) => b.popularity - a.popularity);
    }

    function setupHero(item, index = 0) {
      const title = item.title || item.name || item.original_name;
      const type = item.media_type || (item.title ? 'movie' : 'tv');
      const heroBg = document.getElementById('hero-bg');

      // Remove skeleton classes when data is loaded
      document.getElementById('hero-skeleton-bg')?.remove();
      document.getElementById('hero-title').classList.remove('skeleton-text');
      document.getElementById('hero-desc').classList.remove('skeleton-text');
      document.getElementById('hero-buttons').style.opacity = '1';
      document.getElementById('hero-buttons').style.pointerEvents = 'auto';
      document.getElementById('hero-title').style.minHeight = 'auto';
      document.getElementById('hero-desc').style.minHeight = 'auto';

      if (heroBg) {
        heroBg.style.opacity = '1';
        heroBg.style.backgroundImage = `url(${IMG_URL_BG}${item.backdrop_path})`;
        // Reset animation
        heroBg.style.animation = 'none';
        heroBg.offsetHeight; /* trigger reflow */
        heroBg.style.animation = null;
      }
      heroTitle.textContent = title;
      heroDesc.textContent = item.overview;

      heroPlay.onclick = () => openDetails(item.id, type);
      const heroInfo = document.getElementById('hero-info');
      if (heroInfo) heroInfo.onclick = () => openDetails(item.id, type);

      document.querySelectorAll('.hero-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === index);
      });
    }

    let heroIndex = 0;
    let heroItems = [];
    let heroTimer;

    function updateHeroDisplay() {
      hero.style.opacity = 0.5;
      setTimeout(() => {
        setupHero(heroItems[heroIndex], heroIndex);
        hero.style.opacity = 1;
      }, 500);
    }

    function resetHeroTimer() {
      if (heroTimer) clearInterval(heroTimer);
      heroTimer = setInterval(() => {
        heroIndex = (heroIndex + 1) % heroItems.length;
        updateHeroDisplay();
      }, 10000);
    }

    function startHeroRotation(items) {
      heroItems = items.slice(0, 5); // Rotate top 5

      const dotsContainer = document.getElementById('hero-dots');
      if (dotsContainer) {
        dotsContainer.innerHTML = '';
        heroItems.forEach((_, idx) => {
          const dot = document.createElement('div');
          dot.className = `hero-dot ${idx === 0 ? 'active' : ''}`;
          dot.onclick = () => {
            heroIndex = idx;
            updateHeroDisplay();
            resetHeroTimer();
          };
          dotsContainer.appendChild(dot);
        });
      }

      const prevBtn = document.getElementById('hero-prev');
      const nextBtn = document.getElementById('hero-next');

      if (prevBtn) {
        prevBtn.onclick = () => {
          heroIndex = (heroIndex - 1 + heroItems.length) % heroItems.length;
          updateHeroDisplay();
          resetHeroTimer();
        };
      }

      if (nextBtn) {
        nextBtn.onclick = () => {
          heroIndex = (heroIndex + 1) % heroItems.length;
          updateHeroDisplay();
          resetHeroTimer();
        };
      }

      resetHeroTimer();
    }

    function getContinueWatching() {
      try { return JSON.parse(localStorage.getItem('continue_watching')) || []; }
      catch (e) { return []; }
    }

    function getProgressForId(id) {
      try { return JSON.parse(localStorage.getItem(`progress_${id}`)); }
      catch (e) { return null; }
    }

    function toggleSeasonWatched(id, season) {
      if (!window.currentSeasonData || !window.currentSeasonData.episodes) return;
      try {
        const key = `watched_series_${id}`;
        const seriesData = JSON.parse(localStorage.getItem(key) || '{}');
        const watchedInSeason = seriesData[season] || [];

        const allEpisodes = window.currentSeasonData.episodes.map(ep => parseInt(ep.episode_number));

        // Check if all episodes are already watched
        const allWatched = allEpisodes.every(epNum => watchedInSeason.includes(epNum));

        if (allWatched) {
          // Unmark all
          seriesData[season] = watchedInSeason.filter(epNum => !allEpisodes.includes(epNum));
          if (seriesData[season].length === 0) delete seriesData[season];
        } else {
          // Mark all
          seriesData[season] = [...new Set([...watchedInSeason, ...allEpisodes])];
        }

        seriesData._updatedAt = Date.now();
        localStorage.setItem(key, JSON.stringify(seriesData));

        // Update the switch state if it exists
        const toggle = document.getElementById('season-watch-toggle');
        if (toggle) toggle.checked = !allWatched;

        // Instantly update dropdown option text
        const seasonSelect = document.getElementById('season-select');
        if (seasonSelect) {
          const option = seasonSelect.querySelector(`option[value="${season}"]`);
          if (option) {
            let baseText = option.innerText.replace(/ ✔| ►/g, '');
            option.innerText = baseText + (!allWatched ? ' ✔' : '');
          }
        }

        // Instantly update all episode icons on the screen
        const icons = document.querySelectorAll(`[id^="watch-icon-${id}-${season}-"]`);
        icons.forEach(icon => {
          if (allWatched) {
            icon.style.color = 'rgba(255,255,255,0.4)';
            icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
          } else {
            icon.style.color = '#46d369';
            icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
          }
        });
      } catch (e) { console.error(e); }
    }

    function markEpisodeWatched(id, season, episode) {
      try {
        const key = `watched_series_${id}`;
        const seriesData = JSON.parse(localStorage.getItem(key) || '{}');
        if (!seriesData[season]) seriesData[season] = [];
        if (!seriesData[season].includes(parseInt(episode))) {
          seriesData[season].push(parseInt(episode));
          if (typeof TraktSync !== 'undefined') {
            TraktSync.markWatched(id, 'tv', season, episode);
          }
        }
        seriesData._updatedAt = Date.now();
        localStorage.setItem(key, JSON.stringify(seriesData));
      } catch (e) { }
    }

    function unmarkEpisodeWatched(id, season, episode) {
      try {
        const key = `watched_series_${id}`;
        const seriesData = JSON.parse(localStorage.getItem(key) || '{}');
        if (seriesData[season]) {
          seriesData[season] = seriesData[season].filter(ep => ep !== parseInt(episode));
          if (seriesData[season].length === 0) delete seriesData[season];
          seriesData._updatedAt = Date.now();
          localStorage.setItem(key, JSON.stringify(seriesData));
        }
      } catch (e) { }
    }

    function isEpisodeWatched(id, season, episode, preloadedSeriesData = null) {
      try {
        let seriesData = preloadedSeriesData;
        if (!seriesData) {
          const key = `watched_series_${id}`;
          seriesData = JSON.parse(localStorage.getItem(key) || '{}');
        }
        return seriesData[season] && seriesData[season].includes(parseInt(episode));
      } catch (e) { return false; }
    }

    function toggleWatched(event, id, season, episode, fromCard = false) {
      if (event && !fromCard) event.stopPropagation();
      const isWatched = isEpisodeWatched(id, season, episode);

      if (fromCard && isWatched) return;

      if (isWatched) {
        unmarkEpisodeWatched(id, season, episode);
      } else {
        markEpisodeWatched(id, season, episode);
      }

      const icon = document.getElementById(`watch-icon-${id}-${season}-${episode}`);
      if (icon) {
        if (!isWatched) {
          icon.style.color = '#46d369';
          icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
        } else {
          icon.style.color = 'rgba(255,255,255,0.4)';
          icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
      }
    }

    function getWatchlist() {
      try {
        const list = JSON.parse(localStorage.getItem('watchlist')) || [];
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return list;
      } catch (e) { return []; }
    }

    function toggleWatchlist(item) {
      let list = getWatchlist();
      const idx = list.findIndex(i => i.id == item.id);
      const type = item.media_type || (item.title ? 'movie' : 'tv');
      if (idx > -1) {
        list.splice(idx, 1);
        if (typeof TraktSync !== 'undefined') TraktSync.removeFromWatchlist(item.id, type);
        if (typeof SupabaseSync !== 'undefined') SupabaseSync.removeWatchlist(item.id, type);
      } else {
        list.push({
          id: item.id,
          media_type: type,
          title: item.title || item.name || item.original_name,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          release_date: item.release_date || item.first_air_date,
          timestamp: Date.now()
        });
        if (typeof TraktSync !== 'undefined') TraktSync.addToWatchlist(item.id, type);
        if (typeof SupabaseSync !== 'undefined') SupabaseSync.addWatchlist(item.id, type, item.title || item.name || item.original_name, item.poster_path);
      }
      localStorage.setItem('watchlist', JSON.stringify(list));
      renderWatchlistRow();
      return idx === -1; // returns true if added
    }

    function isInWatchlist(id) {
      return getWatchlist().some(item => item.id == id);
    }



    const UNIFIED_GENRES = [
      { name: 'Action', movie: '28', tv: '10759' },
      { name: 'Adventure', movie: '12', tv: '10759' },
      { name: 'Animation', movie: '16', tv: '16' },
      { name: 'Comedy', movie: '35', tv: '35' },
      { name: 'Crime', movie: '80', tv: '80' },
      { name: 'Documentary', movie: '99', tv: '99' },
      { name: 'Drama', movie: '18', tv: '18' },
      { name: 'Family', movie: '10751', tv: '10751' },
      { name: 'Fantasy', movie: '14', tv: '10765' },
      { name: 'History', movie: '36', tv: '36' },
      { name: 'Horror', movie: '27', tv: '27' },
      { name: 'Music', movie: '10402', tv: '10402' },
      { name: 'Mystery', movie: '9648', tv: '9648' },
      { name: 'Romance', movie: '10749', tv: '10749' },
      { name: 'Sci-Fi', movie: '878', tv: '10765' },
      { name: 'Thriller', movie: '53', tv: '53' },
      { name: 'War', movie: '10752', tv: '10768' },
      { name: 'Western', movie: '37', tv: '37' }
    ];

    async function loadGenreList() {
      // Unified genres replace dynamic TMDB lists to guarantee symmetry and separate combined genres.
      window.movieGenres = UNIFIED_GENRES.map(g => ({ id: g.movie, name: g.name }));
      window.tvGenres = UNIFIED_GENRES.map(g => ({ id: g.tv, name: g.name }));
    }

    // Load Genres immediately
    loadGenreList();

    function populateGenreFilter(type) {
      const genres = type === 'movie' ? window.movieGenres : window.tvGenres;
      genreFilter.innerHTML = '<option value="">All Genres</option>';
      if (genres) {
        genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          genreFilter.appendChild(opt);
        });
      }
    }

    function createRow(title, items, forceType = null, isContinueWatching = false, providerId = null) {
      if (!items || items.length === 0) return;
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.rowType = title;

      const h2 = document.createElement('h2');
      h2.className = 'row-title';
      h2.textContent = title;
      row.appendChild(h2);

      const posters = document.createElement('div');
      posters.className = 'row-posters';

      const leftBtn = document.createElement('button');
      leftBtn.className = 'scroll-btn scroll-left';
      leftBtn.innerHTML = '&#10094;';
      leftBtn.onclick = () => posters.scrollBy({ left: -posters.clientWidth, behavior: 'smooth' });

      const rightBtn = document.createElement('button');
      rightBtn.className = 'scroll-btn scroll-right';
      rightBtn.innerHTML = '&#10095;';
      rightBtn.onclick = () => posters.scrollBy({ left: posters.clientWidth, behavior: 'smooth' });

      items.forEach(item => {
        if (!item.poster_path && !isContinueWatching) return;
        const type = forceType || item.mediaType || item.media_type || (item.title ? 'movie' : 'tv');
        const itemTitle = item.title || item.name || item.original_name || "Unknown";

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openDetails(item.id, type);

        // Badges
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-badge badge-type';
        typeBadge.textContent = type === 'movie' ? 'Movie' : 'TV';
        card.appendChild(typeBadge);

        if (item.vote_average) {
          const ratingBadge = document.createElement('div');
          ratingBadge.className = 'card-badge badge-rating';
          ratingBadge.textContent = `★ ${item.vote_average.toFixed(1)}`;
          card.appendChild(ratingBadge);
        }

        const img = document.createElement('img');
        const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" fill="%23222"><rect width="100%25" height="100%25"/><text x="50%25" y="50%25" fill="%23666" font-family="sans-serif" font-size="40" text-anchor="middle" dy=".3em">No Image</text></svg>`;
        const imgSrc = item.poster_path ? `${IMG_URL}${item.poster_path}` : placeholderSvg;
        img.src = imgSrc;
        img.alt = itemTitle;
        img.loading = 'lazy';

        const ambientGlow = document.createElement('div');
        ambientGlow.className = 'ambient-glow';
        ambientGlow.style.backgroundImage = `url('${imgSrc}')`;
        card.appendChild(ambientGlow);
        card.appendChild(img);

        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
          <div class="card-title">${itemTitle}</div>
        `;
        card.appendChild(info);

        const playOverlay = document.createElement('div');
        playOverlay.className = 'card-play-overlay';
        playOverlay.innerHTML = '<div class="card-play-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>';
        card.appendChild(playOverlay);

        if (isContinueWatching && item.progressValue) {
          const prog = document.createElement('div');
          prog.className = 'card-progress';
          prog.innerHTML = `<div class="card-progress-bar" style="width: ${item.progressValue}%"></div>`;
          card.appendChild(prog);
        }
        posters.appendChild(card);
      });

      if (providerId) {
        const viewAll = document.createElement('div');
        viewAll.className = 'card view-all-card';
        viewAll.innerHTML = `<span>View All →</span>`;
        viewAll.onclick = () => loadGrid(title, providerId);
        posters.appendChild(viewAll);
      }

      row.appendChild(leftBtn);
      row.appendChild(posters);
      row.appendChild(rightBtn);

      if (isContinueWatching) {
        rowsContainer.insertBefore(row, rowsContainer.firstChild);
      } else {
        rowsContainer.appendChild(row);
      }

      // Observe for entrance animation
      rowObserver.observe(row);
    }

    function showFilter(show) {
      if (show) gridFilter.classList.remove('hidden');
      else gridFilter.classList.add('hidden');
    }

    function showGenreFilter(show) {
      if (show) genreFilter.classList.remove('hidden');
      else genreFilter.classList.add('hidden');
    }

    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (window.location.pathname.includes('iptv.html')) {
        if (query.length > 0) clearSearchBtn.classList.add('active');
        else clearSearchBtn.classList.remove('active');
        return; // Let iptv.js handle the search natively
      }

      if (sportsContainer.style.display === 'block') {
        if (query.length > 0) {
          clearSearchBtn.classList.add('active');
        } else {
          clearSearchBtn.classList.remove('active');
        }
        if (window.filterSports) window.filterSports(query);
        return;
      }

      if (query.length > 0) {
        clearSearchBtn.classList.add('active');
        debouncedSearch(query);
      } else {
        clearSearchBtn.classList.remove('active');
        if (!detailsView.classList.contains('active')) {
          if (history.state && history.state.view === 'search') history.back();
          else showMainContent();
        }
      }
    });

    clearSearchBtn?.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });

    if (detailsSearchInput) {
      detailsSearchInput?.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.trim().length > 0) {
          detailsClearSearch.classList.add('active');
          debouncedSearch(query.trim());
        } else {
          detailsClearSearch.classList.remove('active');
          if (history.state && history.state.view === 'search') history.back();
        }
      });
    }

    if (detailsClearSearch) {
      detailsClearSearch?.addEventListener('click', () => {
        detailsSearchInput.value = '';
        detailsClearSearch.classList.remove('active');
        detailsSearchInput.focus();
        if (history.state && history.state.view === 'search') history.back();
      });
    }

    if (detailsSearchInput) {
      detailsSearchInput?.addEventListener('focus', () => {
        if (detailsSearchContainer.classList.contains('collapsed')) {
          detailsSearchContainer.classList.remove('collapsed');
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (detailsSearchContainer && detailsSearchContainer.classList.contains('active') && !detailsSearchContainer.contains(e.target)) {
        if (detailsSearchInput && detailsSearchInput.value === '') {
          detailsSearchContainer.classList.add('collapsed');
        }
      }
    });

    if (homeLink) {
      homeLink?.addEventListener('click', (e) => {
        e.preventDefault();
        if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html'))) {
          window.location.href = window.getRootPath() + 'index.html';
        } else {
          searchInput.value = '';
          globalGoBack('home');
        }
      });
    }

    navItems.forEach(li => {
      li?.addEventListener('click', () => {
        const text = li.textContent.trim().toLowerCase();
        
        if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html'))) {
          let qs = '';
          if (text === 'movies') qs = '?view=grid&title=Movies&filterType=movie';
          else if (text === 'tv') qs = '?view=grid&title=TV Shows&filterType=tv';
          else if (text === 'anime') qs = '?view=anime';
          else if (text === 'live sports') qs = '?view=sports';
          else if (text === 'iptv') { window.location.href = window.getPagePath('iptv.html') + ''; return; }
          else if (text === 'my list') qs = '?view=grid&title=My%20List&filterType=watchlist';
          
          window.location.href = window.getRootPath() + `index.html${qs}`;
          return;
        }

        navItems.forEach(n => n.classList.remove('active'));
        li.classList.add('active');

        if (text === 'home') updateState({ view: 'home' });
        else if (text === 'movies') updateState({ view: 'grid', title: "Movies", filterType: 'movie' });
        else if (text === 'tv') updateState({ view: 'grid', title: "TV Shows", filterType: 'tv' });
        else if (text === 'anime') updateState({ view: 'anime' });
        else if (text === 'live sports') updateState({ view: 'sports' });
        else if (text === 'iptv') window.location.href = window.getPagePath('iptv.html') + '';
        else if (text === 'my list') updateState({ view: 'grid', title: "My List", filterType: 'watchlist' });
      });
    });

    if (globalBackBtn) {
      globalBackBtn?.addEventListener('click', () => {
        // If we're in details view and came from a grid/search, go back to that
        // Otherwise go back to home
        if (history.state) {
          history.back();
        } else {
          updateState({ view: 'home' });
        }
      });
    }

    function updateState(state, push = true) {
      if (push) {
        if (history.state) {
          const oldState = history.state;
          oldState.scrollY = window.scrollY;
        if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html'))) {
          history.replaceState(oldState, '', window.location.search);
        } else {
          history.replaceState(oldState, '', window.location.pathname + window.location.hash);
        }
      }
      
      if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html'))) {
        let qs = window.location.search; // Keep current query by default
        if (state.view === 'details') {
          qs = `?id=${state.id}&type=${state.type}`;
        }
        if (history.state && history.state.view === 'search' && state.view === 'search') {
          history.replaceState(state, '', qs);
        } else {
          history.pushState(state, '', qs);
        }
      } else {
        let hash = '#home';
        if (state.view === 'grid') hash = `#grid-${state.filterType || 'all'}`;
        else if (state.view === 'anime') hash = '#anime';
        else if (state.view === 'sports') hash = '#sports';
        else if (state.view === 'search') hash = `#search-${encodeURIComponent(state.query || '')}`;
        else if (state.view === 'actor') hash = `#actor-${state.actorId}`;
        else if (state.view === 'similar_all') hash = `#similar-${state.sourceType}-${state.sourceId}`;
        else if (state.view === 'details') hash = `#details-${state.type}-${state.id}`;

        if (history.state && history.state.view === 'search' && state.view === 'search') {
          history.replaceState(state, '', window.location.pathname + hash);
        } else {
          history.pushState(state, '', window.location.pathname + hash);
        }
      }
      }
      renderState(state);
    }

    window.addEventListener('popstate', (e) => {
      let trapped = false;
      let isPlayerPop = false;

      if (playerModal.classList.contains('active')) {
        closePlayerModal(true);
        isPlayerPop = true;
      }
      if (serverSelectionModal.classList.contains('active')) {
        closeServerModal();
        trapped = true;
      }
      const subDubModal = document.getElementById('sub-dub-modal');
      if (subDubModal && subDubModal.style.display === 'flex') {
        closeSubDubModal();
        trapped = true;
      }
      const autoCheckOverlay = document.getElementById('auto-check-overlay');
      if (autoCheckOverlay && autoCheckOverlay.style.display === 'flex') {
        cancelAutoCheck();
        trapped = true;
      }

      if (trapped) {
        // The browser popped the stack. We push the exact same state back so the URL
        // stays the same and the user doesn't accidentally navigate backwards.
        if (window.lastAppState) {
          history.pushState(window.lastAppState, '', window.location.href);
        }
        return;
      }

      if (isPlayerPop) {
        // Player was popped cleanly. State is already correct underneath.
        window.lastAppState = e.state || { view: 'home' };
        return;
      }

      const state = e.state || { view: 'home' };
      window.lastAppState = state;
      renderState(state);
    });

    function renderState(state) {
      window.lastAppState = state;
      const { view, id, type, title, providerId, filterType, query } = state;

      // Clean up zombie background trailer
      const bgTrailer = document.getElementById('bg-trailer');
      if (bgTrailer && !bgTrailer.paused) {
        bgTrailer.pause();
        bgTrailer.removeAttribute('src');
        bgTrailer.load();
      }

      // Keep details search bar active if we are actively typing in it
      const isTypingInDetails = document.activeElement === detailsSearchInput && detailsSearchInput.value.length > 0;

      // Reset all views
      mainContent.classList.add('hidden');
      searchResultsContainer.classList.remove('active');
      detailsView.classList.remove('active');
      if (serverTestView) serverTestView.classList.add('hidden');
      navbar.classList.remove('hidden');
      globalBackBtn.classList.remove('active');
      sportsContainer.style.display = 'none';
      navItems.forEach(n => n.classList.remove('active'));

      const homeSearch = document.querySelector('.search-container');
      if (isTypingInDetails) {
        detailsSearchContainer.classList.add('active');
        detailsSearchContainer.classList.remove('collapsed');
        if (homeSearch) homeSearch.style.display = 'none';
      } else {
        detailsSearchContainer.classList.remove('active');
        if (homeSearch) homeSearch.style.display = 'flex';
      }

      if (view === 'home') {
        mainContent.classList.remove('hidden');
        navItems[0].classList.add('active');
        searchInput.value = '';
        showFilter(false);
        showGenreFilter(false);
        window.scrollTo(0, 0);
      } else if (view === 'grid') {
        const isSameGrid = gridState.filterType === (filterType || null) && gridState.providerId === (providerId || null) && searchGrid.innerHTML !== '';

        searchResultsContainer.classList.add('active');
        document.getElementById('search-query-display').innerText = title;

        if (!isSameGrid) {
          gridState = { page: 1, providerId: providerId || null, filterType: filterType || null, query: null, isLoading: false, hasMore: true };
          searchGrid.innerHTML = '';
          fetchGridPage();
        }

        if (state.scrollY) setTimeout(() => window.scrollTo(0, state.scrollY), 50);
        else window.scrollTo(0, 0);

        if (filterType === 'movie' || filterType === 'tv') {
          showFilter(true);
          showGenreFilter(true);
          populateGenreFilter(filterType);
        } else {
          showFilter(false);
          showGenreFilter(false);
        }

        if (!isSameGrid && filterType === 'movie') navItems[1].classList.add('active');
        else if (!isSameGrid && filterType === 'tv') navItems[2].classList.add('active');
        else if (!isSameGrid && filterType === 'anime') navItems[3].classList.add('active');
        else if (!isSameGrid && filterType === 'watchlist') navItems[6].classList.add('active');
        else if (filterType === 'watchlist') navItems[6].classList.add('active');
      } else if (view === 'sports') {
        sportsContainer.style.display = 'block';
        navItems[4].classList.add('active');
        window.scrollTo(0, 0);

        if (!window.sportsInitialized) {
          window.sportsInitialized = true;
          switchSportsTab('channels');
        }
      } else if (view === 'anime') {
        const isSameGrid = gridState.filterType === 'anime' && searchGrid.innerHTML !== '';
        searchResultsContainer.classList.add('active');
        document.getElementById('search-query-display').innerText = 'Anime World';

        if (!isSameGrid) {
          gridState = { page: 1, providerId: null, filterType: 'anime', query: null, isLoading: false, hasMore: true };
          searchGrid.innerHTML = '';
          fetchGridPage();
        }

        showFilter(false); // We want specific sorting for anime
        showGenreFilter(false);
        navItems[3].classList.add('active');

        if (state.scrollY) setTimeout(() => window.scrollTo(0, state.scrollY), 50);
        else window.scrollTo(0, 0);
      } else if (view === 'search' || view === 'actor') {
        const expectedFilterType = view === 'actor' ? 'actor' : null;
        const isSameGrid = gridState.query === query && gridState.filterType === expectedFilterType && gridState.actorId === (state.actorId || null) && searchGrid.innerHTML !== '';

        document.getElementById('search-query-display').innerText = view === 'actor' ? `Movies & TV with ${query}` : `Search Results for "${query}"`;
        searchResultsContainer.classList.add('active');
        globalBackBtn.classList.add('active');
        showFilter(true);
        showGenreFilter(false);

        if (!isSameGrid) {
          gridState = {
            page: 1, providerId: null, filterType: expectedFilterType,
            query: query, actorId: state.actorId || null, isLoading: false, hasMore: true
          };
          searchGrid.innerHTML = '';
          fetchGridPage();
        }

        if (state.scrollY) setTimeout(() => window.scrollTo(0, state.scrollY), 50);
        else window.scrollTo(0, 0);
      } else if (view === 'similar_all') {
        const isSameGrid = gridState.filterType === 'similar_all' && gridState.sourceId === id && gridState.sourceType === type && searchGrid.innerHTML !== '';

        document.getElementById('search-query-display').innerText = `Similar to "${title}"`;
        searchResultsContainer.classList.add('active');
        globalBackBtn.classList.add('active');
        showFilter(false);
        showGenreFilter(false);

        if (!isSameGrid) {
          gridState = {
            page: 1, providerId: null, filterType: 'similar_all',
            sourceId: id, sourceType: type, query: null, isLoading: false, hasMore: true
          };
          searchGrid.innerHTML = '';
          fetchGridPage();
        }

        if (state.scrollY) setTimeout(() => window.scrollTo(0, state.scrollY), 50);
        else window.scrollTo(0, 0);
      } else if (view === 'details') {
        renderDetailsView(id, type);
        navbar.classList.add('hidden');
      } else if (view === 'server_test') {
        renderServerTestView();
        navbar.classList.add('hidden');
      }
    }

    let currentGridFetchId = 0;

    async function fetchGridPage() {
      if (gridState.isLoading || !gridState.hasMore) return;
      gridState.isLoading = true;

      const fetchId = ++currentGridFetchId;

      // Render skeletons only on the first page
      if (gridState.page === 1) {
        searchGrid.innerHTML = Array(20).fill('<div class="skeleton skeleton-card"></div>').join('');
      } else {
        gridLoader.classList.add('active');
      }

      const currentPage = gridState.page;
      gridState.page++;

      const sortType = gridFilter.value;
      let sortVal = 'popularity.desc';
      let extraParams = '';

      if (sortType === 'watched') sortVal = 'vote_count.desc';
      if (sortType === 'top_rated') sortVal = 'vote_average.desc';

      const genreId = genreFilter.value;
      if (genreId) {
        extraParams += `&with_genres=${genreId}`;
      }

      let results = [];
      let totalPages = 1;

      if (gridState.filterType === 'actor') {
        if (currentPage === 1 || !gridState.actorCache) {
          const res = await fetchApi(`/person/${gridState.actorId}/combined_credits?api_key=${TMDB_API_KEY}`);
          if (res && res.cast) {
            gridState.actorCache = res.cast.filter(x => x.poster_path).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          } else {
            gridState.actorCache = [];
          }
        }
        const start = (currentPage - 1) * 20;
        results = gridState.actorCache.slice(start, start + 20);
        totalPages = Math.ceil(gridState.actorCache.length / 20) || 1;
      } else if (gridState.filterType === 'similar_all') {
        const data = await fetchApi(`/${gridState.sourceType}/${gridState.sourceId}/similar?api_key=${TMDB_API_KEY}&page=${currentPage}`);
        if (data) {
          results = data.results.filter(x => x.poster_path).map(x => ({ ...x, media_type: gridState.sourceType }));
          totalPages = data.total_pages;
        }
      } else if (gridState.query) {
        showFilter(false);
        const data = await fetchApi(`/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(gridState.query)}&page=${currentPage}`);
        if (data) {
          results = data.results.filter(i => (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path);
          totalPages = data.total_pages;
        }
      } else if (gridState.providerId) {
        showFilter(false);
        showGenreFilter(false);
        const res = await fetchApi(`/discover/movie?api_key=${TMDB_API_KEY}&with_watch_providers=${gridState.providerId}&watch_region=US&page=${currentPage}`);
        const tvRes = await fetchApi(`/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=${gridState.providerId}&watch_region=US&page=${currentPage}`);
        if (res || tvRes) {
          const m = res ? res.results.map(x => ({ ...x, media_type: 'movie' })) : [];
          const t = tvRes ? tvRes.results.map(x => ({ ...x, media_type: 'tv' })) : [];
          results = [...m, ...t].filter(x => x.poster_path).sort((a, b) => b.popularity - a.popularity);
          totalPages = Math.max(res?.total_pages || 1, tvRes?.total_pages || 1);
        }
      } else if (gridState.filterType === 'movie') {
        let endpoint = '';
        if (genreId) {
          // If genre is selected, use discover as specialized endpoints don't support genres
          endpoint = `/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortVal}${extraParams}&page=${currentPage}`;
        } else {
          if (sortType === 'trending') endpoint = `/trending/movie/week?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else if (sortType === 'upcoming') endpoint = `/movie/upcoming?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else if (sortType === 'top_rated') endpoint = `/movie/top_rated?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else endpoint = `/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortVal}${extraParams}&page=${currentPage}`;
        }

        const res = await fetchApi(endpoint);
        if (res) {
          results = res.results.filter(x => x.poster_path).map(x => ({ ...x, media_type: 'movie' }));
          totalPages = res.total_pages;
        }
      } else if (gridState.filterType === 'tv') {
        let endpoint = '';
        if (genreId) {
          endpoint = `/discover/tv?api_key=${TMDB_API_KEY}&sort_by=${sortVal}${extraParams}&page=${currentPage}`;
        } else {
          if (sortType === 'trending') endpoint = `/trending/tv/week?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else if (sortType === 'upcoming') endpoint = `/tv/on_the_air?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else if (sortType === 'top_rated') endpoint = `/tv/top_rated?api_key=${TMDB_API_KEY}&page=${currentPage}`;
          else endpoint = `/discover/tv?api_key=${TMDB_API_KEY}&sort_by=${sortVal}${extraParams}&page=${currentPage}`;
        }

        const res = await fetchApi(endpoint);
        if (res) {
          results = res.results.filter(x => x.poster_path).map(x => ({ ...x, media_type: 'tv' }));
          totalPages = res.total_pages;
        }
      } else if (gridState.filterType === 'anime') {
        showFilter(false);
        showGenreFilter(false);
        const movieRes = await fetchApi(`/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${currentPage}`);
        const tvRes = await fetchApi(`/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${currentPage}`);
        if (movieRes || tvRes) {
          const m = movieRes ? movieRes.results.map(x => ({ ...x, media_type: 'movie' })) : [];
          const t = tvRes ? tvRes.results.map(x => ({ ...x, media_type: 'tv' })) : [];
          results = [...m, ...t].filter(x => x.poster_path).sort((a, b) => b.popularity - a.popularity);
          totalPages = Math.max(movieRes?.total_pages || 1, tvRes?.total_pages || 1);
        }
      } else if (gridState.filterType === 'watchlist') {
        showFilter(false);
        showGenreFilter(false);
        results = getWatchlist();
        gridState.hasMore = false;
      }

      if (fetchId !== currentGridFetchId) return; // Prevent race conditions on rapid typing

      gridLoader.classList.remove('active');
      gridState.isLoading = false;
      renderGridItems(results, currentPage === 1);

      if (currentPage > totalPages || currentPage > 500) {
        gridState.hasMore = false;
      }

      // After loading, check if we need more to fill the screen (sentinel visibility check)
      if (gridState.hasMore) {
        setTimeout(() => {
          if (scrollSentinel.offsetParent === null || detailsView.classList.contains('active')) return; // Prevent background fetch loop when details are open
          const rect = scrollSentinel.getBoundingClientRect();
          if (rect.top < window.innerHeight + 500) { // Be more aggressive in loading
            fetchGridPage();
          }
        }, 300);
      }
    }


    function loadGrid(title, providerId = null, filterType = null) {
      updateState({ view: 'grid', title, providerId, filterType });
    }

    async function searchByActor(id, name) {
      updateState({ view: 'actor', actorId: id, query: name });
    }

    function performSearch(query) {
      updateState({ view: 'search', query });
    }

    function globalGoBack(forceState = null) {
      if (forceState === 'home') {
        updateState({ view: 'home' });
      } else {
        history.back();
      }
    }

    function renderGridItems(results, replace = false) {
      if (replace) searchGrid.innerHTML = '';
      if (results.length === 0 && replace) {
        searchGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 100px 20px;">
            <svg style="width:80px;height:80px;color:#555;margin-bottom:20px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 style="color:#aaa;font-weight:400;">No results found</h2>
            <p style="color:#666;margin-top:10px;">Try adjusting your search or filters.</p>
          </div>`;
        return;
      }
      
      const fragment = document.createDocumentFragment();
      results.forEach(item => {
        if (!item.poster_path) return;
        const type = item.media_type || (item.title ? 'movie' : 'tv');
        const title = item.title || item.name || item.original_name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openDetails(item.id, type);

        // Badges
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-badge badge-type';
        typeBadge.textContent = type === 'movie' ? 'Movie' : 'TV';
        card.appendChild(typeBadge);

        if (item.vote_average) {
          const ratingBadge = document.createElement('div');
          ratingBadge.className = 'card-badge badge-rating';
          ratingBadge.textContent = `★ ${item.vote_average.toFixed(1)}`;
          card.appendChild(ratingBadge);
        }

        const fallbackPoster = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' fill='%23222'%3E%3Crect width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-family='sans-serif' font-size='16' text-anchor='middle' dy='.3em'%3ENo Poster%3C/text%3E%3C/svg%3E`;
        const img = document.createElement('img');
        const imgSrc = `${IMG_URL}${item.poster_path}`;
        img.src = imgSrc;
        img.onerror = function () { this.onerror = null; this.src = fallbackPoster; };
        img.alt = title;
        img.loading = 'lazy';

        const ambientGlow = document.createElement('div');
        ambientGlow.className = 'ambient-glow';
        ambientGlow.style.backgroundImage = `url('${imgSrc}')`;
        card.appendChild(ambientGlow);
        card.appendChild(img);

        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
          <div class="card-title">${title}</div>
          <div class="card-rating">${year}</div>
        `;
        card.appendChild(info);

        const playOverlay = document.createElement('div');
        playOverlay.className = 'card-play-overlay';
        playOverlay.innerHTML = '<div class="card-play-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>';
        card.appendChild(playOverlay);

        fragment.appendChild(card);
      });
      searchGrid.appendChild(fragment);
    }

    function extractAverageColor(imgSrc) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        // Append cache buster to bypass cached non-CORS image
        img.src = imgSrc + (imgSrc.includes('?') ? '&' : '?') + 'corsbuster=1';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 1;
          canvas.height = 1;
          ctx.drawImage(img, 0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          // Return a slightly vibrant, semi-transparent version of the color
          resolve(`rgba(${data[0]}, ${data[1]}, ${data[2]}, 0.6)`);
        };
        img.onerror = () => resolve('rgba(229, 9, 20, 0.4)'); // Default to primary red
      });
    }

    async function openDetails(id, type) {
      if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html'))) {
        updateState({ view: 'details', id, type });
      } else {
        window.location.href = window.getPagePath('details.html') + `?id=${id}&type=${type}`;
      }
    }

    let currentDetailsFetchId = 0;



    window.currentSeasonData = null;
    window._currentSeasonFetchId = 0;
    const EPISODES_PER_PAGE = 50;

    async function fetchOmdbRatings(imdbId) {
      if (!OMDB_API_KEY || !imdbId) return;
      try {
        const res = await fetch(`https://tmdb-proxy.gametec1290.workers.dev/omdb/?i=${imdbId}`);
        const data = await res.json();
        if (data.Response === "True") {
          const container = document.getElementById('omdb-ratings-container');
          if (!container || container.dataset.imdbId !== imdbId) return;
          if (container.dataset.loaded === 'true') return;
          container.dataset.loaded = 'true';

          let html = '';
          
          // IMDb Rating
          if (data.imdbRating && data.imdbRating !== "N/A") {
            html += `<div class="omdb-badge imdb-badge"><span class="omdb-logo">IMDb</span> ${data.imdbRating}</div>`;
          } else {
            html += `<div class="omdb-badge imdb-badge"><span class="omdb-logo">IMDb</span> N/A</div>`;
          }

          // Rotten Tomatoes & Metacritic
          if (data.Ratings && data.Ratings.length > 0) {
            data.Ratings.forEach(r => {
              if (r.Source === "Rotten Tomatoes") {
                const isFresh = parseInt(r.Value) >= 60 ? 'fresh' : 'rotten';
                html += `<div class="omdb-badge rt-badge ${isFresh}"><span class="omdb-logo"></span> ${r.Value}</div>`;
              }
              if (r.Source === "Metacritic") {
                html += `<div class="omdb-badge mc-badge"><span class="omdb-logo">M</span> ${r.Value.split('/')[0]}</div>`;
              }
            });
          }

          if (html !== '') {
            container.innerHTML += html;
          }
        }
      } catch (err) {
        console.error("OMDb fetch failed:", err);
      }
    }

    async function loadEpisodes(id, season, page = 1) {
      const fetchId = ++window._currentSeasonFetchId;
      const container = document.getElementById('episodes-container');
      if (page === 1) {
        container.innerHTML = `
          <div style="padding: 40px; text-align: center;">
            <div class="spinner" style="margin: 0 auto 15px; width: 30px; height: 30px;"></div>
            <p style="color: #666; font-size: 0.9rem;">Loading episodes...</p>
          </div>`;
        const data = await fetchApi(`/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`);
        if (fetchId !== window._currentSeasonFetchId) return; // Race condition prevented
        if (!data || !data.episodes) {
          container.innerHTML = `
            <div class="error-message" style="padding: 40px;">
              <p>Failed to load episodes for this season.</p>
              <button class="retry-btn" onclick="loadEpisodes(${id}, ${season})">Retry</button>
            </div>`;
          return;
        }
        window.currentSeasonData = data;
      }

      const data = window.currentSeasonData;
      if (!data) return;

      window.currentEpisodePage = page;
      const start = (page - 1) * EPISODES_PER_PAGE;
      const end = start + EPISODES_PER_PAGE;
      const paginatedEpisodes = data.episodes.slice(start, end);

      let chunkDropdownHtml = '';
      if (data.episodes.length > 100) {
        let options = '';
        const chunkCount = Math.ceil(data.episodes.length / 100);
        for (let i = 0; i < chunkCount; i++) {
          const startEp = i * 100 + 1;
          const endEp = Math.min((i + 1) * 100, data.episodes.length);
          const startPage = i * 2 + 1;
          const isSelected = (page === startPage || page === startPage + 1) ? 'selected' : '';
          options += `<option value="${startPage}" ${isSelected}>Episodes ${startEp}-${endEp}</option>`;
        }
        chunkDropdownHtml = `
          <div style="margin-bottom: 15px; display: flex; justify-content: flex-end;">
            <select class="season-select" onchange="loadEpisodes(${id}, ${season}, parseInt(this.value))" style="padding: 8px 12px; background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.9rem;">
              ${options}
            </select>
          </div>
        `;
      }

      const key = `watched_series_${id}`;
      let preloadedSeriesData = {};
      try { preloadedSeriesData = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { }

      // Clean up corrupted array data for this season automatically
      if (data.episodes && preloadedSeriesData[season]) {
        const validEpisodeNumbers = data.episodes.map(ep => parseInt(ep.episode_number));
        const originalLength = preloadedSeriesData[season].length;
        preloadedSeriesData[season] = preloadedSeriesData[season].filter(epNum => validEpisodeNumbers.includes(epNum));
        if (preloadedSeriesData[season].length !== originalLength) {
          localStorage.setItem(key, JSON.stringify(preloadedSeriesData));
          
          // If we cleaned it, we should also try to update the season dropdown icon immediately
          const seasonSelect = document.getElementById('season-select');
          if (seasonSelect) {
            const option = seasonSelect.querySelector(`option[value="${season}"]`);
            if (option) {
               const isFullyWatched = preloadedSeriesData[season].length >= data.episodes.length;
               const isCurrentlyWatching = !isFullyWatched && preloadedSeriesData[season].length > 0;
               let icon = '';
               if (isFullyWatched) icon = ' ✔';
               else if (isCurrentlyWatching) icon = ' ►';
               option.innerText = option.innerText.replace(/ ✔| ►/g, '') + icon;
            }
          }
        }
      }

      // Sync season toggle switch state
      const seasonToggle = document.getElementById('season-watch-toggle');
      if (seasonToggle && data.episodes) {
        const allEps = data.episodes.map(ep => parseInt(ep.episode_number));
        const watchedInSeason = preloadedSeriesData[season] || [];
        const isSeasonFullyWatched = allEps.length > 0 && allEps.every(ep => watchedInSeason.includes(ep));
        seasonToggle.checked = isSeasonFullyWatched;
      }

      const epsHtml = paginatedEpisodes.map(ep => {
        const isComingSoon = !ep.still_path;
        const placeholderStill = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='140' fill='%23222'%3E%3Crect width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-family='sans-serif' font-size='20' text-anchor='middle' dy='.3em'%3E+%3C/text%3E%3C/svg%3E`;
        const playIconSmall = `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

        const imgHtml = isComingSoon
          ? `<div class="coming-soon-overlay">COMING SOON<div class="coming-soon-date">Expected: ${ep.air_date || 'Unknown'}</div></div>`
          : `<img src="${IMG_URL + ep.still_path}" onerror="this.onerror=null;this.src='${placeholderStill}';" alt="${ep.name}" loading="lazy">
             <div class="ep-play-overlay"><div class="ep-play-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div></div>`;

        const isWatched = isEpisodeWatched(id, season, ep.episode_number, preloadedSeriesData);
        const watchIconColor = isWatched ? '#46d369' : 'rgba(255,255,255,0.4)';
        const watchIconSvg = isWatched
          ? `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`
          : `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

        const bulkToggleHtml = !isComingSoon ? `
            <label class="switch-container" onclick="event.stopPropagation();" title="Mark/Unmark up to here" style="transform: scale(0.65); transform-origin: right center; margin: 0; padding: 0;">
              <div class="switch" style="margin: 0;">
                <input type="checkbox" ${isWatched ? 'checked' : ''} onchange="confirmBulkWatchAction(event, ${id}, ${season}, ${ep.episode_number}, this.checked)">
                <span class="slider"></span>
              </div>
            </label>` : '';

        return `
        <div class="episode-card">
          <div class="ep-img-container" ${!isComingSoon ? `onclick="toggleWatched(event, ${id}, ${season}, ${ep.episode_number}, true); openServerSelectionPopup(${id}, ${season}, ${ep.episode_number});"` : ''} style="cursor: ${isComingSoon ? 'default' : 'pointer'}">
            ${isComingSoon ? `<img src="${placeholderStill}" class="coming-soon-img">` : ''}
            ${imgHtml}
          </div>
          <div class="ep-details" ${!isComingSoon ? `onclick="toggleWatched(event, ${id}, ${season}, ${ep.episode_number}, true); openServerSelectionPopup(${id}, ${season}, ${ep.episode_number});"` : ''} style="cursor: ${isComingSoon ? 'default' : 'pointer'}">
            <div class="ep-title-row">
              <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="ep-runtime">${ep.runtime ? ep.runtime + 'm' : ''}</div>
                ${bulkToggleHtml}
                ${!isComingSoon ? `<div onclick="event.stopPropagation(); openDownloadModal(${id}, 'tv', ${season}, ${ep.episode_number})" style="color: #46d369; cursor: pointer; display: flex; align-items: center; padding: 5px; background: rgba(70,211,105,0.1); border-radius: 6px;" title="Download Episode"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div>` : ''}
                ${!isComingSoon ? `<div id="watch-icon-${id}-${season}-${ep.episode_number}" onclick="toggleWatched(event, ${id}, ${season}, ${ep.episode_number})" style="color: ${watchIconColor}; cursor: pointer; display: flex; align-items: center; transition: color 0.2s ease;" title="Toggle Watched">${watchIconSvg}</div>` : ''}
              </div>
            </div>
            <div class="ep-overview">${ep.overview || 'No overview available.'}</div>
          </div>
        </div>
      `}).join('');

      let paginationHtml = '';
      if (data.episodes.length > EPISODES_PER_PAGE) {
        paginationHtml = `<div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px; padding: 10px;">`;
        if (page > 1) {
          paginationHtml += `<button class="btn btn-secondary" style="background: rgba(255,255,255,0.1); border: none; padding: 8px 16px; border-radius: 6px; color: white; cursor: pointer;" onclick="loadEpisodes(${id}, ${season}, ${page - 1})">Previous 50</button>`;
        }
        if (end < data.episodes.length) {
          paginationHtml += `<button class="btn btn-secondary" style="background: rgba(255,255,255,0.1); border: none; padding: 8px 16px; border-radius: 6px; color: white; cursor: pointer;" onclick="loadEpisodes(${id}, ${season}, ${page + 1})">Next 50</button>`;
        }
        paginationHtml += `</div>`;
      }

      container.innerHTML = chunkDropdownHtml + `<div class="episodes-list">${epsHtml}</div>${paginationHtml}`;
      if (page > 1) {
        document.getElementById('details-view').scrollTo({ top: container.offsetTop - 50, behavior: 'smooth' });
      }
    }

    window.confirmBulkWatchAction = function(event, id, season, targetEpisode, isMarking) {
      event.stopPropagation();
      const checkbox = event.target;
      const originalState = !isMarking;
      
      const actionText = isMarking ? 'MARK' : 'UNMARK';
      const confirmMsg = `Are you sure you want to ${actionText} episodes 1 through ${targetEpisode} as ${isMarking ? 'watched' : 'unwatched'}?`;
      
      if (confirm(confirmMsg)) {
        const key = `watched_series_${id}`;
        let preloadedSeriesData = {};
        try { preloadedSeriesData = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { }
        
        if (!preloadedSeriesData[season]) preloadedSeriesData[season] = [];
        
        if (window.currentSeasonData && window.currentSeasonData.episodes) {
          const episodes = window.currentSeasonData.episodes;
          const validEpisodeNumbers = episodes.map(ep => ep.episode_number);
          
          // Clean up any corrupted data from previous bug
          preloadedSeriesData[season] = preloadedSeriesData[season].filter(epNum => validEpisodeNumbers.includes(epNum));
          
          for (const ep of episodes) {
            if (ep.episode_number <= targetEpisode) {
              if (isMarking) {
                if (!preloadedSeriesData[season].includes(ep.episode_number)) preloadedSeriesData[season].push(ep.episode_number);
              } else {
                const index = preloadedSeriesData[season].indexOf(ep.episode_number);
                if (index > -1) preloadedSeriesData[season].splice(index, 1);
              }
            }
          }
        }
        localStorage.setItem(key, JSON.stringify(preloadedSeriesData));
        
        if (window.currentEpisodePage) {
          loadEpisodes(id, season, window.currentEpisodePage);
        } else {
          loadEpisodes(id, season, 1);
        }
      } else {
        checkbox.checked = originalState;
      }
    };

    function showMainContent() {
      mainContent.classList.remove('hidden');
      searchResultsContainer.classList.remove('active');
      globalBackBtn.classList.remove('active');
      
      const homeSearch = document.querySelector('.search-container');
      if (homeSearch) homeSearch.style.display = 'flex';
      
      document.title = "Prisma - Stream Movies & TV Shows";

      // Also clear search input if we're forcing main content to show via nav
      if (history.state && history.state.view === 'home') {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.classList.remove('active');
      }
    }

    function shareContent(title) {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: `Watch ${title} on Prisma`,
          text: `I'm watching ${title} on Prisma. Check it out!`,
          url: url
        }).catch(err => {
          console.log('Share failed:', err);
          if (err.name !== 'AbortError') {
            navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!'));
          }
        });
      } else {
        navigator.clipboard.writeText(url).then(() => {
          alert('Link copied to clipboard!');
        });
      }
    }

    function playTrailer(key) {
      window.open(`https://www.youtube.com/watch?v=${key}`, '_blank');
    }

    // ── Auto-Check Server 27 Engine ──────────────────────────────────────────────
    window.autoCheckCancelled = false;
    window.autoCheckRunning = false;
    window.autoCheckResults = {}; // { serverId: 'success' | 'failed' }
    window.autoCheckContext = null; // { id, type, season, episode, currentServerId }

    function buildServerUrl(serverId, id, type, season, episode) {
      let ap = window.isAutoplayEnabled ? 'true' : 'false';
      let startProgress = '';
      let vidSyncStartTime = '';
      if (serverId === 'vidking' || serverId === 'videasy' || serverId === 'vidnest' || serverId === 'vidsync') {
        const saved = getProgressForId(id);
        if (saved && saved.currentTime) {
          startProgress = `&progress=${Math.floor(saved.currentTime)}`;
          if (serverId === 'vidsync') vidSyncStartTime = `&startTime=${Math.floor(saved.currentTime)}`;
        }
      }
      let autonext = window.isAutoplayEnabled ? '&nextEpisode=true&autoplayNextEpisode=true' : '';
      let autonextAlt = window.isAutoplayEnabled ? '&autoNext=true' : '';
      let autonextCine = window.isAutoplayEnabled ? '&autonext=true&autoskip=true' : '';
      let autonextVidrock = window.isAutoplayEnabled ? '&nextbutton=true&autonext=true' : '';

      if (serverId === 'vidking') return type === 'movie' ? `https://www.vidking.net/embed/movie/${id}?autoPlay=${ap}&color=e50914${startProgress}` : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}${autonext}&episodeSelector=true${startProgress}`;
      else if (serverId === 'videasy') return type === 'movie' ? `https://player.videasy.net/movie/${id}?color=e50914${startProgress}` : `https://player.videasy.net/tv/${id}/${season}/${episode}?episodeSelector=true&color=e50914${autonext}${startProgress}`;
      else if (serverId === 'vidcore') {
        let t = ''; const s = getProgressForId(id); if (s && s.currentTime) t = `&startAt=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://vidcore.net/movie/${id}?autoPlay=${ap}&theme=46d369${t}` : `https://vidcore.net/tv/${id}/${season}/${episode}?autoPlay=${ap}&theme=46d369${t}`;
      }
      else if (serverId === 'vidplays') return type === 'movie' ? `https://vidplays.fun/embed/movie/${id}` : `https://vidplays.fun/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidlink') {
        let t = ''; const s = getProgressForId(id); if (s && s.currentTime) t = `&startAt=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://vidlink.pro/movie/${id}?primaryColor=46d369&autoplay=${ap}${t}` : `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=46d369&autoplay=${ap}${t}`;
      }
      else if (serverId === 'vidsrc-me') return type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
      else if (serverId === 'vidsrc-to') return type === 'movie' ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidsrc-ru') return type === 'movie' ? `https://vidsrc.ru/movie/${id}` : `https://vidsrc.ru/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidsrc-cc') return type === 'movie' ? `https://vidsrc.cc/v2/embed/movie/${id}` : `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidnest') return type === 'movie' ? `https://vidnest.fun/movie/${id}?servericon=hide${startProgress}` : `https://vidnest.fun/tv/${id}/${season}/${episode}?servericon=hide${startProgress}`;
      else if (serverId === 'vidsync') return type === 'movie' ? `https://vidsync.xyz/embed/movie/${id}?autoPlay=${ap}&theme=e50914${vidSyncStartTime}` : `https://vidsync.xyz/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}${autonextAlt}&theme=e50914${vidSyncStartTime}`;
      else if (serverId === '111movies') return type === 'movie' ? `https://111movies.net/movie/${id}` : `https://111movies.net/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidfast') return type === 'movie' ? `https://vidfast.pro/movie/${id}?autoPlay=${ap}&title=true&poster=true&theme=e50914` : `https://vidfast.pro/tv/${id}/${season}/${episode}?autoPlay=${ap}&title=true&poster=true&theme=e50914${autonextAlt}`;
      else if (serverId === 'cinesrc') {
        let t = ''; const s = getProgressForId(id); if (s && s.currentTime) t = `&time=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://cinesrc.st/embed/movie/${id}?autoplay=${ap}&color=%23e50914${t}` : `https://cinesrc.st/embed/tv/${id}?s=${season}&e=${episode}&autoplay=${ap}${autonextCine}&color=%23e50914${t}`;
      }
      else if (serverId === 'mapple') return type === 'movie' ? `https://mapple.rip/watch/movie/${id}` : `https://mapple.rip/watch/tv/${id}-${season}-${episode}`;
      else if (serverId === 'moviesapi') return type === 'movie' ? `https://moviesapi.to/movie/${id}` : `https://moviesapi.to/tv/${id}-${season}-${episode}`;
      else if (serverId === 'rivestream') return type === 'movie' ? `https://www.rivestream.app/embed?type=movie&id=${id}` : `https://www.rivestream.app/embed?type=tv&id=${id}&season=${season}&episode=${episode}`;
      else if (serverId === 'vidplus') return type === 'movie' ? `https://player.vidplus.to/embed/movie/${id}` : `https://player.vidplus.to/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidrock') return type === 'movie' ? `https://vidrock.ru/movie/${id}?autoplay=${ap}&theme=e50914` : `https://vidrock.ru/tv/${id}/${season}/${episode}?autoplay=${ap}&theme=e50914${autonextVidrock}`;
      else if (serverId === 'vidup') return type === 'movie' ? `https://vidup.to/movie/${id}?autoPlay=${ap}&theme=e50914` : `https://vidup.to/tv/${id}/${season}/${episode}?autoPlay=${ap}&theme=e50914${autonextVidrock}`;
      else if (serverId === 'peachify') return type === 'movie' ? `https://peachify.top/embed/movie/${id}?cast=hide&pip=hide&servers=hide` : `https://peachify.top/embed/tv/${id}/${season}/${episode}?cast=hide&pip=hide&servers=hide`;
      else if (serverId === 'fmovies') return type === 'movie' ? `https://www.fmovies.gd/watch/movie/${id}` : `https://www.fmovies.gd/watch/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidlux') return type === 'movie' ? `https://vidlux.xyz/embed/movie/${id}?autoplay=${ap}&color=e50914` : `https://vidlux.xyz/embed/tv/${id}/${season}/${episode}?autoplay=${ap}&color=e50914`;
      else if (serverId === '1embed') return type === 'movie' ? `https://1embed.cc/embed/movie/${id}` : `https://1embed.cc/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'vidsrc-wtf') return type === 'movie' ? `https://vidsrc.wtf/api/1/movie/?id=${id}&color=e50914&autoPlay=${ap}` : `https://vidsrc.wtf/api/1/tv/?id=${id}&s=${season}&e=${episode}&color=e50914&autoPlay=${ap}`;
      else if (serverId === 'zxcstream') return type === 'movie' ? `https://www.zxcstream.xyz/player/movie/${id}?autoplay=${ap}` : `https://www.zxcstream.xyz/player/tv/${id}/${season}/${episode}?autoplay=${ap}`;
      else if (serverId === 'spencerdevs') {
        let t = ''; const s = getProgressForId(id); if (s && s.currentTime) t = `&startAt=${Math.floor(s.currentTime)}&time=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://spencerdevs.xyz/movie/${id}?theme=e50914&autoplay=${ap}${t}` : `https://spencerdevs.xyz/tv/${id}/${season}/${episode}?theme=e50914&autoplay=${ap}${t}`;
      }
      else if (serverId === 'vixsrc') {
        let t = ''; const s = getProgressForId(id); if (s && s.currentTime) t = `&startAt=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://vixsrc.to/movie/${id}?primaryColor=e50914&autoplay=${ap}${t}` : `https://vixsrc.to/tv/${id}/${season}/${episode}?primaryColor=e50914&autoplay=${ap}${t}`;
      }
      else if (serverId === 'vidzee') {
        return type === 'movie' ? `https://player.vidzee.wtf/embed/movie/${id}` : `https://player.vidzee.wtf/embed/tv/${id}/${season}/${episode}`;
      }
      else if (serverId === 'anyembed') {
        return type === 'movie' ? `https://anyembed.xyz/embed/tmdb-movie-${id}?theme=%23e50914&logo=false&autoplay=${ap}` : `https://anyembed.xyz/embed/tmdb-tv-${id}-${season}-${episode}?theme=%23e50914&logo=false&autoplay=${ap}`;
      }
      else if (serverId === 'vidsrc-su') {
        const autoNext = window.isAutoplayEnabled ? 'true' : 'false';
        return type === 'movie' ? `https://vidsrc.su/movie/${id}?autoplay=${ap}&colour=e50914` : `https://vidsrc.su/tv/${id}/${season}/${episode}?autoplay=${ap}&colour=e50914&autonextepisode=${autoNext}`;
      }
      else if (serverId === 'cinemaos') {
        const autoNext = window.isAutoplayEnabled ? 'true' : 'false';
        let timeParam = ''; const s = getProgressForId(id); if (s && s.currentTime) timeParam = `&startTime=${Math.floor(s.currentTime)}`;
        return type === 'movie' ? `https://cinemaos.tech/player/${id}?theme=e50914&autoPlay=${ap}&autoNext=${autoNext}${timeParam}` : `https://cinemaos.tech/player/${id}/${season}/${episode}?theme=e50914&autoPlay=${ap}&autoNext=${autoNext}${timeParam}`;
      }
      else if (serverId === 'nxsha') return type === 'movie' ? `https://web.nxsha.app/embed/movie/${id}` : `https://web.nxsha.app/embed/tv/${id}/${season}/${episode}`;
      else if (serverId === 'xpass') return type === 'movie' ? `https://play.xpass.top/e/movie/${id}` : `https://play.xpass.top/e/tv/${id}/${season}/${episode}`;
      else if (serverId === 'cinextream') return type === 'movie' ? `https://cinextream.net/api/embed/movie/${id}?color=e50914&autoplay=${ap}` : `https://cinextream.net/api/embed/tv/${id}/${season}/${episode}?color=e50914&autoplay=${ap}`;
      else if (serverId === 'screenscape') return type === 'movie' ? `https://screenscape.me/embed?tmdb=${id}&type=movie` : `https://screenscape.me/embed?tmdb=${id}&type=tv&s=${season}&e=${episode}`;
      // Default fallback
      return type === 'movie' ? `https://www.vidking.net/embed/movie/${id}?autoPlay=${ap}&color=e50914` : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}&episodeSelector=true`;
    }

    function testServerEmbed(server, id, type, season, episode) {
      return new Promise((resolve) => {
        const TIMEOUT_MS = 12000;
        const src = buildServerUrl(server.id, id, type, season, episode);
        if (!src) { resolve({ success: false, reason: 'No URL' }); return; }

        const testFrame = document.createElement('iframe');
        testFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;';
        document.body.appendChild(testFrame);

        let resolved = false;
        const cleanup = () => { try { if (testFrame.parentNode) testFrame.parentNode.removeChild(testFrame); } catch (e) { } };
        const done = (result) => { if (!resolved) { resolved = true; clearTimeout(timer); cleanup(); resolve(result); } };

        const timer = setTimeout(() => done({ success: false, reason: 'Timeout' }), TIMEOUT_MS);

        testFrame?.addEventListener('load', () => {
          // Small delay to allow the iframe content to settle
          setTimeout(() => done({ success: true }), 300);
        });
        testFrame?.addEventListener('error', () => done({ success: false, reason: 'Error' }));

        try {
          testFrame.src = src;
        } catch (e) {
          done({ success: false, reason: 'Exception' });
        }
      });
    }

    function showAutoCheckOverlay(title, serversToCheck) {
      const overlay = document.getElementById('auto-check-overlay');
      const titleEl = document.getElementById('auto-check-title');
      const listEl = document.getElementById('auto-check-list');
      const resultEl = document.getElementById('auto-check-result');
      const cancelBtn = document.getElementById('auto-check-cancel');
      const headerSpinner = overlay.querySelector('.ac-spinner');
      const headerH2 = overlay.querySelector('.auto-check-header h2');

      titleEl.textContent = title || 'media';
      resultEl.innerHTML = '';
      cancelBtn.style.display = 'inline-block';
      if (headerSpinner) headerSpinner.style.display = 'block';
      if (headerH2) headerH2.textContent = 'Auto-detecting best server...';

      listEl.innerHTML = serversToCheck.map(s => `
        <div class="ac-item waiting" id="ac-item-${s.id}">
          <div class="ac-icon waiting" id="ac-icon-${s.id}">○</div>
          <div class="ac-name">${s.label} <span style="color:#666;font-weight:400;">(${s.name})</span></div>
          <div class="ac-status" id="ac-status-${s.id}">Waiting</div>
        </div>
      `).join('');

      overlay.classList.add('active');
    }

    function hideAutoCheckOverlay() {
      const overlay = document.getElementById('auto-check-overlay');
      overlay.classList.remove('active');
      window.autoCheckRunning = false;
    }

    function updateChecklistItem(serverId, status, reason) {
      const item = document.getElementById(`ac-item-${serverId}`);
      const icon = document.getElementById(`ac-icon-${serverId}`);
      const statusEl = document.getElementById(`ac-status-${serverId}`);
      if (!item) return;

      item.className = `ac-item ${status}`;
      icon.className = `ac-icon ${status}`;

      if (status === 'checking') {
        icon.innerHTML = '';
        statusEl.textContent = 'Checking...';
        // Auto-scroll to the checking item
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (status === 'success') {
        icon.innerHTML = '✔';
        statusEl.textContent = 'Stream found!';
      } else if (status === 'failed') {
        icon.innerHTML = '✖';
        statusEl.textContent = reason || 'Failed';
      }
    }

    function cancelAutoCheck() {
      window.autoCheckCancelled = true;
      window.autoCheckRunning = false;
      hideAutoCheckOverlay();
      closePlayerModal();
    }

    function showSwitchServerBtn() {
      const btn = document.getElementById('ac-switch-btn');
      if (btn) btn.style.display = 'block';
    }

    function hideSwitchServerBtn() {
      const btn = document.getElementById('ac-switch-btn');
      const panel = document.getElementById('ac-switch-panel');
      if (btn) btn.style.display = 'none';
      if (panel) panel.classList.remove('active');
    }

    function toggleSwitchPanel() {
      const panel = document.getElementById('ac-switch-panel');
      if (!panel) return;

      if (panel.classList.contains('active')) {
        panel.classList.remove('active');
      } else {
        // Populate the panel list
        const listEl = document.getElementById('ac-switch-panel-list');
        const ctx = window.autoCheckContext;
        if (!ctx) return;

        let html = '';
        let serversToRender = SERVERS.filter(s => !s.autoCheck);

        // Push currently playing to the top, then remaining in normal order
        const currentSrvIdx = serversToRender.findIndex(s => s.id === ctx.currentServerId);
        if (currentSrvIdx > -1) {
          const currentSrv = serversToRender.splice(currentSrvIdx, 1)[0];
          serversToRender.unshift(currentSrv);
        }

        serversToRender.forEach(srv => {
          const status = window.autoCheckResults[srv.id];
          let statusDotClass = 'gray';
          let badgeClass = 'untested';
          let badgeText = 'Untested';
          let itemClass = '';

          if (srv.id === ctx.currentServerId) {
            statusDotClass = 'green';
            badgeClass = 'playing';
            badgeText = 'Playing';
            itemClass = 'current';
          } else if (status === 'success') {
            statusDotClass = 'green';
            badgeClass = 'available';
            badgeText = 'Found';
          } else if (status === 'failed') {
            statusDotClass = 'red';
            badgeClass = 'failed';
            badgeText = 'Failed';
            itemClass = 'ac-sw-failed';
          }

          html += `
            <div class="ac-switch-item ${itemClass}" id="sw-item-${srv.id}" onclick="switchToServer('${srv.id}')">
              <div class="ac-sw-dot ${statusDotClass}"></div>
              <div class="ac-sw-name">${srv.label} <span style="opacity:0.6">(${srv.name})</span></div>
              <div class="ac-sw-badge ${badgeClass}" id="sw-badge-${srv.id}">${badgeText}</div>
            </div>
          `;
        });

        listEl.innerHTML = html;
        panel.classList.add('active');
      }
    }

    async function switchToServer(newServerId) {
      const ctx = window.autoCheckContext;
      if (!ctx || ctx.currentServerId === newServerId) return;

      const itemEl = document.getElementById(`sw-item-${newServerId}`);
      const badgeEl = document.getElementById(`sw-badge-${newServerId}`);

      // If we are already testing it, don't trigger again
      if (itemEl && itemEl.classList.contains('testing')) return;

      if (itemEl && badgeEl) {
        itemEl.classList.add('testing');
        badgeEl.className = 'ac-sw-badge testing';
        badgeEl.textContent = 'Testing...';
        itemEl.querySelector('.ac-sw-dot').className = 'ac-sw-dot orange';
      }

      const serverCfg = SERVERS.find(s => s.id === newServerId);
      if (!serverCfg) return;

      const result = await testServerEmbed(serverCfg, ctx.id, ctx.type, ctx.season, ctx.episode);

      if (itemEl) itemEl.classList.remove('testing');

      if (result.success) {
        // Mark as success globally
        window.autoCheckResults[newServerId] = 'success';

        // Update context
        ctx.currentServerId = newServerId;
        window.autoCheckContext = ctx;

        // Save for future auto-check priority
        localStorage.setItem('auto_check_last_working', newServerId);

        // Close panel and load player
        const panel = document.getElementById('ac-switch-panel');
        if (panel) panel.classList.remove('active');
        openPlayer(ctx.id, ctx.type, ctx.season, ctx.episode, newServerId);
      } else {
        // Failed
        window.autoCheckResults[newServerId] = 'failed';
        if (badgeEl) {
          badgeEl.className = 'ac-sw-badge failed';
          badgeEl.textContent = 'Failed';
        }
        if (itemEl) {
          itemEl.className = 'ac-switch-item ac-sw-failed';
          itemEl.querySelector('.ac-sw-dot').className = 'ac-sw-dot red';
        }
      }
    }

    async function autoCheckServers(id, type, season, episode) {
      if (window.autoCheckRunning) return;
      window.autoCheckRunning = true;
      window.autoCheckCancelled = false;

      // Get all servers except the auto-check server itself
      let serversToCheck = SERVERS.filter(s => !s.autoCheck);

      // Smart priority: try last-working server first
      const lastWorking = localStorage.getItem('auto_check_last_working');
      if (lastWorking) {
        const idx = serversToCheck.findIndex(s => s.id === lastWorking);
        if (idx > 0) {
          const [server] = serversToCheck.splice(idx, 1);
          serversToCheck.unshift(server);
        }
      }

      // Fetch the title for display
      let mediaTitle = 'media';
      try {
        const meta = await fetchApi(`/${type}/${id}?api_key=${TMDB_API_KEY}`);
        if (meta) mediaTitle = meta.title || meta.name || 'media';
      } catch (e) { }

      showAutoCheckOverlay(mediaTitle, serversToCheck);

      let foundServer = null;
      let checkedCount = 0;

      for (const server of serversToCheck) {
        if (window.autoCheckCancelled) break;

        // Skip servers that we already know are offline (from ping results)
        const pingEl = document.getElementById(`movie-ping-${server.id}`) || document.getElementById(`tv-ping-${server.id}`);
        if (pingEl && pingEl.textContent && pingEl.textContent.includes('Offline')) {
          updateChecklistItem(server.id, 'failed', 'Already offline');
          window.autoCheckResults[server.id] = 'failed';
          checkedCount++;
          continue;
        }

        updateChecklistItem(server.id, 'checking');

        const result = await testServerEmbed(server, id, type, season, episode);
        checkedCount++;

        if (window.autoCheckCancelled) break;

        if (result.success) {
          updateChecklistItem(server.id, 'success');
          window.autoCheckResults[server.id] = 'success';
          foundServer = server;

          // Update header
          const headerSpinner = document.querySelector('#auto-check-overlay .ac-spinner');
          const headerH2 = document.querySelector('#auto-check-overlay .auto-check-header h2');
          if (headerSpinner) headerSpinner.style.display = 'none';
          if (headerH2) headerH2.textContent = 'Server found!';

          // Show found badge
          const resultEl = document.getElementById('auto-check-result');
          resultEl.innerHTML = `<div class="ac-found-badge">? Playing via ${server.label} (${server.name})</div>`;

          // Hide cancel, brief pause so user sees the result
          document.getElementById('auto-check-cancel').style.display = 'none';

          // Save for future priority
          localStorage.setItem('auto_check_last_working', server.id);

          // Store context for switch-server feature
          window.autoCheckContext = { id, type, season, episode, currentServerId: server.id };

          setTimeout(() => {
            hideAutoCheckOverlay();
            openPlayer(id, type, season, episode, server.id);
            // Show the switch server button after player loads
            setTimeout(() => showSwitchServerBtn(), 500);
          }, 1200);
          return;
        } else {
          updateChecklistItem(server.id, 'failed', result.reason);
          window.autoCheckResults[server.id] = 'failed';
        }
      }

      // All failed or cancelled
      if (!window.autoCheckCancelled && !foundServer) {
        const headerSpinner = document.querySelector('#auto-check-overlay .ac-spinner');
        const headerH2 = document.querySelector('#auto-check-overlay .auto-check-header h2');
        if (headerSpinner) headerSpinner.style.display = 'none';
        if (headerH2) headerH2.textContent = 'No servers available';

        const resultEl = document.getElementById('auto-check-result');
        resultEl.innerHTML = `
          <div class="ac-error-state">
            <h3>All ${checkedCount} servers failed</h3>
            <p>None of the servers responded in time. Try again later or pick a server manually.</p>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button class="ac-btn ac-btn-primary" onclick="hideAutoCheckOverlay(); autoCheckServers(${id}, '${type}', ${season}, ${episode});">Retry</button>
              <button class="ac-btn" onclick="hideAutoCheckOverlay(); closePlayerModal(); openServerSelectionPopup(${id}, ${season}, ${episode}, '${type}');">Pick Manually</button>
            </div>
          </div>
        `;
        document.getElementById('auto-check-cancel').style.display = 'none';
      }

      window.autoCheckRunning = false;
    }

    async function openPlayer(id, type, season = 1, episode = 1, server = 'vidking', customSrc = null) {
      // ── Auto-Check Intercept (Server 27 Alpha) ──
      const serverCfg = SERVERS.find(s => s.id === server);
      if (serverCfg && serverCfg.autoCheck) {
        autoCheckServers(id, type, season, episode);
        return;
      }
      localStorage.setItem('last_used_server', server);
      const currentState = history.state || { view: 'home' };
      const currentHash = window.location.hash || '#home';
      const playerHash = currentHash.includes('-player') ? currentHash : currentHash + '-player';
      if (currentState.playerOpen) {
        history.replaceState({ ...currentState, playerOpen: true }, '', playerHash);
      } else {
        history.pushState({ ...currentState, playerOpen: true }, '', playerHash);
      }

      // Pause background trailer if it's playing
      const bgTrailer = document.getElementById('bg-trailer');
      if (bgTrailer && !bgTrailer.paused) {
        bgTrailer.pause();
      }

      playerModal.classList.add('active');
      lockScroll();

      // Explicitly hide the global back button during video playback
      globalBackBtn.classList.remove('active');

      const promptContainer = document.getElementById('next-prompt-container');
      if (promptContainer) promptContainer.innerHTML = '';
      window.nextPromptShown = false;

      let itemMeta = await fetchApi(`/${type}/${id}?api_key=${TMDB_API_KEY}`);
      if (itemMeta) {
        itemMeta.mediaType = type;
        itemMeta.currentSeason = season;
        itemMeta.currentEpisode = episode;
        itemMeta.currentServer = server;
        playerIframe.dataset.meta = JSON.stringify(itemMeta);
        const title = itemMeta.title || itemMeta.name || "Movie";
        document.title = `Watching: ${title} - Prisma`;
      } else {
        playerIframe.dataset.meta = JSON.stringify({ mediaType: type, id: id, currentSeason: season, currentEpisode: episode, currentServer: server });
      }

      const serverConfig = SERVERS.find(s => s.id === server);

      playerIframe.removeAttribute('sandbox');
      if (serverConfig && serverConfig.sandbox) {
        const sandboxValue = typeof serverConfig.sandbox === 'string'
          ? serverConfig.sandbox
          : 'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock';
        const isGlobalSandboxDisabled = localStorage.getItem('globalSandboxDisabled') === 'true';
        if (sandboxValue && !isGlobalSandboxDisabled) {
          playerIframe.setAttribute('sandbox', sandboxValue);
        }
      }

      let src = "";
      if (customSrc) {
        src = customSrc;
      } else {
        let startProgress = '';
        let vidSyncStartTime = '';
        if (server === 'vidking' || server === 'videasy' || server === 'vidnest' || server === 'vidsync') {
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) {
            startProgress = `&progress=${Math.floor(saved.currentTime)}`;
            if (server === 'vidsync') {
              vidSyncStartTime = `&startTime=${Math.floor(saved.currentTime)}`;
            }
          }
        }

        let ap = window.isAutoplayEnabled ? 'true' : 'false';
        let autonext = window.isAutoplayEnabled ? '&nextEpisode=true&autoplayNextEpisode=true' : '';
        let autonextAlt = window.isAutoplayEnabled ? '&autoNext=true' : '';
        let autonextCine = window.isAutoplayEnabled ? '&autonext=true&autoskip=true' : '';
        let autonextVidrock = window.isAutoplayEnabled ? '&nextbutton=true&autonext=true' : '';

        if (server === 'vidking') src = type === 'movie' ? `https://www.vidking.net/embed/movie/${id}?autoPlay=${ap}&color=e50914${startProgress}` : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}${autonext}&episodeSelector=true${startProgress}`;
        else if (server === 'videasy') src = type === 'movie' ? `https://player.videasy.net/movie/${id}?color=e50914${startProgress}` : `https://player.videasy.net/tv/${id}/${season}/${episode}?episodeSelector=true&color=e50914${autonext}${startProgress}`;
        else if (server === 'vidcore') {
          let timeParam = '';
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) timeParam = `&startAt=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://vidcore.net/movie/${id}?autoPlay=${ap}&theme=46d369${timeParam}` : `https://vidcore.net/tv/${id}/${season}/${episode}?autoPlay=${ap}&theme=46d369${timeParam}`;
        }
        else if (server === 'vidplays') src = type === 'movie' ? `https://vidplays.fun/embed/movie/${id}` : `https://vidplays.fun/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidlink') {
          let timeParam = '';
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) timeParam = `&startAt=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://vidlink.pro/movie/${id}?primaryColor=46d369&autoplay=${ap}${timeParam}` : `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=46d369&autoplay=${ap}${timeParam}`;
        }
        else if (server === 'vidsrc-me') src = type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
        else if (server === 'vidsrc-to') src = type === 'movie' ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidsrc-ru') src = type === 'movie' ? `https://vidsrc.ru/embed/movie/${id}` : `https://vidsrc.ru/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidsrc-cc') src = type === 'movie' ? `https://vidsrc.cc/v2/embed/movie/${id}` : `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidnest') src = type === 'movie' ? `https://vidnest.fun/movie/${id}?servericon=hide${startProgress}` : `https://vidnest.fun/tv/${id}/${season}/${episode}?servericon=hide${startProgress}`;
        else if (server === 'vidsync') src = type === 'movie' ? `https://vidsync.xyz/embed/movie/${id}?autoPlay=${ap}&theme=e50914${vidSyncStartTime}` : `https://vidsync.xyz/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}${autonextAlt}&theme=e50914${vidSyncStartTime}`;
        else if (server === '111movies') src = type === 'movie' ? `https://111movies.net/movie/${id}` : `https://111movies.net/tv/${id}/${season}/${episode}`;
        else if (server === 'vidfast') src = type === 'movie' ? `https://vidfast.pro/movie/${id}?autoPlay=${ap}&title=true&poster=true&theme=e50914` : `https://vidfast.pro/tv/${id}/${season}/${episode}?autoPlay=${ap}&title=true&poster=true&theme=e50914${autonextAlt}`;
        else if (server === 'cinesrc') {
          let timeParam = '';
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) timeParam = `&time=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://cinesrc.st/embed/movie/${id}?autoplay=${ap}&color=%23e50914${timeParam}` : `https://cinesrc.st/embed/tv/${id}?s=${season}&e=${episode}&autoplay=${ap}${autonextCine}&color=%23e50914${timeParam}`;
        }
        else if (server === 'mapple') src = type === 'movie' ? `https://mapple.rip/watch/movie/${id}` : `https://mapple.rip/watch/tv/${id}-${season}-${episode}`;
        else if (server === 'moviesapi') src = type === 'movie' ? `https://moviesapi.to/movie/${id}` : `https://moviesapi.to/tv/${id}-${season}-${episode}`;
        else if (server === 'rivestream') src = type === 'movie' ? `https://www.rivestream.app/embed?type=movie&id=${id}` : `https://www.rivestream.app/embed?type=tv&id=${id}&season=${season}&episode=${episode}`;
        else if (server === 'vidplus') src = type === 'movie' ? `https://player.vidplus.to/embed/movie/${id}` : `https://player.vidplus.to/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidrock') src = type === 'movie' ? `https://vidrock.ru/movie/${id}?autoplay=${ap}&theme=e50914` : `https://vidrock.ru/tv/${id}/${season}/${episode}?autoplay=${ap}&theme=e50914${autonextVidrock}`;
        else if (server === 'vidup') src = type === 'movie' ? `https://vidup.to/movie/${id}?autoPlay=${ap}&theme=e50914` : `https://vidup.to/tv/${id}/${season}/${episode}?autoPlay=${ap}&theme=e50914${autonextVidrock}`;
        else if (server === 'peachify') src = type === 'movie' ? `https://peachify.top/embed/movie/${id}?cast=hide&pip=hide&servers=hide` : `https://peachify.top/embed/tv/${id}/${season}/${episode}?cast=hide&pip=hide&servers=hide`;
        else if (server === 'fmovies') src = type === 'movie' ? `https://www.fmovies.gd/watch/movie/${id}` : `https://www.fmovies.gd/watch/tv/${id}/${season}/${episode}`;
        else if (server === 'vidlux') src = type === 'movie' ? `https://vidlux.xyz/embed/movie/${id}?autoplay=${ap}&color=e50914` : `https://vidlux.xyz/embed/tv/${id}/${season}/${episode}?autoplay=${ap}&color=e50914`;
        else if (server === '1embed') src = type === 'movie' ? `https://1embed.cc/embed/movie/${id}` : `https://1embed.cc/embed/tv/${id}/${season}/${episode}`;
        else if (server === 'vidsrc-wtf') src = type === 'movie' ? `https://vidsrc.wtf/api/1/movie/?id=${id}&color=e50914&autoPlay=${ap}` : `https://vidsrc.wtf/api/1/tv/?id=${id}&s=${season}&e=${episode}&color=e50914&autoPlay=${ap}`;
        else if (server === 'zxcstream') src = type === 'movie' ? `https://www.zxcstream.xyz/player/movie/${id}?autoplay=${ap}` : `https://www.zxcstream.xyz/player/tv/${id}/${season}/${episode}?autoplay=${ap}`;
        else if (server === 'spencerdevs') {
          let timeParam = '';
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) timeParam = `&startAt=${Math.floor(saved.currentTime)}&time=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://spencerdevs.xyz/movie/${id}?theme=e50914&autoplay=${ap}${timeParam}` : `https://spencerdevs.xyz/tv/${id}/${season}/${episode}?theme=e50914&autoplay=${ap}${timeParam}`;
        }
        else if (server === 'vixsrc') {
          let timeParam = '';
          const saved = getProgressForId(id);
          if (saved && saved.currentTime) timeParam = `&startAt=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://vixsrc.to/movie/${id}?primaryColor=e50914&autoplay=${ap}${timeParam}` : `https://vixsrc.to/tv/${id}/${season}/${episode}?primaryColor=e50914&autoplay=${ap}${timeParam}`;
        }
        else if (server === 'vidzee') {
          src = type === 'movie' ? `https://player.vidzee.wtf/embed/movie/${id}` : `https://player.vidzee.wtf/embed/tv/${id}/${season}/${episode}`;
        }
        else if (server === 'anyembed') {
          src = type === 'movie' ? `https://anyembed.xyz/embed/tmdb-movie-${id}?theme=%23e50914&logo=false&autoplay=${ap}` : `https://anyembed.xyz/embed/tmdb-tv-${id}-${season}-${episode}?theme=%23e50914&logo=false&autoplay=${ap}`;
        }
        else if (server === 'vidsrc-su') {
          const autoNext = window.isAutoplayEnabled ? 'true' : 'false';
          src = type === 'movie' ? `https://vidsrc.su/movie/${id}?autoplay=${ap}&colour=e50914` : `https://vidsrc.su/tv/${id}/${season}/${episode}?autoplay=${ap}&colour=e50914&autonextepisode=${autoNext}`;
        }
        else if (server === 'cinemaos') {
          const autoNext = window.isAutoplayEnabled ? 'true' : 'false';
          let timeParam = ''; const saved = getProgressForId(id); if (saved && saved.currentTime) timeParam = `&startTime=${Math.floor(saved.currentTime)}`;
          src = type === 'movie' ? `https://cinemaos.tech/player/${id}?theme=e50914&autoPlay=${ap}&autoNext=${autoNext}${timeParam}` : `https://cinemaos.tech/player/${id}/${season}/${episode}?theme=e50914&autoPlay=${ap}&autoNext=${autoNext}${timeParam}`;
        }
        else if (server === 'nxsha') {
          src = type === 'movie' ? `https://web.nxsha.app/embed/movie/${id}` : `https://web.nxsha.app/embed/tv/${id}/${season}/${episode}`;
        }
        else if (server === 'xpass') {
          src = type === 'movie' ? `https://play.xpass.top/e/movie/${id}` : `https://play.xpass.top/e/tv/${id}/${season}/${episode}`;
        }
        else if (server === 'cinextream') {
          src = type === 'movie' ? `https://cinextream.net/api/embed/movie/${id}?color=e50914&autoplay=${ap}` : `https://cinextream.net/api/embed/tv/${id}/${season}/${episode}?color=e50914&autoplay=${ap}`;
        }
        else if (server === 'screenscape') {
          src = type === 'movie' ? `https://screenscape.me/embed?tmdb=${id}&type=movie` : `https://screenscape.me/embed?tmdb=${id}&type=tv&s=${season}&e=${episode}`;
        }
        else if (server === 'filmu') {
          src = type === 'movie' ? `https://embed.filmu.in/movie/${id}` : `https://embed.filmu.in/tv/${id}/${season}/${episode}`;
        }
        else if (server === 'bingr') {
          // Perform Anilist lookup if it's anime
          let anilistId = id; 
          if (type === 'anime' || window.currentIsAnime) {
            try {
              const title = window.currentMediaTitle || itemMeta?.title || itemMeta?.name || '';
              const cleanTitle = title.replace(/\(TV\)/gi, '').trim();
              
              if (cleanTitle) {
                const response = await fetch('https://graphql.anilist.co', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  body: JSON.stringify({
                    query: `query ($search: String) { Media (search: $search, type: ANIME) { id } }`,
                    variables: { search: cleanTitle }
                  })
                });
                const data = await response.json();
                if (data && data.data && data.data.Media && data.data.Media.id) {
                  anilistId = data.data.Media.id;
                }
              }
            } catch (err) {
              console.warn("Bingr: Anilist mapping failed", err);
            }
          }
          src = `https://bingr.one/watch/anime/${anilistId}/${episode}?dub=false`;
        }
        else if (server === 'server-27') {
          const titleParam = itemMeta ? encodeURIComponent(itemMeta.title || itemMeta.name || '') : '';
          const yearParam = itemMeta ? (itemMeta.release_date || itemMeta.first_air_date || '').split('-')[0] : '';
          src = `${window.getRootPath()}player/dist/index.html?id=${id}&type=${type}&season=${season}&episode=${episode}&title=${titleParam}&year=${yearParam}`;
        }
        else src = type === 'movie' ? `https://www.vidking.net/embed/movie/${id}?autoPlay=${ap}&color=e50914${startProgress}` : `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?autoPlay=${ap}${autonext}&episodeSelector=true${startProgress}`;
      }



      playerIframe.setAttribute('data-tmdb-id', id);
      playerIframe.setAttribute('data-season', season);
      playerIframe.setAttribute('data-episode', episode);
      playerIframe.setAttribute('data-type', type);
      
      // Dynamic Referrer Policy for VixSrc block bypass
      if (server === 'vixsrc') {
        playerIframe.setAttribute('referrerpolicy', 'no-referrer');
      } else {
        playerIframe.setAttribute('referrerpolicy', 'origin');
      }

      playerIframe.src = src;

      // Clear any existing fallback timer
      if (window.manualFallbackTimer) {
        clearInterval(window.manualFallbackTimer);
        window.manualFallbackTimer = null;
      }

      // Servers that DO have a native postMessage progress API
      const nativeTrackers = ['vidcore', 'vidlink', 'vidking', 'cinesrc', 'vidsrc-wtf', 'vidnest', 'vidsync', 'vidfast', 'vidrock', 'vidup', 'vixsrc', 'vidzee', 'vidsrc-su', 'cinemaos', 'xpass'];

      if (!nativeTrackers.includes(server)) {
        // Automated Background Progress Tracker (Invisible Fallback)
        let runtimeMinutes = 24; // Default safe runtime
        if (itemMeta) {
          if (type === 'movie' && itemMeta.runtime) runtimeMinutes = itemMeta.runtime;
          else if ((type === 'tv' || type === 'anime') && itemMeta.episode_run_time && itemMeta.episode_run_time.length > 0) {
            runtimeMinutes = itemMeta.episode_run_time[0];
          } else if ((type === 'tv' || type === 'anime') && itemMeta.runtime) {
            runtimeMinutes = itemMeta.runtime;
          }
        }

        const title = itemMeta ? (itemMeta.title || itemMeta.name || itemMeta.original_name || "Unknown") : "Unknown";
        const poster = itemMeta && itemMeta.poster_path ? `${IMG_URL}${itemMeta.poster_path}` : "";
        const durationSeconds = runtimeMinutes * 60;

        // Re-inject estimated currentTime if imported from Trakt
        try {
          const tempSaved = JSON.parse(localStorage.getItem(`progress_${id}`));
          if (tempSaved && tempSaved.progress && (!tempSaved.currentTime || tempSaved.isEstimated)) {
            tempSaved.currentTime = (tempSaved.progress / 100) * durationSeconds;
            tempSaved.duration = durationSeconds;
            localStorage.setItem(`progress_${id}`, JSON.stringify(tempSaved));
          }
        } catch (e) { }

        // 1. Instant "Ping" registration at 0s
        let cw = getContinueWatching();
        cw = cw.filter(c_id => String(c_id) !== String(id));
        cw.unshift(id);
        if (cw.length > 20) cw = cw.slice(0, 20);
        localStorage.setItem('continue_watching', JSON.stringify(cw));

        // Grab existing progress if any, or start at 0
        let currentSeconds = 0;
        try {
          const existing = JSON.parse(localStorage.getItem(`progress_${id}`));
          if (existing && existing.currentTime) currentSeconds = existing.currentTime;
        } catch (e) { }

        const updateProgress = (seconds) => {
          const savedObj = {
            id: id,
            mediaType: type,
            currentTime: seconds,
            duration: durationSeconds,
            progress: (seconds / durationSeconds) * 100,
            title: title,
            poster: poster,
            updatedAt: Date.now(),
            isEstimated: true // Flag indicating it was tracked by the background timer
          };
          localStorage.setItem(`progress_${id}`, JSON.stringify(savedObj));
          if (typeof SupabaseSync !== 'undefined') SupabaseSync.updateProgress(id, type, seconds, season, episode);

          // If reached the end, mark as watched
          if (seconds >= durationSeconds * 0.9) {
            if (type === 'movie') {
              if (typeof TraktSync !== 'undefined') TraktSync.markWatched(id, 'movie');
            } else if (type === 'tv' || type === 'anime') {
              markEpisodeWatched(id, season, episode);
              const icon = document.getElementById(`watch-icon-${id}-${season}-${episode}`);
              if (icon) {
                icon.style.color = '#46d369';
                icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
              }
            }
          }
        };

        updateProgress(currentSeconds); // Initial ping

        // 2. Background Heartbeat (tick every 10 seconds)
        let elapsedSessionSeconds = 0;
        const FIVE_HOURS_SEC = 18000;

        window.manualFallbackTimer = setInterval(() => {
          elapsedSessionSeconds += 10;
          currentSeconds += 10;

          // 5-Hour Safety Limit: Reset to 0 if they left it running forever
          if (elapsedSessionSeconds >= FIVE_HOURS_SEC) {
            currentSeconds = 0;
            clearInterval(window.manualFallbackTimer);
            window.manualFallbackTimer = null;
          }

          // Cap at duration
          if (currentSeconds > durationSeconds) currentSeconds = durationSeconds;

          updateProgress(currentSeconds);
        }, 10000);
      }

      // Show disclaimer if Server has Ads
      const disclaimer = document.getElementById('s3-disclaimer');
      if (disclaimer) {
        disclaimer.style.display = (serverConfig && !serverConfig.adFree) ? 'block' : 'none';
      }
    }

    function showLegal(type) {
      legalModal.classList.add('active');
      lockScroll();

      if (type === 'tos') {
        legalContent.innerHTML = `
          <h2 style="margin-bottom: 20px; color: var(--primary-color);">Terms of Service</h2>
          <p style="margin-bottom: 15px; line-height: 1.6;">Welcome to Prisma. This application is an <strong>educational project</strong> created for the purpose of demonstrating UI/UX design principles and modern web development techniques.</p>
          <h3 style="margin: 20px 0 10px; color: #fff;">1. Content Disclaimer</h3>
          <p style="margin-bottom: 15px; line-height: 1.6;">Prisma does <strong>not host, store, or distribute</strong> any media files or video content. All metadata (titles, descriptions, posters) is retrieved from the <a href="https://www.themoviedb.org/" target="_blank" style="color: var(--primary-color);">TMDb API</a>. All video playback is handled by third-party external providers. Prisma acts solely as a user interface layer to display publicly available content.</p>
          <h3 style="margin: 20px 0 10px; color: #fff;">2. Copyright Concerns</h3>
          <p style="margin-bottom: 15px; line-height: 1.6;">If you are a copyright holder and wish to request the removal of any content, please contact the <strong>original content providers</strong> (e.g., TMDb, YouTube, or the video hosting services) directly. Prisma has no control over external media and cannot take down content from third-party servers.</p>
          <h3 style="margin: 20px 0 10px; color: #fff;">3. No Warranty</h3>
          <p style="margin-bottom: 15px; line-height: 1.6;">This software is provided "as is", without warranty of any kind. Use at your own risk. The developer is not responsible for how this tool is used or for any content accessed through it.</p>
        `;
      } else {
        legalContent.innerHTML = `
          <h2 style="margin-bottom: 20px; color: var(--primary-color);">Privacy Policy</h2>
          <p style="margin-bottom: 15px; line-height: 1.6;">Your privacy is important to us. Here is how Prisma handles data:</p>
          <ul style="margin-left: 20px; margin-bottom: 15px; line-height: 1.6; list-style-type: disc;">
            <li><strong>No Personal Data Collection</strong>: Prisma does not require an account, email, or any personal identification.</li>
            <li><strong>Local Storage Only</strong>: Any data you save (like your Watchlist or video progress) is stored <strong>locally on your own device</strong> using browser LocalStorage. This data never leaves your device and is not sent to any servers.</li>
            <li><strong>Third-Party Privacy</strong>: When you watch a video or view metadata, your browser interacts with third-party services (TMDb, YouTube, etc.). Please refer to their respective privacy policies regarding how they handle your IP address and cookies.</li>
          </ul>
        `;
      }
    }

    if (closeLegal) {
      closeLegal.onclick = () => {
        legalModal.classList.remove('active');
        unlockScroll();
      };
    }

    function closePlayerModal(isHardwareBack = false) {
      if (!playerModal.classList.contains('active')) return;
      playerModal.classList.remove('active');
      unlockScroll();
      playerIframe.src = "";
      playerIframe.removeAttribute('sandbox'); // Reset sandbox from sports mode

      if (window.manualFallbackTimer) {
        clearInterval(window.manualFallbackTimer);
        window.manualFallbackTimer = null;
      }

      // Clean up next prompt
      window.nextPromptShown = false;
      const promptContainer = document.getElementById('next-prompt-container');
      if (promptContainer) promptContainer.innerHTML = '';

      // Clean up switch server UI
      hideSwitchServerBtn();

      // Revert title to details or home
      const meta = playerIframe.dataset.meta ? JSON.parse(playerIframe.dataset.meta) : null;
      if (meta && (meta.title || meta.name)) {
        document.title = `${meta.title || meta.name} - Prisma`;
      } else {
        document.title = "Prisma - Stream Movies & TV Shows";
      }

      // Restore the global back button if the underlying state needs it
      if ((window.location.pathname.includes('details.html') || window.location.pathname.includes('iptv.html')) || (history.state && (history.state.view === 'search' || history.state.view === 'actor' || history.state.view === 'similar_all' || history.state.view === 'details'))) {
        globalBackBtn?.classList.add('active');
      }

      updateContinueWatchingUI();
    }

    closeModal?.addEventListener('click', () => {
      // If we use history.back() here, cross-origin iframes that navigated internally 
      // will steal the back navigation, causing the user to have to click X multiple times,
      // eventually popping past the details page to the home page.
      if (history.state && history.state.playerOpen) {
        // Overwrite the current state to remove playerOpen, so a hardware back button
        // doesn't have to be pressed twice later.
        const newState = { ...history.state };
        delete newState.playerOpen;
        history.replaceState(newState, '', window.location.hash.replace('-player', ''));
      }
      closePlayerModal();
    });



    window.addEventListener("message", (event) => {
      try {
        if (!event.origin.includes("vidking.net")) return;

        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type !== "PLAYER_EVENT") return;

        const { id, currentTime, duration, progress, mediaType } = data;

        if (!id) return;

        let meta = {};
        if (playerIframe.dataset.meta) {
          meta = JSON.parse(playerIframe.dataset.meta);
        }

        // Dynamic timing: trigger next prompt near end credits
        // Must run BEFORE the progress filter below (which skips > 95%)
        if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
          const timeRemaining = duration - currentTime;
          let threshold;
          if (duration <= 1800) threshold = 90;
          else if (duration <= 3600) threshold = 120;
          else threshold = 300;

          if (timeRemaining <= threshold && timeRemaining > 0) {
            window.nextPromptShown = true;
            showNextPrompt(meta);
          }
        }

        // Skip saving progress for very start/end to keep continue-watching clean
        if (progress < 0.01 || progress > 0.95) return;

        const title = meta.title || meta.name || meta.original_name || "Unknown";
        const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

        const savedObj = {
          id: id,
          mediaType: mediaType || meta.mediaType || "movie",
          currentTime: currentTime,
          duration: duration,
          progress: progress,
          title: title,
          poster: poster,
          updatedAt: Date.now()
        };

        localStorage.setItem(`progress_${id}`, JSON.stringify(savedObj));

        let cw = getContinueWatching();
        cw = cw.filter(c_id => String(c_id) !== String(id));
        cw.unshift(id);
        if (cw.length > 20) cw = cw.slice(0, 20);
        localStorage.setItem('continue_watching', JSON.stringify(cw));
        if (typeof SupabaseSync !== 'undefined') {
          SupabaseSync.updateProgress(id, mediaType || meta.mediaType || "movie", currentTime, meta.season || null, meta.episode || null);
        }

      } catch (e) { }
    });

    // ── Service Worker ───────────────────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Register sw.js without dynamic timestamp to prevent infinite reload loops
        const swUrl = `./sw.js`;

        navigator.serviceWorker.register(swUrl).then(registration => {
          // Check for updates manually on load
          registration.update();
        }).catch(() => { });
      });

      // Warn when a new service worker takes over instead of auto-reloading
      let refreshing = false;
      navigator.serviceWorker?.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('Service worker updated. Please refresh manually.');
          // window.location.reload(); // Disabled to prevent any infinite reload loops
        }
      });
    }

    // ── PWA Install Banner ───────────────────────────────────────────────────
    (function () {
      const banner = document.getElementById('pwa-install-banner');
      const installBtn = document.getElementById('pwa-install-btn');
      const dismissBtn = document.getElementById('pwa-dismiss-btn');
      if (!banner) return;

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
      const dismissed = sessionStorage.getItem('pwa-dismissed');
      if (isStandalone || dismissed) return;

      let deferredPrompt = null;

      // Chrome / Android
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => banner.classList.add('visible'), 4000);
      });

      // iOS Safari — no beforeinstallprompt, show manually
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isIOS && isSafari) {
        setTimeout(() => banner.classList.add('visible'), 5000);
      }

      if (installBtn) {
        installBtn?.addEventListener('click', async () => {
          banner.classList.remove('visible');
          sessionStorage.setItem('pwa-dismissed', '1');
          if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
          } else {
            alert('Tap the Share button (\u{1F517}) in Safari, then "Add to Home Screen".');
          }
        });
      }
      if (dismissBtn) {
        dismissBtn?.addEventListener('click', () => {
          banner.classList.remove('visible');
          sessionStorage.setItem('pwa-dismissed', '1');
        });
      }
    })();

    // Videasy & generic progress tracking listener
    window.addEventListener("message", function (event) {
      if (typeof event.data === 'string' && !event.data.includes('progress') && !event.data.includes('MEDIA_DATA')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // Handle generic Videasy/Vidking
        if (data && data.progress !== undefined && data.type) {
          if ((data.type === 'tv' || data.type === 'anime') && data.season && data.episode) {
            if (data.progress > 85) {
              markEpisodeWatched(data.id, data.season, data.episode);
              const icon = document.getElementById(`watch-icon-${data.id}-${data.season}-${data.episode}`);
              if (icon) {
                icon.style.color = '#46d369';
                icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
              }
            }
          }
        }

        // Handle vidsrc.wtf
        if (data && data.type === "MEDIA_DATA" && data.data) {
          const mediaData = data.data;
          const playerIframe = document.getElementById('player-iframe');
          if (!playerIframe) return;

          const tmdbId = playerIframe.getAttribute('data-tmdb-id');
          const season = playerIframe.getAttribute('data-season') || "1";
          const episode = playerIframe.getAttribute('data-episode') || "1";
          const mediaType = playerIframe.getAttribute('data-type') || "movie";

          if (mediaType === 'tv' && mediaData.progress) {
            const watchedSecs = mediaData.progress.watched || 0;
            const durationSecs = mediaData.progress.duration || 1;
            const percent = (watchedSecs / durationSecs) * 100;

            if (percent > 85) {
              markEpisodeWatched(tmdbId, season, episode);
              const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
              if (icon) {
                icon.style.color = '#46d369';
                icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
              }
            }
          }
        }
      } catch (e) { }
    });

    // VidSync & Cinemaos listener
    window.addEventListener("message", function (event) {
      if (typeof event.data === 'string' && !event.data.includes('VIDSYNC_PLAYER_EVENT') && !event.data.includes('PLAYER_EVENT')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && (data.type === "VIDSYNC_PLAYER_EVENT" || data.type === "PLAYER_EVENT") && data.data) {
          const { event: eventName, currentTime, duration } = data.data;

          const playerIframe = document.getElementById('player-iframe');
          if (!playerIframe) return;

          let meta = {};
          if (playerIframe.dataset.meta) {
            meta = JSON.parse(playerIframe.dataset.meta);
          }

          const tmdbId = playerIframe.getAttribute('data-tmdb-id');
          const season = playerIframe.getAttribute('data-season') || "1";
          const episode = playerIframe.getAttribute('data-episode') || "1";
          const mediaType = playerIframe.getAttribute('data-type') || "movie";

          // Dynamic timing: trigger next prompt near end credits
          if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
            const timeRemaining = duration - currentTime;
            let threshold;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;
            else threshold = 300;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }

          // Save progress
          const progressPercent = duration ? (currentTime / duration) : 0;
          if (progressPercent >= 0.01 && progressPercent <= 0.95 && tmdbId) {
            const title = meta.title || meta.name || meta.original_name || "Unknown";
            const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

            const savedObj = {
              id: tmdbId,
              mediaType: mediaType || meta.mediaType || "movie",
              currentTime: currentTime,
              duration: duration,
              progress: progressPercent,
              title: title,
              poster: poster,
              updatedAt: Date.now()
            };

            const now = Date.now();
            if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
              localStorage.setItem(`progress_${tmdbId}`, JSON.stringify(savedObj));
              window._lastProgressSave = now;
              if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
                TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressPercent * 100);
                window._lastTraktScrobble = now;
              }
            }
          }

          // Handle Watched status
          if (mediaType === 'tv' && progressPercent * 100 > 85) {
            markEpisodeWatched(tmdbId, season, episode);
            const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
          }
        }
      } catch (e) { }
    });

    // VixSrc / VidZee listener
    window.addEventListener("message", function (event) {
      if (!event.origin.includes("vixsrc.to") && !event.origin.includes("vidzee.wtf")) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type !== "PLAYER_EVENT" || !data.data) return;

        const { currentTime, duration } = data.data;
        const playerIframe = document.getElementById('player-iframe');
        if (!playerIframe) return;

        let meta = {};
        if (playerIframe.dataset.meta) {
          meta = JSON.parse(playerIframe.dataset.meta);
        }

        const tmdbId = playerIframe.getAttribute('data-tmdb-id');
        const season = playerIframe.getAttribute('data-season') || "1";
        const episode = playerIframe.getAttribute('data-episode') || "1";
        const mediaType = playerIframe.getAttribute('data-type') || "movie";

        if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
          const timeRemaining = duration - currentTime;
          let threshold;
          if (duration <= 1800) threshold = 90;
          else if (duration <= 3600) threshold = 120;
          else threshold = 300;

          if (timeRemaining <= threshold && timeRemaining > 0) {
            window.nextPromptShown = true;
            showNextPrompt(meta);
          }
        }

        const progressPercent = duration ? (currentTime / duration) : 0;
        if (progressPercent >= 0.01 && progressPercent <= 0.95 && tmdbId) {
          const title = meta.title || meta.name || meta.original_name || "Unknown";
          const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

          const savedObj = {
            id: tmdbId,
            mediaType: mediaType || meta.mediaType || "movie",
            currentTime: currentTime,
            duration: duration,
            progress: progressPercent * 100,
            title: title,
            poster: poster,
            updatedAt: Date.now()
          };

          const now = Date.now();
          if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
            localStorage.setItem(`progress_${tmdbId}`, JSON.stringify(savedObj));
            window._lastProgressSave = now;
            if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
              TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressPercent * 100);
              window._lastTraktScrobble = now;
            }
          }
        }

        if (mediaType === 'tv' && progressPercent * 100 > 85) {
          markEpisodeWatched(tmdbId, season, episode);
          const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
          if (icon) {
            icon.style.color = '#46d369';
            icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
          }
        }
      } catch (e) { }
    });

    // Xpass listener
    window.addEventListener("message", function (event) {
      if (event.origin !== 'https://play.xpass.top') return;
      try {
        const data = event.data;
        if (data?.type !== "player.event") return;

        const playerIframe = document.getElementById('player-iframe');
        if (!playerIframe) return;

        const tmdbId = playerIframe.getAttribute('data-tmdb-id');
        const season = playerIframe.getAttribute('data-season') || "1";
        const episode = playerIframe.getAttribute('data-episode') || "1";
        const mediaType = playerIframe.getAttribute('data-type') || "movie";

        let meta = {};
        if (playerIframe.dataset.meta) {
          meta = JSON.parse(playerIframe.dataset.meta);
        }

        if (data.event.name === "ready") {
          // auto resume playback
          const saved = getProgressForId(tmdbId);
          if (saved && saved.currentTime > 0) {
            playerIframe.contentWindow.postMessage({ type: "player.action", action: "playAt", position: saved.currentTime }, "https://play.xpass.top");
          }
        } 
        else if (data.event.name === "position") {
          const currentTime = data.event.position || 0;
          const duration = data.event.duration || 1;
          
          if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
            const timeRemaining = duration - currentTime;
            let threshold = 300;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }

          const progressPercent = duration ? (currentTime / duration) : 0;
          if (progressPercent >= 0.01 && progressPercent <= 0.95 && tmdbId) {
            const title = meta.title || meta.name || meta.original_name || "Unknown";
            const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

            const savedObj = {
              id: tmdbId,
              mediaType: mediaType || meta.mediaType || "movie",
              currentTime: currentTime,
              duration: duration,
              progress: progressPercent * 100,
              title: title,
              poster: poster,
              updatedAt: Date.now()
            };

            const now = Date.now();
            if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
              localStorage.setItem(`progress_${tmdbId}`, JSON.stringify(savedObj));
              window._lastProgressSave = now;
              if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
                TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressPercent * 100);
                window._lastTraktScrobble = now;
              }
            }
          }

          if (mediaType === 'tv' && progressPercent * 100 > 85) {
            markEpisodeWatched(tmdbId, season, episode);
            const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
          }
        }
      } catch (e) { }
    });

    // Cinextream listener
    window.addEventListener("message", function (event) {
      if (event.origin !== 'https://cinextream.net') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || !data.event) return;

        const playerIframe = document.getElementById('player-iframe');
        if (!playerIframe) return;

        const tmdbId = playerIframe.getAttribute('data-tmdb-id');
        const season = playerIframe.getAttribute('data-season') || "1";
        const episode = playerIframe.getAttribute('data-episode') || "1";
        const mediaType = playerIframe.getAttribute('data-type') || "movie";

        let meta = {};
        if (playerIframe.dataset.meta) {
          meta = JSON.parse(playerIframe.dataset.meta);
        }

        if (data.event === "time") {
          const currentTime = data.time || 0;
          const duration = data.duration || 1;
          
          if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
            const timeRemaining = duration - currentTime;
            let threshold = 300;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }

          const progressPercent = duration ? (currentTime / duration) : 0;
          if (progressPercent >= 0.01 && progressPercent <= 0.95 && tmdbId) {
            const title = meta.title || meta.name || meta.original_name || "Unknown";
            const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

            const savedObj = {
              id: tmdbId,
              mediaType: mediaType || meta.mediaType || "movie",
              currentTime: currentTime,
              duration: duration,
              progress: progressPercent * 100,
              title: title,
              poster: poster,
              updatedAt: Date.now()
            };

            const now = Date.now();
            if (!window._lastProgressSave || now - window._lastProgressSave > 5000) {
              localStorage.setItem(`progress_${tmdbId}`, JSON.stringify(savedObj));
              window._lastProgressSave = now;
              if (typeof TraktSync !== 'undefined' && (!window._lastTraktScrobble || now - window._lastTraktScrobble > 30000)) {
                TraktSync.scrobbleProgress(meta.id, meta.mediaType || meta.type, meta.currentSeason || meta.season, meta.currentEpisode || meta.episode, progressPercent * 100);
                window._lastTraktScrobble = now;
              }
            }
          }

          if (mediaType === 'tv' && progressPercent * 100 > 85) {
            markEpisodeWatched(tmdbId, season, episode);
            const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
          }
        } else if (data.event === "VIDEO_ENDED") {
           // Let Cinetaro handle auto-next inside its player if we don't interfere, or we can use our logic.
        }
      } catch (e) { }
    });

    // Cinesrc listener
    window.addEventListener("message", function (event) {
      if (event.origin !== 'https://cinesrc.st') return;
      try {
        const { type, ...data } = event.data;
        const playerIframe = document.getElementById('player-iframe');
        if (!playerIframe) return;

        let meta = {};
        if (playerIframe.dataset.meta) {
          meta = JSON.parse(playerIframe.dataset.meta);
        }

        const tmdbId = playerIframe.getAttribute('data-tmdb-id');
        const season = playerIframe.getAttribute('data-season') || "1";
        const episode = playerIframe.getAttribute('data-episode') || "1";
        const mediaType = playerIframe.getAttribute('data-type') || "movie";

        if (type === 'cinesrc:timeupdate') {
          const currentTime = data.currentTime;
          const duration = data.duration;

          if (!window.nextPromptShown && duration > 0 && currentTime > 0) {
            const timeRemaining = duration - currentTime;
            let threshold;
            if (duration <= 1800) threshold = 90;
            else if (duration <= 3600) threshold = 120;
            else threshold = 300;

            if (timeRemaining <= threshold && timeRemaining > 0) {
              window.nextPromptShown = true;
              showNextPrompt(meta);
            }
          }

          const progressPercent = duration ? (currentTime / duration) : 0;
          if (currentTime > 3 && progressPercent <= 0.95 && tmdbId) {
            const title = meta.title || meta.name || meta.original_name || "Unknown";
            const poster = meta.poster_path ? `${IMG_URL}${meta.poster_path}` : "";

            const savedObj = {
              id: tmdbId,
              mediaType: mediaType || meta.mediaType || "movie",
              currentTime: currentTime,
              duration: duration,
              progress: progressPercent,
              title: title,
              poster: poster,
              updatedAt: Date.now()
            };

            localStorage.setItem(`progress_${tmdbId}`, JSON.stringify(savedObj));

            let cw = getContinueWatching();
            cw = cw.filter(c_id => String(c_id) !== String(tmdbId));
            cw.unshift(tmdbId);
            if (cw.length > 20) cw = cw.slice(0, 20);
            localStorage.setItem('continue_watching', JSON.stringify(cw));
          }
        } else if (type === 'cinesrc:ended') {
          if (mediaType === 'tv' || mediaType === 'anime') {
            markEpisodeWatched(tmdbId, season, episode);
            const icon = document.getElementById(`watch-icon-${tmdbId}-${season}-${episode}`);
            if (icon) {
              icon.style.color = '#46d369';
              icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
            }
          }
        } else if (type === 'cinesrc:nextepisode') {
          if (data && data.season && data.episode) {
            setTimeout(() => {
              openPlayer(tmdbId, mediaType, data.season, data.episode, 'cinesrc');
            }, 500);
          }
        }
      } catch (e) { }
    });

    document.addEventListener("DOMContentLoaded", initApp);

    // --- Cache Settings Logic ---
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const openCacheSettingsBtn = document.getElementById('open-cache-settings');
    const cacheSettingsView = document.getElementById('cache-settings-view');
    const closeCacheSettingsBtn = document.getElementById('close-cache-settings');
    const cacheTotalSize = document.getElementById('cache-total-size');
    const cacheSectionsContainer = document.getElementById('cache-sections-container');
    const exportCacheBtn = document.getElementById('export-cache-btn');
    const importCacheBtn = document.getElementById('import-cache-btn');
    const importFileInput = document.getElementById('import-file-input');
    const masterClearBtn = document.getElementById('master-clear-btn');
    const cacheClearModal = document.getElementById('cache-clear-modal');
    const cacheModalTitle = document.getElementById('cache-modal-title');
    const cacheModalDesc = document.getElementById('cache-modal-desc');
    const cacheModalCancel = document.getElementById('cache-modal-cancel');
    const cacheModalConfirm = document.getElementById('cache-modal-confirm');

    let currentClearAction = null;

    // Toggle Dropdown
    settingsToggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!settingsToggleBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
        settingsDropdown.classList.remove('active');
      }
    });

    // Open/Close Cache Settings
    openCacheSettingsBtn?.addEventListener('click', () => {
      settingsDropdown.classList.remove('active');
      lockScroll();
      cacheSettingsView.classList.remove('hidden');
      cacheSettingsView.classList.add('active');
      renderCacheSettings();
    });

    // --- Global Preferences & App Info Logic ---
    const openServerTestBtn = document.getElementById('open-server-test-btn');
    openServerTestBtn?.addEventListener('click', () => {
      document.getElementById('account-dropdown').classList.remove('active');
      document.getElementById('settings-dropdown').classList.remove('active');
      updateState({ view: 'server_test' });
    });

    const toggleAutoplayBtn = document.getElementById('toggle-autoplay-btn');
    const autoplayToggleSwitch = document.getElementById('autoplay-toggle-switch');
    const openAppInfoBtn = document.getElementById('open-app-info-btn');
    const appInfoModal = document.getElementById('app-info-modal');
    const closeAppInfo = document.getElementById('close-app-info');
    const reportIssueBtn = document.getElementById('report-issue-btn');

    // Initialize Preferences
    window.isAutoplayEnabled = localStorage.getItem('autoplay_pref') !== 'false'; // Default true

    if (!window.isAutoplayEnabled) {
      autoplayToggleSwitch?.classList.remove('active');
    }

    // Toggle Autoplay
    toggleAutoplayBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.isAutoplayEnabled = !window.isAutoplayEnabled;
      autoplayToggleSwitch?.classList.toggle('active', window.isAutoplayEnabled);
      localStorage.setItem('autoplay_pref', window.isAutoplayEnabled ? 'true' : 'false');
    });

    // App Info Modal
    openAppInfoBtn?.addEventListener('click', () => {
      settingsDropdown.classList.remove('active');
      appInfoModal.classList.add('active');
      lockScroll();
    });

    closeAppInfo?.addEventListener('click', () => {
      appInfoModal.classList.remove('active');
      unlockScroll();
    });

    const jokeModal = document.getElementById('joke-modal');
    const closeJokeModal = document.getElementById('close-joke-modal');

    reportIssueBtn?.addEventListener('click', () => {
      appInfoModal.classList.remove('active');
      jokeModal.classList.add('active');
    });

    closeJokeModal?.addEventListener('click', () => {
      jokeModal.classList.remove('active');
      unlockScroll();
    });

    closeCacheSettingsBtn?.addEventListener('click', () => {
      unlockScroll();
      cacheSettingsView.classList.remove('active');
      setTimeout(() => cacheSettingsView.classList.add('hidden'), 400);
      // Re-render main view if needed
      if (!detailsView.classList.contains('active')) {
        renderWatchlistRow();
        renderContinueWatching();
      }
    });

    // Size Calculation
    function calculateStorageSize() {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        total += key.length + localStorage.getItem(key).length;
      }
      return (total / 1024).toFixed(2);
    }

    // Modal Logic
    function openCacheModal(title, desc, confirmCallback) {
      cacheModalTitle.textContent = title;
      cacheModalDesc.textContent = desc;
      currentClearAction = confirmCallback;
      cacheClearModal.classList.add('active');
    }

    cacheModalCancel?.addEventListener('click', () => {
      cacheClearModal.classList.remove('active');
      currentClearAction = null;
    });

    cacheModalConfirm?.addEventListener('click', () => {
      if (currentClearAction) currentClearAction();
      cacheClearModal.classList.remove('active');
    });

    // Master Clear
    masterClearBtn?.addEventListener('click', () => {
      openCacheModal(
        "Master Clear All Data?",
        "This will permanently delete all watch progress, your watchlist, watched episodes history, and server preferences. This cannot be undone.",
        () => {
          localStorage.clear();
          renderCacheSettings();
        }
      );
    });

    // Export/Import
    exportCacheBtn?.addEventListener('click', () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('sb-') || key.startsWith('trakt_') || key === 'supabase_session') continue;
        data[key] = localStorage.getItem(key);
      }
      const exportObj = {
        _prisma_export_version: 1,
        timestamp: Date.now(),
        data: data
      };

      const filename = `prisma_backup_${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });

      // Fallback for iOS/mobile if navigator.share supports sharing files
      if (navigator.share && /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document)) {
        try {
          const file = new File([blob], filename, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              title: 'Prisma Backup',
              files: [file]
            }).catch(console.error);
            return;
          }
        } catch (e) { console.warn("Share API failed", e); }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    importCacheBtn?.addEventListener('click', () => importFileInput.click());

    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);

          // Support both legacy backups (raw key-value map) and new v1 format
          const dataToImport = imported._prisma_export_version ? imported.data : imported;

          if (!dataToImport || typeof dataToImport !== 'object') {
            alert('Invalid Prisma backup file format.');
            return;
          }

          let quotaHit = false;
          Object.keys(dataToImport).forEach(key => {
            if (key === '_prisma_export_version' || key === 'timestamp') return;
            if (key.startsWith('sb-') || key.startsWith('trakt_') || key === 'supabase_session') return;
            try {
              localStorage.setItem(key, dataToImport[key]);
            } catch (e) {
              quotaHit = true;
            }
          });

          if (quotaHit) {
            alert('Backup partially imported. Your browser storage limit was reached (QuotaExceededError). Clear some Watch History or Settings and try again to import the rest.');
          } else {
            alert('Backup imported successfully!');
          }
          renderCacheSettings();

        } catch (err) {
          alert('Error reading backup file.');
        }
        importFileInput.value = ''; // reset
      };
      reader.readAsText(file);
    });
    // Main Render Function

    // Global deletion functions
    window.deleteCacheKey = function (key) {
      localStorage.removeItem(key);
      if (key.startsWith('progress_')) {
        // Also remove from continue_watching array if it's there
        try {
          let cw = JSON.parse(localStorage.getItem('continue_watching') || '[]');
          const id = key.replace('progress_', '');
          cw = cw.filter(i => i.id != id);
          localStorage.setItem('continue_watching', JSON.stringify(cw));
          if (typeof SupabaseSync !== 'undefined') SupabaseSync.removeFromContinueWatching(id, 'movie');
          if (typeof SupabaseSync !== 'undefined') SupabaseSync.removeFromContinueWatching(id, 'tv');
        } catch (e) { }
      }
      renderCacheSettings();
    };

    window.removeWatchlistItem = function (index) {
      try {
        let list = JSON.parse(localStorage.getItem('watchlist') || '[]');
        list.splice(index, 1);
        localStorage.setItem('watchlist', JSON.stringify(list));
        renderCacheSettings();
      } catch (e) { }
    };

    window.clearCategoryPrefix = function (prefix) {
      openCacheModal(
        "Clear Category?",
        `Are you sure you want to delete all data for this category?`,
        () => {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) keysToRemove.push(key);
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
          if (prefix === 'progress_') localStorage.removeItem('continue_watching');
          renderCacheSettings();
        }
      );
    };

    // ── Live Sports API (Streamed.pk & CDNLivetv) ─────────────────────────
    window.sportsInitialized = false;
    window.channelsLoaded = false;
    window.matchesLoaded = false;

    window.filterSports = function (query) {
      const lowerQuery = query.toLowerCase();
      const isChannels = document.getElementById('sports-channels-view').style.display === 'block';
      const grid = isChannels ? document.getElementById('channels-grid') : document.getElementById('sports-grid');
      const cards = grid.querySelectorAll('.card');

      if (!cards || cards.length === 0) return;

      let hasVisible = false;
      cards.forEach(card => {
        const titleEl = card.querySelector('.card-title');
        const text = titleEl ? titleEl.textContent.toLowerCase() : card.textContent.toLowerCase();
        if (text.includes(lowerQuery)) {
          card.style.display = 'flex';
          hasVisible = true;
        } else {
          card.style.display = 'none';
        }
      });

      const emptyMsgId = isChannels ? 'channels-empty-msg' : 'sports-empty-msg';
      const emptyMsg = document.getElementById(emptyMsgId);

      if (!hasVisible && query !== '') {
        if (!emptyMsg.dataset.originalText) emptyMsg.dataset.originalText = emptyMsg.innerText;
        emptyMsg.innerText = `No results found for "${query}"`;
        emptyMsg.style.display = 'block';
      } else if (hasVisible) {
        emptyMsg.style.display = 'none';
        if (emptyMsg.dataset.originalText) emptyMsg.innerText = emptyMsg.dataset.originalText;
      }
    };

    window.toggleSportsDropdown = function(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('sports-dropdown-menu');
      if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
    };

    document.addEventListener('click', function(event) {
      const dropdown = document.querySelector('.sports-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        const menu = document.getElementById('sports-dropdown-menu');
        if (menu) menu.style.display = 'none';
      }
    });

    window.switchSportsTab = function (tab) {
      const tabChannels = document.getElementById('tab-channels');
      if (tabChannels) {
        tabChannels.style.color = tab === 'channels' ? '#fff' : '#888';
        tabChannels.style.borderBottomColor = tab === 'channels' ? '#e50914' : 'transparent';
      }
      
      const tabMatchStats = document.getElementById('tab-match-stats');
      if (tabMatchStats) {
        tabMatchStats.style.color = tab === 'match-stats' ? '#fff' : '#888';
        tabMatchStats.style.borderBottomColor = tab === 'match-stats' ? '#e50914' : 'transparent';
      }
      
      const tabSportsNews = document.getElementById('tab-sports-news');
      if (tabSportsNews) {
        tabSportsNews.style.color = tab === 'sports-news' ? '#fff' : '#888';
        tabSportsNews.style.borderBottomColor = tab === 'sports-news' ? '#e50914' : 'transparent';
      }
      
      const tabLiveMatchesGroup = document.getElementById('tab-live-matches-group');
      if (tabLiveMatchesGroup) {
        const isActive = tab === 'matches' || tab === 'esportex' || tab === 'streamfree' || tab === 'watchfooty';
        tabLiveMatchesGroup.style.color = isActive ? '#fff' : '#888';
        tabLiveMatchesGroup.style.borderBottomColor = isActive ? '#e50914' : 'transparent';
      }

      const dropdownMenu = document.getElementById('sports-dropdown-menu');
      if (dropdownMenu) {
        dropdownMenu.style.display = 'none';
      }

      const channelsView = document.getElementById('sports-channels-view');
      if (channelsView) channelsView.style.display = tab === 'channels' ? 'block' : 'none';
      
      const matchesView = document.getElementById('sports-matches-view');
      if (matchesView) matchesView.style.display = tab === 'matches' ? 'block' : 'none';
      
      const esportexView = document.getElementById('sports-esportex-view');
      if (esportexView) esportexView.style.display = tab === 'esportex' ? 'block' : 'none';

      const streamfreeView = document.getElementById('sports-streamfree-view');
      if (streamfreeView) streamfreeView.style.display = tab === 'streamfree' ? 'block' : 'none';

      const watchfootyView = document.getElementById('sports-watchfooty-view');
      if (watchfootyView) watchfootyView.style.display = tab === 'watchfooty' ? 'block' : 'none';

      const matchStatsView = document.getElementById('sports-match-stats-view');
      if (matchStatsView) matchStatsView.style.display = tab === 'match-stats' ? 'block' : 'none';

      const sportsNewsView = document.getElementById('sports-news-view');
      if (sportsNewsView) sportsNewsView.style.display = tab === 'sports-news' ? 'block' : 'none';

      if (tab === 'channels') {
        if (!window.cdnTabsInitialized) {
          window.switchCdnTab('channels');
          window.cdnTabsInitialized = true;
        }
      } else if (tab === 'matches' && !window.matchesLoaded) {
        initSportsAPI();
      } else if (tab === 'esportex' && typeof initEsportex === 'function') {
        initEsportex();
      } else if (tab === 'streamfree' || tab === 'watchfooty') {
        if (typeof window.initSportsServers === 'function') {
          window.initSportsServers(tab);
        }
      } else if (tab === 'match-stats') {
        if (typeof window.initMatchStats === 'function') {
          window.initMatchStats();
        }
      } else if (tab === 'sports-news') {
        if (typeof fetchSportsNews === 'function') {
          fetchSportsNews();
        }
      } else {
        if (document.getElementById('search-input') && document.getElementById('search-input').value) {
          window.filterSports(document.getElementById('search-input').value.trim());
        }
      }
    };

    async function initSportsAPI() {
      try {
        const response = await fetch('https://streamed.pk/api/sports');
        const categories = await response.json();
        const select = document.getElementById('sports-category-filter');
        
        // Fetch matches for all categories to get counts
        const fetchPromises = categories.map(cat => 
          fetch(`https://streamed.pk/api/matches/${cat.id}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        );
        
        const results = await Promise.all(fetchPromises);
        
        let allCount = 0;
        const counts = {};
        categories.forEach((cat, index) => {
          const matches = results[index] || [];
          counts[cat.id] = matches.length;
          allCount += matches.length;
        });

        select.innerHTML = `<option value="all">All Sports (${allCount})</option>`;
        categories.forEach(cat => {
          select.insertAdjacentHTML('beforeend', `<option value="${cat.id}">${cat.name} (${counts[cat.id]})</option>`);
        });
        
        fetchStreamedMatches('all');
        window.matchesLoaded = true;
      } catch (e) {
        console.error("Failed to fetch sports categories", e);
        fetchStreamedMatches('football'); // fallback
      }
    }

    window.fetchStreamedMatches = async function (category) {
      const loader = document.getElementById('sports-loader');
      const grid = document.getElementById('sports-grid');
      const emptyMsg = document.getElementById('sports-empty-msg');

      loader.classList.add('active');
      grid.innerHTML = '';
      emptyMsg.style.display = 'none';

      try {
        const response = await fetch(`https://streamed.pk/api/matches/${category}`);
        if (!response.ok) throw new Error('API Error');
        const matches = await response.json();

        if (!matches || matches.length === 0) {
          emptyMsg.style.display = 'block';
          return;
        }

        const now = Date.now();
        grid.innerHTML = matches.map(match => {
          const matchTime = new Date(match.date);
          const isLive = now >= matchTime.getTime();
          const timeStr = matchTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: window.sportsUse12HourFormat 
          });
          const dateStr = matchTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
          const badgeHtml = isLive
            ? `<span style="background: #e50914; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">LIVE</span>`
            : `<span style="background: #555; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.7rem;">UPCOMING at ${timeStr}</span>`;

          const posterUrl = match.poster ? `https://streamed.pk${match.poster}` : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

          let teamsHtml = '';
          if (match.teams && match.teams.home && match.teams.away) {
            const homeBadge = match.teams.home.badge ? `<img src="https://streamed.pk/api/images/badge/${match.teams.home.badge}.webp" style="width:30px;height:30px;object-fit:contain;background:rgba(255,255,255,0.1);border-radius:50%;padding:2px;" onerror="this.style.display='none'">` : '';
            const awayBadge = match.teams.away.badge ? `<img src="https://streamed.pk/api/images/badge/${match.teams.away.badge}.webp" style="width:30px;height:30px;object-fit:contain;background:rgba(255,255,255,0.1);border-radius:50%;padding:2px;" onerror="this.style.display='none'">` : '';

            if (homeBadge || awayBadge) {
              teamsHtml = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;">
                  ${homeBadge}
                  <span style="color: rgba(255,255,255,0.4); font-size: 0.7rem; font-weight: bold;">VS</span>
                  ${awayBadge}
                </div>
              `;
            }
          }

          return `
            <div class="card" onclick="playStreamedMatch('${encodeURIComponent(JSON.stringify(match.sources))}')">
              <img src="${posterUrl}" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='">
              <div class="card-badge badge-type" style="background: rgba(0,0,0,0.8);">${dateStr}</div>
              <div class="card-badge badge-rating">${isLive ? 'LIVE' : timeStr}</div>
              ${!isLive ? `<div class="esportex-countdown" data-start="${matchTime.getTime()}" style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.2); z-index: 5;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>--:--:--</span>
              </div>` : ''}
              <div class="card-play-overlay">
                <div class="card-play-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>
              </div>
              <div class="card-info" style="text-align: center;">
                ${teamsHtml}
                <div class="card-title">${match.title}</div>
              </div>
            </div>
          `;
        }).join('');
      } catch (e) {
        console.error(e);
        emptyMsg.innerHTML = "Failed to load matches. The API might be blocking browser requests.";
        emptyMsg.style.display = 'block';
      } finally {
        loader.classList.remove('active');
        if (document.getElementById('search-input').value) {
          window.filterSports(document.getElementById('search-input').value.trim());
        }
      }
    };

    window.playStreamedMatch = async function (sourcesJson) {
      try {
        const sources = JSON.parse(decodeURIComponent(sourcesJson));
        if (!sources || sources.length === 0) {
          alert('No streams available for this match yet.');
          return;
        }

        document.getElementById('sports-loader').classList.add('active');

        // Fetch all sources concurrently
        const fetchPromises = sources.map(source =>
          fetch(`https://streamed.pk/api/stream/${source.source}/${source.id}`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        );

        const results = await Promise.all(fetchPromises);
        document.getElementById('sports-loader').classList.remove('active');

        // Flatten all streams
        let allStreams = [];
        results.forEach(streamsArray => {
          if (Array.isArray(streamsArray)) {
            allStreams = allStreams.concat(streamsArray);
          }
        });

        if (allStreams.length === 0) {
          alert('No streams available right now.');
          return;
        }

        const listContainer = document.getElementById('stream-selector-list');
        listContainer.innerHTML = '';

        allStreams.forEach(stream => {
          const embedUrl = stream.embedUrl || stream.url || stream.link;
          if (!embedUrl) return;

          const quality = stream.hd ? '<span style="background:#e50914;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:bold;">HD</span>' : '<span style="background:#555;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:bold;">SD</span>';

          listContainer.insertAdjacentHTML('beforeend', `
            <button onclick="playSelectedStream('${embedUrl}')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center; color: white; cursor: pointer; transition: background 0.2s; text-align: left;">
              <div>
                <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 5px;">Server ${stream.streamNo || '?'} <span style="font-size:0.8rem;color:#aaa;font-weight:normal;text-transform:capitalize;">(${stream.source || 'Unknown'})</span></div>
                <div style="color: #ccc; font-size: 0.9rem;">${stream.language || 'Unknown Language'}</div>
              </div>
              <div>${quality}</div>
            </button>
          `);
        });

        document.getElementById('stream-selector-modal').style.display = 'flex';

      } catch (e) {
        console.error("Failed to load stream", e);
        document.getElementById('sports-loader').classList.remove('active');
        alert("Failed to connect to the stream provider.");
      }
    };

    window.playSelectedStream = function (embedUrl) {
      document.getElementById('stream-selector-modal').style.display = 'none';
      playerIframe.removeAttribute('sandbox');
      playerIframe.src = embedUrl;
      const switchBtn = document.getElementById('ac-switch-btn');
      if (switchBtn) switchBtn.style.display = 'none';

      // Pause background trailer if it's playing
      const bgTrailer = document.getElementById('bg-trailer');
      if (bgTrailer && !bgTrailer.paused) {
        bgTrailer.pause();
      }

      playerModal.classList.add('active');
    };

    window.switchCdnTab = function (tab) {
      document.getElementById('cdn-tab-events').classList.remove('active');
      document.getElementById('cdn-tab-channels').classList.remove('active');
      document.getElementById('cdn-events-view').style.display = 'none';
      document.getElementById('cdn-channels-view').style.display = 'none';

      document.getElementById('cdn-tab-events').style.background = 'rgba(255, 255, 255, 0.05)';
      document.getElementById('cdn-tab-events').style.borderColor = 'transparent';
      document.getElementById('cdn-tab-events').style.color = '#aaa';
      document.getElementById('cdn-tab-channels').style.background = 'rgba(255, 255, 255, 0.05)';
      document.getElementById('cdn-tab-channels').style.borderColor = 'transparent';
      document.getElementById('cdn-tab-channels').style.color = '#aaa';

      if (tab === 'events') {
        document.getElementById('cdn-tab-events').classList.add('active');
        document.getElementById('cdn-events-view').style.display = 'block';
        document.getElementById('cdn-tab-events').style.background = 'rgba(229, 9, 20, 0.2)';
        document.getElementById('cdn-tab-events').style.borderColor = '#e50914';
        document.getElementById('cdn-tab-events').style.color = '#fff';
        if (!window.cdnSportsLoaded) fetchCdnSports();
      } else {
        document.getElementById('cdn-tab-channels').classList.add('active');
        document.getElementById('cdn-channels-view').style.display = 'block';
        document.getElementById('cdn-tab-channels').style.background = 'rgba(229, 9, 20, 0.2)';
        document.getElementById('cdn-tab-channels').style.borderColor = '#e50914';
        document.getElementById('cdn-tab-channels').style.color = '#fff';
        if (!window.channelsLoaded) fetchCdnChannels();
      }
    };

    window.fetchCdnSports = async function () {
      const loader = document.getElementById('cdn-events-loader');
      const grid = document.getElementById('cdn-events-grid');
      const emptyMsg = document.getElementById('cdn-events-empty-msg');

      loader.style.display = 'flex';
      loader.classList.add('active');
      grid.innerHTML = '';
      emptyMsg.style.display = 'none';

      try {
        const response = await fetch('https://api.cdnlivetv.tv/api/v1/events/sports/?user=cdnlivetv&plan=free');
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const sportsData = data['cdn-live-tv'];

        if (!sportsData || sportsData.total_events === 0) {
          emptyMsg.style.display = 'block';
          return;
        }

        window.cdnSportsLoaded = true;
        let html = '';
        const categories = ['Soccer', 'NBA', 'NFL', 'NHL'];
        let allEvents = [];
        categories.forEach(cat => {
          if (sportsData[cat] && Array.isArray(sportsData[cat])) {
            sportsData[cat].forEach(ev => {
              ev.categoryName = cat;
              allEvents.push(ev);
            });
          }
        });

        allEvents.sort((a, b) => {
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (a.status !== 'live' && b.status === 'live') return 1;
          return 0;
        });

        allEvents.forEach(match => {
          let statusBadge = '';
          if (match.status === 'live') {
            statusBadge = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(229, 9, 20, 0.9); color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; letter-spacing: 1px; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 12px rgba(229,9,20,0.4);"><span class="pulse-dot" style="width: 6px; height: 6px; background: #fff; border-radius: 50%; display: inline-block;"></span>LIVE</div>`;
          } else if (match.status === 'upcoming') {
            statusBadge = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(5px); color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; letter-spacing: 1px;">UPCOMING</div>`;
          } else {
            statusBadge = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(5px); color: #aaa; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; letter-spacing: 1px;">FINISHED</div>`;
          }

          let tvChannelsHtml = '';
          if (match.channels && match.channels.length > 0) {
            const ch = match.channels[0];
            tvChannelsHtml = `
               <button onclick="playCdnChannel('${ch.url}')" style="width: 100%; background: rgba(229, 9, 20, 0.2); border: 1px solid rgba(229, 9, 20, 0.5); color: white; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: 0.2s;">
                 ? Watch on ${ch.channel_name}
               </button>
             `;
          } else {
            tvChannelsHtml = `<div style="text-align: center; color: #888; font-size: 0.8rem; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">No channels available</div>`;
          }

          html += `
            <div class="card" style="position: relative; padding: 20px; border-radius: 16px; background: linear-gradient(145deg, rgba(40,40,40,0.6) 0%, rgba(20,20,20,0.8) 100%); border: 1px solid rgba(255,255,255,0.05); overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
              ${statusBadge}
              <div style="font-size: 0.75rem; color: #aaa; font-weight: 600; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px;">
                 <img src="${match.countryIMG || 'https://flagcdn.com/w40/us.png'}" style="width: 16px; height: 12px; border-radius: 2px;"> ${match.tournament || match.categoryName}
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 8px;">
                  <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; padding: 10px; display: flex; justify-content: center; align-items: center;">
                    <img src="${match.homeTeamIMG}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='">
                  </div>
                  <span style="font-size: 0.85rem; font-weight: 600; text-align: center; color: #fff;">${match.homeTeam}</span>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: center; padding: 0 15px;">
                  <span style="font-size: 0.8rem; color: #888; font-weight: bold;">VS</span>
                  <span style="font-size: 1.1rem; font-weight: 800; color: #fff; margin-top: 5px;">${match.time || 'TBA'}</span>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 8px;">
                  <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; padding: 10px; display: flex; justify-content: center; align-items: center;">
                    <img src="${match.awayTeamIMG}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='">
                  </div>
                  <span style="font-size: 0.85rem; font-weight: 600; text-align: center; color: #fff;">${match.awayTeam}</span>
                </div>
              </div>
              
              <div>
                ${tvChannelsHtml}
              </div>
            </div>
          `;
        });
        grid.innerHTML = html;
      } catch (e) {
        console.error(e);
        emptyMsg.innerHTML = "Failed to load live events.";
        emptyMsg.style.display = 'block';
      } finally {
        loader.style.display = 'none';
        loader.classList.remove('active');
      }
    };

    window.cdnChannelsData = [];
    window.filterCdnByCountry = function (countryCode) {
      document.querySelectorAll('.country-pill').forEach(btn => {
        if (btn.dataset.code === countryCode) {
          btn.style.background = 'rgba(229, 9, 20, 0.2)';
          btn.style.borderColor = '#e50914';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'rgba(255, 255, 255, 0.05)';
          btn.style.borderColor = 'transparent';
          btn.style.color = '#aaa';
        }
      });

      const grid = document.getElementById('channels-grid');
      let filtered = window.cdnChannelsData;
      if (countryCode !== 'All') {
        filtered = window.cdnChannelsData.filter(c => (c.code || '').toLowerCase() === countryCode.toLowerCase());
      }

      const emptyMsg = document.getElementById('channels-empty-msg');
      if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
      }

      emptyMsg.style.display = 'none';
      grid.innerHTML = filtered.map(channel => {
        const statusColor = channel.status === 'online' ? '#4CAF50' : '#e94560';
        
        let cleanName = channel.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const fallbackLogo = window.channelLogos ? (window.channelLogos[cleanName] || '') : '';

        return `
          <div class="card" onclick="playCdnChannel('${channel.url}')" style="aspect-ratio: auto; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: transform 0.2s, background 0.2s;">
            <div style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 6px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; color: rgba(255,255,255,0.5); overflow: hidden; position: relative;">
              <span>${channel.name.substring(0, 2).toUpperCase()}</span>
              <img src="${channel.image}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #fff; padding: 2px; box-sizing: border-box;" onerror="this.onerror=null; ${fallbackLogo ? `this.src='${fallbackLogo}';` : `this.style.display='none';`} this.onerror=function(){this.style.display='none'};">
            </div>
            <div style="flex-grow: 1; min-width: 0;">
              <div style="font-weight: 600; color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${channel.name}</div>
              <div style="font-size: 0.7rem; color: #aaa; margin-top: 3px; display: flex; align-items: center; gap: 8px;">
                <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>${channel.status.toUpperCase()}</span>
                <span style="color: #666;">•</span>
                <span>&#128065; ${channel.viewers || 0}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    window.fetchCdnChannels = async function () {
      const loader = document.getElementById('channels-loader');
      const grid = document.getElementById('channels-grid');
      const emptyMsg = document.getElementById('channels-empty-msg');
      const pillsContainer = document.getElementById('country-pills-container');

      loader.style.display = 'flex';
      loader.classList.add('active');
      
      if (!window.channelLogos) {
          try { window.channelLogos = await window.channelLogosPromise; }
          catch (e) { window.channelLogos = {}; }
      }
      grid.innerHTML = '';
      emptyMsg.style.display = 'none';

      try {
        const response = await fetch('https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free');
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        if (!data.channels || data.channels.length === 0) {
          emptyMsg.style.display = 'block';
          return;
        }

        window.cdnChannelsData = data.channels.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
        window.channelsLoaded = true;

        const countriesMap = new Map();
        window.cdnChannelsData.forEach(c => {
          if (c.code) countriesMap.set(c.code.toLowerCase(), c.code.toUpperCase());
        });

        let pillsHtml = `<button class="country-pill" data-code="All" onclick="filterCdnByCountry('All')" style="background: rgba(229, 9, 20, 0.2); border: 1px solid #e50914; color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; font-size: 0.85rem; flex-shrink: 0;">&#127757; All</button>`;
        Array.from(countriesMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => {
          const flagUrl = `https://flagcdn.com/w40/${code}.png`;
          pillsHtml += `<button class="country-pill" data-code="${code}" onclick="filterCdnByCountry('${code}')" style="background: rgba(255, 255, 255, 0.05); border: 1px solid transparent; color: #aaa; padding: 6px 14px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
             <img src="${flagUrl}" style="width: 16px; height: 12px; border-radius: 2px; object-fit: cover;" onerror="this.style.display='none'"> ${name}
           </button>`;
        });

        pillsContainer.innerHTML = pillsHtml;
        filterCdnByCountry('All');

      } catch (e) {
        console.error(e);
        emptyMsg.innerHTML = "Failed to load channels.";
        emptyMsg.style.display = 'block';
      } finally {
        loader.style.display = 'none';
        loader.classList.remove('active');
      }
    };

    window.playCdnChannel = function (url) {
      playerIframe.removeAttribute('sandbox');
      playerIframe.src = url;
      const switchBtn = document.getElementById('ac-switch-btn');
      if (switchBtn) switchBtn.style.display = 'none';

      // Pause background trailer if it's playing
      const bgTrailer = document.getElementById('bg-trailer');
      if (bgTrailer && !bgTrailer.paused) {
        bgTrailer.pause();
      }

      playerModal.classList.add('active');
    };

    window.toggleHeroMute = function () {
      const video = document.getElementById('bg-trailer');
      const icon = document.getElementById('hero-mute-icon');
      if (!video || !icon) return;
      if (video.muted) {
        video.muted = false;
        icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
      } else {
        video.muted = true;
        icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
      }
    };

    window.isHeroPausedManually = false;
    window.heroTrailerTimeout = null;

    window.toggleHeroPlayPause = function () {
      const video = document.getElementById('bg-trailer');
      const icon = document.getElementById('hero-play-pause-icon');
      if (!video || !icon) return;
      
      if (video.paused) {
        window.isHeroPausedManually = false;
        video.play().catch(e => console.error("Play prevented", e));
        icon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`; // Pause icon
        
        // Reset the 5 min timeout if user manually plays again
        if (window.heroTrailerTimeout) clearTimeout(window.heroTrailerTimeout);
        window.heroTrailerTimeout = setTimeout(() => {
          const v = document.getElementById('bg-trailer');
          if (v && !v.paused) {
             v.pause();
             window.isHeroPausedManually = true;
             const i = document.getElementById('hero-play-pause-icon');
             if (i) i.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`; // Play icon
          }
        }, 5 * 60 * 1000);
      } else {
        video.pause();
        window.isHeroPausedManually = true;
        icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`; // Play icon
      }
    };

    window.renderServerTestView = async function () {
      serverTestView.classList.remove('hidden');
      window.scrollTo(0, 0);

      const content = document.getElementById('st-content');
      content.innerHTML = '<div style="text-align: center; padding: 50px; color: #fff;">Loading Servers...</div>';

      let uptimeData = null;

      const animeServerIds = ['vidnest-animepahe', 'tryembed', 'vidnest', 'vidlink', 'cinextream', 'vidcore', 'filmu'];
      
      const platformServers = [
        { id: 'prisma-system', name: 'Prisma Host', url: 'https://gametec-hotshot.github.io/movie/', label: 'Platform Website' }
      ];

      // Separate servers
      const animeServers = SERVERS.filter(s => animeServerIds.includes(s.id) && !s.autoCheck);
      const standardServers = SERVERS.filter(s => !animeServerIds.includes(s.id) && !s.autoCheck);
      
      const liveSportsServers = [
        { id: 'ls-streamed', name: 'Streamed.pk', url: 'https://streamed.pk', label: 'Live Matches API 1' },
        { id: 'ls-cdnlivetv', name: 'CDNLivetv', url: 'https://api.cdnlivetv.tv', label: 'Live Events API' },
        { id: 'ls-esportex', name: 'Esportex', url: 'https://api.esportex.site', label: 'Live Matches API 2' }
      ];



      content.innerHTML = `
        <div id="monthly-ranking-container">
           <div style="text-align: center; padding: 40px; color: #888;">
             <span class="st-ping-dot yellow" style="display:inline-block; margin-right: 10px; animation: pulse 1s infinite;"></span> Loading Monthly Rankings...
           </div>
        </div>

        <h2 class="st-section-title" style="margin-top: 40px;">System Health</h2>
        ${createGridHtml(platformServers, 'plat')}

        <h2 class="st-section-title" style="margin-top: 20px;">Movies & TV Servers</h2>
        ${createGridHtml(standardServers, 'std')}
        <h2 class="st-section-title" style="margin-top: 20px;">Anime Servers</h2>
        ${createGridHtml(animeServers, 'ani')}
        <h2 class="st-section-title" style="margin-top: 20px;">Live Sports Servers</h2>
        ${createGridHtml(liveSportsServers, 'ls')}
        
        <h2 class="st-section-title hidden" id="offline-heading" style="margin-top: 20px;">Offline Servers</h2>
        <div class="st-grid hidden" id="offline-grid"></div>
      `;

      // Back button listener
      globalBackBtn.classList.add('active');

      // Asynchronously load uptime stats and rankings
      fetchUptimeRobotData().then(data => {
        uptimeData = data;
        const container = document.getElementById('monthly-ranking-container');
        if (container && uptimeData) {
          container.innerHTML = renderMonthlyRanking(uptimeData);
        }
        
        if (window.isExpertMode && uptimeData) {
          [...platformServers, ...standardServers, ...animeServers, ...liveSportsServers].forEach(srv => {
            const mData = getUptimeDataForServer(srv, uptimeData);
            if (mData) {
               const el = document.getElementById(`uptime-val-${srv.id}`);
               if (el) {
                  const uptimeStr = parseFloat(mData.custom_uptime_ratio).toFixed(2);
                  const isGreen = parseFloat(uptimeStr) > 95;
                  const upColor = isGreen ? '#00d26a' : (parseFloat(uptimeStr) > 80 ? '#fdd835' : '#ff4444');
                  el.style.color = upColor;
                  el.style.background = upColor + '22';
                  el.textContent = uptimeStr + '%';
               }
            } else {
               const el = document.getElementById(`uptime-val-${srv.id}`);
               if (el) el.textContent = 'N/A';
            }
          });
        }
      });

      const sortSelect = document.getElementById('st-sort-select');
      const masterBtn = document.getElementById('st-master-ping-btn');
      
      if (sortSelect) {
        sortSelect?.addEventListener('change', () => {
          // Reset UI
          const offlineGrid = document.getElementById('offline-grid');
          const offlineHeading = document.getElementById('offline-heading');
          
          if (offlineGrid) {
            // Move offline cards back to their original grids
            Array.from(offlineGrid.children).forEach(card => {
              const prefix = card.dataset.prefix;
              const originalGrid = document.getElementById(`${prefix}-grid`);
              if (originalGrid) {
                originalGrid.appendChild(card);
              }
            });
            offlineGrid.classList.add('hidden');
            offlineHeading.classList.add('hidden');
          }

          // Trigger master ping to test again
          if (masterBtn) {
            masterBtn.click();
          }
        });
      }

      // Bind ping buttons
      const bindPings = (servers, prefix) => {
        servers.forEach(srv => {
          const btn = document.getElementById(`${prefix}-btn-${srv.id}`);
          const res = document.getElementById(`${prefix}-res-${srv.id}`);
          const card = document.getElementById(`${prefix}-card-${srv.id}`);
          
          if (btn && res) {
            btn?.addEventListener('click', async () => {
              btn.disabled = true;
              btn.textContent = 'Testing...';
              res.innerHTML = `<span class="st-ping-dot yellow"></span> Wait...`;
              
              if (card) {
                card.style.order = 0; // Reset order while testing
              }

              const result = await pingServer(srv.url);
              
              // If the view was re-rendered while pinging, this card is a detached zombie.
              // We must stop to prevent appending duplicate zombie cards to the new grid.
              if (!document.body.contains(card)) return;

              const currentSort = sortSelect ? sortSelect.value : 'relevant';
              const offlineGrid = document.getElementById('offline-grid');
              const offlineHeading = document.getElementById('offline-heading');

              let localHistory = JSON.parse(localStorage.getItem(`ping_history_${srv.id}`) || '[]');
              if (result.status === 'online') {
                  localHistory.push(result.ping);
              } else {
                  localHistory.push(5000); // Represent offline spike
              }
              if (localHistory.length > 15) localHistory.shift();
              localStorage.setItem(`ping_history_${srv.id}`, JSON.stringify(localHistory));

              // Re-draw dynamic sparkline
              const sparkContainer = document.getElementById(`${prefix}-sparkline-${srv.id}`);
              if (sparkContainer) {
                if (localHistory.length > 1) {
                  const maxTime = Math.max(...localHistory, 200);
                  const width = 200;
                  const height = 30;
                  const color = localHistory[localHistory.length - 1] < 500 ? '#00d26a' : (localHistory[localHistory.length - 1] < 1000 ? '#fdd835' : '#ff4444');
                  const points = localHistory.map((t, i) => {
                    const x = (i / (localHistory.length - 1)) * width;
                    const y = height - ((t / maxTime) * height);
                    return `${x},${y}`;
                  }).join(' ');
                  
                  sparkContainer.innerHTML = `
                    <div style="margin-top:10px; font-size: 0.75rem; color: #888;">Local Ping History (Last ${localHistory.length})</div>
                    <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="margin-top:5px;">
                      <polyline class="sparkline-path" points="${points}" style="stroke: ${color}; filter: drop-shadow(0 0 4px ${color}); opacity: 0.8;"></polyline>
                    </svg>
                  `;
                } else if (localHistory.length === 1) {
                  sparkContainer.innerHTML = `<div style="margin-top:10px; font-size: 0.75rem; color: #888;">Test again to draw graph.</div>`;
                }
              }

              if (result.status === 'online') {
                const color = result.ping < 500 ? 'green' : 'yellow';
                res.innerHTML = `<span class="st-ping-dot ${color}"></span> ${result.ping}ms`;
                
                if (card) {
                  // Ensure it's in its original grid
                  const originalGrid = document.getElementById(`${prefix}-grid`);
                  if (card.parentElement !== originalGrid && originalGrid) {
                    originalGrid.appendChild(card);
                  }

                  if (currentSort === 'asc') {
                    card.style.order = result.ping;
                  } else if (currentSort === 'desc') {
                    card.style.order = -result.ping;
                  } else {
                    card.style.order = 0;
                  }
                }
              } else {
                res.innerHTML = `<span class="st-ping-dot red"></span> Offline`;
                
                if (card) {
                  // Always move offline servers to the offline section
                  if (offlineGrid && offlineHeading) {
                    offlineGrid.appendChild(card);
                    offlineGrid.classList.remove('hidden');
                    offlineHeading.classList.remove('hidden');
                    card.style.order = 0; // Keep normal order in offline grid
                  }
                }
              }
              btn.textContent = 'Test Ping';
              btn.disabled = false;
              
              // Hide offline section if it's empty
              if (offlineGrid && offlineGrid.children.length === 0) {
                offlineGrid.classList.add('hidden');
                offlineHeading.classList.add('hidden');
              }
            });
          }
        });
      };

      bindPings(platformServers, 'plat');
      bindPings(standardServers, 'std');
      bindPings(animeServers, 'ani');
      bindPings(liveSportsServers, 'ls');

      // Master Ping button
      if (masterBtn) {
        masterBtn.onclick = () => {
          const allBtns = content.querySelectorAll('.st-card-ping-btn');
          allBtns.forEach(b => {
            if (!b.disabled) b.click();
          });
        };
        
        // Auto-trigger test on open
        setTimeout(() => {
          masterBtn.click();
        }, 300);

        // Continuous ping for Expert Mode
        if (window.expertPingInterval) clearInterval(window.expertPingInterval);
        if (window.isExpertMode) {
          window.expertPingInterval = setInterval(() => {
            if (!document.hidden && !serverTestView.classList.contains('hidden') && window.isExpertMode) {
              masterBtn.click();
            } else if (!window.isExpertMode || serverTestView.classList.contains('hidden')) {
              clearInterval(window.expertPingInterval);
            }
          }, 5000); // Ping every 5 seconds (Safest standard)
        }
      }
    };

    // --- UptimeRobot & Expert Mode Logic ---
    // UptimeRobot API Key is securely handled by Cloudflare Master Proxy
    const UPTIMEROBOT_API_KEY = 'PROXY_HANDLES_THIS';
    window.isExpertMode = false;
    window.uptimeDataCache = null;
    let uptimeDataTimestamp = 0;

    async function fetchUptimeRobotData() {
      const now = Date.now();
      if (window.uptimeDataCache && (now - uptimeDataTimestamp < 300000)) return window.uptimeDataCache;
      try {
        const WORKER_URL = 'https://tmdb-proxy.gametec1290.workers.dev/uptime/';
        const res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          // The API key is securely injected by the Cloudflare proxy
          body: `format=json&custom_uptime_ratios=30&response_times=1&response_times_limit=15`
        });
        const data = await res.json();
        if (data && data.stat === 'ok') {
          window.uptimeDataCache = data.monitors;
          uptimeDataTimestamp = now;
          return window.uptimeDataCache;
        }
      } catch (e) {
        console.error("Failed to fetch UptimeRobot data:", e);
      }
      return null;
    }

    function getUptimeDataForServer(serverObj, monitors) {
      if (!monitors || !serverObj.url) return null;
      let serverDomain = '';
      try { serverDomain = new URL(serverObj.url).hostname.replace('www.', ''); } catch(e) { return null; }
      const matches = monitors.filter(m => {
        try { 
          let mDomain = m.url.startsWith('http') ? new URL(m.url).hostname : m.url;
          return mDomain.replace('www.', '') === serverDomain; 
        } catch(e) { return false; }
      });
      if (matches.length === 0) return null;
      matches.sort((a, b) => {
        if (a.status === 2 && b.status !== 2) return -1;
        if (b.status === 2 && a.status !== 2) return 1;
        return parseFloat(b.custom_uptime_ratio || 0) - parseFloat(a.custom_uptime_ratio || 0);
      });
      return matches[0];
    }

    function renderMonthlyRanking(uptimeData) {
      if (!uptimeData) return '';

      const animeServerIds = ['vidnest-animepahe', 'tryembed', 'vidnest', 'vidlink', 'cinextream', 'vidcore', 'filmu'];

      // Helper to calculate score and sort
      const buildRanking = (servers) => {
        let scored = servers.map(srv => {
          const mData = getUptimeDataForServer(srv, uptimeData);
          const uptime = mData ? parseFloat(mData.custom_uptime_ratio) : 0;
          let avgPing = 9999;
          if (mData && mData.response_times && mData.response_times.length > 0) {
             const sum = mData.response_times.reduce((acc, r) => acc + r.value, 0);
             avgPing = sum / mData.response_times.length;
          }
          return { ...srv, uptime, avgPing };
        }).filter(s => s.uptime > 0); // Only rank servers we have data for

        // Sort by highest uptime, then lowest ping
        return scored.sort((a, b) => {
          if (b.uptime !== a.uptime) return b.uptime - a.uptime;
          return a.avgPing - b.avgPing;
        });
      };

      const animeRanking = buildRanking(SERVERS.filter(s => animeServerIds.includes(s.id)));
      const stdRanking = buildRanking(SERVERS); // All servers for Movie/TV

      window.fullRankingsCache = window.fullRankingsCache || {};

      const generateHtml = (ranking, title, prefix) => {
        if (ranking.length === 0) return '';
        
        window.fullRankingsCache[prefix] = { title, ranking };
        
        let podiumHtml = '<div class="ranking-podium">';
        const top3 = [ranking[1], ranking[0], ranking[2]]; // Visual order: Silver, Gold, Bronze
        const top3Ranks = [2, 1, 3];
        
        top3.forEach((srv, idx) => {
          if (!srv) return;
          const rank = top3Ranks[idx];
          podiumHtml += `
            <div class="ranking-card rank-${rank}">
              <div class="rank-badge">${rank}</div>
              <h3 style="margin:0 0 5px 0; font-size:1rem; color:#fff;">${srv.name}</h3>
              <div style="font-size:0.75rem; color:#aaa; margin-bottom:12px;">${srv.label}</div>
              <div style="font-size:1.2rem; font-weight:900; color:#00d26a;">${srv.uptime.toFixed(2)}%</div>
              <div style="font-size:0.75rem; color:#888; margin-top:5px;">~${Math.round(srv.avgPing)}ms ping</div>
            </div>
          `;
        });
        podiumHtml += '</div>';

        let listHtml = '<div class="ranking-list">';
        // Add #4 and #5 inline
        for (let i = 3; i < Math.min(5, ranking.length); i++) {
          const srv = ranking[i];
          listHtml += `
            <div class="ranking-list-item">
              <div style="display:flex; align-items:center; gap:15px;">
                <span style="font-size:1.2rem; font-weight:800; color:#888;">#${i+1}</span>
                <div>
                  <div style="color:#fff; font-weight:bold;">${srv.name} <span style="font-size:0.8rem; color:#aaa; font-weight:normal;">(${srv.label})</span></div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="color:#00d26a; font-weight:bold;">${srv.uptime.toFixed(2)}%</div>
                <div style="color:#666; font-size:0.75rem;">~${Math.round(srv.avgPing)}ms</div>
              </div>
            </div>
          `;
        }
        
        // Add dropdown for #6 through #19 (Next 14)
        if (ranking.length > 5) {
          listHtml += `
            <button class="view-all-rankings-btn" onclick="const c = document.getElementById('hidden-rankings-${prefix}'); c.classList.toggle('show'); this.textContent = c.classList.contains('show') ? 'Hide Rankings ▲' : 'View More Rankings ▼';">View More Rankings ▼</button>
            <div class="hidden-rankings" id="hidden-rankings-${prefix}">
          `;
          for (let i = 5; i < Math.min(19, ranking.length); i++) {
            const srv = ranking[i];
            listHtml += `
              <div class="ranking-list-item" style="border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:10px 15px; background:rgba(20,20,20,0.5);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                  <span style="font-size:1.1rem; font-weight:700; color:#555; min-width:25px;">#${i+1}</span>
                  <div style="color:#ccc; font-weight:bold;">${srv.name} <span style="font-size:0.75rem; color:#666; font-weight:normal;">(${srv.label})</span></div>
                </div>
                <div style="text-align:right;">
                  <span style="color:#00d26a; font-weight:bold; font-size:0.95rem;">${srv.uptime.toFixed(2)}%</span>
                  <span style="color:#666; font-size:0.75rem; margin-left:5px;">~${Math.round(srv.avgPing)}ms</span>
                </div>
              </div>
            `;
          }
          
          // Add button for full list if > 19 INSIDE the dropdown
          if (ranking.length > 19) {
            const remaining = ranking.length - 19;
            listHtml += `
              <div style="grid-column: 1 / -1; text-align: center; margin-top: 10px;">
                <button class="view-all-rankings-btn" style="border: 1px solid var(--primary-color); color: var(--primary-color); display: inline-block; width: auto; padding: 10px 30px;" onclick="window.showFullRankingsPage('${prefix}')">View ${remaining} More Rankings →</button>
              </div>
            `;
          }
          listHtml += `</div>`;
        }
        listHtml += '</div>';

        return `
          <div class="ranking-section">
            <h2 class="st-section-title" style="text-align:center; border:none; margin-bottom:40px;">${title}</h2>
            ${podiumHtml}
            ${listHtml}
          </div>
        `;
      };

      return `
        <h1 class="st-title" style="text-align:center; margin-bottom:10px;">Top 5 Servers of the Month</h1>
        <p class="st-subtitle" style="text-align:center; margin-bottom:30px;">Based on verified 30-day uptime and average response time</p>
        <div class="ranking-columns">
          ${generateHtml(stdRanking, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px; filter: drop-shadow(0 0 5px rgba(255,215,0,0.5));"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Movies & TV Servers', 'std')}
          ${generateHtml(animeRanking, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px; filter: drop-shadow(0 0 5px rgba(255,215,0,0.5));"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>Anime Servers', 'anime')}
        </div>
      `;
    }

    // Toggle listener
    document.addEventListener('DOMContentLoaded', () => {
      const toggle = document.getElementById('expert-mode-switch');
      const toggleContainer = document.querySelector('.expert-mode-toggle');
      if (toggleContainer && toggle) {
        // Initial state styling
        toggle.style.width = '40px';
        toggle.style.height = '20px';
        toggle.style.background = 'rgba(255,255,255,0.2)';
        toggle.style.borderRadius = '20px';
        toggle.style.position = 'relative';
        toggle.style.transition = 'background 0.3s';
        
        const knob = document.createElement('div');
        knob.style.width = '16px';
        knob.style.height = '16px';
        knob.style.background = '#fff';
        knob.style.borderRadius = '50%';
        knob.style.position = 'absolute';
        knob.style.top = '2px';
        knob.style.left = '2px';
        knob.style.transition = 'transform 0.3s';
        toggle.appendChild(knob);

        // Global functions for Full Rankings Page
        window.showFullRankingsPage = (prefix) => {
          const data = window.fullRankingsCache[prefix];
          if (!data) return;
          
          const container = document.getElementById('st-content');
          if (!container) return;
          
          // Save current scroll
          window.stContentScroll = container.scrollTop;
          
          // Hide all current children
          Array.from(container.children).forEach(c => {
            if (c.id !== 'full-rankings-page') c.style.display = 'none';
          });
          
          const oldPage = document.getElementById('full-rankings-page');
          if (oldPage) oldPage.remove();
          
          let html = `
            <div id="full-rankings-page" style="padding-bottom:40px; animation: fadeIn 0.3s;">
              <div style="position: sticky; top: 0; background: rgba(18,18,18,0.95); backdrop-filter: blur(10px); padding: 15px 0 25px; z-index: 10; display:flex; flex-direction:column; align-items:center;">
                <button class="btn btn-secondary" style="align-self:flex-start; margin-bottom:15px; display:inline-flex; align-items:center; gap:8px;" onclick="window.hideFullRankingsPage()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Back to Summary
                </button>
                <h2 style="margin:0; text-align:center;">${data.title}</h2>
                <div style="color:#aaa; font-size:0.9rem; margin-top:5px;">Complete 30-day Performance Rankings</div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top:10px;">
          `;
          
          data.ranking.forEach((srv, i) => {
             let color = '#555';
             if(i===0) color='#ffd700';
             if(i===1) color='#c0c0c0';
             if(i===2) color='#cd7f32';
             html += `
               <div class="ranking-list-item" style="border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:15px 20px; background:rgba(20,20,20,0.8); display:flex; align-items:center; justify-content:space-between; transition:transform 0.2s;">
                  <div style="display:flex; align-items:center; gap:15px;">
                    <span style="font-size:1.4rem; font-weight:800; color:${color}; min-width:35px; text-shadow:0 0 10px rgba(255,255,255,0.1);">#${i+1}</span>
                    <div>
                      <div style="color:#fff; font-weight:bold; font-size:1.1rem; margin-bottom:3px;">${srv.name}</div>
                      <div style="font-size:0.75rem; color:#888; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; display:inline-block;">${srv.label}</div>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="color:#00d26a; font-weight:900; font-size:1.2rem;">${srv.uptime.toFixed(2)}%</div>
                    <div style="color:#666; font-size:0.8rem; margin-top:2px;">~${Math.round(srv.avgPing)}ms</div>
                  </div>
               </div>
             `;
          });
          
          html += `</div></div>`;
          container.insertAdjacentHTML('beforeend', html);
          container.scrollTop = 0;
        };

        window.hideFullRankingsPage = () => {
          const container = document.getElementById('st-content');
          if (!container) return;
          const page = document.getElementById('full-rankings-page');
          if (page) page.remove();
          
          Array.from(container.children).forEach(c => {
            c.style.display = '';
          });
          
          if (window.stContentScroll) {
            container.scrollTop = window.stContentScroll;
          }
        };

toggleContainer?.addEventListener('click', async () => {
          if (!window.isExpertMode) {
            const proceed = await showCustomModal("Expert Mode continuously tests servers and uses extra bandwidth. It will automatically turn off after 2 minutes to prevent rate limiting. Do you want to proceed?", false);
            if (!proceed) return;
          }

          window.isExpertMode = !window.isExpertMode;
          if (window.isExpertMode) {
            toggle.style.background = '#00d26a';
            knob.style.transform = 'translateX(20px)';
            
            // Auto-off after 2 minutes
            if (window.expertModeTimeout) clearTimeout(window.expertModeTimeout);
            window.expertModeTimeout = setTimeout(() => {
                if (window.isExpertMode) {
                    window.isExpertMode = false;
                    toggle.style.background = 'rgba(255,255,255,0.2)';
                    knob.style.transform = 'translateX(0)';
                    const container = document.getElementById('monthly-ranking-container');
                    if (container) container.style.display = 'none';
                    if (window.expertPingInterval) clearInterval(window.expertPingInterval);
                    
                    const serverTestView = document.getElementById('server-test-view');
                    if (serverTestView && !serverTestView.classList.contains('hidden')) {
                        renderServerTestView();
                    }
                    showCustomModal("Expert Mode has automatically turned off to save bandwidth and prevent rate limits.", true);
                }
            }, 120000); // 2 minutes

          } else {
            toggle.style.background = 'rgba(255,255,255,0.2)';
            knob.style.transform = 'translateX(0)';
            const container = document.getElementById('monthly-ranking-container');
            if (container) container.style.display = 'none';
            if (window.expertPingInterval) clearInterval(window.expertPingInterval);
            if (window.expertModeTimeout) clearTimeout(window.expertModeTimeout);
          }
          
          // Re-render if view is active
          const serverTestView = document.getElementById('server-test-view');
          if (serverTestView && !serverTestView.classList.contains('hidden')) {
            await renderServerTestView();
            renderMonthlyRanking(uptimeDataCache);
          }
        });
      }
    });


      const sandboxToggleBtn = document.getElementById('toggle-sandbox-btn');
      const sandboxToggleSwitch = document.getElementById('sandbox-toggle-switch');
      
      if (sandboxToggleBtn && sandboxToggleSwitch) {
        const isSandboxDisabled = localStorage.getItem('globalSandboxDisabled') === 'true';
        if (isSandboxDisabled) {
          sandboxToggleSwitch.classList.add('active');
        } else {
          sandboxToggleSwitch.classList.remove('active');
        }

        sandboxToggleBtn.addEventListener('click', () => {
          const currentlyDisabled = localStorage.getItem('globalSandboxDisabled') === 'true';
          const newState = !currentlyDisabled;
          localStorage.setItem('globalSandboxDisabled', newState.toString());
          if (newState) {
            sandboxToggleSwitch.classList.add('active');
          } else {
            sandboxToggleSwitch.classList.remove('active');
          }
        });
      }
window.toggleGlobalSandbox = function(el) {
  const currentlyDisabled = localStorage.getItem('globalSandboxDisabled') === 'true';
  const newState = !currentlyDisabled;
  localStorage.setItem('globalSandboxDisabled', newState.toString());
  if (newState) {
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
  const sandboxToggleSwitch = document.getElementById('sandbox-toggle-switch');
  if (sandboxToggleSwitch) {
    if (newState) sandboxToggleSwitch.classList.add('active');
    else sandboxToggleSwitch.classList.remove('active');
  }
};

window.sportsUse12HourFormat = localStorage.getItem('sports12h') === 'true';

window.toggleSportsTimeFormat = function() {
  window.sportsUse12HourFormat = !window.sportsUse12HourFormat;
  localStorage.setItem('sports12h', window.sportsUse12HourFormat);
  
  const toggles = [
    document.getElementById('sports-time-format-toggle'),
    document.getElementById('esportex-time-format-toggle'),
    document.getElementById('streamfree-time-format-toggle'),
    document.getElementById('watchfooty-time-format-toggle')
  ];
  
  toggles.forEach(t => {
    if (t) {
      if (window.sportsUse12HourFormat) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    }
  });

  if (typeof fetchStreamedMatches === 'function' && document.getElementById('sports-category-filter')) {
    fetchStreamedMatches(document.getElementById('sports-category-filter').value);
  }
  if (typeof renderEsportexCategory === 'function' && typeof activeEsportexTab !== 'undefined' && activeEsportexTab) {
    renderEsportexCategory(activeEsportexTab);
  }
  if (window.sportsServersData) {
    if (window.sportsServersData.streamfree.loaded) {
      renderSportsEvents('streamfree', window.sportsServersData.streamfree.events);
    }
    if (window.sportsServersData.watchfooty.loaded) {
      renderSportsEvents('watchfooty', window.sportsServersData.watchfooty.events);
    }
  }
};

// Initialize static toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggles = [
    document.getElementById('sports-time-format-toggle'),
    document.getElementById('esportex-time-format-toggle'),
    document.getElementById('streamfree-time-format-toggle'),
    document.getElementById('watchfooty-time-format-toggle')
  ];
  toggles.forEach(toggle => {
    if (toggle && window.sportsUse12HourFormat) {
      toggle.classList.add('active');
    }
  });
});
