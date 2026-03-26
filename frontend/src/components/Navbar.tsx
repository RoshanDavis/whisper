import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State to manage the dropdown visibility
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Define our navigation items with clean, outlined SVGs
  const navItems = [
    {
      name: "Chat",
      path: "/",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="M8 12h.01" />
          <path d="M12 12h.01" />
          <path d="M16 12h.01" />
        </svg>
      ),
    },
    // {
    //   name: "Settings",
    //   path: "/settings",
    //   icon: (
    //     <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    //       <circle cx="12" cy="12" r="3" />
    //       <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    //     </svg>
    //   ),
    // },
    {
      name: "About",
      path: "/about",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="h-16 bg-primary-950 border border-primary-50 rounded-full m-2 p-7 flex items-center justify-between relative">
      <div className="text-2xl font-bold text-primary-50 tracking-wide">
        Whisper
      </div>

      {/* Dynamic Navigation Pills */}
      <div className="hidden md:flex items-center gap-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              // The transition-all property makes the expanding/collapsing smooth
              className={`flex items-center justify-center transition-all duration-300 overflow-hidden ${
                isActive
                  ? "bg-primary-700 text-primary-50 px-4 py-1.5 rounded-full gap-2"
                  : "text-primary-50 hover:text-primary-300 p-2 rounded-full"
              }`}
              title={item.name}
            >
              <div className="shrink-0">{item.icon}</div>
              {/* Only render the text if the route is active */}
              {isActive && (
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_10px_var(--color-brand-glow)] hover:ring-2 hover:ring-primary-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={isDropdownOpen}
            aria-controls="user-menu"
          >
            {currentUser?.charAt(0).toUpperCase()}
          </button>
        </div>

        {isDropdownOpen && (
          <div
            id="user-menu"
            role="menu"
            className="absolute right-0 top-7 mt-2 w-48 bg-primary-950 border border-primary-50 rounded-xl shadow-lg py-2 z-50 overflow-hidden origin-top-right animate-in fade-in slide-in-from-top-2"
          >
            <div className="px-4 py-2 border-b border-primary-50 mb-1">
              <p className="text-sm text-primary-50 font-medium truncate">
                {currentUser}
              </p>
            </div>

            <div className="md:hidden border-b border-primary-50 mb-1 py-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={`mobile-${item.path}`}
                    to={item.path}
                    onClick={() => setIsDropdownOpen(false)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                      isActive
                        ? "text-primary-50 bg-primary-800"
                        : "text-primary-100 hover:bg-primary-800 hover:text-primary-50"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-secondary-400 hover:bg-primary-800 hover:text-secondary-300 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
