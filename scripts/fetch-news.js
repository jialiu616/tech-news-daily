import RssParser from 'rss-parser';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const TECH_FIGURES = [
  'elon musk', 'sam altman', 'jensen huang', 'tim cook', 'satya nadella',
  'mark zuckerberg', 'sundar pichai', 'jeff bezos', 'bill gates',
  'linus torvalds', 'lisa su', 'andy jassy', 'dario amodei',
  'demis hassabis', 'ilya sutskever', 'yann lecun', 'fei-fei li',
  'marc andreessen', 'peter thiel', 'reid hoffman', 'jack dorsey',
  'brian chesky', 'daniel ek', 'patrick collison', 'tobi lutke',
  'arvind krishna', 'pat gelsinger', 'greg brockman', 'mira murati',
  'kevin scott', 'mustafa suleyman', 'eric schmidt',
  // Chinese tech figures (English + Chinese names)
  'jack ma', '马云', 'pony ma', '马化腾', 'robin li', '李彦宏',
  'lei jun', '雷军', 'ren zhengfei', '任正非', 'zhang yiming', '张一鸣',
  'wang xing', '王兴', 'huang zheng', '黄峥', 'richard liu', '刘强东',
  'eric yuan', '袁征', '周鸿祎', '丁磊', '张朝阳', '李开复',
  '王小川', '傅盛', '梁汝波', '陆奇'
];

const rssParser = new RssParser({
  timeout: 15000,
  headers: { 'User-Agent': 'TechNewsDaily/2.0 (News Aggregator)' }
});

// ─── Social Network Config ────────────────────────────────────

// RSSHub instance for X/Twitter and Facebook feeds
// Public instances: https://rsshub.app, https://rsshub.rssforever.com
// You can self-host: https://github.com/DIYgod/RSSHub
const RSSHUB_BASE = process.env.RSSHUB_BASE || 'https://rsshub.app';

// Curated X/Twitter tech influencer accounts
const X_TECH_ACCOUNTS = [
  'elonmusk', 'sama', 'sataborasu', 'timaborasu',
  'JensenHuang', 'sataborasu', 'sundaborasu',
  'ylecun', 'demaborasu', 'kaborasu',
  // Prominent tech voices
  'elonmusk', 'sama', 'satyanadella', 'timcook',
  'sundaborasu', 'JensenHuang', 'ylecun',
  'AndrewYNg', 'lexfridman', 'benedictevans',
  'jason', 'saborasu', 'paulg', 'naval',
  'aaborasu', 'caborasu', 'ID_AA_Carmack'
];

// Deduplicated clean list of X/Twitter handles to fetch
const X_HANDLES = [...new Set([
  'elonmusk', 'sama', 'satyanadella', 'timcook',
  'sundarpichai', 'JensenHuang', 'ylecun',
  'AndrewYNg', 'lexfridman', 'benedictevans',
  'jason', 'paulg', 'naval', 'ID_AA_Carmack',
  'kaborasu', 'raaborasu', 'amasad', 'svpino',
  'maborasu', 'emaborasu'
])];

// Mastodon tech accounts (instance@username format)
const MASTODON_ACCOUNTS = [
  { instance: 'mastodon.social', username: 'Gargron' },
  { instance: 'mastodon.social', username: 'mozilla' },
  { instance: 'fosstodon.org', username: 'nixCraft' },
  { instance: 'mastodon.social', username: 'eff' },
  { instance: 'hachyderm.io', username: 'pragdave' },
  { instance: 'mastodon.social', username: 'aral' },
];

// Bluesky tech accounts
const BLUESKY_HANDLES = [
  'jay.bsky.team', 'pfrazee.com', 'samuel.bsky.team',
  'dholms.xyz', 'ericflo.bsky.social', 'swyx.io',
];

// YouTube tech channels (channel IDs for RSS)
const YOUTUBE_CHANNELS = [
  { id: 'UCBJycsmduvYEL83R_U4JriQ', label: 'MKBHD' },
  { id: 'UCXuqSBlHAE6Xw-yeJA0Tunw', label: 'Linus Tech Tips' },
  { id: 'UC0vBXGSyV14uvJ4hECDOl0Q', label: 'Fireship' },
  { id: 'UCsBjURrPoezykLs9EqgamOA', label: 'Fireship' },
  { id: 'UCVHFbqXqoYvEWM1Ddxl0QDg', label: 'Android Authority' },
];

