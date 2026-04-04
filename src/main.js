import './style.css';
import { renderConfigPage } from './config-page.js';
import { renderDashboard } from './dashboard-page.js';
import { decodeConfig } from './config-utils.js';

async function bootstrap() {
  const appEl = document.getElementById('app');
  const hash = window.location.hash;

  if (hash.startsWith('#dashboard/')) {
    const token = hash.slice('#dashboard/'.length);
    try {
      const config = decodeConfig(token);
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

window.addEventListener('hashchange', bootstrap);
bootstrap();
