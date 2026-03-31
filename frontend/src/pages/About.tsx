import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const toBase64 = (buf: ArrayBuffer) => {
  let b = '';
  new Uint8Array(buf).forEach(v => b += String.fromCharCode(v));
  return window.btoa(b);
};

/* ─── Google Fonts ────────────────────────────────────────────────────────── */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
    .font-display { font-family: 'Syne', sans-serif; }
    .font-mono-custom { font-family: 'JetBrains Mono', monospace; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
    @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
    .shimmer-text {
      background: linear-gradient(90deg, #00e5ff 0%, #ffffff 40%, #00e5ff 60%, #ff3b5c 100%);
      background-size: 200% auto;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 4s linear infinite;
    }
    .card-hover { transition: border-color .2s ease, box-shadow .2s ease; }
    .card-hover:hover { border-color: rgba(0,229,255,.3) !important; box-shadow: 0 0 20px rgba(0,229,255,.05); }
    .section-fade { opacity:0; transform:translateY(20px); transition:opacity .6s ease,transform .6s ease; }
    .section-fade.visible { opacity:1; transform:translateY(0); }
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:rgba(0,229,255,.2); border-radius:4px; }
  `}</style>
);

/* ─── Design tokens ───────────────────────────────────────────────────────── */
const C = {
  bg:        '#050c12',
  panel:     'rgba(0,20,32,.6)',
  border:    'rgba(0,229,255,.12)',
  cyan:      '#00e5ff',
  cyanDim:   'rgba(0,229,255,.1)',
  red:       '#ff3b5c',
  redDim:    'rgba(255,59,92,.1)',
  amber:     '#ffb800',
  green:     '#00ff88',
  text:      '#c8dde8',
  textDim:   '#4a6a7a',
  textBright:'#e8f4f8',
};

const DEMO_ITERATIONS = 100_000; // Full production iterations

/* ─── Cipher text animation ───────────────────────────────────────────────── */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
function CipherText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState(() =>
    text.split('').map(c => c === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
  );
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      let frame = 0;
      const total = text.length * 3;
      const id = setInterval(() => {
        frame++;
        setDisplayed(text.split('').map((char, i) => {
          if (char === ' ') return ' ';
          if (frame > i * 3 + 2) return char;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join(''));
        if (frame >= total) { clearInterval(id); setDone(true); }
      }, 30);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return <span style={{ opacity: done ? 1 : 0.65 }}>{displayed}</span>;
}

/* ─── Section observer ────────────────────────────────────────────────────── */
function useSectionObserver() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.section-fade').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─── Shared UI primitives ────────────────────────────────────────────────── */
function Tag({ children, color = 'cyan' }: { children: React.ReactNode; color?: 'cyan'|'red'|'amber'|'green' }) {
  const c = {
    cyan:  { bg:'rgba(0,229,255,.1)',  border:'rgba(0,229,255,.3)',  text:'#00e5ff' },
    red:   { bg:'rgba(255,59,92,.1)',  border:'rgba(255,59,92,.3)',  text:'#ff3b5c' },
    amber: { bg:'rgba(255,184,0,.1)',  border:'rgba(255,184,0,.3)',  text:'#ffb800' },
    green: { bg:'rgba(0,255,136,.1)',  border:'rgba(0,255,136,.3)',  text:'#00ff88' },
  }[color];
  return (
    <span className="font-mono-custom text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {children}
    </span>
  );
}

function Panel({ children, className = '', accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 card-hover ${className}`}
      style={{ background: C.panel, border: `1px solid ${accent ? 'rgba(0,229,255,.25)' : C.border}`, backdropFilter: 'blur(8px)' }}>
      {children}
    </div>
  );
}

function SectionTitle({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono-custom text-xs tracking-[.3em] uppercase" style={{ color: C.cyan }}>{num}</span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${C.border}, transparent)` }} />
      </div>
      <h2 className="font-display text-3xl md:text-4xl" style={{ color: C.textBright }}>{title}</h2>
      <p className="mt-2 font-mono-custom text-sm" style={{ color: C.textDim }}>{sub}</p>
    </div>
  );
}

function MonoLabel({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return <span className="font-mono-custom text-xs font-bold" style={{ color }}>{children}</span>;
}

/* ─── Demo step shell ──────────────────────────────────────────────────────── */
function Step({ s, i, step, running, children }: {
  s: { id: string; label: string; color: string; desc: string };
  i: number; step: number; running: boolean; children?: React.ReactNode;
}) {
  const active = step > i;
  const current = step === i + 1 && running;
  return (
    <div className="rounded-xl p-3 transition-all duration-500"
      style={{
        background: active ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.15)',
        border: `1px solid ${active ? s.color + '44' : 'rgba(255,255,255,.05)'}`,
        opacity: step === 0 ? 0.5 : active || current ? 1 : 0.35,
      }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full transition-all duration-300"
          style={{ background: active ? s.color : C.textDim, boxShadow: active ? `0 0 6px ${s.color}` : 'none' }} />
        <span className="font-mono-custom text-xs font-bold" style={{ color: active ? s.color : C.textDim }}>
          {s.label}
        </span>
        {current && <span className="font-mono-custom text-[10px] ml-auto animate-pulse" style={{ color: s.color }}>running...</span>}
        {active && !current && <span className="font-mono-custom text-[10px] ml-auto" style={{ color: C.green }}>✓ done</span>}
      </div>
      <p className="font-mono-custom text-xs mb-2" style={{ color: C.textDim }}>{s.desc}</p>
      {active && children}
    </div>
  );
}

/* ─── Demo header ─────────────────────────────────────────────────────────── */
function DemoHeader({ dot, label, note }: { dot: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-2 mb-5 flex-wrap">
      <div className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: dot, boxShadow: `0 0 6px ${dot}`, animation: 'pulse-dot 2s ease-in-out infinite' }} />
      <span className="font-mono-custom text-xs font-bold tracking-widest uppercase" style={{ color: dot }}>
        {label}
      </span>
      <span className="font-mono-custom text-[10px] ml-auto px-2 py-0.5 rounded uppercase tracking-widest font-bold"
        style={{ color: C.cyan, background: 'rgba(0,229,255,.1)', border: `1px solid rgba(0,229,255,.3)` }}>
        {note}
      </span>
    </div>
  );
}

/* ─── Data row ────────────────────────────────────────────────────────────── */
function DataRow({ label, value, color = C.textBright }: { label: string; value: string; color?: string }) {
  return (
    <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded break-all"
      style={{ background: 'rgba(0,0,0,.4)', color }}>
      <span style={{ color: C.textDim }}>{label}: </span>{value}
    </div>
  );
}

/* ─── Warning row for exposed private keys ────────────────────────────────── */
function DangerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded break-all"
      style={{ background: 'rgba(255,59,92,.1)', border: `1px dashed ${C.red}88`, color: C.textBright }}>
      <div className="flex justify-between items-center mb-1">
        <span style={{ color: C.red, fontWeight: 'bold' }}>⚠ {label}</span>
        <span style={{ color: C.red, fontSize: '8px', textTransform: 'uppercase' }}>Educational View Only</span>
      </div>
      <span style={{ opacity: 0.8 }}>{value}</span>
    </div>
  );
}

