// js/sports_news.js
let currentNewsOffset = 0;
let isFetchingNews = false;
let currentNewsFilters = {
    sport: 'all',
    sort: 'newest',
    dateRange: 'all',
    q: ''
};

function applyNewsFilters() {
    const sportEl = document.getElementById('news-filter-sport');
    const sortEl = document.getElementById('news-filter-sort');
    const dateRangeEl = document.getElementById('news-filter-date');
    const searchEl = document.getElementById('news-filter-search');

    if (sportEl) currentNewsFilters.sport = sportEl.value;
    if (sortEl) currentNewsFilters.sort = sortEl.value;
    if (dateRangeEl) currentNewsFilters.dateRange = dateRangeEl.value;
    if (searchEl) currentNewsFilters.q = searchEl.value;

    fetchSportsNews(false);
}


async function fetchSportsNews(loadMore = false) {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    if (!loadMore) {
        currentNewsOffset = 0;
        // Show loading spinner
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #e50914; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p style="color: #888;">Fetching latest sports news...</p>
            </div>
        `;
    } else {
        const loadMoreBtn = document.getElementById('load-more-news-btn');
        if (loadMoreBtn) loadMoreBtn.innerText = 'Loading...';
    }

    if (isFetchingNews) return;
    isFetchingNews = true;

    try {
        // Build URL with filters
        let url = `https://api.watchfooty.st/api/v1/news?offset=${currentNewsOffset}`;
        if (currentNewsFilters.sport && currentNewsFilters.sport !== 'all') url += `&sport=${encodeURIComponent(currentNewsFilters.sport)}`;
        if (currentNewsFilters.sort && currentNewsFilters.sort !== 'newest') url += `&sort=${encodeURIComponent(currentNewsFilters.sort)}`;
        if (currentNewsFilters.dateRange && currentNewsFilters.dateRange !== 'all') url += `&dateRange=${encodeURIComponent(currentNewsFilters.dateRange)}`;
        if (currentNewsFilters.q && currentNewsFilters.q.trim() !== '') url += `&q=${encodeURIComponent(currentNewsFilters.q.trim())}`;

        // Fetch news from WatchFooty API with pagination and filters
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch news');
        const newsData = await response.json();
        
        const articles = newsData.articles || [];

        if (articles.length === 0 && !loadMore) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; color: #aaa; text-align: center;">No news available at the moment.</div>';
            isFetchingNews = false;
            return;
        }

        let html = '';
        articles.forEach(article => {
            // Provide a fallback image just in case
            const image = article.imageUrl || 'https://via.placeholder.com/300x170/141414/ffffff?text=News';
            const title = article.headline || 'Breaking News';
            const description = article.description || 'Click to read more about this update.';
            const url = article.url ? article.url.replace('/api/v1/news', 'https://watchfooty.st/en/news') : '#';
            const dateStr = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '';

            // Build the sleek card HTML
            html += `
                <div onclick="openNewsArticle('${article.id}')" style="cursor: pointer; text-decoration: none; color: inherit; display: flex; flex-direction: column; background: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s, box-shadow 0.2s;"
                   onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 10px 20px rgba(0,0,0,0.5)'"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    
                    <div style="height: 170px; background: url('${image}') center/cover; position: relative;">
                        ${dateStr ? `<div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: #fff;">${dateStr}</div>` : ''}
                    </div>
                    
                    <div style="padding: 15px; flex-grow: 1; display: flex; flex-direction: column;">
                        <h3 style="margin: 0 0 10px 0; font-size: 1.1rem; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${title}</h3>
                        <p style="margin: 0; font-size: 0.85rem; color: #888; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${description}</p>
                        
                        <div style="margin-top: auto; padding-top: 15px; color: #e50914; font-size: 0.85rem; font-weight: bold; text-transform: uppercase;">
                            Read More &rarr;
                        </div>
                    </div>
                </div>
            `;
        });

        if (loadMore) {
            // Remove old load more button container before appending new content
            const oldBtnContainer = document.getElementById('news-pagination-container');
            if (oldBtnContainer) oldBtnContainer.remove();
            grid.insertAdjacentHTML('beforeend', html);
        } else {
            grid.innerHTML = html;
        }

        // Check if there are more articles based on pagination
        const pagination = newsData.pagination;
        if (pagination && pagination.nextOffset) {
            currentNewsOffset = pagination.nextOffset;
            
            const btnHtml = `
                <div id="news-pagination-container" style="grid-column: 1 / -1; text-align: center; margin-top: 30px;">
                    <button id="load-more-news-btn" onclick="fetchSportsNews(true)" style="background: rgba(229,9,20,0.2); border: 1px solid #e50914; color: #fff; padding: 12px 30px; font-size: 1rem; font-weight: bold; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#e50914'" onmouseout="this.style.background='rgba(229,9,20,0.2)'">
                        Load More News
                    </button>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', btnHtml);
        }

    } catch (e) {
        console.error(e);
        if (!loadMore) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; color: #e50914; text-align: center;">Unable to load news. Please try again later.</div>';
        } else {
            const loadMoreBtn = document.getElementById('load-more-news-btn');
            if (loadMoreBtn) loadMoreBtn.innerText = 'Error loading more. Try again.';
        }
    } finally {
        isFetchingNews = false;
    }
}

