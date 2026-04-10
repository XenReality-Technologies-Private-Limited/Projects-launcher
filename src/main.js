import './style.css';
import { renderConfigPage } from './config-page.js';
import { renderDashboard } from './dashboard-page.js';
import { decodeConfig } from './config-utils.js';

async function bootstrap() {
  const appEl = document.getElementById('app');
  const path = window.location.pathname;

  if (path.startsWith('/dashboard/')) {
    const token = path.slice('/dashboard/'.length);
    try {
      let config;
      if (token.length <= 16) {
        // Short ID — fetch config from API
        const res = await fetch(`/api/config/${token}`);
        if (!res.ok) throw new Error('Not found');
        config = await res.json();
      } else {
        // Legacy long base64 token
        config = decodeConfig(token);
      }
      if (!config.kpis.length) {
        renderConfigPage(appEl, 'No KPIs found in this URL — please reconfigure.');
        return;
      }
      await renderDashboard(appEl, config);
    } catch {
      renderConfigPage(appEl, 'Invalid dashboard URL — please reconfigure.');
    }
  } else {
    renderConfigPage(appEl);
  }
}

window.addEventListener('popstate', bootstrap);
bootstrap();
