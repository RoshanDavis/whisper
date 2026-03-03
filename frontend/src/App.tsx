import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';       
import Register from './pages/Register'; 
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import About from './pages/About';

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />
      <Route path="/" element={token ? <Chat /> : <Navigate to="/login" />} />
      <Route path="/settings" element={token ? <Settings /> : <Navigate to="/login" />} />
      <Route path="/about" element={token ? <About /> : <Navigate to="/login" />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}