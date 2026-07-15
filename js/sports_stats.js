// js/sports_stats.js
// Handles Match Stats tab and in-player stats for WatchFooty

const WATCHFOOTY_API_ALL = 'https://api.watchfooty.st/api/v1/matches/all';
const WATCHFOOTY_API_STATS = 'https://api.watchfooty.st/api/v1/match/';

window.matchStatsState = {
    currentServer: '1',
    allMatches: [],
    activeHours: 12, // 12, 24, 48
    sportFilter: 'All',
    sortFilter: 'time' // 'time' or 'live'
};

window.changeMatchStatsServer = function(server) {
    window.matchStatsState.currentServer = String(server);
    window.matchStatsState.sportFilter = 'All';
    const sportSelect = document.getElementById('match-stats-sport-filter');
    if (sportSelect) sportSelect.value = 'All';
    window.fetchMatchStatsRange(window.matchStatsState.activeHours);
    
    // Close dropdown after selection
    const menu = document.getElementById('match-stats-dropdown-menu');
    if (menu) menu.style.display = 'none';
};

window.toggleMatchStatsDropdown = function(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('match-stats-dropdown-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.querySelector('.match-stats-dropdown-container');
    if (dropdown && !dropdown.contains(event.target)) {
        const menu = document.getElementById('match-stats-dropdown-menu');
        if (menu) menu.style.display = 'none';
    }
});

window.initMatchStats = async function() {
    // Default load 12h
    window.fetchMatchStatsRange(12);
};

