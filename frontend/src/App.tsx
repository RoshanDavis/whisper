import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import API_URL from './utils/api';
import Login from './pages/Login';       
import Register from './pages/Register'; 
import Chat from './pages/Chat';
// import Settings from './pages/Settings';
import About from './pages/About';

const POLL_INTERVAL = 4000; // 4 s between health pings
const FETCH_TIMEOUT = 15000; // 15 s per attempt — must exceed backend's 10 s connectionTimeoutMillis

export default function App() {
  const { isAuthenticated } = useAuth();
  const [serverReady, setServerReady] = useState(false);

  // Smart-poll /api/health every 3 s until the backend + DB are both ready
  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const ping = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      try {
        const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (cancelled) return;
        if (res.ok) {
          setServerReady(true);
          return;
        }
      } catch {
        clearTimeout(timeout);
        if (cancelled) return;
      }

      // 503, network error, or timeout — schedule another ping
      timerId = setTimeout(ping, POLL_INTERVAL);
    };

    ping();
    return () => {
      cancelled = true;
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, []);

  if (!serverReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary-950 text-primary-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-400 border-t-transparent mb-4" />
        <p className="text-sm tracking-wide">Waking up secure server...</p>
        <p className="text-sm tracking-wide">The server needs to perform a cold start if its not already running. This may take 2-3 minutes. </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} />
      <Route path="/" element={isAuthenticated ? <Chat /> : <Navigate to="/login" replace />} />
      {/* <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" replace />} /> */}
      <Route path="/about" element={isAuthenticated ? <About /> : <Navigate to="/login" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}