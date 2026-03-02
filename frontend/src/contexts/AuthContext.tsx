// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

// 1. Define the shape of our global authentication state
interface AuthContextType {
  token: string | null;
  currentUser: string | null;
  userId: string | null;
  login: (token: string, username: string, userId: string) => void;
  logout: () => void;
}

// 2. Create the Context container
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the Provider component that will wrap our application
export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize state directly from localStorage so users stay logged in upon refresh
  const [token, setToken] = useState<string | null>(localStorage.getItem('whisper_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('whisper_username'));
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('whisper_userid'));

  const login = (newToken: string, username: string, newUserId: string) => {
    localStorage.setItem('whisper_token', newToken);
    localStorage.setItem('whisper_username', username);
    localStorage.setItem('whisper_userid', newUserId);
    
    setToken(newToken);
    setCurrentUser(username);
    setUserId(newUserId);
  };

  const logout = () => {
    // Clear user identity
    localStorage.removeItem('whisper_token');
    localStorage.removeItem('whisper_username');
    localStorage.removeItem('whisper_userid');
    
    // Security measure: Scrape the unwrapped private keys out of memory!
    if (currentUser) {
      localStorage.removeItem(`whisper_priv_${currentUser}`);
      localStorage.removeItem(`whisper_sign_priv_${currentUser}`);
    }

    setToken(null);
    setCurrentUser(null);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ token, currentUser, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. Create a custom hook so our components can easily access this data
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}