// source-filter.js — Source pill-button filtering
import { t } from './i18n.js';

const filtersContainer = document.getElementById('sourceFilters');
const grid = document.getElementById('newsGrid');
let activeSources = new Set(); // empty = all active

export function initSourceFilters(items) {
  // Gather unique sources
  const sourceMap = new Map();
  for (const item of items) {
    if (!sourceMap.has(item.source)) {
      sourceMap.set(item.source, item.sourceLabel);
    }
  }

  activeSources.clear();
  filtersContainer.innerHTML = '';

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'filter-pill active';
  allPill.textContent = t('allSources');
  allPill.addEventListener('click', () => {
    activeSources.clear();
    updatePills();
    applyFilter();
  });
  filtersContainer.appendChild(allPill);

  // Per-source pills
  for (const [source, label] of sourceMap) {
    const pill = document.createElement('button');
    pill.className = 'filter-pill';
    pill.dataset.source = source;
    pill.textContent = label;
    pill.addEventListener('click', () => {
      if (activeSources.has(source)) {
        activeSources.delete(source);
      } else {
        activeSources.add(source);
      }
      updatePills();
      applyFilter();
    });
    filtersContainer.appendChild(pill);
  }
}

function updatePills() {
  const pills = filtersContainer.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    const src = pill.dataset.source;
    if (!src) {
      // "All" pill
      pill.classList.toggle('active', activeSources.size === 0);
    } else {
      pill.classList.toggle('active', activeSources.has(src));
    }
  });
}

function applyFilter() {
  const cards = grid.querySelectorAll('.news-card');
  cards.forEach(card => {
    const src = card.dataset.source;
    if (activeSources.size === 0) {
      card.classList.remove('hidden');
    } else {
      card.classList.toggle('hidden', !activeSources.has(src));
    }
  });
}

export function resetFilters() {
  activeSources.clear();
  updatePills();
  applyFilter();
}
