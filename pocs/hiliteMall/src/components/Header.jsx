import { useEffect, useState } from 'react';
import pb from '../pb.js';

function handleSignOut() {
  pb.authStore.clear();
  window.location.reload();
}

export default function Header() {
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const update = () => {
      setClock(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="dashboard-header">
      <div className="header-logo">
        <img src="/xenlogo.png" alt="XenReality" className="header-logo-img" />
      </div>
      <div className="header-center">
        <span className="header-title">HILITE MALL PoC DASHBOARD</span>
      </div>
      <div className="header-right">
        <span className="header-status">SYSTEM ONLINE</span>
        <span className="header-clock">{clock} IST</span>
        <button className="header-signout" title="Sign out" onClick={handleSignOut}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
