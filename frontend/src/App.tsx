import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import API_URL from './utils/api';
import Login from './pages/Login';       
import Register from './pages/Register'; 
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import About from './pages/About';

export default function App() {
  const { isAuthenticated } = useAuth();
  const [serverReady, setServerReady] = useState(false);

  // Ping the health endpoint on mount to wake the serverless backend
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        if (!cancelled && res.ok) setServerReady(true);
      } catch {
        // Retry after a short delay on failure (cold start can take a few seconds)
        if (!cancelled) setTimeout(ping, 2000);
      }
    };

    ping();
    return () => { cancelled = true; };
  }, []);

  if (!serverReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary-950 text-primary-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-400 border-t-transparent mb-4" />
        <p className="text-sm tracking-wide">Waking up secure server...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} />
      <Route path="/" element={isAuthenticated ? <Chat /> : <Navigate to="/login" replace />} />
      <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" replace />} />
      <Route path="/about" element={isAuthenticated ? <About /> : <Navigate to="/login" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}