/* ─── REGISTRATION DEMO ───────────────────────────────────────────────────── */
function RegistrationDemo() {
  const [password, setPassword] = useState('correcthorsebatterystaple');
  const [step, setStep]         = useState(0);
  const [running, setRunning]   = useState(false);
  const [ms, setMs]             = useState<number | null>(null);
  const [results, setResults]   = useState<Record<string, string>>({});
  const [error, setError]       = useState('');

  const steps = [
    { id:'pbkdf2', label:'01 — PBKDF2 Dual-Derivation', color: C.amber,
      desc:`Password + random 16-byte salt → ${DEMO_ITERATIONS.toLocaleString()} SHA-256 iterations → 512 bits of key material, split into two independent 32-byte halves.` },
    { id:'keys',   label:'02 — Generate Key Pairs',     color: C.cyan,
      desc:"Browser generates ECDH P-256 (key agreement) and ECDSA P-256 (signing) key pairs. Both private keys exist only in RAM." },
    { id:'wrap',   label:'03 — AES-GCM Key Wrapping',   color: C.green,
      desc:"Each private key is exported to PKCS8, then AES-GCM encrypted with the wrapping key using a unique random 12-byte IV." },
    { id:'send',   label:'04 — What Goes to the Server', color: C.red,
      desc:"Only the auth key (bcrypt-hashed server-side), public keys, encrypted private keys, IVs, and salt are transmitted. The password and wrapping key never leave the browser." },
  ];

  const run = useCallback(async () => {
    if (!password.trim()) return;
    setRunning(true); setStep(0); setResults({}); setError(''); setMs(null);
    const enc = new TextEncoder();
    try {
      const t0 = performance.now();

      // Step 1: PBKDF2
      await new Promise(r => setTimeout(r, 300));
      setStep(1);
      const salt       = window.crypto.getRandomValues(new Uint8Array(16));
      const keyMat     = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits       = await window.crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations: DEMO_ITERATIONS, hash:'SHA-256' }, keyMat, 512);
      const authBytes  = bits.slice(0, 32);
      const wrapBytes  = bits.slice(32, 64);
      const wrapKey    = await window.crypto.subtle.importKey('raw', wrapBytes, { name:'AES-GCM' }, false, ['encrypt']);
      const elapsed    = Math.round(performance.now() - t0);
      setMs(elapsed);
      setResults(p => ({ ...p, salt: toBase64(salt.buffer), authKey: toBase64(authBytes), wrapKey: toBase64(wrapBytes) }));

      // Step 2: Generate key pairs
      await new Promise(r => setTimeout(r, 600));
      setStep(2);
      const ecdhPair  = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
      const ecdsaPair = await window.crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign', 'verify']);
      const ecdhPub   = await window.crypto.subtle.exportKey('spki', ecdhPair.publicKey);
      const ecdsaPub  = await window.crypto.subtle.exportKey('spki', ecdsaPair.publicKey);
      const ecdhPriv  = await window.crypto.subtle.exportKey('pkcs8', ecdhPair.privateKey);
      const ecdsaPriv = await window.crypto.subtle.exportKey('pkcs8', ecdsaPair.privateKey);
      
      setResults(p => ({ 
        ...p, 
        ecdhPub: toBase64(ecdhPub), 
        ecdsaPub: toBase64(ecdsaPub),
        ecdhPriv: toBase64(ecdhPriv),
        ecdsaPriv: toBase64(ecdsaPriv)
      }));

      // Step 3: Wrap private keys
      await new Promise(r => setTimeout(r, 600));
      setStep(3);
      const iv1       = window.crypto.getRandomValues(new Uint8Array(12));
      const iv2       = window.crypto.getRandomValues(new Uint8Array(12));
      const encEcdh   = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv: iv1 }, wrapKey, ecdhPriv);
      const encEcdsa  = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv: iv2 }, wrapKey, ecdsaPriv);
      setResults(p => ({
        ...p,
        encEcdh:  toBase64(encEcdh),  iv1: toBase64(iv1.buffer),
        encEcdsa: toBase64(encEcdsa), iv2: toBase64(iv2.buffer),
      }));

      // Step 4: Payload summary
      await new Promise(r => setTimeout(r, 600));
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [password]);

  return (
    <Panel accent>
      <DemoHeader dot={C.amber} label="Flow 1 — Alice Registers" note="Interactive Simulation" />

      <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${C.border}` }}>
        <div className="flex gap-3 items-center">
          <div className="text-xs font-mono-custom" style={{ color: C.textDim, width: '130px' }}>Simulation Variable:</div>
          <input type="text" value={password}
            onChange={e => { setPassword(e.target.value); setStep(0); setResults({}); setMs(null); }}
            className="flex-1 rounded-lg px-3 py-2 font-mono-custom text-sm outline-none"
            style={{ background:'rgba(0,0,0,.5)', border:`1px solid ${C.amber}44`, color: C.textBright, caretColor: C.amber }} />
          <button onClick={run} disabled={running || !password.trim()}
            className="px-5 py-2 rounded-lg font-mono-custom text-xs font-bold transition-all duration-200 whitespace-nowrap"
            style={{ background: running?'rgba(255,184,0,.05)':'rgba(255,184,0,.15)', border:`1px solid ${running?'rgba(255,184,0,.2)':C.amber}`, color: running?C.textDim:C.amber }}>
            {running ? 'Processing...' : 'Run Simulation →'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl px-4 py-2 mb-4 font-mono-custom text-xs" style={{ background: C.redDim, color: C.red }}>{error}</div>}

      <div className="space-y-3">
        <Step s={steps[0]} i={0} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow label="salt (16 random bytes)" value={results.salt || ''} color={C.textBright} />
            <DataRow label="authKey (first 32 bytes → server)" value={results.authKey?.slice(0, 44) + '...' || ''} color={C.cyan} />
            <DataRow label="wrappingKey (last 32 bytes → stays in RAM)" value={results.wrapKey?.slice(0, 44) + '...' || ''} color={C.green} />
            {ms !== null && (
              <div className="font-mono-custom text-[10px] px-2 py-1 rounded" style={{ background:'rgba(255,184,0,.08)', color: C.amber }}>
                PBKDF2 took {ms}ms at {DEMO_ITERATIONS.toLocaleString()} iterations. This intentional CPU delay neutralizes brute-force attacks.
              </div>
            )}
          </div>
        </Step>

        <Step s={steps[1]} i={1} step={step} running={running}>
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <DataRow label="ECDH public key" value={results.ecdhPub?.slice(0, 32) + '...' || ''} color={C.cyan} />
              <DangerRow label="ECDH private key" value={results.ecdhPriv?.slice(0, 32) + '...' || ''} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <DataRow label="ECDSA public key" value={results.ecdsaPub?.slice(0, 32) + '...' || ''} color={C.amber} />
              <DangerRow label="ECDSA private key" value={results.ecdsaPriv?.slice(0, 32) + '...' || ''} />
            </div>
            <div className="font-mono-custom text-[10px] text-center mt-2" style={{ color: C.red }}>
              * For this educational demo, private keys are displayed. In a real application, they are never rendered to the DOM.
            </div>
          </div>
        </Step>

        <Step s={steps[2]} i={2} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow label="encryptedPrivateKey (ECDH)" value={results.encEcdh?.slice(0, 44) + '...' || ''} color={C.green} />
            <DataRow label="keyIv (ECDH wrap IV)"        value={results.iv1 || ''} color={C.textBright} />
            <DataRow label="encryptedSigningPrivateKey" value={results.encEcdsa?.slice(0, 44) + '...' || ''} color={C.green} />
            <DataRow label="signingKeyIv"                value={results.iv2 || ''} color={C.textBright} />
          </div>
        </Step>

        <Step s={steps[3]} i={3} step={step} running={running}>
          <div className="space-y-1">
            {[
              { k:'authKey',                     note:'→ bcrypt-hashed server-side', c: C.cyan },
              { k:'publicKey (ECDH)',            note:'→ shared with contacts', c: C.textBright },
              { k:'encryptedPrivateKey (ECDH)',  note:'→ useless without password', c: C.green },
              { k:'keyIv + keySalt',             note:'→ non-secret, harmless alone', c: C.textBright },
              { k:'publicSigningKey (ECDSA)',    note:'→ shared for verification', c: C.textBright },
              { k:'encryptedSigningPrivateKey',  note:'→ useless without password', c: C.green },
            ].map(r => (
              <div key={r.k} className="flex gap-2 font-mono-custom text-[10px]">
                <span style={{ color: r.c, minWidth: 200 }}>{r.k}</span>
                <span style={{ color: C.textDim }}>{r.note}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 font-mono-custom text-[10px] font-bold"
              style={{ borderTop:`1px solid ${C.border}`, color: C.red }}>
              ✗ password · wrapping key · raw private keys — NEVER transmitted
            </div>
          </div>
        </Step>
      </div>
    </Panel>
  );
}

/* ─── LOGIN DEMO ──────────────────────────────────────────────────────────── */
function LoginDemo() {
  const [password, setPassword] = useState('correcthorsebatterystaple');
  const [scenario, setScenario] = useState<'correct' | 'wrong'>('correct');
  const [step, setStep]   = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState('');

  const steps = [
    { id:'fetch',  label:'01 — Fetch Salt',             color: C.cyan,
      desc:"Browser requests Alice's PBKDF2 salt via GET /salt/:username. Non-existent users get a deterministic dummy salt to prevent username enumeration." },
    { id:'derive', label:'02 — PBKDF2 Dual-Derivation', color: C.amber,
      desc:`Same derivation as registration: password + salt → ${DEMO_ITERATIONS.toLocaleString()} SHA-256 iterations → auth key + wrapping key.` },
    { id:'auth',   label:'03 — Server Auth & Key Download', color: C.red,
      desc:"Auth key sent to server for bcrypt.compare(). On success, server returns the encrypted private keys — never the raw private keys." },
    { id:'unwrap', label:'04 — AES-GCM Key Unwrapping', color: C.green,
      desc:"Wrapping key (derived locally) decrypts the private key blobs. On wrong password the wrapping key is wrong → AES-GCM authentication tag fails → decryption throws." },
  ];

  const run = useCallback(async () => {
    if (!password.trim()) return;
    setRunning(true); setStep(0); setResults({}); setError('');
    const enc = new TextEncoder();
    try {
      // Simulate "server state" — registered with the real password
      const serverSalt    = window.crypto.getRandomValues(new Uint8Array(16));
      const kmSetup       = await window.crypto.subtle.importKey('raw', enc.encode(password), { name:'PBKDF2' }, false, ['deriveBits']);
      const bitsSetup     = await window.crypto.subtle.deriveBits({ name:'PBKDF2', salt: serverSalt, iterations: DEMO_ITERATIONS, hash:'SHA-256' }, kmSetup, 512);
      const wrapSetup     = await window.crypto.subtle.importKey('raw', bitsSetup.slice(32,64), { name:'AES-GCM' }, false, ['encrypt']);
      const ecdhPair      = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
      const ecdhPrivBytes = await window.crypto.subtle.exportKey('pkcs8', ecdhPair.privateKey);
      const serverIv      = window.crypto.getRandomValues(new Uint8Array(12));
      const serverEncKey  = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv: serverIv }, wrapSetup, ecdhPrivBytes);

      // Step 1: Fetch salt
      await new Promise(r => setTimeout(r, 400));
      setStep(1);
      setResults(p => ({ ...p, salt: toBase64(serverSalt.buffer) }));

      // Step 2: Derive keys — using potentially wrong password
      await new Promise(r => setTimeout(r, 700));
      setStep(2);
      const attemptPw = scenario === 'wrong' ? password + '_WRONG' : password;
      const km        = await window.crypto.subtle.importKey('raw', enc.encode(attemptPw), { name:'PBKDF2' }, false, ['deriveBits']);
      const bits      = await window.crypto.subtle.deriveBits({ name:'PBKDF2', salt: serverSalt, iterations: DEMO_ITERATIONS, hash:'SHA-256' }, km, 512);
      const authBytes = bits.slice(0, 32);
      const wrapBytes = bits.slice(32, 64);
      const wrapKey   = await window.crypto.subtle.importKey('raw', wrapBytes, { name:'AES-GCM' }, false, ['decrypt']);
      setResults(p => ({ ...p, authKey: toBase64(authBytes), wrapKey: toBase64(wrapBytes) }));

      // Step 3: Server auth + download encrypted key
      await new Promise(r => setTimeout(r, 700));
      setStep(3);
      setResults(p => ({ ...p, encKey: toBase64(serverEncKey) }));

      // Step 4: Unwrap
      await new Promise(r => setTimeout(r, 700));
      setStep(4);
      try {
        const decrypted = await window.crypto.subtle.decrypt({ name:'AES-GCM', iv: serverIv }, wrapKey, serverEncKey);
        // Verify it's a real usable key
        await window.crypto.subtle.importKey('pkcs8', decrypted, { name:'ECDH', namedCurve:'P-256' }, false, ['deriveBits']);
        setResults(p => ({ ...p, success: true, decryptedKey: toBase64(decrypted) }));
      } catch {
        setResults(p => ({ ...p, success: false }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [password, scenario]);

  return (
    <Panel accent>
      <DemoHeader dot={C.cyan} label="Flow 2 — Alice Logs In" note="Interactive Simulation" />

      <div className="mb-5 p-4 rounded-xl space-y-4" style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${C.border}` }}>
        <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,.4)' }}>
          <button onClick={() => { setScenario('correct'); setStep(0); setResults({}); }}
            className="flex-1 py-1.5 rounded-md font-mono-custom text-xs transition-colors"
            style={{ background: scenario === 'correct' ? 'rgba(0,229,255,.15)' : 'transparent', color: scenario === 'correct' ? C.cyan : C.textDim, border: scenario === 'correct' ? `1px solid ${C.cyan}55` : '1px solid transparent' }}>
            Scenario: Correct Password
          </button>
          <button onClick={() => { setScenario('wrong'); setStep(0); setResults({}); }}
            className="flex-1 py-1.5 rounded-md font-mono-custom text-xs transition-colors"
            style={{ background: scenario === 'wrong' ? 'rgba(255,59,92,.15)' : 'transparent', color: scenario === 'wrong' ? C.red : C.textDim, border: scenario === 'wrong' ? `1px solid ${C.red}55` : '1px solid transparent' }}>
            Scenario: Wrong Password
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="text-xs font-mono-custom" style={{ color: C.textDim, width: '130px' }}>Simulation Variable:</div>
          <input type="password" value={password}
            onChange={e => { setPassword(e.target.value); setStep(0); setResults({}); }}
            className="flex-1 rounded-lg px-3 py-2 font-mono-custom text-sm outline-none"
            style={{ background:'rgba(0,0,0,.5)', border:`1px solid ${C.cyan}44`, color: C.textBright, caretColor: C.cyan }} />
          <button onClick={run} disabled={running || !password.trim()}
            className="px-5 py-2 rounded-lg font-mono-custom text-xs font-bold transition-all duration-200 whitespace-nowrap"
            style={{ background: running?C.cyanDim+'44':C.cyanDim, border:`1px solid ${running?'rgba(0,229,255,.2)':C.cyan}`, color: running?C.textDim:C.cyan }}>
            {running ? 'Authenticating...' : 'Run Simulation →'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl px-4 py-2 mb-4 font-mono-custom text-xs" style={{ background: C.redDim, color: C.red }}>{error}</div>}

      <div className="space-y-3">
        <Step s={steps[0]} i={0} step={step} running={running}>
          <DataRow label="fetched salt" value={String(results.salt || '').slice(0, 44) + '...'} />
        </Step>

        <Step s={steps[1]} i={1} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow
              label={`authKey ${scenario === 'wrong' ? '(derived from WRONG password)' : '(derived from correct password)'}`}
              value={String(results.authKey || '').slice(0, 44) + '...'}
              color={scenario === 'wrong' ? C.red : C.cyan}
            />
            <DataRow label="wrappingKey" value={String(results.wrapKey || '').slice(0, 44) + '...'} color={scenario === 'wrong' ? C.red : C.green} />
          </div>
        </Step>

        <Step s={steps[2]} i={2} step={step} running={running}>
          <div className="space-y-1.5">
            {scenario === 'wrong' && (
              <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded"
                style={{ background:'rgba(255,184,0,.08)', border:`1px solid rgba(255,184,0,.2)`, color: C.amber }}>
                ⚠ In reality, bcrypt.compare() would fail here and the server would return 401.
                Demo continues to show what happens if an attacker somehow got the encrypted key blob anyway.
              </div>
            )}
            <DataRow label="downloaded encrypted ECDH private key" value={String(results.encKey || '').slice(0, 44) + '...'} color={C.green} />
          </div>
        </Step>

        <Step s={steps[3]} i={3} step={step} running={running}>
          {results.success === true && (
            <div className="space-y-1.5">
              <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded font-bold"
                style={{ background:'rgba(0,255,136,.08)', border:`1px solid rgba(0,255,136,.25)`, color: C.green }}>
                ✓ AES-GCM decryption succeeded — auth tag verified. Private key restored in RAM.
              </div>
              <DangerRow label="Decrypted ECDH private key" value={String(results.decryptedKey || '').slice(0, 44) + '...'} />
            </div>
          )}
          {results.success === false && (
            <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded font-bold"
              style={{ background: C.redDim, border:`1px solid ${C.red}44`, color: C.red }}>
              ✗ AES-GCM authentication tag mismatch — wrong wrapping key → decryption throws.
              The encrypted blob is mathematically unreadable with the wrong password.
            </div>
          )}
        </Step>
      </div>
    </Panel>
  );
}

