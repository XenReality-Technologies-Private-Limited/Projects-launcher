import pb from './pb.js';

// Each category is a tab in the menu bar. Each group within a category gets
// its own sub-heading and a naming prefix ("<prefix> - <customer>") for its
// cards. A group with prefix:null renders its card(s) with no prefix, and a
// category with a single prefix:null group renders no sub-heading either
// (used for the one-off Instruction Manual / Internal Projects tabs).
const CATEGORIES = [
  {
    id: 'retail',
    label: 'Retail Stores',
    groups: [
      {
        heading: 'Clothing Brands',
        prefix: 'Clothing Brand',
        items: [
          { name: 'Kalyan Kendra',     url: '/kalyanKendra/' },
          { name: 'Majestic Maharaja', url: '/majesticMaharaja/' },
          { name: 'TechnoSport',       url: '/technoSport/' },
          { name: 'US-Polo',           url: '/usPolo/' },
          { name: 'Gravity',           url: '/gravity/' },
          { name: 'Goyal Sons',        url: '/goyalSons/' },
          { name: 'Rnb',               url: 'https://rnb.xenreality.com/' },
        ],
      },
      {
        heading: 'Jewellery Store',
        prefix: 'Jewellery Store',
        items: [
          { name: 'Kushals', url: '/kushals/' },
        ],
      },
      {
        heading: 'Electronic Store',
        prefix: 'Electronic Store',
        items: [
          { name: 'Reliance', url: '/reliance/' },
        ],
      },
      {
        heading: 'Supermarkets / Malls',
        prefix: 'Supermarket/Mall',
        items: [
          { name: 'V Bazaar',     url: '/vBazaar/' },
          { name: 'Hilite Mall',  url: '/hiliteMall/' },
          { name: 'Safeer Group', url: '/safeerGroup/' },
          { name: 'Carrefour',    url: 'https://carrefour.xenreality.com/' },
        ],
      },
      {
        heading: 'Music Instruments Store',
        prefix: 'Music Instruments Store',
        items: [
          { name: 'Thomsun Yamaha', url: '/yamaha/' },
        ],
      },
      {
        heading: 'Home, Interior & Lifestyle Brands',
        prefix: 'Home & Lifestyle Brand',
        items: [
          { name: 'Chumbak',  url: 'https://test.xenreality.com/' },
          { name: 'Livspace', url: 'https://livspace.xenreality.com/' },
        ],
      },
    ],
  },
  {
    id: 'restaurants',
    label: 'Restaurants',
    groups: [
      {
        heading: null,
        prefix: 'Restaurant',
        items: [
          { name: 'Halli Mane', url: '/halliMane/' },
          { name: 'Paragon',    url: '/paragon/' },
          { name: 'Chicking',   url: '/chicking/' },
        ],
      },
    ],
  },
  {
    id: 'instructions',
    label: 'Instruction Manual',
    groups: [
      {
        heading: null,
        prefix: null,
        items: [
          { name: 'Instruction Manual', url: '/instructions/' },
        ],
      },
    ],
  },
  {
    id: 'internal',
    label: 'Internal Projects',
    groups: [
      {
        heading: null,
        prefix: null,
        items: [
          { name: 'Label Studio Projects', url: '/label-studio-projects/', employeeOnly: true },
        ],
      },
    ],
  },
];

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#6366f1', '#84cc16', '#a855f7',
];

function accentColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

// Blank/missing role = Xen Employee (default), so existing accounts keep full access.
function isEmployee(role) {
  return !role || role === 'employee';
}

