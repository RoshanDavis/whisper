import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';       
import Register from './pages/Register'; 
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import About from './pages/About';

export default function App() {
  const { isAuthenticated } = useAuth();

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