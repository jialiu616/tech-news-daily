// news-renderer.js — Renders news cards into the grid
import { t } from './i18n.js';

const grid = document.getElementById('newsGrid');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return t('justNow');

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return t('weekAgo').replace('{n}', weeks);
  if (days > 0) return t('dayAgo').replace('{n}', days);
  if (hours > 0) return t('hourAgo').replace('{n}', hours);
  if (minutes > 0) return t('minuteAgo').replace('{n}', minutes);
  return t('justNow');
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function renderCard(item) {
  const figures = (item.mentionedFigures || [])
    .map(f => `<span class="figure-tag">${escapeHtml(f)}</span>`)
    .join('');

  const tags = (item.tags || [])
    .map(tag => `<span class="article-tag">${escapeHtml(tag)}</span>`)
    .join('');

  const imageHtml = item.image
    ? `<img class="card-image" src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';

  const upvotes = item.engagement?.upvotes || 0;
  const comments = item.engagement?.comments || 0;

  return `
    <article class="news-card" data-source="${escapeHtml(item.source)}">
      ${imageHtml}
      <div class="card-body">
        <div class="card-source-row">
          <span class="source-badge" data-source="${escapeHtml(item.source)}">${escapeHtml(item.sourceLabel)}</span>
          <span class="card-rank">#${item.rank}</span>
        </div>
        <h2 class="card-title">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
        </h2>
        ${figures ? `<div class="card-figures">${figures}</div>` : ''}
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        <p class="card-description">${escapeHtml(item.description)}</p>
        <div class="card-footer">
          <div class="card-engagement">
            ${upvotes > 0 ? `<span class="engagement-item">&uarr; ${formatNumber(upvotes)}</span>` : ''}
            ${comments > 0 ? `<span class="engagement-item">&#x1F4AC; ${formatNumber(comments)}</span>` : ''}
          </div>
          <span class="card-time">${formatRelativeTime(item.publishedAt)}</span>
        </div>
      </div>
    </article>
  `;
}

export function renderNews(items) {
  if (!items || items.length === 0) {
    grid.innerHTML = `
      <div class="state-container">
        <div class="state-icon">&#x1F4ED;</div>
        <div class="state-title">${t('noData')}</div>
        <div class="state-message">${t('noDataHint')}</div>
      </div>
    `;
    return;
  }
  grid.innerHTML = items.map(renderCard).join('');
}

export function renderLoading() {
  const skeleton = `
    <div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `;
  grid.innerHTML = skeleton.repeat(6);
}

export function renderError(message) {
  grid.innerHTML = `
    <div class="state-container">
      <div class="state-icon">&#x26A0;</div>
      <div class="state-title">${t('errorTitle')}</div>
      <div class="state-message">${message || t('errorMessage')}</div>
    </div>
  `;
}

export function filterBySearch(query) {
  const cards = grid.querySelectorAll('.news-card');
  const q = (query || '').toLowerCase().trim();

  cards.forEach(card => {
    if (!q) {
      card.classList.remove('hidden');
      return;
    }
    const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
    const desc = card.querySelector('.card-description')?.textContent?.toLowerCase() || '';
    const source = card.querySelector('.source-badge')?.textContent?.toLowerCase() || '';
    const match = title.includes(q) || desc.includes(q) || source.includes(q);
    card.classList.toggle('hidden', !match);
  });
}
