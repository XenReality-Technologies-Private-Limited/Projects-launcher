import { useEffect, useState } from 'react';

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
      </div>
    </header>
  );
}
