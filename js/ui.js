// UI Rendering Functions Extracted from main.js

    async function renderDetailsView(id, type) {
      const fetchId = ++currentDetailsFetchId;
      detailsView.classList.add('active');
      globalBackBtn.classList.add('active');

      // Auto-collapse search logic
      detailsSearchContainer.classList.add('active');
      detailsSearchContainer.classList.remove('collapsed');
      detailsSearchInput.value = '';
      detailsClearSearch.classList.remove('active');

      // Hide main navbar search to prevent overlapping
      const homeSearch = document.querySelector('.search-container');
      if (homeSearch) homeSearch.style.display = 'none';

      clearTimeout(detailsSearchTimeout);
      detailsSearchTimeout = setTimeout(() => {
        if (document.activeElement !== detailsSearchInput && detailsSearchInput.value === '') {
          detailsSearchContainer.classList.add('collapsed');
        }
      }, 1500);

      detailsView.innerHTML = `
        <div class="details-sheet-handle"></div>
        <div class="details-hero" style="position: relative; background: #1a1a1a;">
          <div class="skeleton-hero"></div>
          <div class="details-content" style="z-index: 2;">
            <div class="skeleton-text" style="width: 60%; height: 40px;"></div>
            <div class="skeleton-text" style="width: 40%;"></div>
            <div class="skeleton-text" style="width: 80%; height: 100px;"></div>
          </div>
        </div>
      `;
      window.scrollTo(0, 0);

      const data = await fetchApi(`/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,similar,videos,external_ids`);
      if (fetchId !== currentDetailsFetchId) return; // Prevent race conditions

      currentDetailsData = data;

      if (!data) {
        detailsView.innerHTML = `
          <div class="error-message" style="margin: 100px 4%;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3>Unable to load details</h3>
            <p>This could be due to a network issue or the content being unavailable.</p>
            <button class="retry-btn" onclick="renderDetailsView(${id}, '${type}')">Try Again</button>
            <button class="retry-btn" onclick="globalGoBack()" style="margin-left:10px">Go Back</button>
          </div>`;
        return;
      }

      const imdbId = data.external_ids?.imdb_id;

      const title = data.title || data.name || data.original_name;
      document.title = `${title} - Prisma`;
      const year = (data.release_date || data.first_air_date || '').split('-')[0];
      const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
      const runtime = type === 'movie' ? `${data.runtime} min` : `${data.number_of_seasons} Seasons`;

      // Extract Ambient Glow Color dynamically
      const backdropUrl = data.backdrop_path ? `${IMG_URL}${data.backdrop_path}` : `${IMG_URL}${data.poster_path}`;
      if (backdropUrl) {
        extractAverageColor(backdropUrl).then(color => {
          document.documentElement.style.setProperty('--ambient-color', color);
        });
      }

      let castHtml = '';
      if (data.credits && data.credits.cast && data.credits.cast.length > 0) {
        const castItems = data.credits.cast.slice(0, 15).map(actor => {
          const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=222&color=666&size=120`;
          const imgSrc = actor.profile_path ? IMG_URL + actor.profile_path : fallbackImg;
          return `
          <div class="cast-card" onclick="searchByActor(${actor.id}, '${actor.name.replace(/'/g, "\\'")}')" style="cursor: pointer;" title="Search other movies with ${actor.name}">
            <img class="cast-img" src="${imgSrc}" onerror="this.onerror=null;this.src='${fallbackImg}';" alt="${actor.name}" loading="lazy">
            <div class="cast-name">${actor.name}</div>
            <div class="cast-character">${actor.character}</div>
          </div>
          `;
        }).join('');
        castHtml = `
          <h3 class="section-title">Cast & Crew</h3>
          <div class="cast-scroll">${castItems}</div>
        `;
      }

      const playIcon = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style="margin-right: 5px;"><path d="M8 5v14l11-7z"/></svg>`;
      const checkIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      const plusIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      const trailerIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
      const shareIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

      let targetSeason = 1;
      let targetEpisode = 1;
      if (type !== 'movie') {
        let highestSeason = 0;
        let highestEpisode = 0;
        try {
          const key = `watched_series_${id}`;
          const seriesData = JSON.parse(localStorage.getItem(key) || '{}');
          for (const s in seriesData) {
            if (s === '_updatedAt') continue;
            const sNum = parseInt(s);
            if (sNum > highestSeason) {
              highestSeason = sNum;
              highestEpisode = seriesData[s].length > 0 ? Math.max(...seriesData[s]) : 0;
            } else if (sNum === highestSeason) {
              const maxEp = seriesData[s].length > 0 ? Math.max(...seriesData[s]) : 0;
              highestEpisode = Math.max(highestEpisode, maxEp);
            }
          }
        } catch(e) {}

        if (highestSeason > 0 && highestEpisode > 0) {
          targetSeason = highestSeason;
          targetEpisode = highestEpisode;
          if (data.seasons) {
            const currentSeasonData = data.seasons.find(s => s.season_number === highestSeason);
            
            try {
              const seasonPayload = await fetchApi(`/tv/${id}/season/${highestSeason}?api_key=${TMDB_API_KEY}`);
              if (seasonPayload && seasonPayload.episodes) {
                const lastWatchedIndex = seasonPayload.episodes.findIndex(ep => ep.episode_number === highestEpisode);
                
                if (lastWatchedIndex !== -1) {
                  if (lastWatchedIndex < seasonPayload.episodes.length - 1) {
                    targetEpisode = seasonPayload.episodes[lastWatchedIndex + 1].episode_number;
                  } else {
                    const nextSeasonData = data.seasons.find(s => s.season_number === highestSeason + 1);
                    if (nextSeasonData && nextSeasonData.episode_count > 0) {
                      targetSeason = highestSeason + 1;
                      const nextSeasonPayload = await fetchApi(`/tv/${id}/season/${targetSeason}?api_key=${TMDB_API_KEY}`);
                      if (nextSeasonPayload && nextSeasonPayload.episodes && nextSeasonPayload.episodes.length > 0) {
                        targetEpisode = nextSeasonPayload.episodes[0].episode_number;
                      } else {
                        targetEpisode = 1;
                      }
                    }
                  }
                } else {
                  targetEpisode = highestEpisode + 1;
                }
              }
            } catch (err) {
              if (currentSeasonData && highestEpisode < currentSeasonData.episode_count) {
                targetEpisode = highestEpisode + 1;
              } else {
                const nextSeasonData = data.seasons.find(s => s.season_number === highestSeason + 1);
                if (nextSeasonData && nextSeasonData.episode_count > 0) {
                  targetSeason = highestSeason + 1;
                  targetEpisode = 1;
                }
              }
            }
          }
        }

        const prog = getProgressForId(id);
        if (prog && prog.progress < 95) {
          const pSeason = parseInt(prog.currentSeason || prog.season || 0);
          const pEpisode = parseInt(prog.currentEpisode || prog.episode || 0);
          if (pSeason === 0 || pSeason >= highestSeason) {
            targetSeason = pSeason || targetSeason;
            targetEpisode = pEpisode || targetEpisode;
          }
        }
        
        targetSeason = parseInt(targetSeason) || 1;
        targetEpisode = parseInt(targetEpisode) || 1;
      }

      const inList = isInWatchlist(id);
      const watchlistBtnText = inList ? `${checkIcon} In My List` : `${plusIcon} My List`;

      const trailer = data.videos && data.videos.results ? data.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') : null;
      const trailerHtml = trailer ? `<button class="btn btn-info" onclick="playTrailer('${trailer.key}')" style="flex: 1 1 140px;">${trailerIcon} Watch Trailer</button>` : '';

      const dlIconSVG = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right: 5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
      const downloadBtnHtml = `<button class="btn btn-info" onclick="openDownloadModal(${id}, '${type}', ${targetSeason}, ${targetEpisode})" style="flex: 1 1 140px; background: rgba(70, 211, 105, 0.2); color: #46d369; border: 1px solid rgba(70, 211, 105, 0.3);">${dlIconSVG} Download</button>`;

      // Detect if the media is Anime (must be Animation genre AND Japanese language)
      const isAnime = data.original_language === 'ja' && data.genres && data.genres.some(g => g.id === 16);
      window.currentIsAnime = isAnime;
      window.currentMediaTitle = data.title || data.name || data.original_name; // For Anilist API later

      let serversToDisplay = SERVERS.slice(0, 7);
      let adBlockNoticeHtml = '';

      if (window.currentIsAnime) {
        const s40 = SERVERS.find(s => s.id === 'vidnest-animepahe');
        const s39 = SERVERS.find(s => s.id === 'tryembed');
        const s37 = SERVERS.find(s => s.id === 'cinextream');
        const s2 = SERVERS.find(s => s.id === 'vidnest');
        const s14 = SERVERS.find(s => s.id === 'vidlink');
        const s41 = SERVERS.find(s => s.id === 'filmu');
        const s13 = SERVERS.find(s => s.id === 'vidcore');
        const s42 = SERVERS.find(s => s.id === 'bingr');


        if (s42 && s40 && s39 && s37 && s2 && s14 && s41) {
          // EXCLUSIVELY display these 7 servers for Anime on the home details page. No standard servers.
          // Dropped s13 to keep exactly 8 boxes (7 servers + 1 "More Servers" box).
          serversToDisplay = [s42, s40, s2, s39, s37, s14, s41];
        }

        adBlockNoticeHtml = `
          <div class="ad-notice-badge" style="background: rgba(70, 211, 105, 0.1); border: 1px solid rgba(70, 211, 105, 0.2); color: #46d369;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 5px;"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Anime Detected: Displaying dedicated anime servers. Standard servers are available in the More Servers menu as a fallback.
          </div>
        `;
      } else if (isAdBlockerActive) {
        const s12 = SERVERS.find(s => s.id === 'videasy'); // Server 12
        const s17 = SERVERS.find(s => s.id === 'vidfast'); // Server 17

        // Add them to the front if they exist
        if (s12 && s17) {
          let others = SERVERS.filter(s => s.id !== 'videasy' && s.id !== 'vidfast');
          serversToDisplay = [s12, s17, ...others].slice(0, 7);
        }

        adBlockNoticeHtml = `
          <div class="ad-notice-badge">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            uBlock Detected: Server 12 & 17 Optimized for You
          </div>
        `;
      }

      const top5Html = serversToDisplay.map((srv, index) => {
        const isAnimeRecommended = window.currentIsAnime && (srv.id === 'vidnest-animepahe' || srv.id === 'tryembed' || srv.id === 'vidnest' || srv.id === 'vidlink' || srv.id === 'cinextream');
        const isRecommended = isAnimeRecommended || (!window.currentIsAnime && isAdBlockerActive && (srv.id === 'videasy' || srv.id === 'vidfast'));
        const adBadgeColor = srv.adFree ? '#46d369' : (isRecommended ? '#46d369' : '#eab308');
        let adBadgeText = srv.adFree ? 'Ad-Free' : (isRecommended ? 'Optimized' : 'Ads');
        let recommendedClass = isRecommended ? 'server-recommended' : '';
        
        if (window.currentIsAnime) {
          if (srv.id === 'bingr' || srv.id === 'vidnest-animepahe') { adBadgeText = 'Sub/Dub'; recommendedClass = 'server-primary'; }
          else if (srv.id === 'tryembed' || srv.id === 'vidnest' || srv.id === 'vidlink' || srv.id === 'cinextream') { adBadgeText = 'Sub/Dub'; recommendedClass = 'server-recommended'; }
          else if (srv.id === 'vidcore' || srv.id === 'filmu') { adBadgeText = 'Alternative'; recommendedClass = ''; }
        }

        const action = ((srv.id === 'vidnest-animepahe' || srv.id === 'tryembed' || srv.id === 'vidnest' || srv.id === 'vidlink' || srv.id === 'cinextream') && window.currentIsAnime)
          ? `openSubDubModal(${id}, '${type}', ${targetSeason}, ${targetEpisode}, '${srv.id}')`
          : `openPlayer(${id}, '${type}', ${targetSeason}, ${targetEpisode}, '${srv.id}')`;

        const fourKBadgeHtml = srv.has4K ? `<div style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; padding: 3px 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px; letter-spacing: 0.5px; white-space: nowrap;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect><polyline points="7 10 7 14"></polyline><polyline points="10 10 7 12"></polyline><line x1="14" y1="10" x2="14" y2="14"></line><polyline points="17 10 14 12 17 14"></polyline></svg> 4K</div>` : '';

        return `
        <button class="btn btn-play ${recommendedClass}" onclick="${action}" title="${srv.label} (${srv.name})" style="background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); width: 100%; flex-direction: column; align-items: stretch; gap: 10px; padding: 14px; border-radius: 12px !important; text-align: left; justify-content: flex-start; min-height: 90px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; min-width: 0;">
            <div style="display: flex; align-items: center; color: #ccc; font-size: 0.85rem; min-width: 0; overflow: hidden;">
              <span style="flex-shrink: 0;">${playIcon}</span> <span style="font-weight: normal; margin-left: 4px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${srv.name}</span>
            </div>
          </div>
          <div style="font-size: 1.15rem; font-weight: bold; color: #fff; line-height: 1.2; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 100%;">${srv.label}</div>
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; width: 100%; margin-top: auto;">
            <div id="${type}-ping-${srv.id}" style="font-size: 0.8rem; font-weight: normal; color: #9ca3af; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              <span class="ping-light ping-yellow"></span> Waiting...
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; align-items: center;">
              ${fourKBadgeHtml}
              <div style="font-size: 0.6rem; font-weight: 800; color: ${adBadgeColor}; padding: 2px 5px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; text-transform: uppercase; letter-spacing: 0px; white-space: nowrap;">${adBadgeText}</div>
            </div>
          </div>
        </button>
        `;
      }).join('');

      const dropdownHtml = `
        <button class="btn btn-play" onclick="openServerSelectionPopup(${id}, ${targetSeason}, ${targetEpisode}, '${type}')" title="View all ${SERVERS.length} servers" style="background: rgba(255, 255, 255, 0.03); color: #fff; border: 1px dashed rgba(255, 255, 255, 0.2); width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px !important; min-height: 90px; box-shadow: inset 0 0 10px rgba(0,0,0,0.2); transition: all 0.2s;">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="color: #aaa;"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
          <div style="font-size: 1rem; font-weight: bold; color: #fff;">More Servers</div>
          <div style="font-size: 0.75rem; color: #9ca3af;">(${SERVERS.length} Total)</div>
        </button>
      `;

      const s3DisclaimerHtml = `<p style="font-size: 0.75rem; color: #777; margin-top: 10px; display: none;" id="s3-disclaimer">Note: The selected server may contain pop-up ads due to provider limitations.</p>`;

      const serverGuideHtml = `
        <div class="server-guide" style="position: absolute; bottom: 30px; left: 4%; padding: 20px; border: 1px solid rgba(255,255,255,0.1); width: 92%; max-width: 800px; z-index: 20; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 12px;">
          <p style="font-size: 0.75rem; color: #fff; margin-bottom: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">Playback Information</p>
          <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 10px;">
            <div style="font-size: 0.8rem; color: #ccc;"><span style="color: #fff; font-weight: 700; margin-right: 5px;">Server 1-5:</span> Premium Ad-Free</div>
            <div style="font-size: 0.8rem; color: #ccc;"><span style="color: #fff; font-weight: 700; margin-right: 5px;">Dropdown:</span> 18+ Backup Servers</div>
          </div>
          <p style="font-size: 0.75rem; color: #aaa; line-height: 1.4;">Recommended: Try Top 5 first. Use dropdown if they are offline. Mobile is natively ad-free.</p>
        </div>
      `;
      
      const sandboxToggleHtml = `
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 15px; margin-top: 15px; margin-bottom: 20px; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-weight: bold;">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Disable Sandbox
            </div>
            <div class="toggle-switch ${localStorage.getItem('globalSandboxDisabled') === 'true' ? 'active' : ''}" id="details-sandbox-toggle" onclick="toggleGlobalSandbox(this)" style="cursor: pointer;"></div>
          </div>
          <div style="font-size: 0.8rem; color: #aaa; display: flex; align-items: flex-start; gap: 6px;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span style="line-height: 1.3;">Enable this to temporarily fix "Unsupported Sandbox Environment" errors by removing strict sandbox restrictions (this will allow pop-ups).</span>
          </div>
        </div>
      `;

      let extraUI = '';
      if (type === 'movie') {
        extraUI = `
          <div class="server-grid">
            ${top5Html}
            ${dropdownHtml}
          </div>
          ${sandboxToggleHtml}
          <div style="display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; align-items: center; width: 100%;">
            ${trailer ? trailerHtml : ''}
            ${downloadBtnHtml}
            <button class="btn btn-info" id="watchlist-toggle-btn" onclick="handleWatchlistToggle()" style="flex: 1 1 100%;">${watchlistBtnText}</button>
          </div>
          ${s3DisclaimerHtml}
        `;
      } else {
        const key = `watched_series_${id}`;
        let preloadedSeriesData = {};
        try { preloadedSeriesData = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { }

        const seasons = data.seasons ? data.seasons.filter(s => s.season_number > 0) : [];
        let cumulativeEps = 0;
        
        const options = seasons.map(s => {
          const startEp = cumulativeEps + 1;
          const endEp = cumulativeEps + s.episode_count;
          cumulativeEps += s.episode_count;

          const watchedInSeason = preloadedSeriesData[s.season_number] || [];
          const isFullyWatched = s.episode_count > 0 && watchedInSeason.length >= s.episode_count;
          const isCurrentlyWatching = !isFullyWatched && (s.season_number == targetSeason || watchedInSeason.length > 0);
          
          let icon = '';
          if (isFullyWatched) icon = ' ✔';
          else if (isCurrentlyWatching) icon = ' ►';
          
          let label;
          if (window.currentIsAnime) {
            const hasCustomName = s.name && !s.name.toLowerCase().startsWith('season');
            label = hasCustomName ? `${s.name} (Eps ${startEp}-${endEp})` : `Episodes ${startEp}-${endEp}`;
          } else {
            label = `Season ${s.season_number}`;
          }
          
          const selected = s.season_number == targetSeason ? 'selected' : '';
          return `<option value="${s.season_number}" ${selected}>${label}${icon}</option>`;
        }).join('');
        extraUI = `
          <div class="season-selector" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 15px; width: 100%;">
            <select class="season-select" id="season-select" onchange="loadEpisodes(${id}, this.value)" style="flex: 1; min-width: 0;">
              ${options}
            </select>
            <label class="switch-container" title="Toggle entire season as watched or unwatched">
              <span style="font-size: 0.9rem; color: #fff; font-weight: 500;">Season Watched</span>
              <div class="switch">
                <input type="checkbox" id="season-watch-toggle" onchange="toggleSeasonWatched(${id}, document.getElementById('season-select').value)">
                <span class="slider"></span>
              </div>
            </label>
          </div>
          <div class="server-grid">
            ${top5Html}
            ${dropdownHtml}
          </div>
          ${sandboxToggleHtml}
          <div style="display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; align-items: center; width: 100%;">
            ${trailer ? trailerHtml : ''}
            <button class="btn btn-info" id="watchlist-toggle-btn" onclick="handleWatchlistToggle()" style="flex: 1 1 100%;">${watchlistBtnText}</button>
          </div>
          ${s3DisclaimerHtml}
        `;
      }

      let similarHtml = '';
      if (data.similar && data.similar.results && data.similar.results.length > 0) {
        const similarItems = data.similar.results.slice(0, 20).map(item => {
          const itemTitle = item.title || item.name;
          const fallbackPoster = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='180' fill='%23222'%3E%3Crect width='100%25' height='100%25'/%3E%3C/svg%3E`;
          const imgSrc = item.poster_path ? IMG_URL + item.poster_path : fallbackPoster;
          return `
            <div class="card" style="width: 150px; flex: 0 0 auto;" onclick="openDetails(${item.id}, '${item.title ? 'movie' : 'tv'}')">
              <div class="ambient-glow" style="background-image: url('${imgSrc}');"></div>
              <img src="${imgSrc}" alt="${itemTitle}" loading="lazy">
              <div class="card-info" style="opacity: 1; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
                <div class="card-title" style="font-size: 0.8rem;">${itemTitle}</div>
              </div>
            </div>
          `;
        }).join('');

        const safeTitle = (title || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const viewAllCard = `
          <div class="card view-all-card" style="width: 150px; flex: 0 0 auto; min-height: 225px;" onclick="updateState({ view: 'similar_all', id: ${id}, type: '${type}', title: '${safeTitle}' })">
            <span>View All →</span>
          </div>
        `;

        similarHtml = `
          <div style="margin-top: 30px; position: relative;">
            <h3 class="section-title">More Like This</h3>
            <button class="scroll-btn scroll-left" onclick="document.getElementById('similar-scroll').scrollBy({ left: -window.innerWidth * 0.8, behavior: 'smooth' })" style="opacity: 1; left: -25px;">&#10094;</button>
            <div id="similar-scroll" style="display: flex; gap: 15px; overflow-x: auto; overflow-y: hidden; padding: 30px 0 10px 0; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; overscroll-behavior-x: contain; touch-action: pan-x;">
              ${similarItems}
              ${viewAllCard}
            </div>
            <button class="scroll-btn scroll-right" onclick="document.getElementById('similar-scroll').scrollBy({ left: window.innerWidth * 0.8, behavior: 'smooth' })" style="opacity: 1; right: -25px;">&#10095;</button>
          </div>
        `;
      }

      const genresHtml = (data.genres && data.genres.length > 0) ? data.genres.map(g => `<span style="border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 5px 15px; font-size: 0.8rem; background: rgba(255,255,255,0.05); color: #ccc; white-space: nowrap;">${g.name}</span>`).join('') : '';

      detailsView.innerHTML = `
        <div class="details-hero" style="background-image: url(${IMG_URL_BG}${data.backdrop_path})">
          ${(type === 'movie' || type === 'tv') ? `
            <div class="hero-video-wrapper" id="hero-video-wrapper">
              <video muted loop playsinline id="bg-trailer"></video>
            </div>
            <button id="hero-mute-btn" class="hero-mute-btn" onclick="toggleHeroMute()" title="Unmute Background Trailer">
              <svg id="hero-mute-icon" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            </button>
            <button id="hero-play-pause-btn" class="hero-play-pause-btn" onclick="toggleHeroPlayPause()" title="Pause Background Trailer">
              <svg id="hero-play-pause-icon" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          ` : ''}
          <div class="details-content">
            <h1 class="details-title">${title}</h1>
            <div class="details-meta">
              <span id="omdb-ratings-container" class="omdb-ratings-container" data-imdb-id="${imdbId || ''}">
                <span class="details-rating">★ ${rating}</span>
              </span>
              <span>${year}</span>
              <span>${runtime}</span>
            </div>
            <p class="details-overview">${data.overview || 'No overview available.'}</p>
            ${adBlockNoticeHtml}
            
            <div style="display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; align-items: center;">
              <button class="btn btn-info btn-share-mobile" onclick="shareContent('${title.replace(/'/g, "\\'")}')" title="Share with friends">${shareIcon} Share</button>
              ${genresHtml}
            </div>
            ${extraUI}
          </div>
          ${serverGuideHtml}
        </div>
        <div class="details-sections">
          ${type === 'tv' ? '<div id="episodes-container" style="margin-bottom: 40px;">Loading episodes...</div>' : ''}
          ${castHtml}
          ${similarHtml}
        </div>
      `;

      if (type === 'tv') {
        const hasSeasons = data.seasons && data.seasons.some(s => s.season_number > 0);
        if (hasSeasons) loadEpisodes(id, targetSeason);
        else document.getElementById('episodes-container').innerHTML = 'No seasons available.';
      }

      // OMDb Ratings Fetch
      if (imdbId && (type === 'movie' || type === 'tv')) {
        fetchOmdbRatings(imdbId);
      }

      // Background Trailer Logic
      if ((type === 'movie' || type === 'tv') && imdbId) {
        fetch(`https://trailer-api.gametec1290.workers.dev/?id=${imdbId}`)
          .then(res => res.json())
          .then(trailerData => {
            if (trailerData && trailerData.url) {
              const stream = { url: trailerData.url };

              if (stream && stream.url) {
                const videoElement = document.getElementById('bg-trailer');
                const wrapperElement = document.getElementById('hero-video-wrapper');
                if (videoElement && wrapperElement) {
                  videoElement.src = stream.url;

                  // Wait for metadata to reliably set currentTime
                  videoElement?.addEventListener('loadedmetadata', () => {
                    videoElement.currentTime = 5; // Skip the first 5 seconds
                  }, { once: true });

                  // Apply a 1-second delay before fading in and playing
                  setTimeout(() => {
                    // Ensure the user hasn't navigated away from this movie view
                    const currentVideo = document.getElementById('bg-trailer');
                    const currentWrapper = document.getElementById('hero-video-wrapper');
                    if (currentVideo === videoElement && currentWrapper === wrapperElement) {
                      videoElement.play().then(() => {
                        wrapperElement.classList.add('loaded');
                        const muteBtn = document.getElementById('hero-mute-btn');
                        if (muteBtn) muteBtn.style.display = 'flex';
                        const playPauseBtn = document.getElementById('hero-play-pause-btn');
                        if (playPauseBtn) playPauseBtn.style.display = 'flex';
                      }).catch(e => console.error("Autoplay prevented:", e));
                    }
                  }, 1000);

                  // Initialize pause tracking
                  window.isHeroPausedManually = false;
                  videoElement.dataset.pausedByScroll = 'false';

                  // 5 Minute Timeout to pause
                  if (window.heroTrailerTimeout) clearTimeout(window.heroTrailerTimeout);
                  window.heroTrailerTimeout = setTimeout(() => {
                    const v = document.getElementById('bg-trailer');
                    if (v && !v.paused) {
                      v.pause();
                      window.isHeroPausedManually = true;
                      const icon = document.getElementById('hero-play-pause-icon');
                      if (icon) icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
                    }
                  }, 5 * 60 * 1000);

                  // Setup scroll listener for gradual fade and pause/resume
                  if (window._currentScrollFadeHandler) {
                    window.removeEventListener('scroll', window._currentScrollFadeHandler);
                  }
                  let fadeTicking = false;
                  window._currentScrollFadeHandler = () => {
                    if (isTouchDevice) return;

                    if (!fadeTicking) {
                      window.requestAnimationFrame(() => {
                        const v = document.getElementById('bg-trailer');
                        if (!v) {
                          window.removeEventListener('scroll', window._currentScrollFadeHandler);
                          fadeTicking = false;
                          return;
                        }
                        
                        const scrollY = window.scrollY;
                        const fadeStart = 50;
                        const fadeEnd = 400;

                        if (scrollY > fadeEnd) {
                          v.style.opacity = 0;
                          v.volume = 0;
                          if (!v.paused) {
                            v.pause();
                            v.dataset.pausedByScroll = 'true';
                          }
                        } else {
                          const fadeRatio = scrollY < fadeStart ? 1 : 1 - ((scrollY - fadeStart) / (fadeEnd - fadeStart));
                          v.style.opacity = Math.max(0, fadeRatio);
                          v.volume = Math.max(0, Math.min(1, fadeRatio));

                          if (v.paused && v.dataset.pausedByScroll === 'true' && !window.isHeroPausedManually && !playerModal.classList.contains('active')) {
                            v.dataset.pausedByScroll = 'false';
                            v.play().catch(e => console.warn('Autoplay prevented:', e));
                            
                            // Reset the 5 min timeout on auto-resume
                            if (window.heroTrailerTimeout) clearTimeout(window.heroTrailerTimeout);
                            window.heroTrailerTimeout = setTimeout(() => {
                              const v = document.getElementById('bg-trailer');
                              if (v && !v.paused) {
                                v.pause();
                                window.isHeroPausedManually = true;
                                const icon = document.getElementById('hero-play-pause-icon');
                                if (icon) icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
                              }
                            }, 5 * 60 * 1000);
                          }
                        }
                        fadeTicking = false;
                      });
                      fadeTicking = true;
                    }
                  };
                  window.addEventListener('scroll', window._currentScrollFadeHandler, { passive: true });
                }
              }
            }
          })
          .catch(e => console.error("Error fetching trailer:", e));
      }

      const serversToPing = serversToDisplay;
      const pingTop5 = () => {
        serversToPing.forEach(async (srv) => {
          const statusEl = document.getElementById(`${type}-ping-${srv.id}`);
          if (!statusEl) return;
          // Skip auto-check servers (Server 27) — they aren't real servers to ping
          if (srv.autoCheck) {
            statusEl.innerHTML = `<span class="ping-light ping-green"></span> Auto`;
            return;
          }
          const result = await pingServer(srv.url);
          if (result.status === 'online') {
            statusEl.innerHTML = `<span class="ping-light ping-green"></span> ${result.ping}ms`;
          } else {
            statusEl.innerHTML = `<span class="ping-light ping-red"></span> Offline`;
          }
        });
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(pingTop5, { timeout: 2000 });
      } else {
        setTimeout(pingTop5, 600);
      }
    }

    function updateContinueWatchingUI() {
      if (!rowsContainer) return; // Prevent crash on pages without rowsContainer like iptv.html
      // renderContinueWatching now safely handles removing the old row synchronously
      // right before the new one is added, preventing the visual disappearance bug.
      renderContinueWatching();
    }

    function renderCacheSettings() {
      cacheTotalSize.textContent = `Used: ${calculateStorageSize()} KB`;

      const progressItems = [];
      const watchedEpisodes = [];
      let watchlist = [];
      let lastServer = localStorage.getItem('last_used_server');

      // Parse Local Storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('progress_')) {
          try { progressItems.push({ key, data: JSON.parse(localStorage.getItem(key)) }); } catch (e) { }
        } else if (key.startsWith('watched_series_')) {
          const id = key.replace('watched_series_', '');
          try {
            const seriesData = JSON.parse(localStorage.getItem(key) || '{}');
            Object.keys(seriesData).filter(k => k !== '_updatedAt').forEach(season => {
              if (Array.isArray(seriesData[season])) {
                seriesData[season].forEach(episode => {
                  watchedEpisodes.push({ key, id, season, episode });
                });
              }
            });
          } catch (e) { }
        } else if (key === 'watchlist') {
          try { watchlist = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { }
        }
      }

      // Sort progress by updatedAt descending (safe)
      progressItems.sort((a, b) => ((b.data && b.data.updatedAt) || 0) - ((a.data && a.data.updatedAt) || 0));

      let html = '';

      // Section: Watch Progress
      html += `
        <div class="cache-section">
          <div class="cache-section-header">
            <h3 class="cache-section-title">Watch Progress</h3>
            <button class="cache-btn cache-btn-danger" onclick="clearCategoryPrefix('progress_')">Clear Progress</button>
          </div>
          <div class="cache-list">
      `;
      if (progressItems.length === 0) {
        html += `<div class="cache-empty">No watch progress saved.</div>`;
      } else {
        progressItems.forEach(item => {
          const d = item.data || {};
          const percentage = d.progress ? Math.round(d.progress) : 0;
          const poster = d.poster || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

          let progressText = `${percentage}% watched`;
          if (d.isEstimated) {
            const minutesWatched = Math.floor((d.currentTime || 0) / 60);
            progressText = `~${minutesWatched} min watched (Estimated)`;
          }

          html += `
            <div class="cache-item">
              <div class="cache-item-left">
                <img src="${poster}" class="cache-item-poster" alt="poster" loading="lazy">
                <div class="cache-item-info">
                  <div class="cache-item-title">${d.title || 'Unknown Title'}</div>
                  <div class="cache-item-sub">
                    <span class="cache-badge">${d.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                    <span>${progressText}</span>
                  </div>
                </div>
              </div>
              <button class="cache-item-delete" onclick="deleteCacheKey('${item.key}')" title="Delete">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>
              </button>
            </div>
          `;
        });
      }
      html += `</div></div>`;

      // Section: Watchlist
      html += `
        <div class="cache-section">
          <div class="cache-section-header">
            <h3 class="cache-section-title">My Watchlist</h3>
            <button class="cache-btn cache-btn-danger" onclick="deleteCacheKey('watchlist')">Clear Watchlist</button>
          </div>
          <div class="cache-list">
      `;
      if (watchlist.length === 0) {
        html += `<div class="cache-empty">Watchlist is empty.</div>`;
      } else {
        watchlist.forEach((w, index) => {
          const poster = w.poster_path ? IMG_URL + w.poster_path : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
          const title = w.title || w.name || 'Unknown';
          html += `
            <div class="cache-item">
              <div class="cache-item-left">
                <img src="${poster}" class="cache-item-poster" alt="poster" loading="lazy">
                <div class="cache-item-info">
                  <div class="cache-item-title">${title}</div>
                  <div class="cache-item-sub">
                    <span class="cache-badge">${w.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                  </div>
                </div>
              </div>
              <button class="cache-item-delete" onclick="removeWatchlistItem(${index})" title="Delete">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>
              </button>
            </div>
          `;
        });
      }
      html += `</div></div>`;

      // Section: Watched Episodes
      const totalEpCount = watchedEpisodes.length;
      html += `
        <div class="cache-section">
          <div class="cache-section-header">
            <h3 class="cache-section-title">Watched Episodes ${totalEpCount > 0 ? `<span style="font-size:0.8rem;font-weight:400;color:#999;">(${totalEpCount} total)</span>` : ''}</h3>
            <button class="cache-btn cache-btn-danger" onclick="clearCategoryPrefix('watched_')">Clear History</button>
          </div>
          <div class="cache-list" id="watched-episodes-list">
            ${totalEpCount === 0
              ? '<div class="cache-empty">No watched episodes recorded.</div>'
              : '<div class="cache-empty">Loading show names...</div>'
            }
          </div>
        </div>
      `;

      // Section: Server History
      html += `
        <div class="cache-section">
          <div class="cache-section-header">
            <h3 class="cache-section-title">Server Preferences</h3>
            <button class="cache-btn cache-btn-danger" onclick="deleteCacheKey('last_used_server')">Clear Data</button>
          </div>
          <div class="cache-list">
      `;
      if (!lastServer) {
        html += `<div class="cache-empty">No server preference saved.</div>`;
      } else {
        const serverObj = SERVERS.find(s => s.id === lastServer);
        const serverName = serverObj ? serverObj.name : lastServer;
        html += `
          <div class="cache-item">
            <div class="cache-item-left">
              <div style="width:40px;height:40px;border-radius:6px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              </div>
              <div class="cache-item-info">
                <div class="cache-item-title">Last Used Server</div>
                <div class="cache-item-sub" style="color:var(--primary-color);font-weight:bold;">${serverName}</div>
              </div>
            </div>
            <button class="cache-item-delete" onclick="deleteCacheKey('last_used_server')" title="Delete">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>
            </button>
          </div>
        `;
      }
      html += `</div></div>`;

      // Render everything immediately
      cacheSectionsContainer.innerHTML = html;

      // Lazily load watched episode show names in background (5 shows at a time)
      if (watchedEpisodes.length > 0) {
        (async () => {
          const epListEl = document.getElementById('watched-episodes-list');
          if (!epListEl) return;

          // Group by show ID
          const showMap = {};
          watchedEpisodes.forEach(ep => {
            if (!showMap[ep.id]) showMap[ep.id] = { id: ep.id, episodes: [] };
            showMap[ep.id].episodes.push({ season: ep.season, episode: ep.episode });
          });

          const showIds = Object.keys(showMap);
          let epHtml = '';
          const BATCH = 5;

          for (let i = 0; i < showIds.length; i += BATCH) {
            const batch = showIds.slice(i, i + BATCH);
            await Promise.all(batch.map(async (id) => {
              try {
                const showRes = await fetch(`https://tmdb-proxy.gametec1290.workers.dev/3/tv/${id}?api_key=PROXY_HANDLES_THIS`);
                const showData = showRes.ok ? await showRes.json() : null;
                const showTitle = showData ? showData.name : `Show ID: ${id}`;
                const poster = showData && showData.poster_path
                  ? `https://image.tmdb.org/t/p/w500${showData.poster_path}`
                  : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                showMap[id].episodes.forEach(ep => {
                  epHtml += `
                    <div class="cache-item">
                      <div class="cache-item-left">
                        <img src="${poster}" class="cache-item-poster" alt="poster" loading="lazy">
                        <div class="cache-item-info">
                          <div class="cache-item-title">${showTitle}</div>
                          <div class="cache-item-sub">
                            <span class="cache-badge">S${ep.season}:E${ep.episode}</span>
                          </div>
                        </div>
                      </div>
                      <button class="cache-item-delete" onclick="unmarkEpisodeWatched('${id}', '${ep.season}', '${ep.episode}'); renderCacheSettings();" title="Delete">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>
                      </button>
                    </div>
                  `;
                });
              } catch (e) { /* skip */ }
            }));

            const freshEl = document.getElementById('watched-episodes-list');
            if (freshEl) freshEl.innerHTML = epHtml || `<div class="cache-empty">No watched episodes recorded.</div>`;
          }
        })();
      }
    }

      function createGridHtml(servers, prefix) {
        let html = `<div class="st-grid" id="${prefix}-grid">`;
        servers.forEach(srv => {
          let expertHtml = '';
          const isPrisma = srv.id === 'prisma-system';
          const cardClass = isPrisma ? 'st-card prisma-host-card' : 'st-card';
          if (window.isExpertMode) {
            let uptimeHtml = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
                <span style="color: #aaa; font-size: 0.8rem; font-weight: bold;">30-Day Uptime</span>
                <span class="st-uptime" id="uptime-val-${srv.id}" style="color: #777; background: rgba(255,255,255,0.1);">Loading...</span>
              </div>
            `;

            let sparklineSvg = '';
            const localHistory = JSON.parse(localStorage.getItem(`ping_history_${srv.id}`) || '[]');
            if (localHistory.length > 1) {
              const times = localHistory;
              const maxTime = Math.max(...times, 200); // Minimum scale
              const width = 200;
              const height = 30;
              const color = times[times.length - 1] < 500 ? '#00d26a' : (times[times.length - 1] < 1000 ? '#fdd835' : '#ff4444');
              const points = times.map((t, i) => {
                const x = (i / (times.length - 1)) * width;
                const y = height - ((t / maxTime) * height);
                return `${x},${y}`;
              }).join(' ');
              
              sparklineSvg = `
                <div style="margin-top:10px; font-size: 0.75rem; color: #888;">Local Ping History (Last ${times.length})</div>
                <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="margin-top:5px;">
                  <polyline class="sparkline-path" points="${points}" style="stroke: ${color}; filter: drop-shadow(0 0 4px ${color}); opacity: 0.8;"></polyline>
                </svg>
              `;
            } else if (localHistory.length === 1) {
              sparklineSvg = `<div style="margin-top:10px; font-size: 0.75rem; color: #888;">Test again to draw graph.</div>`;
            } else {
               sparklineSvg = `<div style="margin-top:10px; font-size: 0.75rem; color: #888;">No local ping history.</div>`;
            }

            expertHtml = `
              ${uptimeHtml}
              <div id="${prefix}-sparkline-${srv.id}">${sparklineSvg}</div>
            `;
          }

          html += `
            <div class="${cardClass}" id="${prefix}-card-${srv.id}" data-prefix="${prefix}">
              <div class="st-card-header">
                <div>
                  <h3 class="st-card-title">${srv.label || 'Server'}</h3>
                  <div class="st-card-provider">${srv.name}</div>
                </div>
                <button class="st-card-ping-btn" id="${prefix}-btn-${srv.id}" data-url="${srv.url}">Test Ping</button>
              </div>
              <div class="st-card-status-box" style="margin-top: 10px;">
                <span style="color: #aaa; font-size: 0.9rem;">Status</span>
                <div class="st-ping-result" id="${prefix}-res-${srv.id}">
                  <span class="st-ping-dot"></span> ---
                </div>
              </div>
              ${expertHtml}
            </div>
          `;
        });
        html += `</div>`;
        return html;
      }

    async function renderContinueWatching() {
      const cwRaw = getContinueWatching();
      let cwItems = cwRaw.map(id => getProgressForId(id)).filter(item => item !== null);
      
      const removeExisting = () => {
        const rows = document.querySelectorAll('.row');
        rows.forEach(r => {
          if (r.dataset.rowType === "Continue Watching") {
            r.remove();
          }
        });
      };

      if (cwItems.length === 0) {
        removeExisting();
        return;
      }
      cwItems.sort((a, b) => b.updatedAt - a.updatedAt);

      // For any item missing a poster, fetch it from TMDB now and cache it
      const missingPosterItems = cwItems.filter(item => (!item.poster && !item.poster_path));
      if (missingPosterItems.length > 0) {
        await Promise.all(missingPosterItems.map(async (item) => {
          try {
            const type = item.mediaType || item.type || 'movie';
            const meta = await fetchApi(`/${type}/${item.id}?api_key=${TMDB_API_KEY}`);
            if (meta) {
              if (meta.poster_path) {
                item.poster_path = meta.poster_path;
                item.poster = `${IMG_URL}${meta.poster_path}`;
              }
              item.title = item.title || meta.title || meta.name;
              if (meta.vote_average !== undefined) {
                item.vote_average = meta.vote_average;
              }
              // Save back to localStorage so next load is instant
              const key = `progress_${item.id}`;
              try {
                const existing = JSON.parse(localStorage.getItem(key) || '{}');
                localStorage.setItem(key, JSON.stringify({ ...existing, ...item }));
              } catch (e) { }
            }
          } catch (e) { }
        }));
      }

      // Remove the old row right before injecting the new one to prevent async flickering
      removeExisting();

      createRow("Continue Watching", cwItems.map(item => {
        // Safely resolve poster: locally-saved items use 'poster' (full URL),
        // Trakt-imported items may only have 'poster_path' (relative path)
        let posterPath = '';
        if (item.poster) {
          posterPath = item.poster.replace(IMG_URL, '');
        } else if (item.poster_path) {
          posterPath = item.poster_path.replace(IMG_URL, '');
        }
        return {
          id: item.id,
          mediaType: item.mediaType,
          poster_path: posterPath,
          title: item.title,
          name: item.title,
          progressValue: item.progress,
          vote_average: item.vote_average
        };
      }), null, true);
    }

        function showCustomModal(message, isAlert) {
          return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
            overlay.style.backdropFilter = 'blur(10px)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';

            const modal = document.createElement('div');
            modal.style.background = 'linear-gradient(145deg, #1e1e1e, #2a2a2a)';
            modal.style.padding = '30px 40px';
            modal.style.borderRadius = '20px';
            modal.style.maxWidth = '400px';
            modal.style.textAlign = 'center';
            modal.style.boxShadow = '0 15px 35px rgba(0,0,0,0.5)';
            modal.style.border = '1px solid rgba(255,255,255,0.05)';
            modal.style.transform = 'translateY(20px)';
            modal.style.transition = 'transform 0.3s';

            const title = document.createElement('h3');
            title.innerHTML = isAlert ? '&#9201;&#65039; Auto-Off' : '&#9888;&#65039; Warning';
            title.style.color = isAlert ? '#fff' : '#ffaa00';
            title.style.marginBottom = '15px';
            title.style.fontSize = '1.5rem';

            const text = document.createElement('p');
            text.textContent = message;
            text.style.color = '#ccc';
            text.style.marginBottom = '30px';
            text.style.lineHeight = '1.6';
            text.style.fontSize = '0.95rem';

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '15px';
            btnContainer.style.justifyContent = 'center';

            const proceedBtn = document.createElement('button');
            proceedBtn.textContent = 'Got it';
            proceedBtn.style.padding = '10px 25px';
            proceedBtn.style.background = '#00d26a';
            proceedBtn.style.border = 'none';
            proceedBtn.style.borderRadius = '10px';
            proceedBtn.style.color = '#000';
            proceedBtn.style.cursor = 'pointer';
            proceedBtn.style.fontWeight = 'bold';
            proceedBtn.style.transition = 'transform 0.2s, filter 0.2s';
            proceedBtn.onmouseover = () => { proceedBtn.style.transform = 'scale(1.05)'; proceedBtn.style.filter = 'brightness(1.1)'; };
            proceedBtn.onmouseout = () => { proceedBtn.style.transform = 'scale(1)'; proceedBtn.style.filter = 'brightness(1)'; };

            if (!isAlert) {
              const cancelBtn = document.createElement('button');
              cancelBtn.textContent = 'Cancel';
              cancelBtn.style.padding = '10px 25px';
              cancelBtn.style.background = 'rgba(255,255,255,0.1)';
              cancelBtn.style.border = 'none';
              cancelBtn.style.borderRadius = '10px';
              cancelBtn.style.color = '#fff';
              cancelBtn.style.cursor = 'pointer';
              cancelBtn.style.fontWeight = 'bold';
              cancelBtn.style.transition = 'background 0.2s';
              cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.2)';
              cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
              cancelBtn.onclick = () => {
                overlay.style.opacity = '0';
                setTimeout(() => { document.body.removeChild(overlay); resolve(false); }, 300);
              };
              btnContainer.appendChild(cancelBtn);
                proceedBtn.textContent = 'Turn On';
              }
  
              proceedBtn.onclick = () => {
                overlay.style.opacity = '0';
                setTimeout(() => { document.body.removeChild(overlay); resolve(true); }, 300);
              };
  
              btnContainer.appendChild(proceedBtn);
              modal.appendChild(title);
              modal.appendChild(text);
              modal.appendChild(btnContainer);
              overlay.appendChild(modal);
              document.body.appendChild(overlay);
  
              requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'translateY(0)';
              });
            });
          }
