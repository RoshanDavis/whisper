import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  generateKeyPair,
  generateEcdsaKeyPair,
  exportPublicKey,
  deriveDualKeys,
  wrapPrivateKey,
  arrayBufferToBase64
} from '../utils/crypto';
import API_URL from '../utils/api';

// ── Password strength logic ──────────────────────────────────────────────────

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'At least 12 characters',      test: (pw) => pw.length >= 12 },
  { label: 'Uppercase letter (A–Z)',       test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter (a–z)',       test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number (0–9)',                 test: (pw) => /[0-9]/.test(pw) },
  { label: 'Special character (!@#$...)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

interface StrengthInfo {
  level: StrengthLevel;
  label: string;
  color: string;      // Tailwind text color
  barColor: string;   // Tailwind bg color
  filledBars: number; // 1–4
}

function getStrength(password: string, passedCount: number): StrengthInfo {
  if (password.length === 0) {
    return { level: 0, label: '', color: '', barColor: 'bg-gray-700', filledBars: 0 };
  }
  if (passedCount <= 1) {
    return { level: 1, label: 'Very weak', color: 'text-red-400',    barColor: 'bg-red-500',    filledBars: 1 };
  }
  if (passedCount === 2) {
    return { level: 2, label: 'Weak',      color: 'text-orange-400', barColor: 'bg-orange-500', filledBars: 2 };
  }
  if (passedCount === 3 || passedCount === 4) {
    return { level: 3, label: 'Strong',    color: 'text-emerald-400', barColor: 'bg-emerald-500', filledBars: 3 };
  }
  return   { level: 4, label: 'Very strong', color: 'text-emerald-400', barColor: 'bg-emerald-500', filledBars: 4 };
}

// ── Check icon (passing) ─────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <polyline
        points="1.5,5 4,7.5 8.5,2.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── X icon (failing) ─────────────────────────────────────────────────────────
function XIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <line x1="2" y1="2" x2="8" y2="8" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="2" x2="2" y2="8" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Only show the strength UI once the user has started typing
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Evaluate all requirements on every render — fast, no useEffect needed
  const results = useMemo(
    () => REQUIREMENTS.map((req) => req.test(password)),
    [password]
  );
  const passedCount = results.filter(Boolean).length;
  const strength = useMemo(() => getStrength(password, passedCount), [password, passedCount]);
  // Block submission unless all 5 requirements pass (level 4 = "Very strong")
  const isPasswordValid = passedCount === REQUIREMENTS.length;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please choose a stronger password before continuing.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const ecdhKeyPair  = await generateKeyPair();
      const ecdsaKeyPair = await generateEcdsaKeyPair();

      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const { authKeyString, wrappingKey } = await deriveDualKeys(password, salt);

      const ecdhWrapped  = await wrapPrivateKey(ecdhKeyPair.privateKey,  wrappingKey);
      const ecdsaWrapped = await wrapPrivateKey(ecdsaKeyPair.privateKey, wrappingKey);

      const payload = {
        username,
        authKey:                    authKeyString,
        publicKey:                  await exportPublicKey(ecdhKeyPair.publicKey),
        encryptedPrivateKey:        ecdhWrapped.wrappedKeyBase64,
        keyIv:                      ecdhWrapped.ivBase64,
        keySalt:                    arrayBufferToBase64(salt.buffer),
        publicSigningKey:           await exportPublicKey(ecdsaKeyPair.publicKey),
        encryptedSigningPrivateKey: ecdsaWrapped.wrappedKeyBase64,
        signingKeyIv:               ecdsaWrapped.ivBase64,
      };

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      navigate('/login', { state: { message: 'Vault created successfully. Please sign in.' } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-vault-base text-gray-100 font-sans">
      <div className="bg-vault-panel p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50 relative overflow-hidden">
        {/* Accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-emerald-500 to-brand" />

        <h2 className="text-3xl font-bold text-white text-center mb-2 tracking-wide">
          Whisper
        </h2>
        <p className="text-center text-sm text-gray-400 mb-8">Create your account.</p>

        <form onSubmit={handleRegister} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-vault-base border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-gray-100 placeholder-gray-600"
              placeholder="Enter a unique username"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1 pl-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (!passwordTouched) setPasswordTouched(true);
              }}
              className="w-full bg-vault-base border border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-gray-100 placeholder-gray-600"
              placeholder="••••••••"
            />

            {/* Strength meter — only visible after the user starts typing */}
            {passwordTouched && (
              <div className="mt-3 space-y-3">
                {/* Bar + label */}
                <div>
                  <div className="flex gap-1 mb-1.5">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                          bar <= strength.filledBars ? strength.barColor : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className={`text-xs text-right pr-1 transition-colors duration-300 ${strength.color}`}>
                      {strength.label}
                    </p>
                  )}
                </div>

                {/* Requirements checklist */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 space-y-2">
                  {REQUIREMENTS.map((req, i) => {
                    const passed = results[i];
                    return (
                      <div key={req.label} className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                            passed ? 'bg-emerald-500' : 'bg-gray-700'
                          }`}
                        >
                          {passed ? <CheckIcon /> : <XIcon />}
                        </div>
                        <span
                          className={`text-xs transition-colors duration-200 ${
                            passed ? 'text-gray-300' : 'text-gray-500'
                          }`}
                        >
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || (passwordTouched && !isPasswordValid)}
              className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 px-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_var(--color-brand-glow)]"
            >
              {isLoading ? 'Generating Keys...' : 'Create Account'}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-hover font-semibold transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}