/* ─── ENCRYPTION DEMO ─────────────────────────────────────────────────────── */
function EncryptionDemo() {
  const [input, setInput]   = useState('Hello, Bob!');
  const [step, setStep]     = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError]   = useState('');

  const steps = [
    { id:'ecdh',    label:'01 — ECDH Key Agreement',  color: C.cyan,
      desc:"Alice's ECDH private key + Bob's public key → AES-256-GCM shared secret. Bob derives the identical secret on his side without it ever being transmitted." },
    { id:'encrypt', label:'02 — AES-256-GCM Encrypt', color: C.green,
      desc:"Random 96-bit IV generated. Plaintext encrypted; a 128-bit authentication tag is appended automatically by GCM — providing encryption + integrity in one pass." },
    { id:'sign',    label:'03 — ECDSA Signature',     color: C.amber,
      desc:"Alice signs the ciphertext (not the plaintext) with her ECDSA private key using SHA-256. Signing the ciphertext means any server-side tampering is detectable." },
    { id:'send',    label:'04 — Network Payload',     color: C.red,
      desc:"Only ciphertext, IV, and signature travel over the wire. The plaintext and shared secret never leave Alice's browser." },
  ];

  const run = useCallback(async () => {
    if (!input.trim()) return;
    setRunning(true); setStep(0); setResults({}); setError('');
    const enc = new TextEncoder();
    try {
      // Step 1: ECDH
      await new Promise(r => setTimeout(r, 400));
      setStep(1);
      const aliceEcdh = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveKey']);
      const bobEcdh   = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveKey']);
      const sharedSecret = await window.crypto.subtle.deriveKey(
        { name:'ECDH', public: bobEcdh.publicKey },
        aliceEcdh.privateKey,
        { name:'AES-GCM', length: 256 },
        true, // extractable for display
        ['encrypt', 'decrypt'],
      );
      const sharedRaw = await window.crypto.subtle.exportKey('raw', sharedSecret);
      setResults(p => ({ ...p, ecdh: toBase64(sharedRaw) }));

      // Step 2: Encrypt
      await new Promise(r => setTimeout(r, 700));
      setStep(2);
      const iv  = window.crypto.getRandomValues(new Uint8Array(12));
      const ct  = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv }, sharedSecret, enc.encode(input));
      setResults(p => ({ ...p, iv: toBase64(iv.buffer), ciphertext: toBase64(ct) }));

      // Step 3: Sign
      await new Promise(r => setTimeout(r, 700));
      setStep(3);
      const aliceEcdsa = await window.crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
      const sig = await window.crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, aliceEcdsa.privateKey, ct);
      setResults(p => ({ ...p, signature: toBase64(sig) }));

      // Step 4: payload summary
      await new Promise(r => setTimeout(r, 700));
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [input]);

  return (
    <Panel accent>
      <DemoHeader dot={C.green} label="Flow 3 — Alice Sends a Message" note="Interactive Simulation" />

      <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${C.border}` }}>
        <div className="flex gap-3 items-center">
          <div className="text-xs font-mono-custom" style={{ color: C.textDim, width: '130px' }}>Simulation Variable:</div>
          <input value={input} onChange={e => { setInput(e.target.value); setStep(0); setResults({}); }}
            className="flex-1 rounded-lg px-3 py-2 font-mono-custom text-sm outline-none"
            style={{ background:'rgba(0,0,0,.5)', border:`1px solid ${C.green}44`, color: C.textBright, caretColor: C.green }} />
          <button onClick={run} disabled={running || !input.trim()}
            className="px-5 py-2 rounded-lg font-mono-custom text-xs font-bold transition-all duration-200 whitespace-nowrap"
            style={{ background: running?'rgba(0,255,136,.05)':'rgba(0,255,136,.15)', border:`1px solid ${running?'rgba(0,255,136,.2)':C.green}`, color: running?C.textDim:C.green }}>
            {running ? 'Encrypting...' : 'Run Simulation →'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl px-4 py-2 mb-4 font-mono-custom text-xs" style={{ background: C.redDim, color: C.red }}>{error}</div>}

      <div className="space-y-3">
        <Step s={steps[0]} i={0} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow
              label="sharedSecret = deriveKey(Alice_priv, Bob_pub)"
              value={results.ecdh || ''}
              color={C.cyan}
            />
            <div className="font-mono-custom text-[10px] px-2 py-1 rounded"
              style={{ background:'rgba(0,229,255,.04)', color: C.textDim, border:`1px solid ${C.border}` }}>
              Note: shared secret exported for display only. In production, the real app derives it as non-extractable — it can never be read from memory.
            </div>
          </div>
        </Step>

        <Step s={steps[1]} i={1} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow label="iv (96-bit random nonce)" value={results.iv || ''} color={C.amber} />
            <DataRow label="ciphertext (AES-256-GCM output + 128-bit auth tag)" value={(results.ciphertext || '').slice(0, 64) + '...'} color={C.green} />
          </div>
        </Step>

        <Step s={steps[2]} i={2} step={step} running={running}>
          <DataRow label="ECDSA signature over ciphertext" value={(results.signature || '').slice(0, 64) + '...'} color={C.amber} />
        </Step>

        <Step s={steps[3]} i={3} step={step} running={running}>
          <div className="space-y-1">
            {[
              { k:'receiverId',  v:'a7f2c0e9-...' },
              { k:'ciphertext',  v:(results.ciphertext||'').slice(0,32)+'...' },
              { k:'iv',          v: results.iv || '' },
              { k:'signature',   v:(results.signature||'').slice(0,32)+'...' },
            ].map(r => (
              <div key={r.k} className="flex gap-2 font-mono-custom text-[10px]">
                <span style={{ color: C.textDim, minWidth: 90 }}>{r.k}:</span>
                <span style={{ color: C.textBright }} className="break-all">{r.v}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 font-mono-custom text-[10px] font-bold"
              style={{ borderTop:`1px solid ${C.border}`, color: C.red }}>
              ✗ plaintext "{input}" was never transmitted
            </div>
          </div>
        </Step>
      </div>
    </Panel>
  );
}

/* ─── DECRYPTION DEMO ─────────────────────────────────────────────────────── */
function DecryptionDemo() {
  const [scenario, setScenario] = useState<'normal' | 'tamper' | 'impersonate'>('normal');
  const [step, setStep]       = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, string | boolean>>({});

  const steps = [
    { id:'receive', label:'01 — Payload Arrives',         color: C.cyan,
      desc:"Bob's client receives ciphertext, IV, and ECDSA signature via Socket.IO." },
    { id:'ecdh',    label:'02 — ECDH Key Agreement',      color: C.cyan,
      desc:"Bob derives the AES-GCM decryption key using his Private Key + Alice's Public Key." },
    { id:'verify',  label:'03 — ECDSA Signature Verify',  color: C.amber,
      desc:"Bob verifies the signature using Alice's Public Key. This proves Alice created the message and it wasn't modified." },
    { id:'decrypt', label:'04 — AES-256-GCM Decrypt',     color: C.green,
      desc:"Bob attempts to decrypt. If the payload is tampered, AES-GCM's auth tag fails." },
  ];

  const run = useCallback(async () => {
    setRunning(true); setStep(0); setResults({});
    const enc = new TextEncoder();
    try {
      // 1. Core setup (Alice and Bob)
      const aliceEcdh  = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveKey']);
      const bobEcdh    = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveKey']);
      const aliceEcdsa = await window.crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, false, ['sign', 'verify']);
      
      const plaintext  = "Hello, Bob! It's Alice.";
      const iv         = window.crypto.getRandomValues(new Uint8Array(12));
      
      let ciphertext: ArrayBuffer;
      let signature: ArrayBuffer;

      if (scenario === 'impersonate') {
        // Eve creates her own keys to pretend to be Alice
        const eveEcdh = await window.crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveKey']);
        const eveEcdsa = await window.crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, false, ['sign', 'verify']);
        
        // Eve derives a secret using HER private key and BOB'S public key
        const eveShared = await window.crypto.subtle.deriveKey(
          { name:'ECDH', public: bobEcdh.publicKey },
          eveEcdh.privateKey,
          { name:'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
        
        // Eve encrypts and signs using HER keys, but sends it claiming sender_id="Alice"
        ciphertext = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv }, eveShared, enc.encode(plaintext));
        signature = await window.crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, eveEcdsa.privateKey, ciphertext);
      } else {
        // Normal Alice flow
        const aliceShared = await window.crypto.subtle.deriveKey(
          { name:'ECDH', public: bobEcdh.publicKey },
          aliceEcdh.privateKey,
          { name:'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
        ciphertext = await window.crypto.subtle.encrypt({ name:'AES-GCM', iv }, aliceShared, enc.encode(plaintext));
        signature = await window.crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, aliceEcdsa.privateKey, ciphertext);
      }

      // If tamper mode: flip one byte in the ciphertext
      if (scenario === 'tamper') {
        const tampered = new Uint8Array(ciphertext);
        tampered[0] ^= 0xFF; // Flip bits in the first byte
        ciphertext = tampered.buffer;
      }

      // ----------------------------------------------------
      // Bob's Receiving Flow Begins Here
      // ----------------------------------------------------

      // Step 1: Receive
      await new Promise(r => setTimeout(r, 400));
      setStep(1);
      setResults(p => ({
        ...p,
        iv:         toBase64(iv.buffer),
        ciphertext: toBase64(ciphertext),
        signature:  toBase64(signature),
      }));

      // Step 2: Bob derives key assuming it's from Alice (based on sender_id)
      await new Promise(r => setTimeout(r, 700));
      setStep(2);
      const bobShared = await window.crypto.subtle.deriveKey(
        { name:'ECDH', public: aliceEcdh.publicKey }, // Bob uses ALICE'S public key
        bobEcdh.privateKey,
        { name:'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
      );
      const bobSharedRaw = await window.crypto.subtle.exportKey('raw', bobShared);
      setResults(p => ({ ...p, shared: toBase64(bobSharedRaw) }));

      // Step 3: Verify signature using Alice's public signing key
      await new Promise(r => setTimeout(r, 700));
      setStep(3);
      const valid = await window.crypto.subtle.verify(
        { name:'ECDSA', hash:'SHA-256' },
        aliceEcdsa.publicKey,
        signature,
        ciphertext,
      );
      setResults(p => ({ ...p, sigValid: valid }));

      // Step 4: Decrypt
      await new Promise(r => setTimeout(r, 700));
      setStep(4);
      try {
        const dec = await window.crypto.subtle.decrypt({ name:'AES-GCM', iv }, bobShared, ciphertext);
        setResults(p => ({ ...p, plaintext: new TextDecoder().decode(dec) }));
      } catch {
        setResults(p => ({ ...p, plaintext: '__FAILED__' }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }, [scenario]);

  return (
    <Panel accent>
      <DemoHeader dot={C.cyan} label="Flow 4 — Bob Receives a Message" note="Interactive Simulation" />

      <div className="mb-5 p-4 rounded-xl space-y-4" style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${C.border}` }}>
        <div className="flex flex-col md:flex-row gap-2 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,.4)' }}>
          <button onClick={() => { setScenario('normal'); setStep(0); setResults({}); }}
            className="flex-1 py-1.5 rounded-md font-mono-custom text-xs transition-colors"
            style={{ background: scenario === 'normal' ? 'rgba(0,255,136,.15)' : 'transparent', color: scenario === 'normal' ? C.green : C.textDim, border: scenario === 'normal' ? `1px solid ${C.green}55` : '1px solid transparent' }}>
            Normal Delivery
          </button>
          <button onClick={() => { setScenario('tamper'); setStep(0); setResults({}); }}
            className="flex-1 py-1.5 rounded-md font-mono-custom text-xs transition-colors"
            style={{ background: scenario === 'tamper' ? 'rgba(255,184,0,.15)' : 'transparent', color: scenario === 'tamper' ? C.amber : C.textDim, border: scenario === 'tamper' ? `1px solid ${C.amber}55` : '1px solid transparent' }}>
            Tampered Ciphertext
          </button>
          <button onClick={() => { setScenario('impersonate'); setStep(0); setResults({}); }}
            className="flex-1 py-1.5 rounded-md font-mono-custom text-xs transition-colors"
            style={{ background: scenario === 'impersonate' ? 'rgba(255,59,92,.15)' : 'transparent', color: scenario === 'impersonate' ? C.red : C.textDim, border: scenario === 'impersonate' ? `1px solid ${C.red}55` : '1px solid transparent' }}>
            Eve Impersonates Alice
          </button>
        </div>

        <button onClick={run} disabled={running}
          className="w-full px-5 py-2.5 rounded-lg font-mono-custom text-sm font-bold transition-all duration-200"
          style={{ background: running?'rgba(0,229,255,.05)':C.cyanDim, border:`1px solid ${running?'rgba(0,229,255,.2)':C.cyan}`, color: running?C.textDim:C.cyan }}>
          {running ? 'Receiving & Decrypting...' : 'Run Simulation →'}
        </button>
      </div>

      {scenario === 'tamper' && (
        <div className="rounded-lg px-3 py-2 mb-4 font-mono-custom text-[10px]"
          style={{ background: 'rgba(255,184,0,.1)', border:`1px solid rgba(255,184,0,.3)`, color: C.amber }}>
          <span className="font-bold">Code executed:</span> <code>ciphertext[0] ^= 0xFF;</code><br/>
          We intercepted the AES-GCM ciphertext in transit and deliberately flipped the first byte to simulate a network tamper or database manipulation.
        </div>
      )}

      {scenario === 'impersonate' && (
        <div className="rounded-lg px-3 py-2 mb-4 font-mono-custom text-[10px]"
          style={{ background: C.redDim, border:`1px solid rgba(255,59,92,.3)`, color: C.red }}>
          <span className="font-bold">Scenario:</span> An attacker (Eve) forged the database <code>sender_id</code> to say "Alice". 
          Because Eve lacks Alice's private keys, Eve had to encrypt and sign the payload using her <i>own</i> private keys.
        </div>
      )}

      <div className="space-y-3">
        <Step s={steps[0]} i={0} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow label="iv"         value={String(results.iv || '')} color={C.amber} />
            <DataRow label="ciphertext" value={String(results.ciphertext || '').slice(0,64) + '...'} color={scenario === 'tamper' ? C.amber : C.green} />
            <DataRow label="signature"  value={String(results.signature || '').slice(0,64) + '...'} color={scenario === 'impersonate' ? C.red : C.amber} />
          </div>
        </Step>

        <Step s={steps[1]} i={1} step={step} running={running}>
          <div className="space-y-1.5">
            <DataRow label="bobShared = deriveKey(Bob_priv, Alice_pub)" value={String(results.shared || '').slice(0,44) + '...'} color={C.cyan} />
            <div className="font-mono-custom text-[10px] px-2 py-1 rounded"
              style={{ background:'rgba(0,229,255,.04)', color: C.textDim, border:`1px solid ${C.border}` }}>
              Because the database claims the sender is Alice, Bob uses Alice's public key to derive the secret.
            </div>
          </div>
        </Step>

        <Step s={steps[2]} i={2} step={step} running={running}>
          <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded font-bold"
            style={{
              background: results.sigValid ? 'rgba(0,255,136,.08)' : C.redDim,
              border: `1px solid ${results.sigValid ? 'rgba(0,255,136,.25)' : 'rgba(255,59,92,.3)'}`,
              color: results.sigValid ? C.green : C.red,
            }}>
            {results.sigValid
              ? '✓ Signature valid — ciphertext is authentic and untampered'
              : (scenario === 'impersonate' ? '✗ Signature invalid — payload was signed by Eve, not Alice. Impersonation blocked.' : '✗ Signature invalid — ciphertext was modified after Alice signed it')}
          </div>
        </Step>

        <Step s={steps[3]} i={3} step={step} running={running}>
          {results.plaintext === '__FAILED__' ? (
            <div className="font-mono-custom text-[10px] px-2 py-1.5 rounded font-bold"
              style={{ background: C.redDim, border:`1px solid rgba(255,59,92,.3)`, color: C.red }}>
              ✗ AES-GCM decryption threw an error instead of returning corrupted data.
              {scenario === 'impersonate' 
                ? " Bob's derived shared secret does not match Eve's encryption key. The GCM authentication tag failed."
                : " The AES-GCM authentication tag independently caught the flipped byte."}
            </div>
          ) : results.plaintext ? (
            <div className="font-mono-custom text-[10px] px-2 py-2 rounded"
              style={{ background:'rgba(0,255,136,.12)', border:`1px solid rgba(0,255,136,.3)` }}>
              <span style={{ color: C.green }} className="font-bold uppercase tracking-widest block mb-1">Decrypted message:</span>
              <span className="text-sm" style={{ color: C.textBright }}>"{results.plaintext}"</span>
            </div>
          ) : null}
        </Step>
      </div>
    </Panel>
  );
}