function cardHTML(item, displayName, searchText) {
  const initial = item.name.charAt(0).toUpperCase();
  const color   = accentColor(item.name);
  const search  = (searchText || displayName).toLowerCase();

  if (!item.url) {
    return `
      <div class="project-card project-card--disabled" data-search="${search}">
        <div class="project-avatar" style="background:${color}22;color:${color}">${initial}</div>
        <span class="project-name">${displayName}</span>
        <span class="coming-soon-badge">Coming Soon</span>
      </div>`;
  }

  return `
    <a class="project-card" href="${item.url}" target="_blank" rel="noopener noreferrer"
       style="--accent:${color}" data-search="${search}">
      <div class="project-avatar" style="background:${color}22;color:${color}">${initial}</div>
      <span class="project-name">${displayName}</span>
      <svg class="external-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 3h6v6M17 3l-8 8M8 5H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/>
      </svg>
    </a>`;
}

// Role-filters the category tree and drops any group/category left empty.
function visibleCategories(role) {
  return CATEGORIES
    .map((cat) => {
      const groups = cat.groups
        .map((g) => ({ ...g, items: g.items.filter((it) => !it.employeeOnly || isEmployee(role)) }))
        .filter((g) => g.items.length > 0);
      return { ...cat, groups };
    })
    .filter((cat) => cat.groups.length > 0);
}

function groupHTML(group) {
  const cards = group.items
    .map((it) => cardHTML(it, it.name, group.prefix ? `${group.prefix} ${it.name}` : it.name))
    .join('');
  const heading = group.heading ? `<h2 class="group-heading">${group.heading}</h2>` : '';
  return `<section class="group-section">${heading}<div class="projects-grid">${cards}</div></section>`;
}

function categoryBodyHTML(category) {
  return category.groups.map(groupHTML).join('');
}

export function renderProjectsPage(appEl, onLogout) {
  const role = pb.authStore.record?.role;
  const cats = visibleCategories(role);

  appEl.innerHTML = `
    <header class="site-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="logo-img" />
      </div>
      <span class="header-title">XenReality Projects</span>
      <div class="header-right-wrap">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8.5" cy="8.5" r="5.5"/>
          <line x1="13" y1="13" x2="18" y2="18"/>
        </svg>
        <input id="search-input" class="search-input" type="text"
               placeholder="Search projects…" autocomplete="off" />
      </div>
      <button id="logout-btn" class="logout-btn" title="Sign out">Sign out</button>
      </div>
    </header>

    <nav class="category-tabs" id="category-tabs">
      ${cats.map((cat, i) => `<button type="button" class="category-tab${i === 0 ? ' active' : ''}" data-cat="${cat.id}">${cat.label}</button>`).join('')}
    </nav>

    <main class="projects-main">
      <div id="category-body"></div>
      <p id="no-results" class="no-results hidden">No projects match your search.</p>
    </main>
  `;

  appEl.querySelector('#logout-btn').addEventListener('click', onLogout);

  const tabsEl   = appEl.querySelector('#category-tabs');
  const bodyEl   = appEl.querySelector('#category-body');
  const input    = appEl.querySelector('#search-input');
  const noRes    = appEl.querySelector('#no-results');

  function applySearch() {
    const q = input.value.trim().toLowerCase();
    const cards = Array.from(bodyEl.querySelectorAll('.project-card'));
    let visible = 0;
    cards.forEach((card) => {
      const match = !q || card.dataset.search.includes(q);
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    bodyEl.querySelectorAll('.group-section').forEach((section) => {
      const anyVisible = section.querySelectorAll('.project-card:not(.hidden)').length > 0;
      section.classList.toggle('hidden', !anyVisible);
    });
    noRes.classList.toggle('hidden', visible > 0 || cards.length === 0);
  }

  function showCategory(id) {
    const cat = cats.find((c) => c.id === id) || cats[0];
    if (!cat) { bodyEl.innerHTML = ''; return; }
    bodyEl.innerHTML = categoryBodyHTML(cat);
    tabsEl.querySelectorAll('.category-tab').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat.id));
    input.value = '';
    applySearch();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab');
    if (btn) showCategory(btn.dataset.cat);
  });

  input.addEventListener('input', applySearch);

  if (cats.length) showCategory(cats[0].id);
}
