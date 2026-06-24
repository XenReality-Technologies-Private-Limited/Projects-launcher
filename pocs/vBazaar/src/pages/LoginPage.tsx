import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LOGO = 'https://d108xxen99ni2a.cloudfront.net/XenRealitymark.webp';

export default function LoginPage() {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identity, password);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Open Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '44px 40px',
        width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8,
      }}>
        <img src={LOGO} alt="XenReality" style={{ height: 44, objectFit: 'contain', marginBottom: 8 }} />
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>V Bazaar</h1>
        <p style={{ margin: '0 0 16px', fontSize: '.85rem', color: '#64748b' }}>Sign in to view the dashboard</p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
              Username or Email
            </label>
            <input
              type="text"
              value={identity}
              onChange={e => setIdentity(e.target.value)}
              autoComplete="username"
              required
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '.9rem', fontFamily: 'inherit', color: '#0f172a', background: '#f1f5f9', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '.9rem', fontFamily: 'inherit', color: '#0f172a', background: '#f1f5f9', outline: 'none' }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: '.82rem', color: '#ef4444', textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 11, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 9, fontSize: '.95rem', fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
