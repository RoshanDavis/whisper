import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  generateKeyPair, 
  generateEcdsaKeyPair,
  exportPublicKey, 
  deriveKeyFromPassword,
  wrapPrivateKey,
  arrayBufferToBase64
} from '../utils/crypto';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Generate BOTH Key Pairs
      const ecdhKeyPair = await generateKeyPair(); 
      const ecdsaKeyPair = await generateEcdsaKeyPair(); 

      // 2. Generate Salt & Derive Master Wrapper Key
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const wrapperKey = await deriveKeyFromPassword(password, salt);

      // 3. Wrap BOTH Private Keys
      const ecdhWrapped = await wrapPrivateKey(ecdhKeyPair.privateKey, wrapperKey);
      const ecdsaWrapped = await wrapPrivateKey(ecdsaKeyPair.privateKey, wrapperKey);

      // 4. Package for Supabase
      const payload = {
        username,
        password,
        publicKey: await exportPublicKey(ecdhKeyPair.publicKey),
        encryptedPrivateKey: ecdhWrapped.wrappedKeyBase64,
        keyIv: ecdhWrapped.ivBase64,
        keySalt: arrayBufferToBase64(salt.buffer),
        publicSigningKey: await exportPublicKey(ecdsaKeyPair.publicKey),
        encryptedSigningPrivateKey: ecdsaWrapped.wrappedKeyBase64,
        signingKeyIv: ecdsaWrapped.ivBase64
      };

      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      // Send them to the login page so they can unwrap their new keys
      navigate('/login', { state: { message: 'Vault created successfully. Please sign in.' } });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-gray-100 font-sans">
      <div className="bg-[#1e293b] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50 relative overflow-hidden">
        {/* Subtle glowing accent line from your Figma design */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-emerald-500 to-[#0ea5e9]"></div>
        
        <h2 className="text-3xl font-bold text-white text-center mb-2 tracking-wide">
          Whisper
        </h2>
        <p className="text-center text-sm text-gray-400 mb-8">Generate your secure cryptographic identity.</p>
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0f172a] border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] focus:border-[#0ea5e9] transition-all text-gray-100 placeholder-gray-600"
              placeholder="Enter a unique username"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">Master Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f172a] border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] focus:border-[#0ea5e9] transition-all text-gray-100 placeholder-gray-600"
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
              className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-3 px-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(14,165,233,0.3)]"
            >
              {isLoading ? 'Generating Keys...' : 'Create Secure Account'}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400">
          Already have an identity?{' '}
          <Link to="/login" className="text-[#0ea5e9] hover:text-[#38bdf8] font-semibold transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}