async function openNewsArticle(articleId) {
    const modal = document.getElementById('news-article-modal');
    const content = document.getElementById('news-article-content');
    if (!modal || !content) return;
    
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #e50914; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div><p style="color: #888;">Loading article...</p></div>';
    
    try {
        const response = await fetch(`https://api.watchfooty.st/api/v1/news/article/${articleId}`);
        if (!response.ok) throw new Error('Failed to fetch article');
        const article = await response.json();
        
        let bodyHtml = article.content || '';
        // Replace custom tags with HTML
        bodyHtml = bodyHtml.replace(/\[p\]/g, '<p style="margin-bottom: 15px; line-height: 1.6; color: #ccc;">');
        bodyHtml = bodyHtml.replace(/\[\/p\]/g, '</p>');
        bodyHtml = bodyHtml.replace(/\[b\]/g, '<strong style="color: #fff;">');
        bodyHtml = bodyHtml.replace(/\[\/b\]/g, '</strong>');
        bodyHtml = bodyHtml.replace(/\[i\]/g, '<em style="color: #bbb;">');
        bodyHtml = bodyHtml.replace(/\[\/i\]/g, '</em>');
        bodyHtml = bodyHtml.replace(/\[h2\]/g, '<h2 style="color: #fff; font-size: 1.5rem; margin: 25px 0 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">');
        bodyHtml = bodyHtml.replace(/\[\/h2\]/g, '</h2>');
        bodyHtml = bodyHtml.replace(/\[a href="([^"]+)"\]/g, '<a href="$1" target="_blank" style="color: #e50914; text-decoration: none;">');
        bodyHtml = bodyHtml.replace(/\[\/a\]/g, '</a>');
        // Parse image tags
        bodyHtml = bodyHtml.replace(/\[image([^\]]+)\/\]/g, (match, attributes) => {
            const idMatch = attributes.match(/id="([^"]+)"/);
            const altMatch = attributes.match(/alt="([^"]+)"/);
            const id = idMatch ? idMatch[1] : '';
            const alt = altMatch ? altMatch[1] : '';
            if (id) {
                return `<img src="https://livesport-ott-images.ssl.cdn.cra.cz/${id}" alt="${alt}" style="width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; margin: 20px 0; background: rgba(0,0,0,0.2);">`;
            }
            return match;
        });
        // Parse embeds into iframes or fallback links
        bodyHtml = bodyHtml.replace(/\[embed([^\]]+)\/\]/g, (match, attributes) => {
            const urlMatch = attributes.match(/url="([^"]+)"/);
            const typeMatch = attributes.match(/social-type="([^"]+)"/);
            const url = urlMatch ? urlMatch[1] : '#';
            let type = typeMatch ? typeMatch[1].toLowerCase() : 'social';
            
            let iframeUrl = '';
            let height = 400;
            
            if (type === 'twitter' || type === 'x') {
                const idMatch = url.match(/status\/(\d+)/);
                if (idMatch) {
                    iframeUrl = `https://platform.twitter.com/embed/Tweet.html?id=${idMatch[1]}`;
                    height = 500;
                }
            } else if (type === 'instagram') {
                const idMatch = url.match(/\/p\/([^\/?]+)/);
                if (idMatch) {
                    iframeUrl = `https://www.instagram.com/p/${idMatch[1]}/embed`;
                    height = 600;
                }
            } else if (type === 'youtube') {
                const idMatch = url.match(/v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
                if (idMatch) {
                    iframeUrl = `https://www.youtube.com/embed/${idMatch[1]}`;
                    height = 315;
                }
            } else if (type === 'tiktok') {
                const idMatch = url.match(/\/video\/(\d+)/);
                if (idMatch) {
                    iframeUrl = `https://www.tiktok.com/embed/v2/${idMatch[1]}`;
                    height = 600;
                }
            }
            
            if (iframeUrl) {
                return `<div style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #fff;">
                            <iframe src="${iframeUrl}" width="100%" height="${height}" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media"></iframe>
                        </div>`;
            }

            // Fallback button if we can't parse the exact ID
            let color = '#e50914';
            if (type === 'twitter' || type === 'x') color = '#1DA1F2';
            if (type === 'instagram') color = '#E1306C';
            if (type === 'youtube') color = '#FF0000';
            if (type === 'facebook') color = '#1877F2';
            
            const displayType = type.charAt(0).toUpperCase() + type.slice(1);

            return `<a href="${url}" target="_blank" style="display: block; padding: 15px; background: rgba(255,255,255,0.05); border-left: 4px solid ${color}; margin-bottom: 15px; font-size: 0.95rem; color: #fff; border-radius: 4px; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong style="color: ${color};">View Embedded ${displayType} Post &rarr;</strong>
                </div>
                <div style="color: #aaa; font-size: 0.85rem; margin-top: 5px; word-break: break-all;">${url}</div>
            </a>`;
        });
        // Fallbacks for infobox and video (silently remove to keep UI clean)
        bodyHtml = bodyHtml.replace(/\[infobox.*?\]/g, '');
        bodyHtml = bodyHtml.replace(/\[video.*?\]/g, '');
        
        // CATCH-ALL: Strip any remaining unparsed tags to ensure text is clean
        bodyHtml = bodyHtml.replace(/\[\/?[a-zA-Z0-9-]+[^\]]*\]/g, '');
        
        const dateStr = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '';
        
        content.innerHTML = `
            <img src="${article.imageUrl || 'https://via.placeholder.com/800x400/141414/ffffff?text=News'}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                ${article.sport ? `<span style="background: rgba(229,9,20,0.2); color: #e50914; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase;">${article.sport}</span>` : ''}
                ${dateStr ? `<span style="color: #888; font-size: 0.85rem;">${dateStr}</span>` : ''}
            </div>
            <h1 style="color: #fff; font-size: 2rem; margin: 0 0 15px 0; line-height: 1.2;">${article.headline || 'Breaking News'}</h1>
            ${article.author ? `<p style="color: #888; font-size: 0.9rem; margin-bottom: 25px;">By ${article.author}</p>` : ''}
            <div style="font-size: 1.05rem; color: #ddd;">
                ${bodyHtml}
            </div>
        `;
    } catch (e) {
        console.error(e);
        content.innerHTML = '<div style="text-align: center; color: #e50914; padding: 50px;">Failed to load article content. Please try again later.</div>';
    }
}
