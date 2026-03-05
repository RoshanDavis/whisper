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
  const [serverError, setServerError] = useState(false);
  const [, setRetryCount] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(false);

  const MAX_RETRIES = 10;
  const FETCH_TIMEOUT = 8000; // 8s per attempt (cold starts can be slow)

  // Ping the health endpoint on mount to wake the serverless backend
  useEffect(() => {
    const controller = new AbortController();
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleRetry = () => {
      setRetryCount((c) => {
        if (c + 1 >= MAX_RETRIES) {
          setServerError(true);
          return c + 1;
        }
        timerId = setTimeout(ping, 2000);
        return c + 1;
      });
    };

    const ping = async () => {
      // Per-request timeout: abort fetch if it takes too long
      timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        if (res.ok) {
          setServerReady(true);
        } else {
          scheduleRetry();
        }
      } catch {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        scheduleRetry();
      }
    };

    ping();
    return () => {
      controller.abort();
      if (timerId !== undefined) clearTimeout(timerId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [retryTrigger]);

  if (!serverReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary-950 text-primary-50">
        {serverError ? (
          <>
            <p className="text-sm tracking-wide mb-4">Unable to reach the server. Please try again.</p>
            <button
              onClick={() => { setServerError(false); setRetryCount(0); setRetryTrigger((t) => !t); }}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-primary-50 text-sm font-bold rounded-lg transition-colors"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-400 border-t-transparent mb-4" />
            <p className="text-sm tracking-wide">Waking up secure server...</p>
          </>
        )}
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