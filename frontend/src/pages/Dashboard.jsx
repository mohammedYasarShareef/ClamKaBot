import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDataset, generateQuery, runQuery, exportPDF, exportDOCX, getHistory, searchHistory, getNotificationCount, clearNotifications, getArtifacts, suggest } from '../api';

const MI = ({ icon, fill, size }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size || 20, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
);

// ═══ STARFIELD ═══
function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    for (let i = 0; i < 600; i++) {
      const s = document.createElement('div');
      const r = Math.random();
      const sz = r < 0.55 ? 1 : r < 0.85 ? 1.5 : r < 0.97 ? 2 : 3;
      Object.assign(s.style, { position: 'absolute', borderRadius: '50%', width: sz + 'px', height: sz + 'px', opacity: r < 0.55 ? 0.45 : r < 0.85 ? 0.7 : r < 0.97 ? 0.9 : 1, top: Math.random() * 100 + '%', left: Math.random() * 100 + '%', background: Math.random() < 0.14 ? 'rgba(0,255,255,0.6)' : 'rgba(255,255,255,0.7)', pointerEvents: 'none' });
      if (Math.random() < 0.22) { s.style.animation = `twinkle ${1.5 + Math.random() * 4}s ease-in-out infinite`; s.style.animationDelay = Math.random() * 6 + 's'; }
      el.appendChild(s);
    }
    const shoot = () => { const e = document.createElement('div'); const a = -20 + Math.random() * -20, l = 80 + Math.random() * 120, dx = Math.cos(a * Math.PI / 180) * l, dy = Math.sin(a * Math.PI / 180) * l, dur = 0.5 + Math.random() * 0.5; Object.assign(e.style, { position: 'absolute', height: '1.5px', borderRadius: '1px', background: 'linear-gradient(90deg,rgba(0,255,255,0.9),transparent)', pointerEvents: 'none', zIndex: '1', width: l + 'px', top: Math.random() * 70 + '%', left: Math.random() * 80 + '%' }); e.style.animation = `shoot ${dur}s ease-out forwards`; e.style.setProperty('--shoot-angle', a + 'deg'); e.style.setProperty('--shoot-dx', dx + 'px'); e.style.setProperty('--shoot-dy', dy + 'px'); el.appendChild(e); setTimeout(() => e.remove(), dur * 1000 + 100); };
    const sched = () => { shoot(); setTimeout(sched, 4000 + Math.random() * 5000); };
    const t = setTimeout(sched, 2000 + Math.random() * 3000);
    return () => clearTimeout(t);
  }, []);
  return <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} />;
}

