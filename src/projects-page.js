const PROJECTS = [
  { name: 'Bata',           url: 'https://bata.xenreality.com/' },
  { name: 'EasyBuy',        url: 'https://ebsurecount.xenreality.com/' },
  { name: 'Emo Energy',     url: 'https://emo.xenreality.com/' },
  { name: 'Halli Mane PoC', url: 'https://halli.xenreality.com/' },
  { name: 'Kalyan Kendra',  url: 'https://kalyan.xenreality.com/' },
  { name: 'Kushals',        url: 'https://kushals.xenreality.com/' },
  { name: 'MMIPL',          url: 'https://mmipl.xenreality.com/' },
  { name: 'Nikshan',        url: 'https://nikshan.xenreality.com/' },
  { name: 'Paragon',        url: 'https://paragon.xenreality.com/' },
  { name: 'Reliance',       url: 'https://test.xenreality.com/' },
  { name: 'Sulthan',        url: 'https://sulthan.xenreality.com/' },
  { name: 'TechnoSport',    url: 'https://techno.xenreality.com/' },
  { name: 'Us-Polo',        url: 'https://arvind.xenreality.com/' },
  { name: 'V Bazaar',       url: 'https://aws.xenreality.com/' },
  { name: 'Key Motors',     url: null },
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

function cardHTML(project) {
  const initial = project.name.charAt(0).toUpperCase();
  const color   = accentColor(project.name);

  if (!project.url) {
    return `
      <div class="project-card project-card--disabled">
        <div class="project-avatar" style="background:${color}22;color:${color}">${initial}</div>
        <span class="project-name">${project.name}</span>
        <span class="coming-soon-badge">Coming Soon</span>
      </div>`;
  }

  return `
    <a class="project-card" href="${project.url}" target="_blank" rel="noopener noreferrer"
       style="--accent:${color}">
      <div class="project-avatar" style="background:${color}22;color:${color}">${initial}</div>
      <span class="project-name">${project.name}</span>
      <svg class="external-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 3h6v6M17 3l-8 8M8 5H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/>
      </svg>
    </a>`;
}

export function renderProjectsPage(appEl) {
  appEl.innerHTML = `
    <header class="site-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="logo-img" />
      </div>
      <span class="header-title">XenReality Projects</span>
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8.5" cy="8.5" r="5.5"/>
          <line x1="13" y1="13" x2="18" y2="18"/>
        </svg>
        <input id="search-input" class="search-input" type="text"
               placeholder="Search projects…" autocomplete="off" />
      </div>
    </header>

    <main class="projects-main">
      <div id="projects-grid" class="projects-grid">
        ${PROJECTS.map(cardHTML).join('')}
      </div>
      <p id="no-results" class="no-results hidden">No projects match your search.</p>
    </main>
  `;

  const input = appEl.querySelector('#search-input');
  const grid  = appEl.querySelector('#projects-grid');
  const noRes = appEl.querySelector('#no-results');
  const cards = Array.from(grid.querySelectorAll('.project-card'));

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card, i) => {
      const match = !q || PROJECTS[i].name.toLowerCase().includes(q);
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    noRes.classList.toggle('hidden', visible > 0);
  });
}