/* ─── DB Table ────────────────────────────────────────────────────────────── */
function DBTable({ name, desc, cols }: { name: string; desc: string; cols: { col: string; type: string; note: string }[] }) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="px-4 py-3 flex items-center gap-3"
        style={{ background:'rgba(0,229,255,.05)', borderBottom:`1px solid ${C.border}` }}>
        <code className="font-mono-custom text-xs font-bold" style={{ color: C.cyan }}>{name}</code>
        <span className="font-mono-custom text-xs" style={{ color: C.textDim }}>{desc}</span>
      </div>
      <div>
        {cols.map((c, i) => (
          <div key={i} className="flex gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
            style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
            <code className="font-mono-custom text-xs shrink-0 w-52" style={{ color: C.textBright }}>{c.col}</code>
            <code className="font-mono-custom text-xs shrink-0 w-40" style={{ color: C.amber }}>{c.type}</code>
            <span className="font-mono-custom text-xs" style={{ color: C.textDim }}>{c.note}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Sidebar nav ─────────────────────────────────────────────────────────── */
const SECTIONS = [
  { id:'overview',     label:'Overview' },
  { id:'demo',         label:'Live Demos' },
  { id:'architecture', label:'Architecture' },
  { id:'crypto',       label:'Cryptography' },
  { id:'keys',         label:'Key Management' },
  { id:'auth',         label:'Auth & Sessions' },
  { id:'realtime',     label:'Real-Time' },
  { id:'database',     label:'Database' },
  { id:'threats',      label:'Threat Model' },
];

function SidebarNav({ active }: { active: string }) {
  return (
    <nav className="hidden xl:flex flex-col gap-0.5 sticky top-24 self-start w-44 shrink-0">
      <div className="font-mono-custom text-[10px] tracking-[.25em] uppercase mb-3 px-3" style={{ color: C.textDim }}>
        Contents
      </div>
      {SECTIONS.map(s => (
        <a key={s.id} href={`#${s.id}`}
          className="font-mono-custom text-xs px-3 py-1.5 rounded-lg transition-all duration-200 block"
          style={{
            color:      active === s.id ? C.cyan : C.textDim,
            background: active === s.id ? C.cyanDim : 'transparent',
            borderLeft: active === s.id ? `2px solid ${C.cyan}` : '2px solid transparent',
          }}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/* ─── Threat data ─────────────────────────────────────────────────────────── */
const THREATS = [
  { threat:'Database Breach',      sev:'CRITICAL', mit:'Server stores only AES-GCM ciphertext + bcrypt-hashed auth keys. Zero plaintext. Even a full DB dump contains nothing readable — the auth key cannot reconstruct the wrapping key.' },
  { threat:'Server Compromise',    sev:'CRITICAL', mit:'True zero-knowledge design. The server never receives the plaintext password — only a derived auth key. It cannot reconstruct the wrapping key, shared secrets, or raw private keys. Compromise yields only encrypted blobs.' },
  { threat:'XSS Attack',           sev:'HIGH',     mit:'JWT stored in an HttpOnly cookie — JavaScript cannot read it. CryptoKey objects are non-serializable and live only in React state, so a script injection cannot extract them.' },
  { threat:'Man-in-the-Middle',    sev:'HIGH',     mit:'HTTPS enforced in production (Secure cookie flag, TLS). AES-GCM 128-bit auth tag detects any ciphertext tampering in transit. ECDSA signature independently detects forgery.' },
  { threat:'Message Tampering',    sev:'HIGH',     mit:'Two independent tamper-detection layers on every message: the GCM authentication tag and the ECDSA signature. Both must pass.' },
  { threat:'CSRF Attack',          sev:'MED',      mit:'SameSite=Lax cookie policy + strict CORS origin whitelist on both the REST API and Socket.IO handshake.' },
  { threat:'Replay Attack',        sev:'MED',      mit:'Cryptographically random 96-bit IV per message. AES-GCM is catastrophically insecure with IV reuse — Whisper generates a fresh one for every encrypt call. Message UUIDs deduplicate on the client.' },
  { threat:'Physical Access',      sev:'MED',      mit:'Private keys live only in React state (RAM). Closing the tab or refreshing the page destroys them permanently. No key material ever written to localStorage or IndexedDB.' },
  { threat:'Brute-Force Password', sev:'MED',      mit:'PBKDF2 × 100,000 SHA-256 iterations means each guess takes significant time. bcrypt on the server-side auth key adds a second hardening layer. The password itself never leaves the browser.' },
  { threat:'SQL Injection',        sev:'LOW',      mit:'Drizzle ORM parameterises all queries. UUID inputs validated with regex before any database operation.' },
];
const SEV: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg:'rgba(255,59,92,.07)',  border:'rgba(255,59,92,.3)',  text:'#ff3b5c' },
  HIGH:     { bg:'rgba(255,184,0,.06)',  border:'rgba(255,184,0,.3)',  text:'#ffb800' },
  MED:      { bg:'rgba(0,229,255,.04)',  border:'rgba(0,229,255,.2)',  text:'#00e5ff' },
  LOW:      { bg:'rgba(0,255,136,.04)', border:'rgba(0,255,136,.2)', text:'#00ff88' },
};

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function About() {
  const [active, setActive] = useState('overview');
  useSectionObserver();

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin:'-30% 0px -60% 0px' },
    );
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen font-mono-custom" style={{ background: C.bg, color: C.text }}>
      <FontLoader />
      <div className="font-sans"><Navbar /></div>

      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[.025]"
        style={{ background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,229,255,1) 2px,rgba(0,229,255,1) 4px)' }} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden" style={{ borderBottom:`1px solid ${C.border}` }}>
        <div className="absolute inset-0" style={{
          backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,
          backgroundSize:'60px 60px',
        }} />
        <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 80% 60% at 50% 100%,rgba(0,229,255,.06) 0%,transparent 70%)' }} />

        <div className="relative max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 font-mono-custom text-[11px] tracking-widest uppercase"
            style={{ background:'rgba(0,229,255,.07)', border:'1px solid rgba(0,229,255,.2)', color: C.cyan }}>
            A Technical Deep-Dive · Project Documentation
          </div>

          <h1 className="font-display mb-4" style={{ fontSize:'clamp(2.8rem,7vw,5.5rem)', lineHeight:1.05, letterSpacing:'-.03em' }}>
            <span style={{ color: C.textBright }}>How </span>
            <span className="shimmer-text">Whisper</span>
            <span style={{ color: C.textBright }}> Works</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm leading-relaxed mb-10" style={{ color: C.textDim }}>
            A zero-knowledge end-to-end encrypted messaging system. Every cryptographic operation runs in your browser.
            The server is architecturally incapable of reading any message — ever.
          </p>

          <div className="flex flex-wrap justify-center gap-8 mb-10">
            {[
              { v:'AES-256-GCM', l:'Encryption' },
              { v:'ECDH P-256',  l:'Key Agreement' },
              { v:'ECDSA P-256', l:'Signatures' },
              { v:'100,000×',    l:'PBKDF2 Rounds' },
              { v:'RAM Only',    l:'Key Storage' },
              { v:'0 Plaintext', l:'Stored on Server' },
            ].map(m => (
              <div key={m.l} className="text-center">
                <div className="font-display text-xl mb-0.5" style={{ color: C.cyan, filter:`drop-shadow(0 0 8px ${C.cyan}55)` }}>{m.v}</div>
                <div className="text-[11px] tracking-widest uppercase" style={{ color: C.textDim }}>{m.l}</div>
              </div>
            ))}
          </div>

          <div className="text-sm" style={{ color:'rgba(0,229,255,.3)' }}>
            <CipherText text="Initializing secure documentation..." delay={300} />
          </div>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-12 flex gap-10">
        <SidebarNav active={active} />

        <main className="flex-1 min-w-0 space-y-24">

          {/* 01 OVERVIEW */}
          <section id="overview" className="section-fade">
            <SectionTitle num="01" title="Project Overview" sub="What Whisper is, why it was built, and the core design promise" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {[
                { icon:'⭕', label:'Zero-Knowledge',     body:'The server routes encrypted payloads but is mathematically prevented from reading them. Even a full compromise yields no plaintext.' },
                { icon:'🔐', label:'Browser-Native Crypto', body:'All encryption, decryption, signing, and key derivation run inside the browser using the Web Crypto API — zero external libraries.' },
                { icon:'🛡️', label:'Defense in Depth',   body:'Three independent tamper-detection layers: TLS, AES-GCM authentication tags, and ECDSA signatures. Any single layer catches a MITM.' },
              ].map(c => (
                <Panel key={c.label} accent>
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <div className="font-bold text-sm mb-1" style={{ color: C.textBright }}>{c.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>{c.body}</div>
                </Panel>
              ))}
            </div>
            <Panel>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: C.text }}>
                <p>Whisper is built around a single guarantee: <strong style={{ color: C.cyan }}>even a fully compromised server reveals no message content.</strong> This is achieved by performing all cryptographic operations exclusively inside the user's browser, using keys that never exist in plaintext outside device RAM. The user's plaintext password never leaves the browser.</p>
                <p>The architecture uses <strong style={{ color: C.textBright }}>ECDH (Elliptic Curve Diffie-Hellman)</strong> so two users can arrive at an identical encryption key without ever transmitting it. Messages are encrypted with <strong style={{ color: C.textBright }}>AES-256-GCM</strong> — an authenticated cipher that both encrypts and guarantees integrity. Every ciphertext is then signed with <strong style={{ color: C.textBright }}>ECDSA</strong> so recipients can verify the message genuinely came from the claimed sender.</p>
                <p>Private keys are wrapped (encrypted) with a <strong style={{ color: C.textBright }}>wrapping key</strong> derived via <strong style={{ color: C.textBright }}>PBKDF2 dual-derivation</strong>. The password produces 512 bits of key material split into an <strong style={{ color: C.cyan }}>auth key</strong> (sent to the server for bcrypt verification) and a <strong style={{ color: C.cyan }}>wrapping key</strong> (stays in the browser to encrypt private keys). The two halves are cryptographically independent — the server cannot reconstruct the wrapping key from the auth key.</p>
              </div>
            </Panel>
          </section>

          {/* 02 LIVE DEMOS */}
          <section id="demo" className="section-fade">
            <SectionTitle num="02" title="Interactive Demonstrations" sub="Real Web Crypto API operations running in your browser — nothing sent to any server" />
            <div className="space-y-10">
              <RegistrationDemo />
              <LoginDemo />
              <EncryptionDemo />
              <DecryptionDemo />
            </div>
          </section>

          {/* 03 ARCHITECTURE */}
          <section id="architecture" className="section-fade">
            <SectionTitle num="03" title="System Architecture" sub="Three zones, strict data boundaries, and why the server can never cheat" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1 mb-5">
              {[
                { label:'BROWSER',    color: C.cyan, items:['ECDH Private Key (RAM only)','ECDSA Private Key (RAM only)','AES-256-GCM Shared Secret (derived, non-extractable)','Web Crypto API operations','React state — never localStorage'] },
                { label:'NETWORK',   color: C.textDim, items:['HTTPS / TLS in production','Socket.IO over WSS','Payload: ciphertext + iv + signature','Zero plaintext in transit'] },
                { label:'SERVER + DB', color: C.red, items:['Receives ciphertext blobs only','Stores ciphertext, iv, signature','Stores wrapped private keys','Cannot decrypt — ever'] },
              ].map((l, i) => (
                <div key={i} className="flex flex-col">
                  <div className="rounded-t-xl px-4 py-2 font-mono-custom text-xs font-bold tracking-widest text-center"
                    style={{ background:`${l.color}14`, border:`1px solid ${l.color}44`, borderBottom:'none', color: l.color }}>
                    {l.label}
                  </div>
                  <div className="flex-1 rounded-b-xl p-4 space-y-2"
                    style={{ background:'rgba(0,0,0,.3)', border:`1px solid ${l.color}22`, borderTop:'none' }}>
                    {l.items.map((item, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="text-xs mt-0.5" style={{ color: l.color }}>›</span>
                        <span className="text-xs" style={{ color: C.text }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel>
                <MonoLabel>Tech Stack</MonoLabel>
                <div className="mt-3 space-y-2">
                  {[
                    ['Frontend',   'React 19 + Vite 7 + TypeScript'],
                    ['Backend',    'Node.js + Express 5'],
                    ['Real-Time',  'Socket.IO 4.8'],
                    ['Database',   'PostgreSQL + Drizzle ORM'],
                    ['Auth',       'JWT (HttpOnly cookie) + bcrypt'],
                    ['Crypto',     'Web Crypto API (browser-native)'],
                    ['Styling',    'Tailwind CSS v4 + custom @theme'],
                    ['Deploy',     'Vercel (FE) + Render (BE)'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: C.textDim }}>{k}</span>
                      <span className="text-xs font-bold" style={{ color: C.textBright }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <MonoLabel>Boot Sequence</MonoLabel>
                <div className="mt-3 space-y-2">
                  {[
                    'Frontend polls GET /api/health every 4 seconds',
                    'Backend loads env vars, creates Express + HTTP server',
                    'Socket.IO attaches to same HTTP server',
                    'Pool pre-warm: SELECT 1 forces first DB connection open',
                    'Health returns 200 → serverReady = true',
                    'React Router renders route tree',
                    'Unauthenticated users → /login; authenticated → /',
                  ].map((s, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0"
                        style={{ background: C.cyanDim, color: C.cyan }}>{i + 1}</span>
                      <span className="text-xs leading-relaxed" style={{ color: C.text }}>{s}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          {/* 04 CRYPTOGRAPHY */}
          <section id="crypto" className="section-fade">
            <SectionTitle num="04" title="Cryptographic Protocol" sub="Every algorithm, every choice, every reason" />
            <div className="space-y-4">
              <Panel>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><Tag>ECDH</Tag><Tag color="amber">Key Agreement</Tag></div>
                    <h3 className="font-display text-2xl" style={{ color: C.textBright }}>Elliptic Curve Diffie-Hellman</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs" style={{ color: C.textDim }}>Curve</div>
                    <div className="font-bold text-sm" style={{ color: C.cyan }}>P-256 (secp256r1)</div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed mb-4" style={{ color: C.text }}>
                  ECDH allows two parties to derive an identical shared secret without transmitting it. Alice has her ECDH private key and Bob's public key. Bob has his ECDH private key and Alice's public key. Due to elliptic curve math:{' '}
                  <code style={{ color: C.cyan }}>Alice_priv × Bob_pub = Bob_priv × Alice_pub = sharedSecret</code>. The server sees both public keys but cannot compute the shared secret without a private key.
                </p>
                <div className="rounded-xl p-4 mb-4" style={{ background:'rgba(0,0,0,.4)', border:`1px solid ${C.border}` }}>
                  <div className="text-[11px] space-y-1" style={{ color: C.textDim }}>
                    <div><span style={{ color: C.cyan }}>Alice</span>: <code>deriveKey(Alice_privECDH, Bob_pubECDH)</code> <span style={{ color: C.green }}>→ sharedSecret</span></div>
                    <div><span style={{ color: C.amber }}>Bob</span>&nbsp;&nbsp;: <code>deriveKey(Bob_privECDH, Alice_pubECDH)</code> <span style={{ color: C.green }}>→ sharedSecret (identical)</span></div>
                    <div className="pt-2" style={{ borderTop:`1px solid ${C.border}`, color: C.red }}>Server sees both public keys — cannot derive sharedSecret without a private key</div>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { l:'Output', v:'AES-256-GCM key' },
                    { l:'Security', v:'~128-bit equiv.' },
                    { l:'Key storage', v:'Non-extractable in production' },
                    { l:'Caching', v:'Per-contact in-memory cache' },
                  ].map(r => (
                    <div key={r.l} className="text-xs p-2 rounded-lg" style={{ background:'rgba(0,229,255,.05)', border:`1px solid ${C.border}` }}>
                      <div style={{ color: C.textDim }}>{r.l}</div>
                      <div style={{ color: C.textBright }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <div className="flex items-start gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><Tag color="green">AES-256-GCM</Tag><Tag color="green">Authenticated Encryption</Tag></div>
                    <h3 className="font-display text-2xl" style={{ color: C.textBright }}>Encrypt + Authenticate in One Pass</h3>
                  </div>
                </div>
                <p className="text-xs leading-relaxed mb-4" style={{ color: C.text }}>
                  AES-256-GCM simultaneously encrypts data <em>and</em> produces a 128-bit authentication tag. A single call to{' '}
                  <code style={{ color: C.cyan }}>crypto.subtle.decrypt()</code> both decrypts and verifies integrity — if even one byte was modified, decryption throws rather than returning corrupted plaintext.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { l:'Key', v:'256-bit (32 bytes)' },
                    { l:'IV / Nonce', v:'96-bit random per message' },
                    { l:'Auth Tag', v:'128-bit (GCM appends)' },
                    { l:'Mode', v:'Counter (stream cipher)' },
                  ].map(r => (
                    <div key={r.l} className="rounded-xl p-3 text-center" style={{ background:'rgba(0,255,136,.04)', border:'1px solid rgba(0,255,136,.15)' }}>
                      <div className="text-[10px] mb-1" style={{ color: C.textDim }}>{r.l}</div>
                      <div className="text-xs font-bold" style={{ color: C.green }}>{r.v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: C.redDim, border:'1px solid rgba(255,59,92,.25)' }}>
                  <div className="flex items-start gap-2">
                    <span style={{ color: C.red }}>⚠</span>
                    <div className="text-xs leading-relaxed" style={{ color: C.text }}>
                      <strong style={{ color: C.red }}>IV Reuse = Catastrophic Failure.</strong> If the same (key, IV) pair is ever reused, AES-GCM leaks its authentication key — allowing an attacker to forge arbitrary authenticated messages. XORing two ciphertexts also recovers the XOR of plaintexts. Whisper generates a fresh cryptographically random 96-bit IV via <code style={{ color: C.amber }}>crypto.getRandomValues()</code> for every single message.
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <div className="flex items-start gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><Tag color="amber">ECDSA</Tag><Tag color="amber">Digital Signatures</Tag></div>
                    <h3 className="font-display text-2xl" style={{ color: C.textBright }}>Proving Authorship & Detecting Forgery</h3>
                  </div>
                </div>
                <p className="text-xs leading-relaxed mb-4" style={{ color: C.text }}>
                  After encrypting, the <strong style={{ color: C.textBright }}>ciphertext</strong> (not the plaintext) is signed with the sender's ECDSA private key. Signing the ciphertext is a deliberate design choice: the server stores and forwards the ciphertext, so signing it lets the recipient verify that the encrypted blob wasn't altered by the server or in transit.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { q:'Why sign the ciphertext, not the plaintext?', a:"The server stores and forwards the ciphertext. Signing it means any server-side modification — intentional or accidental — is detectable by the recipient before decryption." },
                    { q:'What does failed verification mean?', a:'Either the ciphertext was modified after signing, or the message was not produced by the claimed sender. A red ⚠ warning replaces the message text in both cases.' },
                    { q:'Why skip verifying your own messages?', a:'You produced and signed them yourself. Re-verifying your own signature is redundant. The code skips ECDSA verification when senderId === userId.' },
                  ].map(c => (
                    <div key={c.q} className="rounded-xl p-3" style={{ background:'rgba(255,184,0,.04)', border:'1px solid rgba(255,184,0,.15)' }}>
                      <div className="text-xs font-bold mb-1" style={{ color: C.amber }}>{c.q}</div>
                      <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>{c.a}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          {/* 05 KEY MANAGEMENT */}
          <section id="keys" className="section-fade">
            <SectionTitle num="05" title="Key Management" sub="How private keys are created, protected, stored, and restored" />
            <div className="space-y-4">
              <Panel>
                <MonoLabel>Two Key Pairs — Two Distinct Roles</MonoLabel>
                <p className="text-xs leading-relaxed mt-2 mb-4" style={{ color: C.text }}>
                  Cryptographic best practice prohibits using the same key pair for both key exchange and signing. They have different mathematical properties, different failure modes, and different required parameters in the Web Crypto API.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-4" style={{ background:'rgba(0,229,255,.04)', border:'1px solid rgba(0,229,255,.2)' }}>
                    <div className="font-bold text-sm mb-2" style={{ color: C.cyan }}>ECDH Key Pair</div>
                    <div className="text-xs space-y-1" style={{ color: C.text }}>
                      <div>Purpose: <span style={{ color: C.textBright }}>key agreement</span></div>
                      <div>Curve: <span style={{ color: C.textBright }}>P-256 (secp256r1)</span></div>
                      <div>Usages: <code style={{ color: C.cyan }}>deriveKey, deriveBits</code></div>
                      <div className="pt-1 text-xs leading-relaxed" style={{ color: C.textDim }}>Public key shared with every contact. Private key wrapped with the PBKDF2-derived wrapping key before upload. Derived shared secrets are marked non-extractable.</div>
                    </div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background:'rgba(255,184,0,.04)', border:'1px solid rgba(255,184,0,.2)' }}>
                    <div className="font-bold text-sm mb-2" style={{ color: C.amber }}>ECDSA Key Pair</div>
                    <div className="text-xs space-y-1" style={{ color: C.text }}>
                      <div>Purpose: <span style={{ color: C.textBright }}>digital signatures</span></div>
                      <div>Curve: <span style={{ color: C.textBright }}>P-256 (secp256r1)</span></div>
                      <div>Usages: <code style={{ color: C.amber }}>sign</code> / <code style={{ color: C.amber }}>verify</code></div>
                      <div className="pt-1 text-xs leading-relaxed" style={{ color: C.textDim }}>Public key stored as publicSigningKey and shared with contacts. Private key wrapped separately with its own unique IV.</div>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <MonoLabel>PBKDF2 Dual-Derivation Flow</MonoLabel>
                <p className="text-xs leading-relaxed mt-2 mb-4" style={{ color: C.text }}>
                  The plaintext password <strong style={{ color: C.red }}>never leaves the browser</strong>. PBKDF2 derives 512 bits from the password + salt. Those 64 bytes are split in half: the first 32 become the <strong style={{ color: C.cyan }}>auth key</strong> (sent to the server for bcrypt verification), and the last 32 become the <strong style={{ color: C.green }}>wrapping key</strong> (stays in the browser). The two halves are cryptographically independent — knowing the auth key reveals nothing about the wrapping key.
                </p>
                <div className="overflow-x-auto pb-2">
                  <div className="flex items-center gap-0 min-w-max">
                    {[
                      { label:'Password',     sub:'user input',              color: C.amber },
                      { label:'PBKDF2',       sub:'100k × SHA-256',         color: C.cyan },
                      { label:'512 bits',     sub:'64 bytes output',         color: C.cyan },
                      { label:'Auth Key',     sub:'bytes 0–31 → server',    color: C.red },
                      { label:'Wrapping Key', sub:'bytes 32–63 → browser',  color: C.green },
                    ].map((n, i, arr) => (
                      <div key={i} className="flex items-center">
                        <div className="text-center px-3">
                          <div className="rounded-xl px-3 py-2 text-xs font-bold"
                            style={{ background:'rgba(0,0,0,.4)', border:`1px solid ${n.color}44`, color: n.color, minWidth: 110 }}>
                            {n.label}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: C.textDim }}>{n.sub}</div>
                        </div>
                        {i < arr.length - 1 && (
                          <div className="h-px w-8 mb-4"
                            style={{ background:`linear-gradient(90deg,${n.color}88,${arr[i+1].color}88)` }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                  {[
                    { t:'Random 16-byte Salt',   d:'Generated with crypto.getRandomValues(). Two users with the same password get different key material. Prevents rainbow table attacks.' },
                    { t:'100,000 Iterations',    d:'SHA-256 hashes the password+salt 100,000 times. Makes brute-force guessing take seconds per attempt instead of microseconds.' },
                    { t:'Dual-Derivation Split', d:'512 bits sliced in half. The two halves are cryptographically independent — the auth key reveals nothing about the wrapping key.' },
                    { t:'AES-GCM Wrapping',      d:'Each private key is exported to PKCS8, then AES-GCM encrypted with the wrapping key using a unique random 12-byte IV.' },
                  ].map(c => (
                    <div key={c.t} className="rounded-xl p-3" style={{ background:'rgba(0,0,0,.3)', border:`1px solid ${C.border}` }}>
                      <div className="text-xs font-bold mb-1" style={{ color: C.textBright }}>{c.t}</div>
                      <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>{c.d}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <MonoLabel>What the Server Stores vs. What It Can Do With It</MonoLabel>
                <div className="mt-3 space-y-1.5">
                  {[
                    { field:'public_key',                      val:'ECDH public key (Base64)',         verdict:'Public by design — safe to store and share' },
                    { field:'encrypted_private_key',           val:'AES-GCM wrapped ECDH private key', verdict:"Useless without the user's password" },
                    { field:'key_iv',                          val:'12-byte AES-GCM IV',               verdict:'Non-secret — needed for decryption but harmless alone' },
                    { field:'key_salt',                        val:'16-byte PBKDF2 salt',              verdict:'Non-secret — cannot be reversed to recover the password' },
                    { field:'public_signing_key',              val:'ECDSA public key (Base64)',        verdict:'Public by design — used for signature verification' },
                    { field:'encrypted_signing_private_key',   val:'AES-GCM wrapped ECDSA key',        verdict:"Useless without the user's password" },
                  ].map(r => (
                    <div key={r.field} className="flex gap-3 items-start rounded-lg px-3 py-2" style={{ background:'rgba(0,0,0,.2)' }}>
                      <code className="text-[11px] shrink-0 w-52" style={{ color: C.cyan }}>{r.field}</code>
                      <span className="text-[11px] shrink-0 w-44" style={{ color: C.text }}>{r.val}</span>
                      <span className="text-[11px]" style={{ color: C.textDim }}>{r.verdict}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          {/* 06 AUTH */}
          <section id="auth" className="section-fade">
            <SectionTitle num="06" title="Authentication & Sessions" sub="Registration, login, JWT cookies, cross-tab sync, and logout" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Panel>
                <MonoLabel color={C.green}>Registration Flow</MonoLabel>
                <div className="mt-3 space-y-2.5">
                  {[
                    'Generate ECDH + ECDSA key pairs in browser',
                    'Generate random 16-byte PBKDF2 salt',
                    'Dual-derive: PBKDF2(password, salt) → 512 bits → auth key + wrapping key',
                    'Wrap both private keys with AES-GCM using separate random IVs',
                    'POST authKey + wrapped keys + public keys (password never sent)',
                    'Server: bcrypt-hash the authKey (10 rounds)',
                    'Server: INSERT with onConflictDoNothing on username',
                    'Browser: navigate to /login with success flash',
                  ].map((s, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0"
                        style={{ background:'rgba(0,255,136,.1)', color: C.green }}>{i + 1}</span>
                      <span className="text-xs leading-relaxed" style={{ color: C.text }}>{s}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <MonoLabel color={C.cyan}>Login + Key Unwrapping</MonoLabel>
                <div className="mt-3 space-y-2.5">
                  {[
                    'GET /salt/:username — fetch PBKDF2 salt (dummy salt returned for unknown users to prevent enumeration)',
                    'Browser: dual-derive PBKDF2(password, salt) → auth key + wrapping key',
                    'POST username + authKey (password never sent over the network)',
                    'Server: bcrypt.compare() verifies authKey against stored hash',
                    'Server: sign JWT { userId, username } — 24h expiry',
                    'Server: set HttpOnly Secure SameSite=Lax cookie + return encrypted key material',
                    'Browser: unwrap both private keys using the locally-derived wrapping key',
                    'Browser: importKey() both blobs as live ECDH + ECDSA CryptoKeys',
                    'AuthContext.login() stores keys in React state — never localStorage',
                  ].map((s, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0"
                        style={{ background: C.cyanDim, color: C.cyan }}>{i + 1}</span>
                      <span className="text-xs leading-relaxed" style={{ color: C.text }}>{s}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { t:'JWT HttpOnly Cookie', tag:'Security', d:"The JWT is set exclusively as an HttpOnly, Secure, SameSite=Lax cookie. JavaScript cannot read HttpOnly cookies — protecting the token against XSS. The cookie is sent automatically with all API requests and WebSocket handshakes. The JWT never appears in the response body." },
                { t:'Cross-Tab Sync',      tag:'UX',       d:'Login/logout writes a timestamp to localStorage("auth_sync"). Other tabs listen for the storage event and call window.location.reload(). Since CryptoKey objects cannot be serialised, a reload forces re-authentication — all tabs stay consistent.' },
                { t:'Logout Behavior',     tag:'Security', d:'Logout simultaneously: disconnects all active Socket.IO sockets for the userId server-side, clears the JWT cookie via Set-Cookie, and zeroes all React state (user, userId, ecdhPrivateKey, ecdsaPrivateKey → null). Route guards redirect to /login.' },
              ].map(c => (
                <Panel key={c.t}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: C.textBright }}>{c.t}</span>
                    <Tag color={c.tag === 'Security' ? 'red' : 'cyan'}>{c.tag}</Tag>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: C.textDim }}>{c.d}</p>
                </Panel>
              ))}
            </div>
          </section>

          {/* 07 REAL-TIME */}
          <section id="realtime" className="section-fade">
            <SectionTitle num="07" title="Real-Time Layer" sub="Socket.IO, message routing, multi-tab support, and optimistic UI" />
            <div className="space-y-4">
              <Panel>
                <MonoLabel>Socket Authentication</MonoLabel>
                <p className="text-xs leading-relaxed mt-2 mb-3" style={{ color: C.text }}>
                  Every Socket.IO connection — including reconnects — passes through JWT middleware before any event handlers fire.{' '}
                  <code style={{ color: C.cyan }}>withCredentials: true</code> on the client sends the HttpOnly cookie with the WebSocket upgrade handshake. The JWT never needs to be exposed to client JavaScript.
                </p>
                <div className="rounded-xl p-4 text-[11px] space-y-1" style={{ background:'rgba(0,0,0,.4)', border:`1px solid ${C.border}` }}>
                  <div style={{ color: C.textDim }}>// Socket middleware — runs on every connection attempt</div>
                  <div><span style={{ color: C.cyan }}>parse</span>(<span style={{ color: C.amber }}>socket.handshake.headers.cookie</span>) → extract whisper_token</div>
                  <div><span style={{ color: C.cyan }}>jwt.verify</span>(token, JWT_SECRET) → throws on invalid/expired</div>
                  <div><span style={{ color: C.amber }}>socket.data.userId</span> = decoded.userId <span style={{ color: C.textDim }}>// stamped permanently</span></div>
                  <div className="pt-1" style={{ color: C.textDim }}>// ALL event handlers read senderId from socket.data.userId — never from the client payload</div>
                </div>
              </Panel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel>
                  <MonoLabel>Connected Users Map</MonoLabel>
                  <div className="mt-3 rounded-xl p-3 text-[11px] space-y-1 mb-3"
                    style={{ background:'rgba(0,0,0,.4)', border:`1px solid ${C.border}` }}>
                    <div style={{ color: C.cyan }}>connectedUsers: Map&lt;userId, Set&lt;socketId&gt;&gt;</div>
                    <div style={{ color: C.textDim }}>// Multiple sockets per user = multiple open tabs</div>
                    <div style={{ color: C.green }}>on 'connect'    → set.add(socket.id)</div>
                    <div style={{ color: C.red }}>on 'disconnect' → set.delete(socket.id)</div>
                    <div style={{ color: C.textDim }}>// if set.size === 0 → delete userId entry</div>
                  </div>
                  <p className="text-xs" style={{ color: C.textDim }}>A Set per user ensures messages reach all open tabs. A single socket ID would silently drop messages to tabs other than the sender's active one.</p>
                </Panel>
                <Panel>
                  <MonoLabel>Multi-Tab Message Flow</MonoLabel>
                  <div className="mt-3 space-y-2 text-xs">
                    {[
                      { t:'Tab A emits sendMessage',                                    c: C.textBright },
                      { t:'Server: DB transaction (INSERT messages + UPSERT conversations)', c: C.textDim },
                      { t:'messageSaved → Tab A only (confirm + swap tempId)',          c: C.green },
                      { t:"receiveMessage → Tab B, Tab C (sender's other tabs)",        c: C.cyan },
                      { t:'receiveMessage → all receiver sockets',                      c: C.cyan },
                      { t:'Tab A skips receiveMessage — already has the optimistic entry', c: C.textDim },
                    ].map((r, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span style={{ color: C.textDim }}>›</span>
                        <span style={{ color: r.c }}>{r.t}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel>
                <MonoLabel>Socket Events Reference</MonoLabel>
                <div className="mt-3 space-y-2">
                  {[
                    { ev:'sendMessage',    dir:'client→server',  payload:'{ receiverId, ciphertext, iv, signature, tempId }', note:'senderId = socket.data.userId (JWT). Never trusted from client payload.' },
                    { ev:'messageSaved',   dir:'server→sender',  payload:'{ tempId, message: { id, createdAt, ... } }',       note:'Confirms DB write. Frontend swaps tempId → real UUID, clears pending flag.' },
                    { ev:'receiveMessage', dir:'server→all',     payload:'savedMessage (full object)',                        note:'Sent to all receiver sockets + all other sender sockets (multi-tab sync).' },
                    { ev:'messageError',   dir:'server→sender',  payload:'{ tempId, error }',                                note:'DB transaction failed. Frontend marks optimistic entry as failed.' },
                    { ev:'inboxUpdated',   dir:'server→receiver', payload:'(empty signal)',                                   note:'Fired when a pending auto-contact row is created. Triggers sidebar refresh.' },
                  ].map(r => (
                    <div key={r.ev} className="rounded-xl p-3" style={{ background:'rgba(0,0,0,.2)', border:`1px solid ${C.border}` }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <code className="text-sm font-bold" style={{ color: C.cyan }}>{r.ev}</code>
                        <Tag color={r.dir.includes('client') ? 'amber' : 'cyan'}>{r.dir}</Tag>
                      </div>
                      <div className="text-[11px] mb-1" style={{ color: C.amber }}>{r.payload}</div>
                      <div className="text-xs" style={{ color: C.textDim }}>{r.note}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          {/* 08 DATABASE */}
          <section id="database" className="section-fade">
            <SectionTitle num="08" title="Database Schema" sub="Four tables, strict constraints, and a denormalized inbox for performance" />
            <div className="space-y-4">
              <DBTable name="users" desc="Account credentials and cryptographic key material"
                cols={[
                  { col:'id',                            type:'uuid PK',     note:'Auto-generated. FK target for messages, contacts, and conversations.' },
                  { col:'username',                      type:'text UNIQUE', note:'Login identifier. onConflictDoNothing prevents a TOCTOU race at registration.' },
                  { col:'password_hash',                 type:'text',        note:'bcrypt hash of the PBKDF2-derived auth key (not the raw password).' },
                  { col:'public_key',                    type:'text',        note:'ECDH P-256 public key (Base64). Shared with contacts for key agreement.' },
                  { col:'encrypted_private_key',         type:'text',        note:"AES-GCM wrapped ECDH private key. Useless without the user's password." },
                  { col:'key_iv + key_salt',             type:'text',        note:'IV for ECDH wrapping + PBKDF2 salt. Non-secret; harmless without the password.' },
                  { col:'public_signing_key',            type:'text',        note:'ECDSA P-256 public key. Used by recipients to verify message signatures.' },
                  { col:'encrypted_signing_private_key', type:'text',        note:'AES-GCM wrapped ECDSA private key. Wrapped separately with its own IV.' },
                ]} />
              <DBTable name="messages" desc="Encrypted payloads only — server cannot read any of this"
                cols={[
                  { col:'id',          type:'uuid PK',       note:'Unique message ID. Used for client-side deduplication.' },
                  { col:'sender_id',   type:'uuid FK→users', note:'Set from JWT — never from the client payload.' },
                  { col:'receiver_id', type:'uuid FK→users', note:'Recipient of the message.' },
                  { col:'ciphertext',  type:'text',          note:'AES-256-GCM encrypted content (Base64). Server cannot decrypt.' },
                  { col:'iv',          type:'text',          note:'Random 96-bit IV (Base64). Unique per message. Required for decryption.' },
                  { col:'signature',   type:'text',          note:'ECDSA signature of the ciphertext. Verifies sender authenticity.' },
                  { col:'created_at',  type:'timestamp',      note:'Server-assigned. Indexed for efficient history queries.' },
                ]} />
              <DBTable name="contacts" desc="Directional relationships with accept/pending states"
                cols={[
                  { col:'owner_id',                    type:'uuid FK',              note:'The user who owns this contact entry.' },
                  { col:'contact_id',                  type:'uuid FK',              note:'The contact being referenced.' },
                  { col:'status',                      type:"text DEFAULT 'accepted'", note:"'accepted' = manually added. 'pending' = auto-created on first incoming message." },
                  { col:'UNIQUE(owner_id, contact_id)', type:'constraint',          note:'Prevents duplicates. onConflictDoUpdate upgrades pending → accepted.' },
                ]} />
              <DBTable name="conversations" desc="Denormalized inbox — avoids GROUP BY on the messages table"
                cols={[
                  { col:'user1_id + user2_id',          type:'uuid FK pair',  note:'Canonical ordering: user1_id < user2_id enforced by CHECK constraint. One row per pair.' },
                  { col:'last_message_at',               type:'timestamp',      note:'Updated on every UPSERT. Powers inbox sort in O(contacts), not O(messages).' },
                  { col:'UNIQUE(user1_id, user2_id)',   type:'constraint',     note:'Prevents duplicate conversation rows.' },
                  { col:'CHECK(user1_id < user2_id)',   type:'constraint',     note:'Eliminates (A,B) / (B,A) duplicates regardless of who sent the first message.' },
                ]} />
            </div>
          </section>

          {/* 09 THREATS */}
          <section id="threats" className="section-fade">
            <SectionTitle num="09" title="Threat Model" sub="Known attack vectors, mitigations, and honest tradeoffs" />
            <div className="space-y-2 mb-6">
              {THREATS.map(t => {
                const s = SEV[t.sev];
                return (
                  <div key={t.threat} className="flex gap-4 items-start rounded-xl p-4 card-hover"
                    style={{ background: s.bg, border:`1px solid ${s.border}44` }}>
                    <div className="shrink-0 w-24 text-center">
                      <div className="rounded-lg px-2 py-1 font-bold text-[10px] tracking-widest"
                        style={{ background: s.bg, border:`1px solid ${s.border}`, color: s.text }}>{t.sev}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm mb-1" style={{ color: C.textBright }}>{t.threat}</div>
                      <div className="text-xs leading-relaxed" style={{ color: C.textDim }}>{t.mit}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Panel>
              <MonoLabel color={C.amber}>Intentional Security Tradeoffs</MonoLabel>
              <div className="mt-3 space-y-4">
                {[
                  { t:'Page Refresh Requires Re-Login', verdict:'Intentional security decision', color: C.amber,
                    d:'CryptoKey objects live only in React state and cannot be serialised to localStorage or IndexedDB without compromising security. A page refresh destroys all key material permanently. This is by design — physical access to an unattended computer cannot recover session keys. Worse UX, meaningfully better security.' },
                  { t:'No Perfect Forward Secrecy (PFS)', verdict:'Known limitation', color: C.red,
                    d:"The same ECDH key pair is reused across all conversations. If the ECDH private key were compromised, all stored ciphertext on the server would become decryptable. True PFS requires ephemeral per-session key rotation (e.g. Signal Protocol's Double Ratchet algorithm). Significantly more complex to implement." },
                  { t:'No Password Recovery', verdict:'Intentional security decision', color: C.amber,
                    d:"The password is the sole input to PBKDF2 dual-derivation, which produces the wrapping key that encrypts your private keys. The server never receives the password or the wrapping key — so it cannot help you recover them. If you forget your password, your private keys are permanently inaccessible: no reset, no recovery, no message history. This is the inherent cost of a true zero-knowledge system." },
                ].map(c => (
                  <div key={c.t} className="rounded-xl p-4" style={{ background:'rgba(0,0,0,.25)', border:`1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: C.textBright }}>{c.t}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                        style={{ background:'rgba(255,255,255,.05)', color: c.color }}>{c.verdict}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: C.textDim }}>{c.d}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

        </main>
      </div>
    </div>
  );
}