// ═══ CURSOR ORB — follows mouse across ENTIRE page, turns black inside sidebar ═══
function CursorOrb() {
  const spotRef = useRef(null);
  const dotRef = useRef(null);
  useEffect(() => {
    const move = (e) => {
      if (spotRef.current) { spotRef.current.style.left = e.clientX + 'px'; spotRef.current.style.top = e.clientY + 'px'; spotRef.current.style.opacity = '1'; }
      if (dotRef.current) { dotRef.current.style.left = e.clientX + 'px'; dotRef.current.style.top = e.clientY + 'px'; dotRef.current.style.opacity = '1'; }

      // Detect if cursor is over the sidebar and switch colours smoothly
      const sidebar = document.getElementById('cyan-sidebar');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        const inSidebar = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (dotRef.current) {
          dotRef.current.style.background = inSidebar ? '#000000' : '#00FFFF';
          dotRef.current.style.boxShadow = inSidebar
            ? '0 0 6px 2px rgba(0,0,0,0.5)'
            : '0 0 6px 2px rgba(0,255,255,0.8)';
        }
        if (spotRef.current) {
          spotRef.current.style.background = inSidebar
            ? 'radial-gradient(circle,rgba(0,0,0,0.45) 0%,rgba(0,0,0,0.20) 35%,rgba(0,0,0,0.06) 65%,transparent 100%)'
            : 'radial-gradient(circle,rgba(255,255,255,0.55) 0%,rgba(0,255,255,0.30) 35%,rgba(0,255,255,0.10) 65%,transparent 100%)';
          spotRef.current.style.boxShadow = inSidebar
            ? '0 0 8px 4px rgba(0,0,0,0.22),0 0 18px 6px rgba(0,0,0,0.10)'
            : '0 0 8px 4px rgba(0,255,255,0.18),0 0 18px 6px rgba(0,255,255,0.08)';
          spotRef.current.style.mixBlendMode = inSidebar ? 'multiply' : 'screen';
        }
      }
    };
    const leave = () => { if (spotRef.current) spotRef.current.style.opacity = '0'; if (dotRef.current) dotRef.current.style.opacity = '0'; };
    const down = () => { if (dotRef.current) dotRef.current.style.transform = 'translate(-50%,-50%) scale(2)'; };
    const up = () => { if (dotRef.current) dotRef.current.style.transform = 'translate(-50%,-50%) scale(1)'; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseleave', leave);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseleave', leave); document.removeEventListener('mousedown', down); document.removeEventListener('mouseup', up); };
  }, []);
  return (<>
    <div ref={spotRef} style={{ position: 'fixed', width: 38, height: 38, borderRadius: '50%', mixBlendMode: 'screen', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 9998, opacity: 0, transition: 'opacity 0.15s, background 0.2s, box-shadow 0.2s', background: 'radial-gradient(circle,rgba(255,255,255,0.55) 0%,rgba(0,255,255,0.30) 35%,rgba(0,255,255,0.10) 65%,transparent 100%)', boxShadow: '0 0 8px 4px rgba(0,255,255,0.18),0 0 18px 6px rgba(0,255,255,0.08)' }} />
    <div ref={dotRef} style={{ position: 'fixed', width: 5, height: 5, borderRadius: '50%', background: '#00FFFF', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px 2px rgba(0,255,255,0.8)', transition: 'transform 0.05s, background 0.2s, box-shadow 0.2s', opacity: 0 }} />
  </>);
}

export default function Dashboard() {
  const nav = useNavigate();
  const email = localStorage.getItem('email') || 'User';
  const userName = localStorage.getItem('userName') || email.split('@')[0];
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  const [tableName, setTableName] = useState('');
  const [preview, setPreview] = useState(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchTimer = useRef(null);
  const [badge, setBadge] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [artifactsList, setArtifactsList] = useState([]);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef(null);
  // Sidebar toggle state (hidden by default, toggle on button click)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Voice state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => { loadHist(); getNotificationCount().then(d => setBadge(d.count)).catch(() => { }); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const h = (e) => { if (!e.target.closest('#notif-area')) setNotifOpen(false); if (!e.target.closest('#settings-area')) setSettingsOpen(false); if (!e.target.closest('#search-area')) setShowSearchDrop(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Voice-to-text setup (Web Speech API) ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = false;
      r.interimResults = false;
      r.lang = 'en-US';
      r.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setQuestion(prev => prev ? prev + ' ' + text : text);
        setListening(false);
      };
      r.onerror = () => setListening(false);
      r.onend = () => setListening(false);
      recognitionRef.current = r;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) { alert('Voice input not supported in this browser. Use Chrome or Edge.'); return; }
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else { recognitionRef.current.start(); setListening(true); }
  };

  const loadHist = () => getHistory().then(d => setHistory(d.queries || [])).catch(() => { });
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('email'); localStorage.removeItem('userName'); nav('/'); };
  const addMsg = (type, text, data) => setMessages(p => [...p, { type, text, data }]);
  const upload = async (e) => { const file = e.target.files[0]; if (!file) return; setUploading(true); const fd = new FormData(); fd.append('file', file); try { const d = await uploadDataset(fd); setTableName(d.table_name); setPreview(d.preview); addMsg('system', `Uploaded "${file.name}" → ${d.table_name} (${d.row_count} rows)`); } catch (err) { addMsg('error', err.response?.data?.detail || 'Upload failed'); } setUploading(false); };
  const generate = async (q) => { const query = q || question; if (!query.trim()) return; setQuestion(''); setShowSuggestions(false); addMsg('user', query); setGenerating(true); try { const d = await generateQuery(query, tableName || ''); if (d.is_syntax) { addMsg('syntax', null, d); } else { addMsg('result', null, d); loadHist(); getNotificationCount().then(d => setBadge(d.count)).catch(() => { }); } } catch (err) { const msg = err.response?.data?.detail || 'Generation failed'; addMsg('error', msg); } setGenerating(false); }; const runQ = async (id) => { try { const d = await runQuery(id, tableName); addMsg('run', null, d); } catch (err) { addMsg('error', err.response?.data?.detail || 'Run failed'); } };
  const doExport = async (id, fmt) => { try { const blob = fmt === 'pdf' ? await exportPDF(id) : await exportDOCX(id); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `query_${id}.${fmt}`; a.click(); } catch { alert('Export failed'); } };
  const handleSearch = (val) => { setSearchQ(val); clearTimeout(searchTimer.current); if (val.length < 2) { setSearchResults([]); setShowSearchDrop(false); return; } searchTimer.current = setTimeout(async () => { try { const d = await searchHistory(val); setSearchResults(d.results || []); setShowSearchDrop((d.results || []).length > 0); } catch (_) { setSearchResults([]); setShowSearchDrop(false); } }, 300); };
  const handleQuestionChange = (val) => { setQuestion(val); clearTimeout(suggestTimer.current); if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; } if (!tableName) { setSuggestions([]); setShowSuggestions(false); return; } suggestTimer.current = setTimeout(async () => { try { const d = await suggest(val, tableName); const s = d.suggestions || []; setSuggestions(s); setShowSuggestions(s.length > 0); } catch (_) { setSuggestions([]); setShowSuggestions(false); } }, 250); }; const openNotif = async () => { setNotifOpen(o => !o); setSettingsOpen(false); if (!notifOpen) { try { const d = await getHistory(); setNotifItems((d.queries || []).slice(0, 8)); } catch { } clearNotifications().catch(() => { }); setBadge(0); } };
  const openArtifacts = async () => { setSettingsOpen(false); setShowArtifacts(true); try { const d = await getArtifacts(); setArtifactsList(d.artifacts || []); } catch { } };
  const examples = ['Show all employees who joined after 2020', 'What is the average salary by department?', 'List the top 5 highest paid employees', 'How many employees are in each department?'];

  return (
    <div style={{ display: 'block', height: '100vh', overflow: 'hidden', cursor: 'none', position: 'relative' }}>
      <CursorOrb />
      <style>{`
        @keyframes twinkle{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes shoot{0%{transform:translateX(0) translateY(0) rotate(var(--shoot-angle));opacity:1}100%{transform:translateX(var(--shoot-dx)) translateY(var(--shoot-dy)) rotate(var(--shoot-angle));opacity:0}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.6);opacity:0}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,60,60,0.4)}50%{box-shadow:0 0 0 8px rgba(255,60,60,0)}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        *, *::before, *::after { cursor: none !important; }
        .result-table th{background:rgba(0,229,255,0.08);color:rgb(12,172,175);font-family:'Manrope';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:10px 16px;border-bottom:1px solid rgba(72,72,71,0.4);white-space:nowrap}
        .result-table td{padding:10px 16px;font-size:13px;color:#fff;border-bottom:1px solid rgba(72,72,71,0.15);white-space:nowrap}
        .result-table tr:last-child td{border-bottom:none}
        .result-table tr:hover td{background:rgba(0,229,255,0.04)}
        .hover-glow:hover{color:#00E5FF !important;filter:drop-shadow(0 0 6px rgba(0,229,255,0.5))}
        .search-glow:focus-within{border-color:rgba(0,229,255,0.5) !important;box-shadow:0 0 12px rgba(0,229,255,0.15)}
        .sidebar-overlay{display:none}
        @media(max-width:768px){
          .sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:49}
          .search-input-full{width:110px !important}
          .chat-main-padding{padding:24px 16px 140px !important}
          .input-bar-padding{padding:0 10px !important}
          .example-grid{grid-template-columns:1fr !important}
          .result-table th,.result-table td{padding:7px 8px !important;font-size:11px !important}
        }
      `}</style>

      {/* ═══ SIDEBAR BACKDROP (click outside to close) ═══ */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 48 }} />}

      {/* ═══ CYAN SIDEBAR ═══ */}
      <aside id="cyan-sidebar" style={{ width: 270, minWidth: 240, maxWidth: 300, background: '#00FFFF', display: 'flex', flexDirection: 'column', padding: '32px 0', boxShadow: '4px 0 24px rgba(0,255,255,0.35)', zIndex: 50, flexShrink: 0, cursor: 'default', position: 'fixed', top: 0, left: 0, height: '100vh', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '0 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#164e63', border: '2px solid #155e75', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E5FF', fontWeight: 800, fontSize: '0.9rem', fontFamily: "'Space Grotesk'" }}>{userName[0]?.toUpperCase()}</div>
            <p className="font-headline" style={{ fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#003d41', lineHeight: 1.2 }}>{userName}</p>
          </div>
        </div>
        <p className="font-headline" style={{ padding: '0 24px', marginBottom: 12, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#005c62', opacity: 0.7 }}>Recent Commands</p>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {history.slice(0, 20).map((h, i) => (<div key={h.id} onClick={() => addMsg('result', null, h)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, cursor: 'none', margin: '2px 0', transition: 'all 0.15s', color: i === 0 ? '#003d41' : '#005c62', background: i === 0 ? 'rgba(0,60,70,0.18)' : 'transparent', opacity: i === 0 ? 1 : 0.75 }} onMouseEnter={e => { if (i !== 0) e.currentTarget.style.background = 'rgba(0,180,180,0.3)'; }} onMouseLeave={e => { if (i !== 0) e.currentTarget.style.background = 'transparent'; }}>
            <MI icon="history" size={16} /><span className="font-headline" style={{ fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nl_query}</span>
          </div>))}
          {history.length === 0 && <p style={{ color: '#005c62', fontSize: '0.75rem', padding: '12px 16px', opacity: 0.6 }}>No history yet</p>}
        </div>
        <div style={{ borderTop: '1px solid rgba(0,180,180,0.25)', padding: '16px 16px 0' }}>
          <button onClick={logout} style={{ width: '100%', background: 'none', border: 'none', color: '#003d41', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, transition: 'all 0.15s' }}><MI icon="logout" fill size={18} /> Logout</button>
        </div>
      </aside>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: '#000', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
        <Starfield />
        <div style={{ position: 'absolute', width: 420, height: 420, top: '-10%', left: '10%', background: 'rgba(0,255,255,0.04)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: 300, height: 300, bottom: '15%', right: '5%', background: 'rgba(0,200,255,0.03)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: 200, height: 200, top: '50%', left: '40%', background: 'rgba(0,255,200,0.025)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Top bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 0 20px', height: 56, background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 40, flexShrink: 0 }}>
          {/* ═══ HAMBURGER BUTTON ═══ */}
          <button onClick={() => setSidebarOpen(o => !o)} className="hover-glow" style={{ width: 36, height: 36, borderRadius: 8, background: 'none', border: 'none', color: '#767575', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0, padding: 0 }}>
            <span style={{ display: 'block', width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform 0.2s, opacity 0.2s', transform: sidebarOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'opacity 0.2s', opacity: sidebarOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform 0.2s, opacity 0.2s', transform: sidebarOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div id="search-area" style={{ position: 'relative' }}>
              <div className="search-glow" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#20201f', border: '1px solid transparent', borderRadius: 9999, padding: '5px 12px', transition: 'all 0.2s' }}>
                <MI icon="search" size={16} /><input value={searchQ} onChange={e => handleSearch(e.target.value)} onFocus={() => { if (searchResults.length > 0) setShowSearchDrop(true); }} placeholder="Search history…" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.82rem', outline: 'none', width: 180, fontFamily: "'Inter'", maxWidth: '40vw' }} />
              </div>
              {showSearchDrop && searchResults.length > 0 && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 360, background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 12, maxHeight: 320, overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 999 }}>
                <div className="font-label" style={{ padding: '10px 16px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767575', borderBottom: '1px solid rgba(72,72,71,0.2)' }}>Search Results</div>
                {searchResults.map(r => (<div key={r.id} onClick={() => { addMsg('result', null, r); setShowSearchDrop(false); setSearchQ(''); }} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(72,72,71,0.1)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><div style={{ color: '#adaaaa', fontSize: '0.8rem' }}>{r.nl_query}</div><div className="font-mono" style={{ color: '#767575', fontSize: '0.68rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sql_query}</div></div>))}
              </div>)}
            </div>
            <div id="notif-area" style={{ position: 'relative' }}>
              <button onClick={openNotif} className="hover-glow" style={{ ...topBtn, position: 'relative' }}><MI icon="notifications" size={18} />{badge > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#ff7351', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: '0.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>}</button>
              {notifOpen && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340, background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 999, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(72,72,71,0.2)' }}><span className="font-headline" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>Notifications</span><span className="font-label" style={{ fontSize: '0.6rem', fontWeight: 700, color: '#00E5FF', letterSpacing: '0.08em' }}>{notifItems.length} QUERIES</span></div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>{notifItems.length === 0 && <p style={{ padding: 20, color: '#767575', fontSize: '0.82rem', textAlign: 'center' }}>No new notifications</p>}{notifItems.map(n => (<div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(72,72,71,0.1)', display: 'flex', gap: 10, alignItems: 'flex-start' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,229,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}><MI icon="auto_awesome" fill size={14} /></div><div style={{ flex: 1, minWidth: 0 }}><p style={{ color: '#adaaaa', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.nl_query}</p><p className="font-mono" style={{ color: '#767575', fontSize: '0.65rem', marginTop: 2 }}>{n.intent}·{n.table_name}</p></div></div>))}</div>
              </div>)}
            </div>
            <div id="settings-area" style={{ position: 'relative' }}>
              <button onClick={() => { setSettingsOpen(o => !o); setNotifOpen(false); }} className="hover-glow" style={topBtn}><MI icon="settings" size={18} /></button>
              {settingsOpen && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 200, background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 999, overflow: 'hidden' }}>
                {[{ icon: 'folder_open', label: 'Artifacts Created', action: openArtifacts }, { icon: 'palette', label: 'Theme', action: () => { setSettingsOpen(false); alert('Dark theme active.'); } }, { icon: 'help', label: 'Help', action: () => { setSettingsOpen(false); alert('ClamkaBot v4.1 — NL→SQL. Upload CSV, ask in English, get SQL.'); } }, { icon: 'info', label: 'About', action: () => { setSettingsOpen(false); alert('ClamkaBot v4.1\nFastAPI+React+SQLite\nMistral Small 3.1'); } }].map((item, i) => (<div key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', transition: 'background 0.15s', color: '#adaaaa', fontSize: '0.82rem' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><MI icon={item.icon} size={18} />{item.label}</div>))}
              </div>)}
            </div>
          </div>
        </header>

        {/* Artifacts modal */}
        {showArtifacts && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowArtifacts(false)}><div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 16, width: '90%', maxWidth: 500, maxHeight: '70vh', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(72,72,71,0.2)' }}><span className="font-headline" style={{ fontWeight: 700, color: '#fff' }}>Artifacts Created</span><button onClick={() => setShowArtifacts(false)} style={{ background: 'none', border: 'none', color: '#767575', fontSize: '1.2rem' }}>✕</button></div>
          <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '12px 20px' }}>{artifactsList.length === 0 && <p style={{ color: '#767575', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>No artifacts yet.</p>}{artifactsList.map(a => (<div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(72,72,71,0.1)' }}><MI icon={a.format === 'pdf' ? 'picture_as_pdf' : 'description'} size={18} /><div style={{ flex: 1 }}><div style={{ color: '#adaaaa', fontSize: '0.82rem' }}>{a.filename}</div><div className="font-mono" style={{ color: '#767575', fontSize: '0.65rem' }}>{a.format.toUpperCase()}·{a.created_at?.slice(0, 16)}</div></div></div>))}</div>
        </div></div>)}

        {/* Chat area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px,4vw,48px) clamp(16px,4vw,48px) 140px', position: 'relative', zIndex: 10 }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {!tableName && (<div className="fade-in" style={{ textAlign: 'center', marginTop: 60 }}><input type="file" ref={fileRef} accept=".csv,.xlsx,.xls" onChange={upload} style={{ display: 'none' }} /><button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'rgba(0,229,255,0.05)', border: '1px dashed rgba(0,229,255,0.2)', borderRadius: 16, padding: '28px 48px', color: '#00E5FF', fontSize: '0.9rem', fontWeight: 600, fontFamily: "'Space Grotesk'" }}><MI icon="cloud_upload" size={28} /><br />{uploading ? 'Uploading…' : 'Upload CSV / Excel to begin'}</button></div>)}
            {tableName && messages.length === 0 && (<div className="fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><MI icon="database" fill size={28} /></div>
              <h2 className="font-headline" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>Ready to query</h2>
              <p style={{ color: '#adaaaa', fontSize: '0.88rem', maxWidth: 420, margin: '0 auto 32px' }}>Type a natural language question below and the AI will generate and execute the SQL for you.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, maxWidth: 520, margin: '0 auto' }}>{examples.map((ex, i) => (<div key={i} onClick={() => generate(ex)} style={{ background: 'rgba(32,32,32,0.8)', border: '1px solid rgba(72,72,71,0.2)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; e.currentTarget.style.background = 'rgba(0,229,255,0.04)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(72,72,71,0.2)'; e.currentTarget.style.background = 'rgba(32,32,32,0.8)'; }}><p className="font-label" style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00E5FF', marginBottom: 3 }}>Example</p><p style={{ fontSize: '0.8rem', color: '#adaaaa' }}>{ex}</p></div>))}</div>
              <div style={{ marginTop: 20 }}><span className="font-mono" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 9999, padding: '4px 14px', color: '#00E5FF', fontSize: '0.7rem', fontWeight: 600 }}>✓ {tableName} loaded</span></div>
            </div>)}

            {/* Messages */}
            {messages.map((m, i) => (<div key={i} style={{ marginBottom: 32 }} className="fade-in">
              {m.type === 'user' && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#262626', border: '1px solid rgba(72,72,71,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="person" size={20} /></div><div style={{ paddingTop: 6 }}><h2 className="font-headline" style={{ fontSize: '1.3rem', fontWeight: 500, color: '#fff', marginBottom: 4 }}>{m.text}</h2><p className="font-label" style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767575' }}>just now · SQLite Context</p></div></div>)}
              {m.type === 'system' && (<div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: '#00E5FF', fontSize: '0.8rem', padding: 10, background: 'rgba(0,229,255,0.04)', borderRadius: 8, border: '1px solid rgba(0,229,255,0.1)' }}><MI icon="check_circle" fill size={16} />{m.text}</div>)}
              {m.type === 'syntax' && m.data && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="code" fill size={20} /></div><div style={{ flex: 1 }}><div style={{ background: 'rgba(38,38,38,0.9)', backdropFilter: 'blur(20px)', borderRadius: 12, padding: 28, border: '1px solid rgba(72,72,71,0.08)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><span className="font-headline" style={{ fontSize: '1rem', fontWeight: 700, color: '#00E5FF' }}>SQL Syntax Template</span><div style={{ flex: 1, height: 1, background: 'rgba(72,72,71,0.2)' }} /><span className="font-label" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,190,46,0.1)', color: '#ffbe2e', border: '1px solid rgba(255,190,46,0.2)' }}>NO DATASET</span></div><pre className="font-mono" style={{ background: '#000', borderRadius: 8, padding: 20, fontSize: '0.85rem', color: '#ffbe2e', overflowX: 'auto', border: '1px solid rgba(72,72,71,0.1)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{m.data.sql_query}</pre><p style={{ color: '#767575', fontSize: '0.78rem', marginTop: 12 }}>Upload a dataset to get the actual query with your column names.</p></div></div></div>)}
              {m.type === 'error' && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#b92902', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="error" size={20} /></div><div style={{ background: 'rgba(26,26,26,0.9)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,115,81,0.2)', flex: 1 }}><span className="font-headline" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff7351' }}>Error</span><p style={{ color: '#adaaaa', fontSize: '0.85rem', marginTop: 4 }}>{m.text}</p></div></div>)}
              {m.type === 'result' && m.data && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="auto_awesome" fill size={20} /></div><div style={{ flex: 1 }}>
                <div style={{ background: 'rgba(38,38,38,0.9)', backdropFilter: 'blur(20px)', borderRadius: 12, padding: 28, border: '1px solid rgba(72,72,71,0.08)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 12, right: 12, opacity: 0.1, pointerEvents: 'none' }}><MI icon="database" size={72} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}><span className="font-headline" style={{ fontSize: '1rem', fontWeight: 700, color: '#00E5FF' }}>Query Artifact</span><div style={{ flex: 1, height: 1, background: 'rgba(72,72,71,0.2)' }} />{m.data.intent && <span className="font-label" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#262626', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.data.intent}</span>}</div>
                  <pre className="font-mono" style={{ background: '#000', borderRadius: 8, padding: 20, fontSize: '0.82rem', color: '#00E5FF', overflowX: 'auto', border: '1px solid rgba(72,72,71,0.1)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '0 0 12px' }}>{m.data.sql_query}</pre>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 20 }}>
                    <button onClick={() => navigator.clipboard.writeText(m.data.sql_query)} style={actionBtn}><MI icon="content_copy" size={14} /> Copy</button>
                    <button onClick={() => doExport(m.data.id, 'pdf')} style={actionBtn}><MI icon="picture_as_pdf" size={14} /> PDF</button>
                    <button onClick={() => doExport(m.data.id, 'docx')} style={actionBtn}><MI icon="description" size={14} /> Doc</button>
                    <button onClick={() => runQ(m.data.id)} style={{ ...actionBtn, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', color: '#00E5FF' }}><MI icon="play_arrow" fill size={14} /> Run</button>
                  </div>
                </div>
              </div></div>)}
              {m.type === 'run' && m.data && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="table_chart" fill size={20} /></div><div style={{ flex: 1, background: 'rgba(38,38,38,0.9)', backdropFilter: 'blur(20px)', borderRadius: 12, border: '1px solid rgba(72,72,71,0.08)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid rgba(72,72,71,0.15)' }}><span className="font-headline" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00E5FF' }}>Results</span><div style={{ flex: 1, height: 1, background: 'rgba(72,72,71,0.2)' }} /><span className="font-label" style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#262626', color: '#adaaaa' }}>{m.data.row_count} rows·{m.data.exec_ms}ms</span></div>
                <div style={{ overflowX: 'auto' }}><table className="result-table" style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{m.data.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{m.data.results.slice(0, 30).map((r, ri) => <tr key={ri}>{m.data.columns.map(c => <td key={c}>{r[c] ?? '—'}</td>)}</tr>)}</tbody></table></div>
              </div></div>)}
            </div>))}
            {generating && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }} className="fade-in"><div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI icon="auto_awesome" fill size={20} /></div><div style={{ paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ display: 'flex', gap: 5 }}>{[0, 150, 300].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#00E5FF', animation: 'pulseRing 0.6s ease-in-out infinite', animationDelay: d + 'ms' }} />)}</div><span className="font-label" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767575' }}>Generating SQL…</span></div></div>)}
            <div ref={chatEndRef} />
          </div>
        </main>

        {/* ═══ FLOATING INPUT BAR WITH MIC BUTTON ═══ */}
        {(<div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 720, padding: '0 24px', zIndex: 20 }}>
          {showSuggestions && suggestions.length > 0 && (<div style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', borderRadius: 12, marginBottom: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 -8px 30px rgba(0,0,0,0.4)' }}>
            <div className="font-label" style={{ padding: '8px 16px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767575', borderBottom: '1px solid rgba(72,72,71,0.2)' }}>Suggestions</div>
            {suggestions.map(s => (<div key={s.id} onClick={() => { setQuestion(s.nl_query); setShowSuggestions(false); }} style={{ padding: '8px 16px', borderBottom: '1px solid rgba(72,72,71,0.1)', transition: 'background 0.15s', display: 'flex', justifyContent: 'space-between' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><span style={{ color: '#adaaaa', fontSize: '0.8rem' }}>{s.nl_query}</span><span className="font-mono" style={{ color: '#767575', fontSize: '0.65rem' }}>{(s.score * 100).toFixed(0)}%</span></div>))}
          </div>)}
          <div style={{ background: 'rgba(19,19,19,0.8)', backdropFilter: 'blur(30px)', borderRadius: 9999, border: '1px solid rgba(72,72,71,0.1)', padding: 6, display: 'flex', alignItems: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', transition: 'border-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,229,255,0.5)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(72,72,71,0.1)'}>
            <input type="file" ref={fileRef} accept=".csv,.xlsx,.xls" onChange={upload} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} className="hover-glow" style={{ width: 40, height: 40, borderRadius: '50%', background: 'none', border: 'none', color: '#767575', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI icon="add" size={22} /></button>
            <input value={question} onChange={e => handleQuestionChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); } }} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Ask something about your data…" style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '0.88rem', outline: 'none', padding: '0 12px', fontFamily: "'Inter'" }} />
            {/* ── MIC BUTTON ── */}
            <button onClick={toggleVoice} className="hover-glow" style={{ width: 40, height: 40, borderRadius: '50%', background: 'none', border: 'none', color: listening ? '#ff4444' : '#767575', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', animation: listening ? 'micPulse 1.5s ease infinite' : 'none' }}>
              <MI icon={listening ? 'mic' : 'mic'} fill={listening} size={20} />
            </button>
            <button onClick={() => generate()} disabled={generating || !question.trim()} style={{ width: 40, height: 40, borderRadius: '50%', background: question.trim() ? '#00E5FF' : '#262626', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s', color: question.trim() ? '#00363d' : '#767575' }}><MI icon="arrow_upward" size={20} /></button>
          </div>
        </div>)}
      </div>
    </div>
  );
}

const topBtn = { padding: 7, color: '#767575', background: 'none', border: 'none', borderRadius: 8, transition: 'color 0.15s' };
const actionBtn = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9999, background: 'none', border: 'none', color: '#767575', fontSize: '0.7rem', fontWeight: 700, fontFamily: "'Manrope'", transition: 'color 0.15s' };