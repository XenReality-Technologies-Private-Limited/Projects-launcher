import pb from './pb.js';

export function renderEmployeeLogin(onSuccess) {
  const el = document.createElement('div');
  el.className = 'login-overlay';
  el.innerHTML = `
    <div class="login-box">
      <img src="/xenlogo.png" alt="XenReality" class="login-logo" />
      <h1 class="login-title">XenReality Projects</h1>
      <p class="login-subtitle">Sign in with your XenReality account</p>
      <form id="login-form" class="login-form" novalidate>
        <div class="login-field">
          <label for="login-email">Username or Email</label>
          <input id="login-email" type="text" autocomplete="username" required />
        </div>
        <div class="login-field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" autocomplete="current-password" required />
        </div>
        <p id="login-error" class="login-error hidden"></p>
        <button type="submit" class="login-btn" id="login-btn">Sign in</button>
      </form>
    </div>
  `;
  document.body.appendChild(el);

  const form   = el.querySelector('#login-form');
  const errMsg = el.querySelector('#login-error');
  const btn    = el.querySelector('#login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identity = el.querySelector('#login-email').value.trim();
    const password = el.querySelector('#login-password').value;
    errMsg.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await pb.collection('xr_employees').authWithPassword(identity, password);
      el.remove();
      onSuccess();
    } catch {
      errMsg.textContent = 'Invalid credentials. Please try again.';
      errMsg.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}
