const ESPORTEX_ICONS = {
  football: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
  basketball: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M5.4 5.4l13.2 13.2"></path><path d="M18.6 5.4L5.4 18.6"></path><path d="M12 2a10 10 0 0 0 10 10"></path><path d="M2 12a10 10 0 0 0 10 10"></path></svg>',
  amfootball: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(45 12 12)"></ellipse><path d="M9.8 9.8l4.4 4.4"></path><path d="M8 12l2-2"></path><path d="M10 14l2-2"></path><path d="M12 16l2-2"></path></svg>',
  baseball: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M6.5 6.5a10 10 0 0 0 0 11"></path><path d="M17.5 6.5a10 10 0 0 1 0 11"></path></svg>',
  badminton: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h18"></path><path d="M18.4 6.6a9 9 0 1 1-12.77.04"></path></svg>',
  volleyball: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20"></path><path d="M2 12a14.5 14.5 0 0 0 20 0"></path></svg>',
  tennis: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2c2.8 2.8 2.8 17.2 0 20"></path><path d="M2 12c2.8-2.8 17.2-2.8 20 0"></path></svg>',
  race: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>',
  fight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4z"></path><path d="M20 14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2z"></path><path d="M10 6h4"></path><path d="M10 18h4"></path></svg>',
  hockey: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4l-9 14-4-4"></path><circle cx="6" cy="14" r="2"></circle></svg>',
  rugby: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"></ellipse><path d="M9 12h6"></path><path d="M12 9v6"></path></svg>',
  cricket: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14l8-4"></path><path d="M10 16l6-8"></path></svg>',
  other: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>'
};

const ESPORTEX_LABELS = {
  all: 'All Sports',
  football: 'Soccer',
  basketball: 'Basketball',
  amfootball: 'NFL',
  baseball: 'Baseball',
  badminton: 'Badminton',
  volleyball: 'Volleyball',
  tennis: 'Tennis',
  race: 'Motorsport',
  fight: 'Fight',
  hockey: 'Hockey',
  rugby: 'Rugby',
  cricket: 'Cricket',
  other: 'Other'
};

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

let esportexData = null;
let activeEsportexTab = null;
let esportexPollingInterval = null;

