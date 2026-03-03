// Tech News Fetcher
class TechNewsFetcher {
    constructor() {
        this.newsContainer = document.getElementById('newsContainer');
        this.lastUpdatedElement = document.getElementById('lastUpdated');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.newsData = [];
        this.init();
    }

    init() {
        this.loadCachedNews();
        this.fetchNews();
        this.setupEventListeners();
        this.updateLastUpdatedTime();
    }

    setupEventListeners() {
        this.refreshBtn.addEventListener('click', () => {
            this.fetchNews(true);
        });

        // Auto-refresh every hour
        setInterval(() => {
            this.fetchNews();
        }, 60 * 60 * 1000); // 1 hour
    }

    async fetchNews(forceRefresh = false) {
        if (!forceRefresh && this.newsData.length > 0) {
            const lastFetch = localStorage.getItem('lastNewsFetch');
            if (lastFetch) {
                const hoursSinceLastFetch = (Date.now() - parseInt(lastFetch)) / (1000 * 60 * 60);
                if (hoursSinceLastFetch < 1) {
                    this.displayNews(this.newsData);
                    return;
                }
            }
        }

        this.showLoading();
        
        try {
            // Fetch from multiple sources to get diverse tech news
            const sources = [
                this.fetchFromHackerNews(),
                this.fetchFromTechCrunch(),
                this.fetchFromRedditTech(),
                this.fetchFromArsTechnica()
            ];

            const results = await Promise.allSettled(sources);
            const allNews = [];

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    allNews.push(...result.value);
                }
            });

            // Sort by date and take top 30
            this.newsData = allNews
                .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
                .slice(0, 30);

            this.cacheNews();
            this.displayNews(this.newsData);
            this.updateLastUpdatedTime();

        } catch (error) {
            console.error('Error fetching news:', error);
            this.showError('Failed to load news. Please try again later.');
        }
    }

    async fetchFromHackerNews() {
        try {
            const response = await fetch('https://api.hnpwa.com/v0/news/1.json');
            const data = await response.json();
            return data.map(item => ({
                title: item.title,
                url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
                description: item.title,
                source: 'Hacker News',
                publishedAt: new Date(item.time * 1000).toISOString(),
                image: null
            }));
        } catch (error) {
            console.warn('Hacker News fetch failed:', error);
            return [];
        }
    }

    async fetchFromTechCrunch() {
        try {
            // Using a CORS proxy for demonstration
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const url = encodeURIComponent('https://techcrunch.com/feed/');
            const response = await fetch(proxyUrl + url);
            const xmlText = await response.text();
            
            // Simple XML parsing
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            const items = xmlDoc.querySelectorAll('item');
            
            return Array.from(items).slice(0, 10).map(item => {
                const description = item.querySelector('description')?.textContent || '';
                // Extract first image from description
                const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
                
                return {
                    title: item.querySelector('title')?.textContent || '',
                    url: item.querySelector('link')?.textContent || '',
                    description: description.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                    source: 'TechCrunch',
                    publishedAt: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
                    image: imgMatch ? imgMatch[1] : null
                };
            });
        } catch (error) {
            console.warn('TechCrunch fetch failed:', error);
            return [];
        }
    }

    async fetchFromRedditTech() {
        try {
            const response = await fetch('https://www.reddit.com/r/technology/hot.json?limit=10');
            const data = await response.json();
            return data.data.children.map(post => ({
                title: post.data.title,
                url: `https://reddit.com${post.data.permalink}`,
                description: post.data.selftext.substring(0, 200) + '...',
                source: 'r/technology',
                publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
                image: post.data.thumbnail && post.data.thumbnail.startsWith('http') ? post.data.thumbnail : null
            }));
        } catch (error) {
            console.warn('Reddit fetch failed:', error);
            return [];
        }
    }

    async fetchFromArsTechnica() {
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const url = encodeURIComponent('https://feeds.arstechnica.com/arstechnica/index');
            const response = await fetch(proxyUrl + url);
            const xmlText = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            const items = xmlDoc.querySelectorAll('item');
            
            return Array.from(items).slice(0, 8).map(item => {
                const description = item.querySelector('description')?.textContent || '';
                const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
                
                return {
                    title: item.querySelector('title')?.textContent || '',
                    url: item.querySelector('link')?.textContent || '',
                    description: description.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                    source: 'Ars Technica',
                    publishedAt: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
                    image: imgMatch ? imgMatch[1] : null
                };
            });
        } catch (error) {
            console.warn('Ars Technica fetch failed:', error);
            return [];
        }
    }

    displayNews(news) {
        if (news.length === 0) {
            this.showError('No news articles found.');
            return;
        }

        this.newsContainer.innerHTML = news.map(article => `
            <article class="news-card">
                ${article.image ? `<img src="${article.image}" alt="${article.title}" class="news-image" onerror="this.style.display='none'">` : ''}
                <div class="news-content">
                    <h2 class="news-title">
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                    </h2>
                    <p class="news-description">${article.description}</p>
                    <div class="news-meta">
                        <span class="news-source">${article.source}</span>
                        <span class="news-date">${this.formatDate(article.publishedAt)}</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    showLoading() {
        this.newsContainer.innerHTML = '<div class="loading">Fetching latest tech news...</div>';
    }

    showError(message) {
        this.newsContainer.innerHTML = `<div class="error">${message}</div>`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    updateLastUpdatedTime() {
        const now = new Date();
        this.lastUpdatedElement.textContent = now.toLocaleString();
        localStorage.setItem('lastNewsUpdate', now.toISOString());
    }

    cacheNews() {
        localStorage.setItem('techNews', JSON.stringify(this.newsData));
        localStorage.setItem('lastNewsFetch', Date.now().toString());
    }

    loadCachedNews() {
        const cached = localStorage.getItem('techNews');
        if (cached) {
            try {
                this.newsData = JSON.parse(cached);
                this.displayNews(this.newsData);
            } catch (error) {
                console.error('Failed to load cached news:', error);
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TechNewsFetcher();
});

// Service Worker for offline support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}