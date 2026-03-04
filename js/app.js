// app.js — Main entry point
import { initI18n, setLocale } from './i18n.js';
import { renderNews, renderLoading, renderError, filterBySearch } from './news-renderer.js';
import { initDateNavigator, getCurrentDate } from './date-navigator.js';
import { initSourceFilters, resetFilters } from './source-filter.js';

let currentItems = [];

async function loadDateData(date) {
  renderLoading();
  resetFilters();

  try {
    const res = await fetch(`data/${date}.json`);
    if (!res.ok) throw new Error(`No data for ${date}`);
    const data = await res.json();
    currentItems = data.items || [];

    renderNews(currentItems);
    initSourceFilters(currentItems);
    updateStats(data);

    // Update last-updated display
    const lastEl = document.getElementById('lastUpdated');
    if (lastEl && data.generatedAt) {
      const d = new Date(data.generatedAt);
      lastEl.textContent = d.toLocaleString();
    }
  } catch (err) {
    console.error('loadDateData error:', err);
    currentItems = [];
    renderError();
    updateStats(null);
  }
}

function updateStats(data) {
  const countEl = document.getElementById('statCount');
  const sourcesEl = document.getElementById('statSources');
  const dateEl = document.getElementById('statDate');

  if (data && data.items) {
    const sources = new Set(data.items.map(i => i.source));
    countEl.textContent = data.itemCount || data.items.length;
    sourcesEl.textContent = sources.size;
    dateEl.textContent = data.date;
  } else {
    countEl.textContent = '--';
    sourcesEl.textContent = '--';
    dateEl.textContent = getCurrentDate() || '--';
  }
}

async function init() {
  // i18n
  const langSelector = document.getElementById('langSelector');
  const storedLocale = localStorage.getItem('tn-locale');
  if (storedLocale) langSelector.value = storedLocale;

  await initI18n(langSelector.value);

  // Language switch
  langSelector.addEventListener('change', async () => {
    await setLocale(langSelector.value);
    // Re-render current data with new locale strings
    if (currentItems.length > 0) {
      renderNews(currentItems);
      initSourceFilters(currentItems);
    }
  });

  // Date navigator — calls loadDateData on date change
  const initialDate = await initDateNavigator(loadDateData);

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterBySearch(searchInput.value);
    }, 200);
  });

  // Load initial data
  await loadDateData(initialDate);
}

init().catch(err => {
  console.error('App init error:', err);
  renderError();
});
