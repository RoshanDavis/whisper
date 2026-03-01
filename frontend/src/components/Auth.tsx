import { useState } from 'react';
import { 
  generateKeyPair, 
  exportPublicKey, 
  exportPrivateKey,
  deriveKeyFromPassword,
  wrapPrivateKey,
  unwrapPrivateKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  generateEcdsaKeyPair,    // <-- NEW
  unwrapEcdsaPrivateKey    // <-- NEW
} from '../utils/crypto';

interface AuthProps {
  onAuthSuccess: (token: string, username: string, userId: string) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let payload: any = { username, password };

      // ==========================================
      // REGISTRATION FLOW
      // ==========================================
      if (!isLogin) {
        // 1. Generate BOTH Key Pairs
        const ecdhKeyPair = await generateKeyPair(); // For encryption
        const ecdsaKeyPair = await generateEcdsaKeyPair(); // For digital signatures

        // 2. Generate Salt & Derive Master Wrapper Key
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const wrapperKey = await deriveKeyFromPassword(password, salt);

        // 3. Wrap BOTH Private Keys
        const ecdhWrapped = await wrapPrivateKey(ecdhKeyPair.privateKey, wrapperKey);
        const ecdsaWrapped = await wrapPrivateKey(ecdsaKeyPair.privateKey, wrapperKey);

        // 4. Package for Supabase
        payload.publicKey = await exportPublicKey(ecdhKeyPair.publicKey);
        payload.encryptedPrivateKey = ecdhWrapped.wrappedKeyBase64;
        payload.keyIv = ecdhWrapped.ivBase64;
        payload.keySalt = arrayBufferToBase64(salt.buffer);

        payload.publicSigningKey = await exportPublicKey(ecdsaKeyPair.publicKey);
        payload.encryptedSigningPrivateKey = ecdsaWrapped.wrappedKeyBase64;
        payload.signingKeyIv = ecdsaWrapped.ivBase64;
      }

      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // ==========================================
      // LOGIN FLOW
      // ==========================================
      if (isLogin && data.token) {
        try {
          const saltBuffer = base64ToArrayBuffer(data.user.keySalt);
          const salt = new Uint8Array(saltBuffer);
          const wrapperKey = await deriveKeyFromPassword(password, salt);

          // 1. Unwrap the Encryption Key
          const ecdhPrivateKey = await unwrapPrivateKey(data.user.encryptedPrivateKey, wrapperKey, data.user.keyIv);
          const ecdhPrivateKeyBase64 = await exportPrivateKey(ecdhPrivateKey);
          localStorage.setItem(`whisper_priv_${username}`, ecdhPrivateKeyBase64);

          // 2. Unwrap the Signing Key
          const ecdsaPrivateKey = await unwrapEcdsaPrivateKey(data.user.encryptedSigningPrivateKey, wrapperKey, data.user.signingKeyIv);
          const ecdsaPrivateKeyBase64 = await exportPrivateKey(ecdsaPrivateKey);
          localStorage.setItem(`whisper_sign_priv_${username}`, ecdsaPrivateKeyBase64);

          onAuthSuccess(data.token, data.user.username, data.user.id);
        } catch (unwrapError) {
          console.error("Unwrapping failed:", unwrapError);
          throw new Error("Failed to unlock your cryptographic keys. Please check your password.");
        }
      } else {
        setIsLogin(true);
        setError('Registration successful! Your dual keys are securely wrapped. Please log in.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100 font-sans">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-700">
        <h2 className="text-3xl font-bold text-emerald-400 text-center mb-6 tracking-wide">
          Whisper
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-100"
              placeholder="Enter your username"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-100"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className={`p-3 rounded text-sm ${error.includes('successful') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-bold py-2 px-4 rounded-lg transition-colors mt-4 disabled:opacity-50"
          >
            {isLoading ? 'Processing Crypto...' : (isLogin ? 'Sign In & Unlock' : 'Create Secure Account')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }} 
            className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}