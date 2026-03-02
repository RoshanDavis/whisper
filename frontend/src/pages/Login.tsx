import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  deriveKeyFromPassword,
  unwrapPrivateKey,
  unwrapEcdsaPrivateKey,
  exportPrivateKey,
  base64ToArrayBuffer
} from '../utils/crypto';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const successMessage = location.state?.message;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      try {
        const salt = new Uint8Array(base64ToArrayBuffer(data.user.keySalt));
        const wrapperKey = await deriveKeyFromPassword(password, salt);

        const ecdhPrivateKey = await unwrapPrivateKey(data.user.encryptedPrivateKey, wrapperKey, data.user.keyIv);
        localStorage.setItem(`whisper_priv_${username}`, await exportPrivateKey(ecdhPrivateKey));

        const ecdsaPrivateKey = await unwrapEcdsaPrivateKey(data.user.encryptedSigningPrivateKey, wrapperKey, data.user.signingKeyIv);
        localStorage.setItem(`whisper_sign_priv_${username}`, await exportPrivateKey(ecdsaPrivateKey));

        login(data.token, data.user.username, data.user.id);
        navigate('/');

      } catch (unwrapError) {
        throw new Error("Failed to unlock your cryptographic keys. Please check your password.");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-vault-base text-gray-100 font-sans">
      <div className="bg-vault-panel p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50 relative overflow-hidden">
        {/* Semantic accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-brand to-emerald-500"></div>
        
        <h2 className="text-3xl font-bold text-white text-center mb-2 tracking-wide">
          Whisper
        </h2>
        <p className="text-center text-sm text-gray-400 mb-8">Unlock your encrypted messages.</p>

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-center">
            {successMessage}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-vault-base border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-gray-100 placeholder-gray-600"
              placeholder="Enter your username"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">Master Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-vault-base border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-gray-100 placeholder-gray-600"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 text-center">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 px-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_var(--color-brand-glow)]"
            >
              {isLoading ? 'Decrypting Vault...' : 'Sign In & Unlock'}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400">
          Don't have an identity?{' '}
          <Link to="/register" className="text-brand hover:text-brand-hover font-semibold transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}