setInterval(() => {
  document.querySelectorAll('.esportex-countdown').forEach(el => {
    const start = parseInt(el.getAttribute('data-start'));
    if (!start) return;
    const diff = start - Date.now();
    if (diff <= 0) {
      const span = el.querySelector('span');
      if (span) span.innerText = 'LIVE NOW';
      else el.innerText = 'LIVE NOW';
      el.style.color = '#22c55e';
      el.style.borderColor = 'rgba(34,197,94,0.3)';
      el.style.background = 'rgba(34,197,94,0.12)';
      el.classList.remove('esportex-countdown');
      return;
    }
    
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    
    let text = '';
    if (h >= 24) {
      const d = Math.floor(h / 24);
      text = `${d}d ${h % 24}h`;
    } else {
      text = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    const span = el.querySelector('span');
    if (span) span.innerText = text;
    else el.innerText = text;
  });
}, 1000);

function initEsportex() {
  if (esportexPollingInterval) return; // already initialized
  fetchEsportexData();
  esportexPollingInterval = setInterval(fetchEsportexData, 45000);
}

async function fetchEsportexData() {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await fetch(`https://api.esportex.site/api/streams?cache=${timestamp}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    if (data.success) {
      esportexData = data;
      esportexData.all = [];
      Object.keys(data).forEach(key => {
        if (key !== 'success' && key !== 'all' && Array.isArray(data[key])) {
          esportexData.all = esportexData.all.concat(data[key]);
        }
      });
      renderEsportexUI();
    }
  } catch (error) {
    console.error('Failed to fetch Esportex data:', error);
    if (!esportexData) {
      const container = document.getElementById('esportex-content');
      if (container) container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">Failed to load live sports data.</div>';
    }
  }
}

function parseWibDate(dateStr) {
  // Input: "YYYY-MM-DD HH:mm"
  return new Date(dateStr.replace(' ', 'T') + '+07:00');
}

function getEsportexMatchStatus(kickoff, endTime) {
  const now = Date.now();
  const start = parseWibDate(kickoff).getTime();
  const end = new Date(endTime.replace(' ', 'T') + '+07:00').getTime();
  
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'ended';
}

function renderEsportexUI() {
  const view = document.getElementById('sports-esportex-view');
  if (!view) return;

  if (!esportexData) return;

  const validCategories = Object.keys(ESPORTEX_LABELS);

  if (!activeEsportexTab || !validCategories.includes(activeEsportexTab)) {
    activeEsportexTab = validCategories[0];
  }

  // Render Dropdown
  let html = `<div class="grid-header" style="justify-content: flex-start; gap: 20px; padding-bottom: 15px; margin-bottom: 15px; align-items: center; flex-wrap: wrap;">`;
  html += `
   <div style="display: flex; flex-direction: column; margin-right: 15px;">
     <span style="color: #e50914; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Currently Viewing</span>
     <h2 style="margin: 0; font-size: 1.4rem; color: #fff;">Server 2 <span style="color: #888; font-size: 1rem; font-weight: normal;">(Esportex)</span></h2>
   </div>`;
  html += `<select class="grid-filter-select" style="display: block; width: auto; max-width: 100%;" onchange="switchEsportexCategory(this.value)">`;
  
  validCategories.forEach(cat => {
    const matches = esportexData[cat] || [];
    const count = matches.length;
    const isSelected = cat === activeEsportexTab ? 'selected' : '';
    html += `<option value="${cat}" ${isSelected}>${ESPORTEX_LABELS[cat]} (${count})</option>`;
  });
  html += `</select>`;

  html += `<button class="sports-server-btn sports-refresh-btn" onclick="fetchEsportexData()" style="padding: 8px 12px; margin-left: 10px; background: rgba(255, 255, 255, 0.1); border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; color: #fff;" title="Refresh Server">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Refresh
  </button>`;

  html += `
    <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
      <span style="color: #aaa; font-size: 0.9rem; font-weight: bold;">12-Hour</span>
      <div class="toggle-switch ${window.sportsUse12HourFormat ? 'active' : ''}" id="esportex-time-format-toggle" onclick="toggleSportsTimeFormat()"></div>
    </div>
  </div>`;

  html += `<div id="esportex-content"></div>`;
  view.innerHTML = html;

  renderEsportexCategory(activeEsportexTab);
}

window.switchEsportexCategory = function(cat) {
  activeEsportexTab = cat;
  renderEsportexUI();
};

function renderEsportexCategory(cat) {
  const container = document.getElementById('esportex-content');
  const matches = esportexData[cat] || [];

  if (matches.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px; font-size: 1.1rem;">No live events currently available for this sport.</div>';
    return;
  }
  
  // Group by league
  const leagues = {};
  matches.forEach(m => {
    const lg = m.league || 'Other';
    if (!leagues[lg]) leagues[lg] = [];
    leagues[lg].push(m);
  });

  let html = '';
  
  Object.keys(leagues).sort().forEach(league => {
    const lgMatches = leagues[league].sort((a, b) => parseWibDate(a.kickoff).getTime() - parseWibDate(b.kickoff).getTime());
    
    html += `
      <div style="margin-top: 40px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
          <span style="font-size: 0.75rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; background: rgba(229, 9, 20, 0.12); color: #e50914; border: 1px solid rgba(229, 9, 20, 0.25);">
            ${league}
          </span>
          <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
        </div>
        <div class="search-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; align-items: start;">
    `;

    lgMatches.forEach(match => {
      const matchId = match.slug;
      
      const status = getEsportexMatchStatus(match.kickoff, match.endTime);
      let statusHtml = '';
      let countdownHtml = '';
      
      if (status === 'live') {
        statusHtml = `<span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; color: #22c55e; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); padding: 3px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px;">
          <div style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 6px #22c55e;"></div> LIVE
        </span>`;
      } else if (status === 'upcoming') {
        const startDate = parseWibDate(match.kickoff);
        const startTimestamp = startDate.getTime();
        const dateStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase();
        
        countdownHtml = `
            <span class="esportex-countdown" data-start="${startTimestamp}" style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; color: #fff; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>--:--:--</span>
            </span>
        `;
        statusHtml = `
            <span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; color: #f7c948; background: rgba(247,201,72,0.1); border: 1px solid rgba(247,201,72,0.25); padding: 3px 8px; border-radius: 4px;">
              ${dateStr}
            </span>
        `;
      } else {
        statusHtml = `<span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; color: #888; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px;">
          ENDED
        </span>`;
      }

      const matchTime = parseWibDate(match.kickoff).toLocaleTimeString([], {
        hour: '2-digit', 
        minute: '2-digit',
        hour12: window.sportsUse12HourFormat
      });
      const poster = match.poster || FALLBACK_POSTER;

      html += `
        <div class="card" onclick="esportexOpenServerModal('${matchId}')" style="position: relative; border-radius: 12px; background: linear-gradient(145deg, rgba(30,30,30,0.6) 0%, rgba(15,15,15,0.8) 100%); border: 1px solid rgba(255,255,255,0.05); overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; aspect-ratio: auto !important; height: auto;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
          <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; overflow: hidden;">
            <img src="${poster}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;" onerror="this.src='${FALLBACK_POSTER}'">
            <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(15,15,15,0.9) 100%);"></div>
            ${countdownHtml ? `<div style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2;">${countdownHtml}</div>` : ''}
            <div style="position: absolute; top: 12px; right: 12px;">${statusHtml}</div>
            <div style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.1);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ${matchTime}
            </div>
          </div>
          
          <div style="padding: 12px 15px; display: flex; flex-direction: column; align-items: center; text-align: center;">
            <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #fff; line-height: 1.3;">${match.tag}</h3>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

window.esportexPlayStream = function(url) {
  const modal = document.getElementById('stream-selector-modal');
  if (modal) modal.style.display = 'none';
  esportexWatch(url);
};

window.esportexOpenServerModal = function(matchId) {
  let modal = document.getElementById('stream-selector-modal');
  let listContainer = document.getElementById('stream-selector-list');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stream-selector-modal';
    modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; align-items: center; justify-content: center;';
    modal.innerHTML = `
      <div style="background: #141414; border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80dvh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 1.5rem;">Select a Stream</h2>
          <button onclick="document.getElementById('stream-selector-modal').style.display='none'" style="background: none; border: none; color: #aaa; font-size: 1.5rem; cursor: pointer;">✕</button>
        </div>
        <p style="color: #aaa; font-size: 0.9rem; margin-bottom: 20px;">If a stream buffers or pauses on iOS, try selecting a different server.</p>
        <div id="stream-selector-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    listContainer = document.getElementById('stream-selector-list');
  }

  if (!listContainer || !modal) {
    console.error("Server modal elements not found.");
    return;
  }
  
  let foundMatch = null;
  for (const cat in esportexData) {
    if (Array.isArray(esportexData[cat])) {
      const match = esportexData[cat].find(m => m.slug === matchId);
      if (match) {
        foundMatch = match;
        break;
      }
    }
  }
  
  if (!foundMatch || !foundMatch.iframes || foundMatch.iframes.length === 0) {
    return alert("No servers available for this match.");
  }
  
  listContainer.innerHTML = '';
  foundMatch.iframes.forEach((iframe, index) => {
    let isHD = iframe.server.toLowerCase().includes('hd') || iframe.server.toLowerCase().includes('4k') || iframe.server.toLowerCase().includes('vip') || iframe.server.toLowerCase().includes('auto');
    const qualityHtml = isHD ? '<span style="background:#e50914;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:bold;">HD</span>' : '<span style="background:#555;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:bold;">SD</span>';

    listContainer.innerHTML += `
      <button onclick="esportexPlayStream('${iframe.url}')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center; color: white; cursor: pointer; transition: background 0.2s; text-align: left;">
        <div>
          <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 5px;">Server ${index + 1} <span style="font-size:0.8rem;color:#aaa;font-weight:normal;text-transform:capitalize;">(Admin)</span></div>
          <div style="color: #ccc; font-size: 0.9rem;">${iframe.server}</div>
        </div>
        <div>${qualityHtml}</div>
      </button>
    `;
  });
  
  modal.style.display = 'flex';
};

window.esportexWatch = function(url) {
  if (!url) return alert('No stream URL available');
  const modal = document.getElementById('esportex-watch-modal');
  const iframe = document.getElementById('esportex-watch-iframe');
  if (modal && iframe) {
    iframe.src = url;
    modal.style.display = 'flex';
  }
};

window.closeEsportexWatch = function() {
  const modal = document.getElementById('esportex-watch-modal');
  const iframe = document.getElementById('esportex-watch-iframe');
  if (modal && iframe) {
    modal.style.display = 'none';
    iframe.src = '';
  }
};

window.esportexShowEmbed = function(url) {
  if (!url) return alert('No stream URL available');
  const modal = document.getElementById('esportex-embed-modal');
  const textarea = document.getElementById('esportex-embed-code');
  if (modal && textarea) {
    textarea.value = `<iframe src="${url}" width="100%" height="100%" frameborder="0" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>`;
    modal.style.display = 'flex';
  }
};

window.closeEsportexEmbed = function() {
  const modal = document.getElementById('esportex-embed-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.esportexCopyCode = function(url) {
  if (!url) return alert('No stream URL available');
  const code = `<iframe src="${url}" width="100%" height="100%" frameborder="0" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>`;
  navigator.clipboard.writeText(code).then(() => {
    showEsportexToast('Copied to clipboard!');
  }).catch(err => {
    console.error('Could not copy text: ', err);
  });
};

function showEsportexToast(msg) {
  let toast = document.getElementById('esportex-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'esportex-toast';
    toast.style.cssText = 'position: fixed; bottom: 30px; right: 30px; background: #22c55e; color: #fff; padding: 12px 20px; border-radius: 8px; font-weight: bold; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: 0.3s; transform: translateY(20px); opacity: 0;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
  }, 3000);
}
