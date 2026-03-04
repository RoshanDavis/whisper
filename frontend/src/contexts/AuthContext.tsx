// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

// 1. Define the shape of our global authentication state
interface AuthContextType {
  currentUser: string | null;
  userId: string | null;
  ecdhPrivateKey: CryptoKey | null;
  ecdsaPrivateKey: CryptoKey | null;
  isAuthenticated: boolean;
  login: (username: string, userId: string, ecdhKey: CryptoKey, ecdsaKey: CryptoKey) => void;
  logout: () => void;
}

// 2. Create the Context container
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the Provider component that will wrap our application
export function AuthProvider({ children }: { children: ReactNode }) {
  // Session state — no localStorage; keys live in memory only
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ecdhPrivateKey, setEcdhPrivateKey] = useState<CryptoKey | null>(null);
  const [ecdsaPrivateKey, setEcdsaPrivateKey] = useState<CryptoKey | null>(null);

  // Fully authenticated = user info + both crypto keys loaded
  const isAuthenticated = currentUser !== null && userId !== null && ecdhPrivateKey !== null && ecdsaPrivateKey !== null;

  const login = (username: string, newUserId: string, ecdhKey: CryptoKey, ecdsaKey: CryptoKey) => {
    setCurrentUser(username);
    setUserId(newUserId);
    setEcdhPrivateKey(ecdhKey);
    setEcdsaPrivateKey(ecdsaKey);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_err) {
      // Best-effort: clear client state even if server call fails
    }
    setCurrentUser(null);
    setUserId(null);
    setEcdhPrivateKey(null);
    setEcdsaPrivateKey(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userId, isAuthenticated, ecdhPrivateKey, ecdsaPrivateKey, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. Custom hook so our components can easily access this data
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}