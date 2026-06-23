import './style.css';
import { requireAuth } from './login.js';
import { createDatabase, loadCashStaff, loadPayment, loadCashierAbsence, loadCustomerWait, loadCashierPayout, loadCylinderZone, loadTableClearance, loadTableClearance7 } from './db.js';
import { renderDashboard } from './dashboard.js';

const CF = 'https://d2uimaqek2eby3.cloudfront.net/Halli-Mane';
const DB_URL  = `${CF}/HalliMane.db`;
const DB2_URL = `${CF}/HalliMane%20(1).db`;

const CAMERAS = [
  { label: 'Cash Given to Staff',      type: 'cash-staff',        videoUrl: `${CF}/output_hallimane_1.mp4` },
  { label: 'Payment Transactions',     type: 'payment',           videoUrl: `${CF}/output_hallimane_2.mp4` },
  { label: 'Payment Transactions 2',   type: 'payment2',          videoUrl: `${CF}/output_hallimane_7.mp4` },
  { label: 'Cashier Not in Frame',     type: 'cashier-absence',   videoUrl: `${CF}/output_hallimane_3.mp4` },
  { label: 'Customer Waiting',         type: 'customer-wait',     videoUrl: `${CF}/output_hallimane_4.mp4` },
  { label: 'Money Given by Cashier',   type: 'cashier-payout',    videoUrl: `${CF}/Output_Hallimane8.mp4` },
  { label: 'Cylinder Zone',            type: 'cylinder-zone',     videoUrl: `${CF}/Cylinder%20Output%20Blurred.mp4` },
  { label: 'Table Clearance',          type: 'table-clearance',   videoUrl: `${CF}/Output_Hallimane9.mp4` },
  { label: 'Table Clearance 2',        type: 'table-clearance-2', videoUrl: `${CF}/output_hallimane_6.mp4` },
  { label: 'Food Safety Gear',         type: 'apron',             videoUrl: `${CF}/Apron_Output_Blurred.mp4` },
];

async function bootstrap() {
  const appEl = document.getElementById('app');

  // Show loading state while DB fetches
  appEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;color:#6b7280;font-family:system-ui,sans-serif;">
      <div style="font-size:1.1rem;font-weight:600;">Loading Halli Mane Dashboard&hellip;</div>
      <div style="font-size:0.85rem;">Fetching database from CloudFront</div>
    </div>`;

  try {
    const [db, db2] = await Promise.all([createDatabase(DB_URL), createDatabase(DB2_URL)]);
    const allData = {
      cashStaff:       loadCashStaff(db),
      payment:         loadPayment(db),
      payment2:        loadPayment(db2),
      cashierAbsence:  loadCashierAbsence(db),
      customerWait:    loadCustomerWait(db),
      cashierPayout:   loadCashierPayout(db),
      cylinderZone:    loadCylinderZone(db),
      tableClearance:  loadTableClearance(db),
      tableClearance7: loadTableClearance7(db2),
    };
    db.close();
    db2.close();
    await renderDashboard(appEl, CAMERAS, allData);
  } catch (err) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;color:#6b7280;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:600;color:#b91c1c;">Failed to load dashboard</div>
        <div style="font-size:0.85rem;font-family:monospace;color:#ef4444;">${err?.message || 'Unknown error'}</div>
        <div style="font-size:0.8rem;margin-top:8px;">Check that the database URL is reachable and that CloudFront has CORS configured for this origin.</div>
      </div>`;
  }
}

requireAuth(bootstrap);
