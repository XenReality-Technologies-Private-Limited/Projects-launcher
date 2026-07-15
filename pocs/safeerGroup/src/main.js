import './style.css';
import { requireAuth } from './login.js';
import { initDashboard } from './dashboard.js';

requireAuth(() => {
  const appEl = document.getElementById('app');
  initDashboard(appEl);
});
