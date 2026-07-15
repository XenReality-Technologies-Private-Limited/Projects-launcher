import pb from './pb.js';

const LOGO = 'https://d108xxen99ni2a.cloudfront.net/XenRealitymark.webp';
const POC_NAME = 'Hilite Mall';
const COLLECTION = 'xr_employees';

export function requireAuth(onAuthed) {
  if (pb.authStore.isValid) { onAuthed(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:#f1f5f9;display:flex;
    align-items:center;justify-content:center;z-index:9999;
    font-family:'Open Sans',system-ui,sans-serif;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;
                box-shadow:0 4px 24px rgba(0,0,0,.08);padding:44px 40px;
                width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <img src="${LOGO}" alt="XenReality" style="height:44px;object-fit:contain;margin-bottom:8px;" />
      <h1 style="margin:0;font-size:1.2rem;font-weight:600;color:#0f172a;">${POC_NAME}</h1>
      <p style="margin:0 0 16px;font-size:.85rem;color:#64748b;">Sign in to view the dashboard</p>
      <form id="poc-login-form" style="width:100%;display:flex;flex-direction:column;gap:14px;" novalidate>
        <div style="display:flex;flex-direction:column;gap:5px;">
          <label for="poc-identity" style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;">Username or Email</label>
          <input id="poc-identity" type="text" autocomplete="username"
            style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:.9rem;font-family:inherit;color:#0f172a;background:#f1f5f9;outline:none;" />
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          <label for="poc-password" style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;">Password</label>
          <input id="poc-password" type="password" autocomplete="current-password"
            style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:.9rem;font-family:inherit;color:#0f172a;background:#f1f5f9;outline:none;" />
        </div>
        <p id="poc-login-error" style="margin:0;font-size:.82rem;color:#ef4444;text-align:center;display:none;"></p>
        <button id="poc-login-btn" type="submit"
          style="width:100%;padding:11px;background:#1e293b;color:#fff;border:none;border-radius:9px;
                 font-size:.95rem;font-weight:600;font-family:inherit;cursor:pointer;margin-top:4px;">
          Sign in
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const form  = overlay.querySelector('#poc-login-form');
  const errEl = overlay.querySelector('#poc-login-error');
  const btn   = overlay.querySelector('#poc-login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identity = overlay.querySelector('#poc-identity').value.trim();
    const password = overlay.querySelector('#poc-password').value;
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await pb.collection(COLLECTION).authWithPassword(identity, password);
      history.replaceState(null, '', location.href);
      overlay.remove();
      onAuthed();
    } catch {
      errEl.textContent = 'Invalid credentials. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}
