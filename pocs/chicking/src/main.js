import './style.css';
import { requireAuth } from './login.js';
import { loadKitchenData, loadBillWaitData } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF          = 'https://d2uimaqek2eby3.cloudfront.net/Chicking';
const KITCHEN_VIDEO = `${CF}/chicking_poc_kitchen_video_ppe.mp4`;
const BILLING_VIDEO = `${CF}/chicking_poc_video_annotated.mp4`;
const KITCHEN_DB    = `${CF}/kitchen.db?v=${Date.now()}`;
const BILLWAIT_DB   = `${CF}/bill_wait.db?v=${Date.now()}`;

async function bootstrap() {
  const appEl = document.getElementById('app');

  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Chicking Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching databases from CloudFront</div>
    </div>`;

  try {
    const [kitchenData, billWaitData] = await Promise.all([
      loadKitchenData(KITCHEN_DB),
      loadBillWaitData(BILLWAIT_DB),
    ]);
    renderDashboard(appEl, { kitchenVideoUrl: KITCHEN_VIDEO, billingVideoUrl: BILLING_VIDEO }, kitchenData, billWaitData);
  } catch (err) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                  flex-direction:column;gap:12px;color:#6b7280;font-family:system-ui,sans-serif;
                  padding:24px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:600;color:#b91c1c;">Failed to load dashboard</div>
        <div style="font-size:0.85rem;font-family:monospace;color:#ef4444;">${err?.message || 'Unknown error'}</div>
      </div>`;
  }
}

requireAuth(bootstrap);
