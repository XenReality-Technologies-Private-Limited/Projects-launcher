import './style.css';
import pb from './pb.js';
import { renderEmployeeLogin } from './employee-login.js';
import { renderProjectsPage } from './projects-page.js';

function boot() {
  const app = document.getElementById('app');
  if (pb.authStore.isValid) {
    const poc = pb.authStore.record?.poc;
    if (poc) { window.location.replace('/' + poc + '/'); return; }
    renderProjectsPage(app, () => { pb.authStore.clear(); boot(); });
  } else {
    renderEmployeeLogin(() => boot());
  }
}

boot();
