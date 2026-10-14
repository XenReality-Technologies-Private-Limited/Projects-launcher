import pb from './pb.js';
import { getCachedSsoToken } from './sso-tokens.js';

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
          { name: 'TechnoSport',   url: '/technoSport/', logo: 'https://d2uimaqek2eby3.cloudfront.net/TechnoSport/Technosport-logo.png' },
          { name: 'US-Polo',       url: '/usPolo/',       logo: 'https://d2uimaqek2eby3.cloudfront.net/US-Polo/US_Polo_Logo.png' },
          { name: 'Rnb',           url: 'https://rnb.xenreality.com/', ssoCollection: 'bata_users', logo: 'https://d2uimaqek2eby3.cloudfront.net/RnB/RnB_logo.png' },
          { name: 'Kalyan Kendra', url: '/kalyanKendra/', logo: 'https://d2uimaqek2eby3.cloudfront.net/Kalyan-Kendra/Kalyan-Kendra_logo.png' },
        ],
      },
      {
        heading: 'Jewellery Store',
        prefix: 'Jewellery Store',
        items: [
          { name: 'Kushals', url: '/kushals/', logo: 'https://d2uimaqek2eby3.cloudfront.net/Kushals/Kushals_New_Logo_.avif' },
        ],
      },
      {
        heading: 'Electronic Store',
        prefix: 'Electronic Store',
        items: [
          { name: 'Reliance', url: '/reliance/', logo: 'https://d2uimaqek2eby3.cloudfront.net/reliance_demos/Reliance_logo.webp' },
        ],
      },
      {
        heading: 'Supermarkets / Malls',
        prefix: 'Supermarket/Mall',
        items: [
          { name: 'Carrefour',    url: 'https://carrefour.xenreality.com/', ssoCollection: 'bata_users', logo: 'https://d2uimaqek2eby3.cloudfront.net/Carrefour/Carrefour-Logo.svg' },
          { name: 'V Bazaar',     url: '/vBazaar/',     logo: 'https://d2uimaqek2eby3.cloudfront.net/V%20Bazaar/V-Bazaar-logo.png' },
          { name: 'Safeer Group', url: '/safeerGroup/' },
        ],
      },
      {
        heading: 'Music Instruments Store',
        prefix: 'Music Instruments Store',
        items: [
          { name: 'Thomsun Yamaha', url: '/yamaha/', logo: 'https://d2uimaqek2eby3.cloudfront.net/Yamaha/thomsun.png' },
        ],
      },
      {
        heading: 'Home, Interior & Lifestyle Brands',
        prefix: 'Home & Lifestyle Brand',
        items: [
          { name: 'Chumbak',  url: 'https://test.xenreality.com/',     ssoCollection: 'bata_users', logo: 'https://d2uimaqek2eby3.cloudfront.net/Chumbak/Chumbak_logo.webp' },
          { name: 'Livspace', url: 'https://livspace.xenreality.com/', ssoCollection: 'bata_users', logo: 'https://d2uimaqek2eby3.cloudfront.net/LivSpace/Livspace_logo.svg' },
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
          { name: 'Halli Mane', url: '/halliMane/', logo: 'https://d2uimaqek2eby3.cloudfront.net/Halli-Mane/halli_mane_logo.png' },
          { name: 'Paragon',    url: '/paragon/',    logo: 'https://d2uimaqek2eby3.cloudfront.net/Paragon/paragon_logo.jfif' },
          { name: 'Chicking',   url: '/chicking/',   logo: 'https://d2uimaqek2eby3.cloudfront.net/Chicking/chicking-logo.png' },
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
  const avatar  = item.logo
    ? `<div class="project-avatar project-avatar--logo"><img src="${item.logo}" alt="${item.name}" loading="lazy" /></div>`
    : `<div class="project-avatar" style="background:${color}22;color:${color}">${initial}</div>`;

  if (!item.url) {
    return `
      <div class="project-card project-card--disabled" data-search="${search}">
        ${avatar}
        <span class="project-name">${displayName}</span>
        <span class="coming-soon-badge">Coming Soon</span>
      </div>`;
  }

  const sso = item.ssoCollection ? ` data-sso="${item.ssoCollection}"` : '';
  return `
    <a class="project-card" href="${item.url}" target="_blank" rel="noopener noreferrer"
       style="--accent:${color}" data-search="${search}"${sso}>
      ${avatar}
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

function groupHTML(group, showHeading = true) {
  const cards = group.items
    .map((it) => cardHTML(it, it.name, group.prefix ? `${group.prefix} ${it.name}` : it.name))
    .join('');
  const heading = showHeading && group.heading ? `<h2 class="group-heading">${group.heading}</h2>` : '';
  return `<section class="group-section">${heading}<div class="projects-grid">${cards}</div></section>`;
}

// A category with several groups (e.g. Retail Stores' Clothing Brands,
// Jewellery Store, Electronic Store, ...) gets its own sub-tab row instead of
// stacking every group's section one after another — a group with just one
// card otherwise reads as mostly empty scroll space under its heading. A
// category with only one group (Restaurants, Instruction Manual, Internal
// Projects) just renders that group directly, no sub-tabs needed.
function categoryBodyHTML(category) {
  if (category.groups.length <= 1) {
    return category.groups.map((g) => groupHTML(g)).join('');
  }
  const tabs = category.groups
    .map((g, i) => `<button type="button" class="subcategory-tab${i === 0 ? ' active' : ''}" data-group-index="${i}">${g.heading || g.prefix}</button>`)
    .join('');
  return `
    <nav class="subcategory-tabs">${tabs}</nav>
    <div id="subcategory-body">${groupHTML(category.groups[0], false)}</div>
  `;
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

  let activeCat = null;

  function showCategory(id) {
    const cat = cats.find((c) => c.id === id) || cats[0];
    if (!cat) { bodyEl.innerHTML = ''; return; }
    activeCat = cat;
    bodyEl.innerHTML = categoryBodyHTML(cat);
    tabsEl.querySelectorAll('.category-tab').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat.id));
    input.value = '';
    applySearch();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab');
    if (btn) showCategory(btn.dataset.cat);
  });

  bodyEl.addEventListener('click', (e) => {
    const subTab = e.target.closest('.subcategory-tab');
    if (subTab) {
      const group = activeCat?.groups[Number(subTab.dataset.groupIndex)];
      const subBody = bodyEl.querySelector('#subcategory-body');
      if (group && subBody) {
        bodyEl.querySelectorAll('.subcategory-tab').forEach((b) => b.classList.toggle('active', b === subTab));
        subBody.innerHTML = groupHTML(group, false);
        input.value = '';
        applySearch();
      }
      return;
    }

    // Resolved at click time, not render time: the silent SSO login (see
    // src/sso-tokens.js) is still in flight when this page first renders, so
    // baking a token into the href up front could miss it. By the time
    // someone actually clicks, it's had time to land.
    const a = e.target.closest('a.project-card[data-sso]');
    if (!a) return;
    const token = getCachedSsoToken(a.dataset.sso);
    if (!token) return;
    try {
      const u = new URL(a.href);
      u.searchParams.set('pbtoken', token);
      a.href = u.toString();
    } catch { /* leave href as-is */ }
  });

  input.addEventListener('input', applySearch);

  if (cats.length) showCategory(cats[0].id);
}
