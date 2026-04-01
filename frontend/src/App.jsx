import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './pages/Dashboard';
import DbExplorer from './pages/DbExplorer';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cyan: #00E5FF;
          --bg: #0e0e0e;
          --bg-card: #1a1a1a;
          --bg-elevated: #202020;
          --bg-hover: #262626;
          --border: #484847;
          --border-dim: rgba(72,72,71,0.3);
          --text: #ffffff;
          --text-sub: #adaaaa;
          --text-dim: #767575;
          --error: #ff7351;
          --green: #4ade80;
        }
        body {
          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
          min-height: 100vh;
        }
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        ::selection { background: rgba(0,229,255,0.25); color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #484847; border-radius: 10px; }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .fade-in { animation: fadeSlideIn 0.4s ease forwards; }
      `}</style>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/db" element={<ProtectedRoute><DbExplorer /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
