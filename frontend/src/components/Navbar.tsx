// frontend/src/components/Navbar.tsx
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="h-16 bg-[#0f172a] border-b border-gray-700/50 flex items-center justify-between px-6 shrink-0">
      {/* Left: Logo */}
      <div className="text-2xl font-bold text-white tracking-wide">
        Whisper
      </div>

      {/* Center: Navigation Pills (from your Figma) */}
      <div className="hidden md:flex items-center gap-2 bg-[#1e293b] p-1 rounded-full border border-gray-700/50">
        <button className="px-4 py-1.5 bg-[#0ea5e9] text-white text-sm font-medium rounded-full shadow-sm">
          Home
        </button>
        <button className="px-4 py-1.5 text-gray-400 hover:text-gray-200 text-sm font-medium rounded-full transition-colors">
          Settings
        </button>
        <button className="px-4 py-1.5 text-gray-400 hover:text-gray-200 text-sm font-medium rounded-full transition-colors">
          Info
        </button>
      </div>

      {/* Right: User Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">User</span>
          <div className="w-8 h-8 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-sm shadow-[0_0_10px_rgba(14,165,233,0.3)]">
            {currentUser?.charAt(0).toUpperCase()}
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium px-2 py-1 border border-red-500/20 rounded-md hover:bg-red-500/10"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}