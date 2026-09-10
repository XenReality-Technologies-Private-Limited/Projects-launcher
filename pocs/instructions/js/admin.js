import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.0/dist/pocketbase.es.mjs';

const pb = new PocketBase('https://pb.xenreality.com');
let allSubmissions = [];
let currentSubmissionId = null;

// Initialize immediately since module scripts are deferred
initAdmin();

async function initAdmin() {
  await verifyAuth();
  bindEvents();
  loadSubmissions();
}

async function verifyAuth() {
  if (!pb.authStore.isValid) {
    window.location.replace('/instructions/login.html');
    return;
  }
  
  // Refresh auth to get latest role and check validity
  try {
    await pb.collection('xr_employees').authRefresh();
    const user = pb.authStore.record;
    
    // Check role (assuming field is named 'role' and admins are 'admin')
    if (!user || user.role !== 'admin') {
      alert("Access Denied: You do not have administrator privileges.");
      window.location.replace('/instructions/');
      return;
    }
    
    document.getElementById('user-greeting').textContent = \`Hello, \${user.name || user.email}\`;
    document.getElementById('admin-loader').style.display = 'none';
    document.getElementById('admin-app').style.display = 'block';
    
  } catch (err) {
    console.error("Auth error:", err);
    localStorage.removeItem('pocketbase_auth');
    window.location.replace('/instructions/login.html');
  }
}

function bindEvents() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    pb.authStore.clear();
    window.location.replace('/instructions/login.html');
  });
  
  document.getElementById('btn-refresh').addEventListener('click', loadSubmissions);
  
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('filter-status').addEventListener('change', renderTable);
  
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.remove('open');
  });
  
  // Close modal on outside click
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
      e.target.classList.remove('open');
    }
  });
  
  document.getElementById('btn-save-status').addEventListener('click', saveStatus);
}

async function loadSubmissions() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading...</td></tr>';
  
  try {
    // Fetch submissions, latest first
    const records = await pb.collection('camera_nvr_submissions').getFullList({
      sort: '-created',
    });
    
    allSubmissions = records;
    renderTable();
  } catch (err) {
    console.error("Failed to load submissions:", err);
    tbody.innerHTML = \`<tr><td colspan="8" style="text-align:center;color:#ef4444;">Error loading data: \${escapeHtml(err.message)}</td></tr>\`;
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  const searchStr = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;
  
  const filtered = allSubmissions.filter(sub => {
    const matchesSearch = 
      (sub.store_name || '').toLowerCase().includes(searchStr) || 
      (sub.field_engineer_name || '').toLowerCase().includes(searchStr) ||
      (sub.store_location || '').toLowerCase().includes(searchStr);
      
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">No submissions found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(sub => {
    const d = new Date(sub.created);
    const dateStr = \`\${d.getDate()}/\${d.getMonth()+1}/\${d.getFullYear()}\`;
    
    let statusClass = 'status-pending';
    if (sub.status === 'reviewed') statusClass = 'status-reviewed';
    if (sub.status === 'actioned') statusClass = 'status-actioned';
    
    return \`
      <tr style="cursor:pointer;" onclick="openDetails('\${sub.id}')">
        <td>\${dateStr}</td>
        <td style="font-weight:600;">\${escapeHtml(sub.store_name)}</td>
        <td>\${escapeHtml(sub.store_location)}, \${escapeHtml(sub.city)}</td>
        <td>\${escapeHtml(sub.field_engineer_name)}</td>
        <td>\${sub.has_nvr ? \`Yes (\${escapeHtml(sub.camera_brand)})\` : 'No'}</td>
        <td>\${sub.camera_count}</td>
        <td><span class="status-badge \${statusClass}">\${escapeHtml(sub.status || 'pending')}</span></td>
        <td><button class="btn btn-ghost btn-sm">View</button></td>
      </tr>
    \`;
  }).join('');
}

window.openDetails = async function(id) {
  const sub = allSubmissions.find(s => s.id === id);
  if (!sub) return;
  
  currentSubmissionId = id;
  
  // Set modal header and status
  document.getElementById('modal-title').textContent = \`\${escapeHtml(sub.store_name)} (\${escapeHtml(sub.city)})\`;
  document.getElementById('update-status').value = sub.status || 'pending';
  
  // Render loading state for body
  const bodyEl = document.getElementById('modal-body');
  bodyEl.innerHTML = '<div style="text-align:center;padding:40px;">Loading details...</div>';
  document.getElementById('detail-modal').classList.add('open');
  
  // Fetch associated cameras
  let cameras = [];
  try {
    cameras = await pb.collection('camera_details').getFullList({
      filter: \`submission = '\${id}'\`,
      sort: 'camera_number'
    });
  } catch (err) {
    console.error("Failed to load cameras:", err);
  }
  
  // Build HTML
  let html = \`
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">Store</span>
        <span class="detail-val">\${escapeHtml(sub.store_name)}<br><span style="font-size:0.85em;color:var(--ink-soft);">\${escapeHtml(sub.store_location)}, \${escapeHtml(sub.city)}, \${escapeHtml(sub.country)}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Engineer</span>
        <span class="detail-val">\${escapeHtml(sub.field_engineer_name)}<br><span style="font-size:0.85em;color:var(--ink-soft);">\${escapeHtml(sub.field_engineer_phone)} | \${escapeHtml(sub.field_engineer_email)}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Company</span>
        <span class="detail-val">\${escapeHtml(sub.field_engineer_company || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Visit Date</span>
        <span class="detail-val">\${escapeHtml(sub.visit_date.split(' ')[0])}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Submission Date</span>
        <span class="detail-val">\${new Date(sub.created).toLocaleString()}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">NVR Setup</span>
        <span class="detail-val">\${sub.has_nvr ? 'Yes' : 'No'} (\${escapeHtml(sub.camera_brand)})</span>
      </div>
    </div>
  \`;
  
  if (sub.has_nvr) {
    html += \`<h3 class="section-title">NVR Details</h3><div class="detail-grid">\`;
    
    if (sub.nvr_cloud_id) {
      html += \`
        <div class="detail-item">
          <span class="detail-label">Cloud ID / Serial</span>
          <span class="detail-val">\${escapeHtml(sub.nvr_cloud_id)}</span>
        </div>
      \`;
    }
    if (sub.nvr_ip_address) {
      html += \`
        <div class="detail-item">
          <span class="detail-label">IP Address</span>
          <span class="detail-val">\${escapeHtml(sub.nvr_ip_address)} \${sub.nvr_port ? \`:\${sub.nvr_port}\` : ''}</span>
        </div>
      \`;
    }
    
    const uid = 'nvr_pwd_' + Math.random().toString(36).substr(2, 9);
    html += \`
      <div class="detail-item">
        <span class="detail-label">NVR Username</span>
        <span class="detail-val credential">\${escapeHtml(sub.nvr_username)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">NVR Password</span>
        <span class="detail-val credential">
          <span id="\${uid}" data-val="\${escapeHtml(sub.nvr_password)}">••••••••</span>
          <button class="credential-toggle" onclick="togglePwd('\${uid}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </span>
      </div>
    \`;
    html += \`</div>\`;
  }
  
  if (sub.router_ip || sub.router_username) {
    html += \`<h3 class="section-title">Router Details</h3><div class="detail-grid">\`;
    html += \`
      <div class="detail-item">
        <span class="detail-label">Router IP</span>
        <span class="detail-val">\${escapeHtml(sub.router_ip || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Router User</span>
        <span class="detail-val credential">\${escapeHtml(sub.router_username || '-')}</span>
      </div>
    \`;
    
    if (sub.router_password) {
      const uid = 'router_pwd_' + Math.random().toString(36).substr(2, 9);
      html += \`
        <div class="detail-item">
          <span class="detail-label">Router Password</span>
          <span class="detail-val credential">
            <span id="\${uid}" data-val="\${escapeHtml(sub.router_password)}">••••••••</span>
            <button class="credential-toggle" onclick="togglePwd('\${uid}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </span>
        </div>
      \`;
    }
    html += \`</div>\`;
  }
  
  html += \`<h3 class="section-title">Camera Details (\${cameras.length} records)</h3>\`;
  
  if (cameras.length > 0) {
    html += \`
      <table class="cam-table">
        <thead>
          <tr>
            <th>#</th>
            <th>IP Address</th>
            <th>Channel</th>
            \${!sub.has_nvr ? '<th>Username</th><th>Password</th>' : ''}
          </tr>
        </thead>
        <tbody>
    \`;
    
    cameras.forEach((cam, idx) => {
      html += \`<tr>
        <td>\${cam.camera_number}</td>
        <td>\${escapeHtml(cam.camera_ip_address)}</td>
        <td>\${escapeHtml(cam.camera_channel || '-')}</td>
      \`;
      
      if (!sub.has_nvr) {
        const uid = 'cam_pwd_' + idx;
        html += \`
          <td><span class="credential" style="font-size:0.85rem;">\${escapeHtml(cam.camera_username)}</span></td>
          <td>
            <span class="credential" style="font-size:0.85rem;">
              <span id="\${uid}" data-val="\${escapeHtml(cam.camera_password)}">••••••</span>
              <button class="credential-toggle" onclick="togglePwd('\${uid}')" style="padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            </span>
          </td>
        \`;
      }
      html += \`</tr>\`;
    });
    
    html += \`</tbody></table>\`;
  } else {
    html += \`<p style="color:var(--ink-soft);font-size:0.9rem;">No camera records found.</p>\`;
  }
  
  if (sub.additional_notes) {
    html += \`
      <h3 class="section-title">Additional Comments</h3>
      <div style="background:#f8fafd;padding:16px;border-radius:12px;border:1px solid var(--line);font-size:0.95rem;line-height:1.5;">
        \${escapeHtml(sub.additional_notes).replace(/\\n/g, '<br>')}
      </div>
    \`;
  }
  
  bodyEl.innerHTML = html;
};

window.togglePwd = function(id) {
  const span = document.getElementById(id);
  if (!span) return;
  const val = span.getAttribute('data-val');
  if (span.textContent.includes('•')) {
    span.textContent = val;
  } else {
    span.textContent = '••••••••';
  }
};

async function saveStatus() {
  if (!currentSubmissionId) return;
  
  const newStatus = document.getElementById('update-status').value;
  const btn = document.getElementById('btn-save-status');
  const msg = document.getElementById('save-msg');
  
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    const updated = await pb.collection('camera_nvr_submissions').update(currentSubmissionId, {
      status: newStatus
    });
    
    // Update local data
    const idx = allSubmissions.findIndex(s => s.id === currentSubmissionId);
    if (idx !== -1) {
      allSubmissions[idx].status = newStatus;
    }
    
    renderTable(); // Update background table
    
    btn.textContent = 'Save';
    btn.disabled = false;
    
    msg.style.opacity = 1;
    setTimeout(() => { msg.style.opacity = 0; }, 2000);
    
  } catch (err) {
    console.error("Failed to update status:", err);
    alert("Failed to update status: " + err.message);
    btn.textContent = 'Save';
    btn.disabled = false;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
}