// ─── Source Fetchers ──────────────────────────────────────────

async function fetchHackerNews() {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await res.json();
    const top50 = ids.slice(0, 50);

    const items = await Promise.allSettled(
      top50.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      })
    );

    return items
      .filter(r => r.status === 'fulfilled' && r.value && r.value.type === 'story')
      .map(r => {
        const item = r.value;
        return {
          id: `hn-${item.id}`,
          title: item.title || '',
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          description: item.title || '',
          source: 'hackernews',
          sourceLabel: 'Hacker News',
          sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
          author: item.by || null,
          publishedAt: new Date((item.time || 0) * 1000).toISOString(),
          engagement: {
            upvotes: item.score || 0,
            comments: item.descendants || 0
          },
          image: null
        };
      });
  } catch (err) {
    console.warn('HN fetch failed:', err.message);
    return [];
  }
}

async function fetchReddit(subreddit, limit = 50) {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      { headers: { 'User-Agent': 'TechNewsDaily/2.0' } }
    );
    const data = await res.json();
    return (data?.data?.children || [])
      .filter(p => !p.data.stickied)
      .map(p => {
        const d = p.data;
        return {
          id: `reddit-${d.id}`,
          title: d.title || '',
          url: d.url_overridden_by_dest || `https://reddit.com${d.permalink}`,
          description: (d.selftext || d.title || '').substring(0, 300),
          source: 'reddit',
          sourceLabel: `r/${subreddit}`,
          sourceUrl: `https://reddit.com${d.permalink}`,
          author: d.author || null,
          publishedAt: new Date((d.created_utc || 0) * 1000).toISOString(),
          engagement: {
            upvotes: d.ups || 0,
            comments: d.num_comments || 0
          },
          image: d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : null
        };
      });
  } catch (err) {
    console.warn(`Reddit r/${subreddit} fetch failed:`, err.message);
    return [];
  }
}

async function fetchRSS(feedUrl, sourceName, sourceLabel) {
  try {
    const feed = await rssParser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 20).map((item, i) => {
      const desc = (item.contentSnippet || item.content || item.summary || '')
        .replace(/<[^>]*>/g, '')
        .substring(0, 300);

      let image = null;
      const content = item.content || item['content:encoded'] || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];
      if (!image && item.enclosure?.url) image = item.enclosure.url;

      return {
        id: `${sourceName}-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: sourceName,
        sourceLabel: sourceLabel,
        sourceUrl: item.link || '',
        author: item.creator || item.author || null,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image
      };
    });
  } catch (err) {
    console.warn(`RSS ${sourceLabel} fetch failed:`, err.message);
    return [];
  }
}

async function fetchDevTo() {
  try {
    const res = await fetch('https://dev.to/api/articles?top=1&per_page=30', {
      headers: { 'User-Agent': 'TechNewsDaily/2.0' }
    });
    const articles = await res.json();
    return (articles || []).map((a, i) => ({
      id: `devto-${a.id || i}`,
      title: a.title || '',
      url: a.url || '',
      description: (a.description || '').substring(0, 300),
      source: 'devto',
      sourceLabel: 'dev.to',
      sourceUrl: a.url || '',
      author: a.user?.name || a.user?.username || null,
      publishedAt: a.published_at || new Date().toISOString(),
      engagement: {
        upvotes: a.positive_reactions_count || 0,
        comments: a.comments_count || 0
      },
      image: a.cover_image || a.social_image || null
    }));
  } catch (err) {
    console.warn('dev.to fetch failed:', err.message);
    return [];
  }
}

// ─── Social Network Fetchers ──────────────────────────────────

// X/Twitter via RSSHub — fetches curated tech influencer feeds
async function fetchXTwitter() {
  const items = [];
  // Batch fetch from a few key accounts to stay within rate limits
  const handles = X_HANDLES.slice(0, 12);

  const results = await Promise.allSettled(
    handles.map(async (handle) => {
      try {
        const feed = await rssParser.parseURL(`${RSSHUB_BASE}/twitter/user/${handle}`);
        return (feed.items || []).slice(0, 5).map((item, i) => {
          const text = (item.contentSnippet || item.title || '')
            .replace(/<[^>]*>/g, '')
            .substring(0, 300);
          let image = null;
          const content = item.content || '';
          const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch) image = imgMatch[1];

          return {
            id: `x-${handle}-${i}-${Date.now()}`,
            title: text.substring(0, 120) || `@${handle}`,
            url: item.link || `https://x.com/${handle}`,
            description: text,
            source: 'x',
            sourceLabel: `X @${handle}`,
            sourceUrl: item.link || `https://x.com/${handle}`,
            author: `@${handle}`,
            publishedAt: item.isoDate || new Date().toISOString(),
            engagement: { upvotes: 0, comments: 0 },
            image
          };
        });
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// X/Twitter via official API (if bearer token is provided)
async function fetchXTwitterAPI() {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return [];

  try {
    // Fetch recent tweets from a curated list of tech accounts
    const usernames = X_HANDLES.slice(0, 10).join(',');
    const searchQuery = encodeURIComponent(
      `(from:${X_HANDLES.slice(0, 8).join(' OR from:')}) -is:retweet -is:reply`
    );

    const res = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${searchQuery}&max_results=30&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'TechNewsDaily/2.0'
        }
      }
    );

    if (!res.ok) {
      console.warn(`X API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const users = {};
    (data.includes?.users || []).forEach(u => { users[u.id] = u; });

    return (data.data || []).map((tweet, i) => {
      const user = users[tweet.author_id] || {};
      const metrics = tweet.public_metrics || {};
      return {
        id: `xapi-${tweet.id}`,
        title: tweet.text?.substring(0, 120) || '',
        url: `https://x.com/${user.username || 'i'}/status/${tweet.id}`,
        description: tweet.text?.substring(0, 300) || '',
        source: 'x',
        sourceLabel: `X @${user.username || 'unknown'}`,
        sourceUrl: `https://x.com/${user.username || 'i'}/status/${tweet.id}`,
        author: user.name || `@${user.username}` || null,
        publishedAt: tweet.created_at || new Date().toISOString(),
        engagement: {
          upvotes: (metrics.like_count || 0) + (metrics.retweet_count || 0),
          comments: metrics.reply_count || 0
        },
        image: null
      };
    });
  } catch (err) {
    console.warn('X API fetch failed:', err.message);
    return [];
  }
}

