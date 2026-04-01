import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (pw !== pw2) { setError('Passwords do not match'); return; }
    if (pw.length < 6) { setError('Min 6 characters'); return; }
    setLoading(true);
    try {
      const d = await register(name.trim(), email, pw);
      localStorage.setItem('token', d.token);
      localStorage.setItem('email', d.email);
      localStorage.setItem('userName', d.name || name.trim());
      nav('/dashboard');
    } catch (err) { setError(err.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const inp = { background: '#0e0e0e', border: '1px solid rgba(72,72,71,0.4)', borderRadius: 9999, padding: '12px 18px', color: '#fff', fontSize: '0.88rem', outline: 'none', width: '100%' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e0e' }}>
      <div className="fade-in" style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 16, padding: '44px 38px', width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#00E5FF', marginBottom: 8, display: 'block' }}>database</span>
        <h1 className="font-headline" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>Create Account</h1>
        <p className="font-label" style={{ color: '#00E5FF', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>Join ClamkaBot</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required style={inp} />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          <input type="password" placeholder="Password (min 6)" value={pw} onChange={e => setPw(e.target.value)} required style={inp} />
          <input type="password" placeholder="Confirm Password" value={pw2} onChange={e => setPw2(e.target.value)} required style={inp} />
          {error && <p style={{ color: '#ff7351', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: '#00E5FF', color: '#00363d', border: 'none', borderRadius: 9999, padding: 12, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', marginTop: 6, fontFamily: "'Space Grotesk'" }}>
            {loading ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p style={{ marginTop: 22, color: '#767575', fontSize: '0.82rem' }}>
          Have an account? <Link to="/" style={{ color: '#00E5FF', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
