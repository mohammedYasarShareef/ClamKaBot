import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const d = await login(email, password);
      localStorage.setItem('token', d.token);
      localStorage.setItem('email', d.email);
      localStorage.setItem('userName', d.name || d.email.split('@')[0]);
      nav('/dashboard');
    } catch (err) { setError(err.response?.data?.detail || 'Login failed'); }
    finally { setLoading(false); }
  };

  const inp = { background: '#0e0e0e', border: '1px solid rgba(72,72,71,0.4)', borderRadius: 9999, padding: '12px 18px', color: '#fff', fontSize: '0.88rem', outline: 'none', width: '100%' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e0e' }}>
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%)', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div className="fade-in" style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 16, padding: '44px 38px', width: '100%', maxWidth: 400, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#00E5FF', marginBottom: 8, display: 'block' }}>database</span>
        <h1 className="font-headline" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>ClamkaBot SQL</h1>
        <p className="font-label" style={{ color: '#00E5FF', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>Data Command Center</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
          {error && <p style={{ color: '#ff7351', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: '#00E5FF', color: '#00363d', border: 'none', borderRadius: 9999, padding: 12, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', marginTop: 6, fontFamily: "'Space Grotesk'" }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: 22, color: '#767575', fontSize: '0.82rem' }}>
          No account? <Link to="/register" style={{ color: '#00E5FF', textDecoration: 'none', fontWeight: 600 }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