// Mastodon — open API, no auth required
async function fetchMastodon() {
  const items = [];

  const results = await Promise.allSettled(
    MASTODON_ACCOUNTS.map(async ({ instance, username }) => {
      try {
        // Look up user ID first
        const lookupRes = await fetch(
          `https://${instance}/api/v1/accounts/lookup?acct=${username}`,
          { headers: { 'User-Agent': 'TechNewsDaily/2.0' } }
        );
        if (!lookupRes.ok) return [];
        const account = await lookupRes.json();

        // Fetch their recent public statuses
        const statusRes = await fetch(
          `https://${instance}/api/v1/accounts/${account.id}/statuses?limit=5&exclude_replies=true&exclude_reblogs=true`,
          { headers: { 'User-Agent': 'TechNewsDaily/2.0' } }
        );
        if (!statusRes.ok) return [];
        const statuses = await statusRes.json();

        return statuses.map(status => {
          const text = (status.content || '')
            .replace(/<[^>]*>/g, '')
            .substring(0, 300);
          const image = status.media_attachments?.[0]?.preview_url || null;

          return {
            id: `mastodon-${status.id}`,
            title: text.substring(0, 120) || `@${username}@${instance}`,
            url: status.url || `https://${instance}/@${username}/${status.id}`,
            description: text,
            source: 'mastodon',
            sourceLabel: `Mastodon @${username}`,
            sourceUrl: status.url || `https://${instance}/@${username}/${status.id}`,
            author: account.display_name || `@${username}`,
            publishedAt: status.created_at || new Date().toISOString(),
            engagement: {
              upvotes: (status.favourites_count || 0) + (status.reblogs_count || 0),
              comments: status.replies_count || 0
            },
            image
          };
        });
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// Bluesky — open AT Protocol API, no auth required for public data
async function fetchBluesky() {
  const items = [];

  const results = await Promise.allSettled(
    BLUESKY_HANDLES.map(async (handle) => {
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=5&filter=posts_no_replies`,
          { headers: { 'User-Agent': 'TechNewsDaily/2.0' } }
        );
        if (!res.ok) return [];
        const data = await res.json();

        return (data.feed || []).map(entry => {
          const post = entry.post;
          const record = post.record || {};
          const text = (record.text || '').substring(0, 300);
          const image = post.embed?.images?.[0]?.thumb ||
                        post.embed?.external?.thumb || null;

          return {
            id: `bluesky-${post.uri?.split('/').pop() || Date.now()}`,
            title: text.substring(0, 120) || `@${handle}`,
            url: `https://bsky.app/profile/${handle}/post/${post.uri?.split('/').pop() || ''}`,
            description: text,
            source: 'bluesky',
            sourceLabel: `Bluesky @${handle.split('.')[0]}`,
            sourceUrl: `https://bsky.app/profile/${handle}`,
            author: post.author?.displayName || `@${handle}`,
            publishedAt: record.createdAt || post.indexedAt || new Date().toISOString(),
            engagement: {
              upvotes: (post.likeCount || 0) + (post.repostCount || 0),
              comments: post.replyCount || 0
            },
            image
          };
        });
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// YouTube tech channels via RSS (no API key needed)
async function fetchYouTube() {
  const items = [];

  const results = await Promise.allSettled(
    YOUTUBE_CHANNELS.map(async ({ id, label }) => {
      try {
        const feed = await rssParser.parseURL(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`
        );
        return (feed.items || []).slice(0, 3).map((item, i) => ({
          id: `youtube-${id}-${i}`,
          title: item.title || '',
          url: item.link || '',
          description: (item.contentSnippet || item.title || '').substring(0, 300),
          source: 'youtube',
          sourceLabel: `YouTube ${label}`,
          sourceUrl: item.link || '',
          author: feed.title || label,
          publishedAt: item.isoDate || new Date().toISOString(),
          engagement: { upvotes: 0, comments: 0 },
          image: item.link ? `https://i.ytimg.com/vi/${item.id?.split(':').pop()}/hqdefault.jpg` : null
        }));
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// Facebook pages via RSSHub (since Graph API requires app review)
async function fetchFacebook() {
  const FB_PAGES = [
    'TechCrunch', 'WIRED', 'TheVerge', 'engadget',
    'NVIDIA', 'Meta', 'Google', 'Microsoft'
  ];

  const items = [];
  const results = await Promise.allSettled(
    FB_PAGES.map(async (page) => {
      try {
        const feed = await rssParser.parseURL(`${RSSHUB_BASE}/facebook/page/${page}`);
        return (feed.items || []).slice(0, 3).map((item, i) => {
          const text = (item.contentSnippet || item.title || '')
            .replace(/<[^>]*>/g, '')
            .substring(0, 300);
          let image = null;
          const content = item.content || '';
          const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch) image = imgMatch[1];

          return {
            id: `facebook-${page}-${i}-${Date.now()}`,
            title: text.substring(0, 120) || `FB: ${page}`,
            url: item.link || `https://facebook.com/${page}`,
            description: text,
            source: 'facebook',
            sourceLabel: `Facebook ${page}`,
            sourceUrl: item.link || `https://facebook.com/${page}`,
            author: page,
            publishedAt: item.isoDate || new Date().toISOString(),
            engagement: { upvotes: 0, comments: 0 },
            image
          };
        });
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// ─── Chinese Web Source Fetchers ──────────────────────────────

// V2EX — Chinese developer forum, open API, no auth
async function fetchV2EX() {
  try {
    const res = await fetch('https://www.v2ex.com/api/topics/hot.json', {
      headers: { 'User-Agent': 'TechNewsDaily/2.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const topics = await res.json();

    return (topics || []).slice(0, 30).map(t => ({
      id: `v2ex-${t.id}`,
      title: t.title || '',
      url: t.url || `https://www.v2ex.com/t/${t.id}`,
      description: (t.content || t.content_rendered || t.title || '')
        .replace(/<[^>]*>/g, '').substring(0, 300),
      source: 'v2ex',
      sourceLabel: 'V2EX',
      sourceUrl: `https://www.v2ex.com/t/${t.id}`,
      author: t.member?.username || null,
      publishedAt: new Date((t.created || 0) * 1000).toISOString(),
      engagement: {
        upvotes: 0,
        comments: t.replies || 0
      },
      image: t.member?.avatar_large || null
    }));
  } catch (err) {
    console.warn('V2EX fetch failed:', err.message);
    return [];
  }
}

// 36Kr (36氪) — Major Chinese tech news, direct RSS
async function fetch36Kr() {
  try {
    const feed = await rssParser.parseURL('https://36kr.com/feed');
    return (feed.items || []).slice(0, 20).map((item, i) => {
      const desc = (item.contentSnippet || item.content || item.summary || '')
        .replace(/<[^>]*>/g, '').substring(0, 300);
      let image = null;
      const content = item.content || item['content:encoded'] || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];

      return {
        id: `36kr-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: '36kr',
        sourceLabel: '36Kr 36氪',
        sourceUrl: item.link || '',
        author: item.creator || item.author || null,
        publishedAt: item.isoDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image
      };
    });
  } catch (err) {
    console.warn('36Kr fetch failed:', err.message);
    return [];
  }
}

// Zhihu (知乎) Hot Topics — via RSSHub, with fallback to alternative feed
async function fetchZhihu() {
  // Try multiple RSSHub routes
  const routes = [
    `${RSSHUB_BASE}/zhihu/hot`,
    `${RSSHUB_BASE}/zhihu/daily`
  ];

  for (const url of routes) {
    try {
      const feed = await rssParser.parseURL(url);
      const items = (feed.items || []).slice(0, 20).map((item, i) => {
        const desc = (item.contentSnippet || item.content || '')
          .replace(/<[^>]*>/g, '').substring(0, 300);
        let image = null;
        const content = item.content || '';
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) image = imgMatch[1];

        return {
          id: `zhihu-${i}-${Date.now()}`,
          title: item.title || '',
          url: item.link || '',
          description: desc,
          source: 'zhihu',
          sourceLabel: 'Zhihu 知乎',
          sourceUrl: item.link || '',
          author: item.creator || null,
          publishedAt: item.isoDate || new Date().toISOString(),
          engagement: { upvotes: 0, comments: 0 },
          image
        };
      });
      if (items.length > 0) return items;
    } catch (err) {
      // Try next route
    }
  }

  console.warn('Zhihu fetch failed: all routes exhausted');
  return [];
}

// Weibo (微博) Tech Hot Topics — via RSSHub
async function fetchWeibo() {
  try {
    // RSSHub: /weibo/search/hot for trending, or /weibo/keyword/科技 for tech keyword
    const feed = await rssParser.parseURL(`${RSSHUB_BASE}/weibo/search/hot`);
    // Filter for tech-related items
    const techKeywords = [
      '科技', '技术', 'AI', '人工智能', '手机', '芯片', '互联网',
      '数码', '电脑', '软件', '算法', '大模型', '自动驾驶', '机器人',
      '量子', '5G', '6G', '半导体', 'GPU', 'CPU', '华为', '小米',
      '苹果', '谷歌', '微软', '特斯拉', 'OpenAI', 'ChatGPT',
      '马斯克', '雷军', '马云', '任正非'
    ];

    return (feed.items || []).slice(0, 30)
      .filter(item => {
        const text = ((item.title || '') + (item.contentSnippet || '')).toLowerCase();
        // Accept all items — Weibo hot already skews toward tech, or filter if needed
        return true;
      })
      .slice(0, 15)
      .map((item, i) => {
        const desc = (item.contentSnippet || item.content || '')
          .replace(/<[^>]*>/g, '').substring(0, 300);
        return {
          id: `weibo-${i}-${Date.now()}`,
          title: item.title || '',
          url: item.link || '',
          description: desc,
          source: 'weibo',
          sourceLabel: 'Weibo 微博',
          sourceUrl: item.link || '',
          author: item.creator || null,
          publishedAt: item.isoDate || new Date().toISOString(),
          engagement: { upvotes: 0, comments: 0 },
          image: null
        };
      });
  } catch (err) {
    console.warn('Weibo fetch failed:', err.message);
    return [];
  }
}

// Huxiu (虎嗅) — Chinese tech media via RSSHub
async function fetchHuxiu() {
  try {
    const feed = await rssParser.parseURL(`${RSSHUB_BASE}/huxiu/article`);
    return (feed.items || []).slice(0, 15).map((item, i) => {
      const desc = (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>/g, '').substring(0, 300);
      let image = null;
      const content = item.content || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];

      return {
        id: `huxiu-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: 'huxiu',
        sourceLabel: 'Huxiu 虎嗅',
        sourceUrl: item.link || '',
        author: item.creator || null,
        publishedAt: item.isoDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image
      };
    });
  } catch (err) {
    console.warn('Huxiu fetch failed:', err.message);
    return [];
  }
}

// Juejin (掘金) — Chinese developer community via RSSHub
async function fetchJuejin() {
  try {
    const feed = await rssParser.parseURL(`${RSSHUB_BASE}/juejin/trending/all/1`);
    return (feed.items || []).slice(0, 20).map((item, i) => {
      const desc = (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>/g, '').substring(0, 300);

      return {
        id: `juejin-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: 'juejin',
        sourceLabel: 'Juejin 掘金',
        sourceUrl: item.link || '',
        author: item.creator || null,
        publishedAt: item.isoDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image: null
      };
    });
  } catch (err) {
    console.warn('Juejin fetch failed:', err.message);
    return [];
  }
}

// Bilibili (哔哩哔哩) — Chinese video platform, tech ranking via RSSHub
async function fetchBilibili() {
  try {
    // Technology partition ranking
    const feed = await rssParser.parseURL(`${RSSHUB_BASE}/bilibili/ranking/0/3/1`);
    return (feed.items || []).slice(0, 15).map((item, i) => {
      const desc = (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>/g, '').substring(0, 300);
      let image = null;
      const content = item.content || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];

      return {
        id: `bilibili-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: 'bilibili',
        sourceLabel: 'Bilibili 哔哩哔哩',
        sourceUrl: item.link || '',
        author: item.creator || null,
        publishedAt: item.isoDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image
      };
    });
  } catch (err) {
    console.warn('Bilibili fetch failed:', err.message);
    return [];
  }
}

// IT Home (IT之家) — Popular Chinese tech news, direct RSS
async function fetchITHome() {
  try {
    const feed = await rssParser.parseURL('https://www.ithome.com/rss/');
    return (feed.items || []).slice(0, 20).map((item, i) => {
      const desc = (item.contentSnippet || item.content || '')
        .replace(/<[^>]*>/g, '').substring(0, 300);
      let image = null;
      const content = item.content || item['content:encoded'] || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];

      return {
        id: `ithome-${i}-${Date.now()}`,
        title: item.title || '',
        url: item.link || '',
        description: desc,
        source: 'ithome',
        sourceLabel: 'IT Home IT之家',
        sourceUrl: item.link || '',
        author: item.creator || null,
        publishedAt: item.isoDate || new Date().toISOString(),
        engagement: { upvotes: 0, comments: 0 },
        image
      };
    });
  } catch (err) {
    console.warn('IT Home fetch failed:', err.message);
    return [];
  }
}

// ─── Scoring ──────────────────────────────────────────────────

function normalizeEngagement(items) {
  if (items.length === 0) return items;

  const maxUp = Math.max(...items.map(i => i.engagement.upvotes), 1);
  const maxComm = Math.max(...items.map(i => i.engagement.comments), 1);

  return items.map(item => ({
    ...item,
    _engagementScore: (
      (item.engagement.upvotes / maxUp) * 60 +
      (item.engagement.comments / maxComm) * 40
    )
  }));
}

function computeScores(allItems) {
  const now = Date.now();

  // Group by source and normalize engagement within each source
  const bySource = {};
  for (const item of allItems) {
    if (!bySource[item.source]) bySource[item.source] = [];
    bySource[item.source].push(item);
  }

  let scored = [];
  for (const [source, items] of Object.entries(bySource)) {
    scored.push(...normalizeEngagement(items));
  }

  // Source weights
  const sourceWeights = {
    hackernews: 1.0,
    reddit: 1.0,
    techcrunch: 1.1,
    theverge: 1.05,
    arstechnica: 1.0,
    devto: 0.9,
    producthunt: 0.9,
    x: 1.15,
    mastodon: 0.95,
    bluesky: 0.95,
    youtube: 1.0,
    facebook: 0.95,
    v2ex: 1.0,
    '36kr': 1.1,
    zhihu: 1.05,
    weibo: 1.1,
    huxiu: 1.0,
    juejin: 0.9,
    bilibili: 0.95,
    ithome: 1.0
  };

  return scored.map(item => {
    // Recency bonus
    const ageHours = (now - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
    let recencyBonus = 0;
    if (ageHours <= 6) recencyBonus = 20;
    else if (ageHours <= 12) recencyBonus = 10;
    else if (ageHours <= 24) recencyBonus = 5;

    // Tech figure bonus
    const titleLower = (item.title || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const combined = titleLower + ' ' + descLower;
    const mentionedFigures = TECH_FIGURES.filter(name => combined.includes(name));
    const techFigureBonus = mentionedFigures.length > 0 ? 15 : 0;

    // Source weight
    const weight = sourceWeights[item.source] || 1.0;

    const engScore = item._engagementScore || 40; // RSS items without engagement get baseline
    const finalScore = (engScore + recencyBonus + techFigureBonus) * weight;

    return {
      ...item,
      score: Math.round(finalScore * 10) / 10,
      mentionedFigures: mentionedFigures.map(n =>
        n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      ),
      _engagementScore: undefined
    };
  });
}

function selectTopItems(scoredItems, count = 100) {
  // Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score);

  const selected = [];
  const sourceCounts = {};
  const MAX_PER_SOURCE = Math.ceil(count / 5); // ~20 max per source for 100 items

  for (const item of scoredItems) {
    if (selected.length >= count) break;
    const cnt = sourceCounts[item.source] || 0;
    if (cnt >= MAX_PER_SOURCE) continue;
    sourceCounts[item.source] = cnt + 1;
    selected.push(item);
  }

  // Assign ranks and clean internal fields
  return selected.map((item, i) => {
    const clean = { ...item };
    delete clean._engagementScore;
    clean.rank = i + 1;
    return clean;
  });
}

// ─── Deduplication ────────────────────────────────────────────

function deduplicateItems(items) {
  const seen = new Map();
  return items.filter(item => {
    // Normalize URL for dedup
    const urlKey = (item.url || '').replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
    // Also check title similarity
    const titleKey = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);

    if (seen.has(urlKey) || (titleKey.length > 10 && seen.has(titleKey))) {
      return false;
    }
    if (urlKey) seen.set(urlKey, true);
    if (titleKey.length > 10) seen.set(titleKey, true);
    return true;
  });
}

// ─── Summary Generation ───────────────────────────────────────

function generateDailySummary(items, tagKeywords) {
  // Count tag frequencies
  const tagCounts = {};
  const tagLabels = {
    ai: 'AI & Machine Learning',
    crypto: 'Crypto & Blockchain',
    apple: 'Apple',
    google: 'Google',
    microsoft: 'Microsoft',
    startup: 'Startups & Funding',
    security: 'Security',
    space: 'Space Tech',
    programming: 'Programming',
    ev: 'EV & Autonomous'
  };

  for (const item of items) {
    for (const tag of item.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Get top topics sorted by frequency
  const topTopics = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({
      tag,
      label: tagLabels[tag] || tag,
      count
    }));

  // Get source distribution
  const sourceCounts = {};
  for (const item of items) {
    sourceCounts[item.sourceLabel || item.source] = (sourceCounts[item.sourceLabel || item.source] || 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));

  // Get mentioned tech figures
  const figures = [];
  for (const item of items) {
    if (item.mentionedFigures && item.mentionedFigures.length > 0) {
      figures.push(...item.mentionedFigures);
    }
  }
  const figureCounts = {};
  for (const f of figures) {
    figureCounts[f] = (figureCounts[f] || 0) + 1;
  }
  const topFigures = Object.entries(figureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Get top 5 headlines (highest scoring items)
  const headlines = items.slice(0, 5).map(item => ({
    title: item.title,
    source: item.sourceLabel || item.source,
    url: item.url
  }));

  // Generate text summary
  let textSummary = '';
  
  if (topTopics.length > 0) {
    const topicNames = topTopics.slice(0, 3).map(t => t.label).join(', ');
    textSummary += `Today's tech news is dominated by ${topicNames}. `;
  }

  if (topFigures.length > 0) {
    const figureNames = topFigures.slice(0, 3).map(f => f.name).join(', ');
    textSummary += `Key figures in the news include ${figureNames}. `;
  }

  if (headlines.length > 0) {
    textSummary += `Top story: "${headlines[0].title}" from ${headlines[0].source}.`;
  }

  return {
    text: textSummary,
    topTopics,
    topSources,
    topFigures,
    headlines
  };
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const today = format(new Date(), 'yyyy-MM-dd');
  console.log(`[TechNewsDaily] Fetching news for ${today}...`);

  // Fetch all sources in parallel
  const results = await Promise.allSettled([
    // --- News sites & forums ---
    fetchHackerNews(),
    fetchReddit('technology', 50),
    fetchReddit('programming', 30),
    fetchRSS('https://techcrunch.com/feed/', 'techcrunch', 'TechCrunch'),
    fetchRSS('https://www.theverge.com/rss/index.xml', 'theverge', 'The Verge'),
    fetchRSS('https://feeds.arstechnica.com/arstechnica/index', 'arstechnica', 'Ars Technica'),
    fetchDevTo(),
    fetchRSS('https://www.producthunt.com/feed', 'producthunt', 'Product Hunt'),
    // --- Social networks ---
    process.env.TWITTER_BEARER_TOKEN ? fetchXTwitterAPI() : fetchXTwitter(),
    fetchMastodon(),
    fetchBluesky(),
    fetchYouTube(),
    fetchFacebook(),
    // --- Chinese web sources ---
    fetchV2EX(),
    fetch36Kr(),
    fetchZhihu(),
    fetchWeibo(),
    fetchHuxiu(),
    fetchJuejin(),
    fetchBilibili(),
    fetchITHome()
  ]);

  let allItems = [];
  const sourceNames = [
    'Hacker News', 'r/technology', 'r/programming',
    'TechCrunch', 'The Verge', 'Ars Technica', 'dev.to', 'Product Hunt',
    process.env.TWITTER_BEARER_TOKEN ? 'X/Twitter (API)' : 'X/Twitter (RSS)',
    'Mastodon', 'Bluesky', 'YouTube', 'Facebook',
    'V2EX', '36Kr', 'Zhihu', 'Weibo', 'Huxiu', 'Juejin', 'Bilibili', 'IT Home'
  ];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      console.log(`  [OK] ${sourceNames[i]}: ${result.value.length} items`);
      allItems.push(...result.value);
    } else {
      const reason = result.status === 'rejected' ? result.reason?.message : 'empty';
      console.warn(`  [FAIL] ${sourceNames[i]}: ${reason}`);
    }
  });

  if (allItems.length === 0) {
    console.error('[TechNewsDaily] All sources failed. No data to write.');
    process.exit(1);
  }

  console.log(`  Total candidates: ${allItems.length}`);

  // Deduplicate
  allItems = deduplicateItems(allItems);
  console.log(`  After dedup: ${allItems.length}`);

  // Score and select top 100
  const scored = computeScores(allItems);
  const top100 = selectTopItems(scored, 100);

  console.log(`  Selected: ${top100.length} items`);

  // Add tags based on keywords
  const tagKeywords = {
    ai: ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm', 'neural', 'deep learning', 'openai', 'chatgpt', 'gemini', 'claude', '人工智能', '大模型', '机器学习'],
    crypto: ['bitcoin', 'crypto', 'blockchain', 'ethereum', 'web3', '比特币', '区块链', '加密货币'],
    apple: ['apple', 'iphone', 'ipad', 'macos', 'wwdc', '苹果'],
    google: ['google', 'android', 'chrome', 'pixel', 'alphabet', '谷歌', '安卓'],
    microsoft: ['microsoft', 'windows', 'azure', 'copilot', '微软'],
    startup: ['startup', 'funding', 'series a', 'series b', 'vc', 'venture', '融资', '创业', '投资'],
    security: ['security', 'hack', 'breach', 'vulnerability', 'cyber', 'malware', '安全', '漏洞', '黑客'],
    space: ['space', 'nasa', 'spacex', 'rocket', 'satellite', 'mars', '航天', '火箭', '卫星'],
    programming: ['programming', 'developer', 'open source', 'github', 'rust', 'python', 'javascript', '开源', '开发者', '编程'],
    ev: ['tesla', 'ev', 'electric vehicle', 'autonomous', 'self-driving', '电动车', '自动驾驶', '新能源', '特斯拉']
  };

  for (const item of top100) {
    const combined = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
    item.tags = [];
    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(kw => combined.includes(kw))) {
        item.tags.push(tag);
      }
    }
  }

  // Generate daily summary
  const summary = generateDailySummary(top100, tagKeywords);

  // Write output
  const output = {
    date: today,
    generatedAt: new Date().toISOString(),
    itemCount: top100.length,
    summary,
    items: top100
  };

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const outFile = path.join(DATA_DIR, `${today}.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[TechNewsDaily] Written to ${outFile}`);
}

main().catch(err => {
  console.error('[TechNewsDaily] Fatal error:', err);
  process.exit(1);
});
