import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbTables, getDbTableData, getDbSchema } from '../api';

export default function DbExplorer() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSchema, setShowSchema] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([getDbTables(), getDbSchema()])
      .then(([t, s]) => { setTables(t.tables || []); setSchemas(s.schemas || []); if (t.tables?.length) load(t.tables[0].name); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const load = async (name, p = 1) => {
    setActive(name); setPage(p);
    try { setData(await getDbTableData(name, p)); } catch { setData(null); }
  };

  const pages = data ? Math.ceil(data.total / data.limit) : 0;
  const btn = { background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.3)', color: '#adaaaa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: "'Space Grotesk'" };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0e0e0e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid rgba(72,72,71,0.2)', background: '#0e0e0e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#00E5FF', fontSize: 22 }}>storage</span>
          <h1 className="font-headline" style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>SQLite Explorer</h1>
          <span style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 4, padding: '1px 8px', color: '#00E5FF', fontSize: '0.6rem', fontWeight: 700, fontFamily: "'Manrope'" }}>
            {tables.length} tables · {tables.reduce((s, t) => s + t.row_count, 0)} rows
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSchema(s => !s)} style={btn}>{showSchema ? '📊 Data' : '📜 Schema'}</button>
          <button onClick={() => nav('/dashboard')} style={btn}>← Dashboard</button>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 200, borderRight: '1px solid rgba(72,72,71,0.2)', background: '#131313', overflowY: 'auto', padding: '10px 0' }}>
          <div className="font-label" style={{ color: '#767575', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 16px' }}>Tables</div>
          {tables.map(t => (
            <div key={t.name} onClick={() => { load(t.name); setShowSchema(false); }}
              style={{ padding: '8px 16px', cursor: 'pointer', borderLeft: active === t.name ? '3px solid #00E5FF' : '3px solid transparent', background: active === t.name ? 'rgba(0,229,255,0.04)' : 'transparent' }}>
              <div className="font-mono" style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{t.name}</div>
              <div style={{ color: '#767575', fontSize: '0.65rem' }}>{t.row_count} rows</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && <p style={{ color: '#767575' }}>Loading…</p>}
          {showSchema ? schemas.map(s => (
            <div key={s.table} style={{ background: '#1a1a1a', border: '1px solid rgba(72,72,71,0.2)', borderLeft: '3px solid #00E5FF', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div className="font-mono" style={{ color: '#00E5FF', fontWeight: 700, fontSize: '0.82rem', marginBottom: 8 }}>{s.table}</div>
              <pre className="font-mono" style={{ background: '#0e0e0e', border: '1px solid rgba(72,72,71,0.2)', borderRadius: 6, padding: 12, fontSize: '0.73rem', color: '#adaaaa', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{s.sql}</pre>
            </div>
          )) : data && (
            <>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="font-headline" style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{data.table}</h2>
                <span style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 4, padding: '2px 8px', color: '#00E5FF', fontSize: '0.65rem', fontWeight: 700, fontFamily: "'Manrope'" }}>{data.total} records</span>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid rgba(72,72,71,0.2)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{data.columns.map(c => <th key={c} style={{ padding: '9px 14px', textAlign: 'left', color: '#00E5FF', borderBottom: '1px solid rgba(72,72,71,0.4)', fontWeight: 700, background: 'rgba(0,229,255,0.06)', fontFamily: "'Manrope'", fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
                  <tbody>{data.rows.map((r, i) => <tr key={i}>{data.columns.map(c => <td key={c} style={{ padding: '8px 14px', color: '#fff', borderBottom: '1px solid rgba(72,72,71,0.15)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r[c] != null ? String(r[c]).slice(0, 80) : '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14, alignItems: 'center' }}>
                <button onClick={() => load(active, page - 1)} disabled={page <= 1} style={btn}>← Prev</button>
                <span style={{ color: '#adaaaa', fontSize: '0.8rem' }}>Page {page}/{pages}</span>
                <button onClick={() => load(active, page + 1)} disabled={page >= pages} style={btn}>Next →</button>
              </div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
