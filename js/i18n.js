// i18n — Locale detection and translation
let strings = {};
let currentLocale = 'en';

const SUPPORTED_LOCALES = ['en', 'zh'];

function detectLocale() {
  // Check localStorage override first
  const stored = localStorage.getItem('tn-locale');
  if (stored && stored !== 'auto' && SUPPORTED_LOCALES.includes(stored)) {
    return stored;
  }
  // Detect from browser
  const nav = navigator.language || navigator.userLanguage || 'en';
  const short = nav.split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(short) ? short : 'en';
}

export async function initI18n(forcedLocale) {
  currentLocale = forcedLocale && forcedLocale !== 'auto'
    ? forcedLocale
    : detectLocale();

  try {
    const res = await fetch(`i18n/${currentLocale}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    strings = await res.json();
  } catch (e) {
    console.warn('i18n: failed to load locale', currentLocale, e);
    // Fallback to English
    if (currentLocale !== 'en') {
      try {
        const res = await fetch('i18n/en.json');
        if (res.ok) strings = await res.json();
      } catch (e2) {
        console.warn('i18n: English fallback also failed', e2);
      }
      currentLocale = 'en';
    }
  }

  applyTranslations();
  return currentLocale;
}

export function t(key) {
  return strings[key] || key;
}

export function getLocale() {
  return currentLocale;
}

function applyTranslations() {
  // data-i18n="key" → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) el.textContent = strings[key];
  });

  // data-i18n-placeholder="key" → placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (strings[key]) el.placeholder = strings[key];
  });
}

export function setLocale(locale) {
  if (locale === 'auto') {
    localStorage.removeItem('tn-locale');
  } else {
    localStorage.setItem('tn-locale', locale);
  }
  return initI18n(locale);
}
