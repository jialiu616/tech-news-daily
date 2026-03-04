// date-navigator.js — Archive date picking & mini-calendar
import { t } from './i18n.js';

let availableDates = [];
let currentDate = null;
let onDateChange = null;
let calendarMonth = null; // { year, month } currently displayed in mini-calendar

const datePicker = document.getElementById('datePicker');
const prevBtn = document.getElementById('prevDay');
const nextBtn = document.getElementById('nextDay');
const todayBtn = document.getElementById('todayBtn');
const calendarEl = document.getElementById('miniCalendar');

export async function initDateNavigator(callback) {
  onDateChange = callback;

  // Fetch the index manifest
  try {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = await res.json();
    availableDates = (index.dates || []).sort().reverse(); // newest first
  } catch (e) {
    console.warn('date-navigator: failed to load index.json', e);
    availableDates = [];
  }

  // Determine initial date from URL hash or latest available
  const hash = window.location.hash;
  const hashMatch = hash.match(/#date=(\d{4}-\d{2}-\d{2})/);
  const requestedDate = hashMatch ? hashMatch[1] : null;

  if (requestedDate && availableDates.includes(requestedDate)) {
    currentDate = requestedDate;
  } else if (availableDates.length > 0) {
    currentDate = availableDates[0];
  } else {
    currentDate = todayString();
  }

  // Configure date picker
  if (availableDates.length > 0) {
    datePicker.min = availableDates[availableDates.length - 1];
    datePicker.max = availableDates[0];
  }
  datePicker.value = currentDate;

  // Initialize calendar to the month of the current date
  const d = new Date(currentDate + 'T00:00:00');
  calendarMonth = { year: d.getFullYear(), month: d.getMonth() };

  // Event listeners
  datePicker.addEventListener('change', () => {
    navigateTo(datePicker.value);
  });

  prevBtn.addEventListener('click', () => {
    const idx = availableDates.indexOf(currentDate);
    if (idx >= 0 && idx < availableDates.length - 1) {
      navigateTo(availableDates[idx + 1]);
    }
  });

  nextBtn.addEventListener('click', () => {
    const idx = availableDates.indexOf(currentDate);
    if (idx > 0) {
      navigateTo(availableDates[idx - 1]);
    }
  });

  todayBtn.addEventListener('click', () => {
    const today = todayString();
    if (availableDates.includes(today)) {
      navigateTo(today);
    } else if (availableDates.length > 0) {
      navigateTo(availableDates[0]);
    }
  });

  window.addEventListener('hashchange', () => {
    const m = window.location.hash.match(/#date=(\d{4}-\d{2}-\d{2})/);
    if (m && m[1] !== currentDate) {
      navigateTo(m[1], false);
    }
  });

  renderCalendar();
  updateNavState();

  return currentDate;
}

function navigateTo(date, updateHash = true) {
  // Snap to nearest available date if requested date has no data
  if (!availableDates.includes(date)) {
    const nearest = findNearest(date);
    if (nearest) date = nearest;
    else return;
  }

  currentDate = date;
  datePicker.value = date;

  if (updateHash) {
    history.replaceState(null, '', `#date=${date}`);
  }

  // Update calendar month view if needed
  const d = new Date(date + 'T00:00:00');
  calendarMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderCalendar();
  updateNavState();

  if (onDateChange) onDateChange(date);
}

function updateNavState() {
  const idx = availableDates.indexOf(currentDate);
  prevBtn.disabled = idx < 0 || idx >= availableDates.length - 1;
  nextBtn.disabled = idx <= 0;
  todayBtn.classList.toggle('active', currentDate === todayString() || currentDate === availableDates[0]);
}

function findNearest(date) {
  if (availableDates.length === 0) return null;
  let closest = availableDates[0];
  let minDiff = Infinity;
  const target = new Date(date + 'T00:00:00').getTime();
  for (const d of availableDates) {
    const diff = Math.abs(new Date(d + 'T00:00:00').getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }
  return closest;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Mini Calendar ──────────────────────────────────────

function renderCalendar() {
  if (!calendarEl) return;

  const { year, month } = calendarMonth;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  // Available dates set for quick lookup
  const dateSet = new Set(availableDates);

  let daysHtml = dayLabels
    .map(d => `<span class="calendar-day-label">${d}</span>`)
    .join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    daysHtml += '<span class="calendar-day empty"></span>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const classes = ['calendar-day'];
    if (dateSet.has(dateStr)) classes.push('has-data');
    if (dateStr === today) classes.push('today');
    if (dateStr === currentDate) classes.push('selected');

    const clickHandler = dateSet.has(dateStr)
      ? `onclick="window.__calNav('${dateStr}')"`
      : '';

    daysHtml += `<span class="${classes.join(' ')}" ${clickHandler}>${day}</span>`;
  }

  calendarEl.innerHTML = `
    <div class="calendar-header">
      <span class="calendar-title">${monthNames[month]} ${year}</span>
      <div class="calendar-nav">
        <button id="calPrev">&larr;</button>
        <button id="calNext">&rarr;</button>
      </div>
    </div>
    <div class="calendar-grid">${daysHtml}</div>
  `;

  // Calendar month nav
  calendarEl.querySelector('#calPrev')?.addEventListener('click', () => {
    calendarMonth.month--;
    if (calendarMonth.month < 0) {
      calendarMonth.month = 11;
      calendarMonth.year--;
    }
    renderCalendar();
  });

  calendarEl.querySelector('#calNext')?.addEventListener('click', () => {
    calendarMonth.month++;
    if (calendarMonth.month > 11) {
      calendarMonth.month = 0;
      calendarMonth.year++;
    }
    renderCalendar();
  });

  // Global handler for calendar day clicks
  window.__calNav = (date) => navigateTo(date);
}

export function getAvailableDates() {
  return availableDates;
}

export function getCurrentDate() {
  return currentDate;
}