window.fetchMatchStatsRange = async function(hours) {
    const container = document.getElementById('match-stats-container');
    if (!container) return;
    
    // Update active button UI
    ['12h', '24h', '48h'].forEach(h => {
        const btn = document.getElementById(`stats-time-${h}`);
        if (btn) {
            if (parseInt(h) === hours) {
                btn.style.background = 'rgba(229,9,20,0.8)';
                btn.style.color = '#fff';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#aaa';
            }
        }
    });

    window.matchStatsState.activeHours = hours;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888;">
            <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--primary-color); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            Fetching matches...
        </div>
    `;

    try {
        if (window.matchStatsState.currentServer === '1') {
            await fetchServer1Matches(hours);
        } else if (window.matchStatsState.currentServer === '2') {
            await fetchServer2Matches();
        }
        
        updateMatchStatsSportDropdown();
        window.applyMatchStatsFilters();
        
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color: #e50914; text-align: center; padding: 40px;">Failed to load matches.</div>';
    }
};

async function fetchServer1Matches(hours) {
    const datesToFetch = [];
    const today = new Date();
    
    // Base fetch is always today
    datesToFetch.push(WATCHFOOTY_API_ALL);
    
    if (hours === 24 || hours === 48) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        datesToFetch.push(`${WATCHFOOTY_API_ALL}?date=${tomorrow.toISOString().split('T')[0]}`);
    }
    
    if (hours === 48) {
        const dayAfter = new Date(today);
        dayAfter.setDate(dayAfter.getDate() + 2);
        datesToFetch.push(`${WATCHFOOTY_API_ALL}?date=${dayAfter.toISOString().split('T')[0]}`);
    }

    const responses = await Promise.all(datesToFetch.map(url => fetch(url)));
    const dataArrays = await Promise.all(responses.map(res => {
        if (!res.ok) return [];
        return res.json();
    }));

    // Flatten and remove duplicates by matchId
    const matchMap = new Map();
    dataArrays.flat().forEach(match => {
        if (match && (match.matchId || match.id)) {
            matchMap.set(match.matchId || match.id, match);
        }
    });

    window.matchStatsState.allMatches = Array.from(matchMap.values());
}

async function fetchServer2Matches() {
    const ESPN_LEAGUES = [
        // Top European Soccer
        'soccer/eng.1', 'soccer/eng.2', 'soccer/eng.3', 'soccer/eng.4', 'soccer/eng.fa', 'soccer/eng.league_cup',
        'soccer/esp.1', 'soccer/esp.2', 'soccer/esp.copa_del_rey',
        'soccer/ita.1', 'soccer/ita.2', 'soccer/ita.coppa_italia',
        'soccer/ger.1', 'soccer/ger.2', 'soccer/ger.dfb_pokal',
        'soccer/fra.1', 'soccer/fra.2', 'soccer/fra.coupe_de_france',
        // Other European Soccer
        'soccer/ned.1', 'soccer/por.1', 'soccer/tur.1', 'soccer/bel.1', 'soccer/sco.1',
        // International/Continental Soccer
        'soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/uefa.europa.conf', 'soccer/uefa.nations', 'soccer/uefa.euro',
        'soccer/fifa.world', 'soccer/fifa.worldq.uefa', 'soccer/fifa.worldq.conmebol', 'soccer/fifa.worldq.concacaf', 'soccer/fifa.friendlies',
        // Americas Soccer
        'soccer/conmebol.america', 'soccer/conmebol.libertadores', 'soccer/conmebol.sudamericana',
        'soccer/concacaf.gold', 'soccer/concacaf.champions',
        'soccer/mex.1', 'soccer/usa.1', 'soccer/usa.nwsl', 'soccer/bra.1', 'soccer/arg.1',
        // Asia/Oceania Soccer
        'soccer/jpn.1', 'soccer/aus.1', 'soccer/afc.champions',

        // Basketball
        'basketball/nba', 'basketball/mens-college-basketball', 'basketball/womens-college-basketball', 'basketball/wnba', 'basketball/euroleague',
        
        // American Football
        'football/nfl', 'football/college-football', 'football/cfl', 'football/ufl',
        
        // Baseball
        'baseball/mlb', 'baseball/college-baseball',
        
        // Hockey
        'hockey/nhl', 'hockey/mens-college-hockey',
        
        // Fighting (MMA/Boxing)
        'mma/ufc', 'mma/pfl', 'boxing/all',
        
        // Racing
        'racing/f1', 'racing/nascar-premier', 'racing/indycar',
        
        // Golf & Tennis
        'golf/pga', 'golf/lpga', 'golf/liv',
        'tennis/atp', 'tennis/wta',
        
        // Cricket (ICC Tournaments & IPL)
        'cricket/8039', 'cricket/8040', 'cricket/19430', 'cricket/8048'
    ];
    
    const getESPNRange = () => {
        const d1 = new Date();
        d1.setDate(d1.getDate() - 3);
        const d2 = new Date();
        d2.setDate(d2.getDate() + 7);
        const format = (d) => {
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}${m}${day}`;
        };
        return `${format(d1)}-${format(d2)}`;
    };
    const dateRange = getESPNRange();

    const fetchPromises = ESPN_LEAGUES.map(async (league) => {
        try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${dateRange}&limit=500`);
            if (!res.ok) return [];
            const data = await res.json();
            
            // Map ESPN format to our generic format
            const events = data.events || [];
            return events.map(ev => {
                const homeTeamObj = ev.competitions[0]?.competitors?.find(c => c.homeAway === 'home');
                const awayTeamObj = ev.competitions[0]?.competitors?.find(c => c.homeAway === 'away');
                const state = ev.status.type.state; // 'pre', 'in', 'post'
                
                return {
                    matchId: `espn_${league}_${ev.id}`,
                    espnId: ev.id,
                    espnLeague: league,
                    sport: league.split('/')[0].toUpperCase(),
                    league: data.leagues?.[0]?.name || league,
                    status: state,
                    timestamp: new Date(ev.date).getTime(),
                    poster: data.leagues?.[0]?.logos?.[0]?.href || '',
                    scores: {
                        home: homeTeamObj?.score ? parseInt(homeTeamObj.score) : -1,
                        away: awayTeamObj?.score ? parseInt(awayTeamObj.score) : -1
                    },
                    teams: {
                        home: {
                            name: homeTeamObj?.team?.displayName || 'Home',
                            logoUrl: homeTeamObj?.team?.logo || ''
                        },
                        away: {
                            name: awayTeamObj?.team?.displayName || 'Away',
                            logoUrl: awayTeamObj?.team?.logo || ''
                        }
                    }
                };
            });
        } catch (e) {
            console.warn('Failed to fetch league:', league, e);
            return [];
        }
    });
    
    const results = await Promise.all(fetchPromises);
    window.matchStatsState.allMatches = results.flat();
}

function updateMatchStatsSportDropdown() {
    const sportFilter = document.getElementById('match-stats-sport-filter');
    const leagueFilter = document.getElementById('match-stats-league-filter');
    if (!sportFilter) return;

    const groupedSports = {};
    const groupedLeagues = {};

    window.matchStatsState.allMatches.forEach(e => {
        let baseSport = e.sport ? e.sport.split(' • ')[0].trim().toUpperCase() : 'SPORTS';
        if (baseSport === 'FOOTBALL') baseSport = 'SOCCER';
        if (baseSport === 'AMERICAN-FOOTBALL' || baseSport === 'AMERICAN FOOTBALL') baseSport = 'FOOTBALL';
        
        if (!groupedSports[baseSport]) groupedSports[baseSport] = 0;
        groupedSports[baseSport]++;
        
        if (window.matchStatsState.sportFilter === baseSport) {
            let leagueName = e.league || 'Other';
            if (!groupedLeagues[leagueName]) groupedLeagues[leagueName] = 0;
            groupedLeagues[leagueName]++;
        }
    });

    const sortedSports = Object.keys(groupedSports).sort();
    let html = `<option value="All">All Sports (${window.matchStatsState.allMatches.length})</option>`;
    
    sortedSports.forEach(sport => {
        const selected = window.matchStatsState.sportFilter === sport ? 'selected' : '';
        html += `<option value="${sport}" ${selected}>${sport} (${groupedSports[sport]})</option>`;
    });
    
    sportFilter.innerHTML = html;
    
    if (window.matchStatsState.sportFilter !== 'All' && leagueFilter) {
        leagueFilter.style.display = 'inline-block';
        const sortedLeagues = Object.keys(groupedLeagues).sort();
        let lHtml = `<option value="All">All Leagues</option>`;
        sortedLeagues.forEach(league => {
            const lSelected = window.matchStatsState.leagueFilter === league ? 'selected' : '';
            lHtml += `<option value="${league}" ${lSelected}>${league} (${groupedLeagues[league]})</option>`;
        });
        leagueFilter.innerHTML = lHtml;
    } else if (leagueFilter) {
        leagueFilter.style.display = 'none';
    }
}

window.applyMatchStatsFilters = function(sportChanged = false) {
    const sportFilter = document.getElementById('match-stats-sport-filter');
    const leagueFilter = document.getElementById('match-stats-league-filter');
    const sortFilter = document.getElementById('match-stats-sort-filter');
    
    if (sportFilter) window.matchStatsState.sportFilter = sportFilter.value;
    if (sortFilter) window.matchStatsState.sortFilter = sortFilter.value;
    
    if (sportChanged) {
        window.matchStatsState.leagueFilter = 'All';
        if (leagueFilter) leagueFilter.value = 'All';
        updateMatchStatsSportDropdown();
    } else if (leagueFilter && leagueFilter.style.display !== 'none') {
        window.matchStatsState.leagueFilter = leagueFilter.value;
    }
    
    let filtered = [...window.matchStatsState.allMatches];
    
    // 1. Filter by Sport & League
    if (window.matchStatsState.sportFilter !== 'All') {
        filtered = filtered.filter(match => {
            let s = match.sport ? match.sport.split(' • ')[0].trim().toUpperCase() : 'SPORTS';
            if (s === 'FOOTBALL') s = 'SOCCER';
            if (s === 'AMERICAN-FOOTBALL' || s === 'AMERICAN FOOTBALL') s = 'FOOTBALL';
            
            if (s !== window.matchStatsState.sportFilter) return false;
            
            if (window.matchStatsState.leagueFilter && window.matchStatsState.leagueFilter !== 'All') {
                let matchLeague = match.league || 'Other';
                if (matchLeague !== window.matchStatsState.leagueFilter) return false;
            }
            
            return true;
        });
    }

    // 2. Sort by Time or Live First
    filtered.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        
        if (window.matchStatsState.sortFilter === 'live') {
            const aLive = a.status === 'in' ? 1 : 0;
            const bLive = b.status === 'in' ? 1 : 0;
            
            if (aLive !== bLive) {
                return bLive - aLive; // Live matches first
            }
        }
        
        // Default to chronological sort
        return timeA - timeB;
    });

    renderMatchStatsList(filtered, document.getElementById('match-stats-container'));
};

function formatCountdown(timestamp) {
    const now = Date.now();
    const diffMs = timestamp - now;
    
    if (diffMs <= 0) return 'Starting soon';
    
    const diffSec = Math.floor(diffMs / 1000);
    const m = Math.floor((diffSec % 3600) / 60);
    const h = Math.floor((diffSec % 86400) / 3600);
    const d = Math.floor(diffSec / 86400);

    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function renderMatchStatsList(matches, container) {
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">No matches found for this selection.</div>';
        return;
    }

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">`;
    
    matches.forEach(match => {
        let sportName = match.sport ? match.sport.toUpperCase() : 'SPORTS';
        if (sportName === 'FOOTBALL') sportName = 'SOCCER';
        if (sportName === 'AMERICAN-FOOTBALL' || sportName === 'AMERICAN FOOTBALL') sportName = 'FOOTBALL';

        const getUrl = (path) => path ? (path.startsWith('http') ? path : `https://api.watchfooty.st${path}`) : '';
        const posterUrl = match.poster ? getUrl(match.poster) : 'https://via.placeholder.com/280x160/141414/ffffff?text=No+Poster';
        const homeLogo = (match.teams && match.teams.home && match.teams.home.logoUrl) ? getUrl(match.teams.home.logoUrl) : '';
        const awayLogo = (match.teams && match.teams.away && match.teams.away.logoUrl) ? getUrl(match.teams.away.logoUrl) : '';
        const homeName = (match.teams && match.teams.home) ? match.teams.home.name : 'Home';
        const awayName = (match.teams && match.teams.away) ? match.teams.away.name : 'Away';
        
        let timerHtml = '';
        let dateHtml = '';
        
        if (match.status === 'in') {
            timerHtml = `<div style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: rgba(229,9,20,0.9); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 2;">LIVE NOW</div>`;
        } else if (match.status === 'post' || match.status === 'FT') {
            dateHtml = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 2;">ENDED</div>`;
            timerHtml = '';
        } else if (match.timestamp) {
            timerHtml = `<div style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.5); white-space: nowrap; z-index: 2;">${formatCountdown(match.timestamp)}</div>`;
            
            if (match.timestamp > Date.now()) {
                const d = new Date(match.timestamp);
                const isToday = new Date().toDateString() === d.toDateString();
                let timeStr = isToday ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                dateHtml = `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: #aaa; z-index: 2;">${timeStr}</div>`;
            }
        }

        const isTransparentLogo = match.poster && match.poster.includes('.png');
        const posterBg = isTransparentLogo ? `background: linear-gradient(135deg, #1a1a1a, #222); display: flex; justify-content: center; align-items: center;` : `background: url('${posterUrl}') center/cover;`;
        
        html += `
            <div onclick="window.loadMatchStats('${match.matchId || match.id}', 'match-stats-container', '${posterUrl}')" 
                 style="background: #1a1a1a; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid rgba(255,255,255,0.1);"
                 onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 10px 20px rgba(0,0,0,0.5)'"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                
                <div style="height: 140px; ${posterBg} position: relative; overflow: hidden;">
                    ${isTransparentLogo ? `<div style="position: absolute; font-size: 1.5rem; font-weight: 900; color: rgba(255,255,255,0.05); text-transform: uppercase; text-align: center; width: 90%; line-height: 1.2;">${match.league || sportName}</div><img src="${posterUrl}" style="max-height: 90px; max-width: 80%; opacity: 0.95; object-fit: contain; filter: drop-shadow(0 0 15px rgba(255,255,255,0.35)); position: relative; z-index: 1;">` : ''}
                    ${timerHtml}
                    ${dateHtml}
                </div>
                
                <div style="padding: 15px;">
                    <div style="font-size: 0.8rem; color: #888; margin-bottom: 10px;">${sportName} • ${match.league || ''}</div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${homeLogo ? `<img src="${homeLogo}" style="width: 24px; height: 24px; object-fit: contain;">` : ''}
                            <span style="color: #fff; font-weight: 500; font-size: 0.95rem;">${homeName}</span>
                        </div>
                        <span style="color: #fff; font-weight: bold;">${match.scores ? (match.scores.home !== -1 ? match.scores.home : '-') : '-'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${awayLogo ? `<img src="${awayLogo}" style="width: 24px; height: 24px; object-fit: contain;">` : ''}
                            <span style="color: #fff; font-weight: 500; font-size: 0.95rem;">${awayName}</span>
                        </div>
                        <span style="color: #fff; font-weight: bold;">${match.scores ? (match.scores.away !== -1 ? match.scores.away : '-') : '-'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

window.loadMatchStats = async function(matchId, targetContainerId, posterUrl) {
    const container = document.getElementById(targetContainerId);
    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'block';
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888;">
            <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--primary-color); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            Loading Match Statistics...
        </div>
    `;

    if (window.matchStatsState.currentServer === '2') {
        await loadServer2MatchStats(matchId, container, targetContainerId, posterUrl);
        return;
    }

    try {
        const response = await fetch(`${WATCHFOOTY_API_STATS}${matchId}/stats`);
        if (!response.ok) throw new Error('Stats not available');
        const data = await response.json();
        if (posterUrl) data.posterUrl = posterUrl;
        
        renderDetailedStats(data, container, targetContainerId === 'match-stats-container');
    } catch (e) {
        console.error(e);
        container.innerHTML = `
            <div style="padding: 30px; text-align: center;">
                <h3 style="color: #fff; margin-bottom: 10px;">Statistics Not Available</h3>
                <p style="color: #aaa;">Detailed statistics are not yet available for this match.</p>
                ${targetContainerId === 'match-stats-container' ? `<button onclick="window.initMatchStats()" style="margin-top: 15px; background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Go Back</button>` : ''}
            </div>
        `;
    }
};

async function loadServer2MatchStats(matchIdStr, container, targetContainerId, posterUrl) {
    try {
        const parts = matchIdStr.replace('espn_', '').split('_');
        const league = parts[0]; 
        const id = parts[1];
        
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${id}`);
        if (!response.ok) throw new Error('Stats not available');
        const summaryData = await response.json();
        
        const homeTeamHeader = summaryData.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home') || {};
        const awayTeamHeader = summaryData.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away') || {};
        const homeTeamBox = summaryData.boxscore?.teams?.find(t => t.homeAway === 'home') || {};
        const awayTeamBox = summaryData.boxscore?.teams?.find(t => t.homeAway === 'away') || {};
        
        const mappedData = {
            posterUrl: posterUrl,
            status: summaryData.header?.competitions?.[0]?.status?.type?.state,
            currentMinute: summaryData.header?.competitions?.[0]?.status?.displayClock,
            date: summaryData.header?.competitions?.[0]?.date,
            homeScore: homeTeamHeader.score !== undefined ? homeTeamHeader.score : -1,
            awayScore: awayTeamHeader.score !== undefined ? awayTeamHeader.score : -1,
            teams: {
                home: { 
                    name: homeTeamHeader.team?.displayName || homeTeamBox.team?.displayName, 
                    logoUrl: homeTeamHeader.team?.logo || homeTeamBox.team?.logo, 
                    id: homeTeamHeader.team?.id || homeTeamBox.team?.id 
                },
                away: { 
                    name: awayTeamHeader.team?.displayName || awayTeamBox.team?.displayName, 
                    logoUrl: awayTeamHeader.team?.logo || awayTeamBox.team?.logo, 
                    id: awayTeamHeader.team?.id || awayTeamBox.team?.id 
                }
            },
            gameInfo: summaryData.gameInfo,
            lastFiveGames: summaryData.lastFiveGames,
            headToHeadGames: summaryData.headToHeadGames,
            pickcenter: summaryData.pickcenter,
            standings: summaryData.standings,
            statistics: {
                boxscore: { teams: [], players: summaryData.boxscore?.players },
                commentary: [],
                rosters: summaryData.rosters
            }
        };

        if (summaryData.boxscore?.teams) {
            mappedData.statistics.boxscore.teams = summaryData.boxscore.teams.map(t => ({
                statistics: t.statistics?.map(s => ({ displayValue: s.displayValue, label: s.label })) || []
            }));
        }

        if (summaryData.keyEvents) {
            mappedData.statistics.commentary = summaryData.keyEvents.map(ev => ({
                time: { displayValue: ev.clock?.displayValue || '' },
                text: ev.text
            }));
        }

        // Note: We use summaryData.rosters directly without stripping it down so that we preserve athlete headshots and positions.
        
        renderDetailedStats(mappedData, container, targetContainerId === 'match-stats-container');
    } catch(e) {
        console.error(e);
        container.innerHTML = `
            <div style="padding: 30px; text-align: center;">
                <h3 style="color: #fff; margin-bottom: 10px;">Statistics Not Available</h3>
                <p style="color: #aaa;">Detailed statistics are not yet available for this match on ESPN.</p>
                ${targetContainerId === 'match-stats-container' ? `<button onclick="window.initMatchStats()" style="margin-top: 15px; background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Go Back</button>` : ''}
            </div>
        `;
    }
};

function renderDetailedStats(data, container, showBackButton) {
    if (!data.statistics) {
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; color: #aaa;">
                No advanced statistics found for this match.
                ${showBackButton ? `<br><button onclick="window.initMatchStats()" style="margin-top: 15px; background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Go Back</button>` : ''}
            </div>
        `;
        return;
    }

    const s = data.statistics;
    const homeTeam = data.teams?.home?.name || 'Home';
    const awayTeam = data.teams?.away?.name || 'Away';
    const getUrl = (path) => path ? (path.startsWith('http') ? path : `https://api.watchfooty.st${path}`) : '';
    const homeLogo = data.teams?.home?.logoUrl ? getUrl(data.teams.home.logoUrl) : '';
    const awayLogo = data.teams?.away?.logoUrl ? getUrl(data.teams.away.logoUrl) : '';
    const homeScore = data.homeScore !== undefined && data.homeScore !== -1 ? data.homeScore : '-';
    const awayScore = data.awayScore !== undefined && data.awayScore !== -1 ? data.awayScore : '-';

    let html = `
        ${showBackButton ? `<button onclick="window.initMatchStats()" style="margin-bottom: 20px; background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Matches</button>` : ''}
        
        <!-- Scoreboard Header -->
        <div style="${data.posterUrl ? `background: url('${data.posterUrl}') center/cover;` : 'background: linear-gradient(135deg, #1a1a1a, #2a2a2a);'} border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;">
            <div style="background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(20px); padding: 30px 20px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
                <div style="text-align: center; flex: 1;">
                    ${homeLogo ? `<img src="${homeLogo}" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 10px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">` : ''}
                    <div style="color: #fff; font-weight: bold; font-size: 1.2rem;">${homeTeam}</div>
                </div>
                <div style="text-align: center; padding: 0 20px; flex: 2;">
                    <div style="font-size: 0.9rem; color: #888; margin-bottom: 5px;">${data.currentMinute ? data.currentMinute + "'" : data.status === 'in' ? 'LIVE' : (data.date ? new Date(data.date).toLocaleDateString() : '')}</div>
                    
                    ${homeScore === '-' ? 
                        `<div style="font-size: 2.5rem; font-weight: 800; color: #fff; display: flex; align-items: center; justify-content: center; gap: 15px;">
                            <span style="color: #888; font-size: 1.5rem; text-transform: uppercase;">v</span>
                        </div>`
                    : String(homeScore).length > 8 || String(awayScore).length > 8 ? 
                        `<div style="font-size: 1.2rem; font-weight: 700; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 10px;">
                            <span style="color: #fff; text-align: center;">${homeScore}</span>
                            <span style="font-size: 0.8rem; color: #888; text-transform: uppercase;">vs</span>
                            <span style="color: #fff; text-align: center;">${awayScore}</span>
                        </div>`
                    :
                        `<div style="font-size: 2.5rem; font-weight: 800; color: #fff; display: flex; align-items: center; justify-content: center; gap: 15px;">
                            <span>${homeScore}</span><span style="color: #555;">-</span><span>${awayScore}</span>
                        </div>`
                    }
                </div>
                <div style="text-align: center; flex: 1;">
                    ${awayLogo ? `<img src="${awayLogo}" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 10px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">` : ''}
                    <div style="color: #fff; font-weight: bold; font-size: 1.2rem;">${awayTeam}</div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
    `;

    // Match Info
    if (data.gameInfo && data.gameInfo.venue) {
        html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-around;">`;
        html += `<div style="text-align: center;"><div style="color: #888; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 5px;">Venue</div><div style="color: #fff; font-weight: bold;">${data.gameInfo.venue.fullName || 'Unknown'} ${data.gameInfo.venue.address?.city ? `(${data.gameInfo.venue.address.city})` : ''}</div></div>`;
        if (data.gameInfo.attendance) html += `<div style="text-align: center;"><div style="color: #888; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 5px;">Attendance</div><div style="color: #fff; font-weight: bold;">${data.gameInfo.attendance.toLocaleString()}</div></div>`;
        if (data.gameInfo.weather?.temperature) html += `<div style="text-align: center;"><div style="color: #888; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 5px;">Weather</div><div style="color: #fff; font-weight: bold;">${data.gameInfo.weather.temperature}° - ${data.gameInfo.weather.displayValue || ''}</div></div>`;
        if (data.gameInfo.officials && data.gameInfo.officials.length > 0) html += `<div style="text-align: center;"><div style="color: #888; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 5px;">Referee</div><div style="color: #fff; font-weight: bold;">${data.gameInfo.officials[0].fullName}</div></div>`;
        html += `</div>`;
    }

    // Match Predictor
    if (data.pickcenter && data.pickcenter.length > 0) {
        const pc = data.pickcenter[0];
        if (pc.homeWinPercentage && pc.awayWinPercentage) {
            html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">`;
            html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 15px; font-size: 1.1rem;">Match Predictor</h3>`;
            html += `<div style="display: flex; justify-content: space-between; color: #fff; font-size: 0.9rem; margin-bottom: 8px; font-weight: bold;">`;
            html += `<span>${homeTeam} (${(pc.homeWinPercentage * 100).toFixed(1)}%)</span>`;
            if (pc.tiePercentage) html += `<span style="color:#888;">Tie (${(pc.tiePercentage * 100).toFixed(1)}%)</span>`;
            html += `<span>${awayTeam} (${(pc.awayWinPercentage * 100).toFixed(1)}%)</span>`;
            html += `</div>`;
            html += `<div style="display: flex; height: 12px; background: #333; border-radius: 6px; overflow: hidden;">`;
            html += `<div style="width: ${pc.homeWinPercentage * 100}%; background: #007bff;"></div>`;
            if (pc.tiePercentage) html += `<div style="width: ${pc.tiePercentage * 100}%; background: #888;"></div>`;
            html += `<div style="width: ${pc.awayWinPercentage * 100}%; background: #e50914;"></div>`;
            html += `</div></div>`;
        }
    }

    // Form Guide
    if (data.lastFiveGames && data.lastFiveGames.length === 2) {
        html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">`;
        data.lastFiveGames.forEach(teamForm => {
            const isHome = teamForm.team?.id === data.teams?.home?.id;
            const tName = isHome ? homeTeam : awayTeam;
            html += `<div>`;
            html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 10px; font-size: 0.9rem; text-transform: uppercase;">${tName} Form</h3>`;
            html += `<div style="display: flex; gap: 5px;">`;
            if (teamForm.events) {
                teamForm.events.forEach(ev => {
                    const result = ev.gameResult;
                    const bg = result === 'W' ? '#4CAF50' : (result === 'L' ? '#F44336' : '#9E9E9E');
                    html += `<div style="width: 25px; height: 25px; border-radius: 4px; background: ${bg}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;" title="${ev.atVs} ${ev.score || ''} - ${new Date(ev.gameDate).toLocaleDateString()}">${result || '-'}</div>`;
                });
            }
            html += `</div></div>`;
        });
        html += `</div>`;
    }

    // Head to Head
    if (data.headToHeadGames && data.headToHeadGames.length > 0 && data.headToHeadGames[0].events) {
        const h2hEvents = data.headToHeadGames[0].events;
        const currentTeamId = data.headToHeadGames[0].team?.id;
        html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">`;
        html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Head to Head (Last ${h2hEvents.length})</h3>`;
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        h2hEvents.forEach(ev => {
            html += `<div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">`;
            html += `<div style="color: #888; font-size: 0.85rem; width: 80px;">${new Date(ev.gameDate).toLocaleDateString()}</div>`;
            
            const isHome = ev.homeTeamId === currentTeamId;
            const currentTeamScore = isHome ? ev.homeTeamScore : ev.awayTeamScore;
            const oppScore = isHome ? ev.awayTeamScore : ev.homeTeamScore;
            const currentTeamWin = ev.gameResult === 'W';
            const oppWin = ev.gameResult === 'L';

            const currentStyle = currentTeamWin ? 'color: #fff; font-weight: bold;' : 'color: #aaa;';
            const oppStyle = oppWin ? 'color: #fff; font-weight: bold;' : 'color: #aaa;';

            html += `<div style="flex: 1; text-align: right; ${currentStyle} margin-right: 15px;">${data.headToHeadGames[0].team?.abbreviation || data.headToHeadGames[0].team?.displayName} <span style="margin-left: 5px; font-size: 1.1rem;">${currentTeamScore}</span></div>`;
            html += `<div style="color: #555;">-</div>`;
            html += `<div style="flex: 1; text-align: left; ${oppStyle} margin-left: 15px;"><span style="margin-right: 5px; font-size: 1.1rem;">${oppScore}</span> ${ev.opponent?.abbreviation || ev.opponent?.displayName}</div>`;
            html += `</div>`;
        });
        html += `</div></div>`;
    }

    // Boxscore (Possession, Stats)
    if (s.boxscore && s.boxscore.teams && s.boxscore.teams.length === 2) {
        html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">`;
        html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Team Stats</h3>`;
        
        const t1Stats = s.boxscore.teams[0].statistics || [];
        const t2Stats = s.boxscore.teams[1].statistics || [];
        
        t1Stats.forEach((stat1, idx) => {
            const stat2 = t2Stats[idx];
            if (stat2) {
                const p1 = stat1.displayValue.includes('%') ? parseInt(stat1.displayValue) : parseFloat(stat1.displayValue);
                const p2 = stat2.displayValue.includes('%') ? parseInt(stat2.displayValue) : parseFloat(stat2.displayValue);
                const total = (p1 + p2) || 1;
                const p1Width = (p1 / total) * 100;
                const p2Width = (p2 / total) * 100;

                html += `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; color: #fff; font-size: 0.9rem; margin-bottom: 5px;">
                            <span>${stat1.displayValue}</span>
                            <span style="color: #888;">${stat1.label}</span>
                            <span>${stat2.displayValue}</span>
                        </div>
                        <div style="display: flex; height: 6px; background: #333; border-radius: 3px; overflow: hidden; gap: 2px;">
                            <div style="width: ${p1Width}%; background: #007bff;"></div>
                            <div style="width: ${p2Width}%; background: #e50914;"></div>
                        </div>
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    // Commentary
    if (s.commentary && s.commentary.length > 0) {
        html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">`;
        html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 20px; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Live Commentary</h3>`;
        html += `<div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">`;
        
        s.commentary.forEach(comm => {
            html += `
                <div style="display: flex; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="min-width: 40px; font-weight: bold; color: #e50914;">${comm.time?.displayValue || ''}</div>
                    <div style="color: #ddd; font-size: 0.95rem; line-height: 1.4;">${comm.text}</div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }

    // Rosters
    if (s.rosters && s.rosters.length === 2) {
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
        
        [0, 1].forEach(idx => {
            const teamName = idx === 0 ? homeTeam : awayTeam;
            const roster = s.rosters[idx];
            
            html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">`;
            html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 10px; font-size: 1.1rem;">${teamName} Roster</h3>`;
            html += `<div style="color: #888; font-size: 0.85rem; margin-bottom: 15px;">Formation: ${roster.formation || 'N/A'}</div>`;
            
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            if (roster.roster) {
                const starters = roster.roster.filter(p => p.starter);
                const subs = roster.roster.filter(p => !p.starter);

                const renderPlayer = (player) => {
                    let eventsHtml = '';
                    if (player.plays) {
                        player.plays.forEach(play => {
                            if (play.scoringPlay) eventsHtml += '⚽ ';
                            if (play.yellowCard) eventsHtml += '🟨 ';
                            if (play.redCard) eventsHtml += '🟥 ';
                            if (play.substitution) eventsHtml += '🔄 ';
                        });
                    }
                    const pName = player.athlete?.fullName || player.athlete?.displayName || 'Unknown';
                    const initials = pName === 'Unknown' ? '?' : pName.split(' ').filter(p=>p.length>0).map((n,i,a)=>i===0||i===a.length-1?n[0]:'').join('').toUpperCase().substring(0,2);
                    const fallbackHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #2a2a2a, #3a3a3a); border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #bbb; font-weight: bold;">${initials}</div>`;
                    const headshotHtml = player.athlete?.headshot?.href ? `<img src="${player.athlete.headshot.href}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); background: #222;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"><div style="display: none; width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #2a2a2a, #3a3a3a); border: 2px solid rgba(255,255,255,0.1); align-items: center; justify-content: center; font-size: 0.75rem; color: #bbb; font-weight: bold;">${initials}</div>` : fallbackHtml;

                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 24px; text-align: center; color: #888; font-size: 0.85rem;">${player.jersey || ''}</div>
                                ${headshotHtml}
                                <div style="color: #fff; font-size: 0.95rem; font-weight: 500;">${pName} <span style="color: #666; font-size: 0.8rem; margin-left: 5px; font-weight: normal;">${player.position?.abbreviation || ''}</span></div>
                            </div>
                            <div style="font-size: 0.9rem;">${eventsHtml}</div>
                        </div>
                    `;
                };

                html += `<div style="color: #fff; font-weight: bold; margin-top: 5px; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Starters</div>`;
                starters.forEach(p => html += renderPlayer(p));

                if (subs.length > 0) {
                    html += `<div style="color: #fff; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Substitutes</div>`;
                    subs.forEach(p => html += renderPlayer(p));
                }
            }
            html += `</div></div>`;
        });
        
        html += `</div>`;
    }

    // Player Stats Boxscore
    if (s.boxscore && s.boxscore.players && s.boxscore.players.length > 0) {
        html += `<div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 20px;">`;
        s.boxscore.players.forEach(teamPlayers => {
            const tName = teamPlayers.team?.displayName;
            html += `<div style="background: #141414; border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.05); overflow-x: auto;">`;
            html += `<h3 style="color: #fff; margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${tName} Player Stats</h3>`;
            
            html += `<table style="width: 100%; border-collapse: collapse; color: #fff; font-size: 0.85rem; text-align: left; min-width: 500px;">`;
            html += `<thead><tr style="color: #888; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
            html += `<th style="padding: 10px 5px;">Player</th>`;
            if (teamPlayers.statistics && teamPlayers.statistics.length > 0) {
                const labels = teamPlayers.statistics[0].labels || [];
                labels.forEach(label => {
                    html += `<th style="padding: 10px 5px; text-align: right;">${label}</th>`;
                });
            }
            html += `</tr></thead><tbody>`;

            if (teamPlayers.statistics && teamPlayers.statistics.length > 0) {
                const statsMap = teamPlayers.statistics[0].athletes || [];
                statsMap.forEach(athleteStats => {
                    const pName = athleteStats.athlete?.displayName || 'Unknown';
                    const initials = pName === 'Unknown' ? '?' : pName.split(' ').filter(p=>p.length>0).map((n,i,a)=>i===0||i===a.length-1?n[0]:'').join('').toUpperCase().substring(0,2);
                    const fallbackHtml = `<div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #2a2a2a, #3a3a3a); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #bbb; font-weight: bold;">${initials}</div>`;
                    const headshotHtml = athleteStats.athlete?.headshot?.href ? `<img src="${athleteStats.athlete.headshot.href}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); background: #222;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"><div style="display: none; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #2a2a2a, #3a3a3a); border: 1px solid rgba(255,255,255,0.1); align-items: center; justify-content: center; font-size: 0.65rem; color: #bbb; font-weight: bold;">${initials}</div>` : fallbackHtml;

                    html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">`;
                    html += `<td style="padding: 8px 5px; font-weight: 500; color: #ddd; display: flex; align-items: center; gap: 10px;">${headshotHtml} <span>${pName}</span></td>`;
                    athleteStats.stats?.forEach(val => {
                        html += `<td style="padding: 8px 5px; text-align: right;">${val}</td>`;
                    });
                    html += `</tr>`;
                });
            }
            
            html += `</tbody></table></div>`;
        });
        html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}
