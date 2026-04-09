
const KPI_TYPES = [
  { value: 'footfall',   label: 'Footfall' },
  { value: 'passerby',  label: 'PasserBy' },
  { value: 'zone-entry', label: 'Zone Entry' },
  { value: 'billing',   label: 'Billing Counter' },
];

// Resize an uploaded logo image to max 200px wide before base64-encoding,
// keeping the URL hash size manageable.
function resizeLogo(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 200;
      if (img.width <= maxW) { resolve(dataUrl); return; }
      const scale = maxW / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxW;
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

// Generate a simple unique ID for each KPI entry.
let _kpiCounter = 0;
function nextId() { return `kpi-${++_kpiCounter}`; }

export function renderConfigPage(appEl, errorMessage = null) {
  // Internal state
  const state = {
    companyLogo: null,   // base64 data URL or null
    kpis: [{ id: nextId(), type: 'footfall', label: '', videoUrl: '', dbUrl: '' }],
  };

  function buildKpiEntryHtml(entry, index) {
    const typeOptions = KPI_TYPES.map(t =>
      `<option value="${t.value}"${entry.type === t.value ? ' selected' : ''}>${t.label}</option>`
    ).join('');
    return `
      <div class="kpi-entry" data-id="${entry.id}">
        <div class="kpi-entry-header">
          <span class="kpi-entry-number">KPI ${index + 1}</span>
          <button class="btn-danger delete-kpi-btn" data-id="${entry.id}" type="button">Remove</button>
        </div>
        <div class="kpi-entry-fields">
          <div class="field-group">
            <label>KPI Type</label>
            <select class="kpi-type-select" data-id="${entry.id}">
              ${typeOptions}
            </select>
          </div>
          <div class="field-group">
            <label>Display Name</label>
            <input class="kpi-label-input" data-id="${entry.id}" type="text"
              placeholder="e.g. Main Entrance" value="${entry.label}" />
          </div>
          <div class="field-group full-width">
            <label>Video URL (AWS S3 / CloudFront)</label>
            <input class="kpi-video-url" data-id="${entry.id}" type="url"
              placeholder="https://your-bucket.s3.amazonaws.com/video.mp4" value="${entry.videoUrl}" />
          </div>
          <div class="field-group full-width">
            <label>Database URL (AWS S3 .db file)</label>
            <input class="kpi-db-url" data-id="${entry.id}" type="url"
              placeholder="https://your-bucket.s3.amazonaws.com/data.db" value="${entry.dbUrl}" />
          </div>
        </div>
      </div>`;
  }

  function renderKpiList() {
    const listEl = appEl.querySelector('#kpi-list');
    if (!listEl) return;
    listEl.innerHTML = state.kpis.map((entry, i) => buildKpiEntryHtml(entry, i)).join('');
    bindKpiListEvents();
  }

  function readKpisFromDom() {
    state.kpis.forEach((entry) => {
      const typeEl = appEl.querySelector(`.kpi-type-select[data-id="${entry.id}"]`);
      const labelEl = appEl.querySelector(`.kpi-label-input[data-id="${entry.id}"]`);
      const videoEl = appEl.querySelector(`.kpi-video-url[data-id="${entry.id}"]`);
      const dbEl = appEl.querySelector(`.kpi-db-url[data-id="${entry.id}"]`);
      if (typeEl) entry.type = typeEl.value;
      if (labelEl) entry.label = labelEl.value.trim();
      if (videoEl) entry.videoUrl = videoEl.value.trim();
      if (dbEl) entry.dbUrl = dbEl.value.trim();
    });
  }

  function validate() {
    let valid = true;
    // Clear previous errors
    appEl.querySelectorAll('.field-group input.error').forEach(el => el.classList.remove('error'));
    appEl.querySelector('.config-error-msg')?.remove();

    state.kpis.forEach((entry) => {
      const videoEl = appEl.querySelector(`.kpi-video-url[data-id="${entry.id}"]`);
      const dbEl = appEl.querySelector(`.kpi-db-url[data-id="${entry.id}"]`);
      if (!entry.videoUrl) { videoEl?.classList.add('error'); valid = false; }
      if (!entry.dbUrl)    { dbEl?.classList.add('error'); valid = false; }
    });

    if (!valid) {
      const msg = document.createElement('p');
      msg.className = 'config-error-msg';
      msg.textContent = 'Please fill in all Video URL and Database URL fields.';
      appEl.querySelector('.config-actions').before(msg);
    }
    return valid;
  }

  function bindKpiListEvents() {
    appEl.querySelectorAll('.delete-kpi-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        readKpisFromDom();
        const id = btn.dataset.id;
        state.kpis = state.kpis.filter(k => k.id !== id);
        renderKpiList();
      });
    });
  }

  appEl.innerHTML = `
    <header class="dashboard-header">
      <div class="header-logo">
        <img src="/xenlogo.png" alt="XenReality" class="header-logo-img" />
      </div>
      <div class="header-right">
        <span class="header-status">CONFIGURE DASHBOARD</span>
      </div>
    </header>

    <main class="config-main">
      ${errorMessage ? `<div class="config-banner-error">${errorMessage}</div>` : ''}
      <div class="config-card">
        <h1>Configure Your Dashboard</h1>

        <div class="logo-upload-section">
          <div class="field-group">
            <label>Company Logo</label>
            <input type="file" id="logo-input" accept="image/*" />
          </div>
        </div>

        <div class="kpi-section-header">
          <span class="kpi-section-title">KPI Entries</span>
        </div>

        <div id="kpi-list"></div>

        <button class="btn-add-kpi" id="add-kpi-btn" type="button">+ Add KPI</button>

        <div class="config-actions">
          <button class="btn-primary" id="continue-btn" type="button">Continue &rarr;</button>
        </div>
      </div>
    </main>
  `;

  // Render initial KPI list
  renderKpiList();

  // Logo upload — store in state; it will appear on the dashboard page after Continue
  appEl.querySelector('#logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      state.companyLogo = await resizeLogo(evt.target.result);
    };
    reader.readAsDataURL(file);
  });

  // Add KPI
  appEl.querySelector('#add-kpi-btn').addEventListener('click', () => {
    readKpisFromDom();
    state.kpis.push({ id: nextId(), type: 'footfall', label: '', videoUrl: '', dbUrl: '' });
    renderKpiList();
  });

  // Continue
  appEl.querySelector('#continue-btn').addEventListener('click', async () => {
    readKpisFromDom();
    if (!validate()) return;

    const config = {
      companyLogo: state.companyLogo,
      kpis: state.kpis.map(({ type, label, videoUrl, dbUrl }) => ({ type, label, videoUrl, dbUrl })),
    };

    const btn = appEl.querySelector('#continue-btn');
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Server error');
      const { id } = await res.json();

      const shareBox = document.createElement('div');
      shareBox.className = 'share-url-box';
      const fullUrl = `${window.location.origin}${window.location.pathname}#dashboard/${id}`;
      shareBox.innerHTML = `
        <div class="share-url-label">Your dashboard URL (share this with your client):</div>
        <div class="share-url-text">${fullUrl}</div>
        <button class="btn-copy-url" type="button">Copy URL</button>
      `;
      appEl.querySelector('.config-actions').after(shareBox);

      shareBox.querySelector('.btn-copy-url').addEventListener('click', () => {
        navigator.clipboard.writeText(fullUrl).then(() => {
          shareBox.querySelector('.btn-copy-url').textContent = 'Copied!';
        });
      });

      window.location.hash = `#dashboard/${id}`;
    } catch {
      btn.disabled = false;
      btn.textContent = 'Continue \u2192';
      const msg = document.createElement('p');
      msg.className = 'config-error-msg';
      msg.textContent = 'Failed to save configuration. Please try again.';
      appEl.querySelector('.config-actions').before(msg);
    }
  });
}
