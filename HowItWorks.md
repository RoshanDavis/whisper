# Whisper — How It Works

> A complete, in-depth breakdown of every moving part in the Whisper codebase.
> Covers **what** each piece does, **why** the design choice was made, **where** the code lives,
> **how** it is implemented, and **when** each piece executes at runtime.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technology Stack & Why Each Was Chosen](#3-technology-stack--why-each-was-chosen)
4. [Application Boot Sequence](#4-application-boot-sequence)
5. [Cryptographic Architecture](#5-cryptographic-architecture)
   - 5.1 [Key Generation (Registration)](#51-key-generation-registration)
   - 5.2 [Key Wrapping with PBKDF2](#52-key-wrapping-with-pbkdf2)
   - 5.3 [Key Unwrapping (Login)](#53-key-unwrapping-login)
   - 5.4 [Shared Secret Derivation (ECDH)](#54-shared-secret-derivation-ecdh)
   - 5.5 [Message Encryption (AES-256-GCM)](#55-message-encryption-aes-256-gcm)
   - 5.6 [Message Decryption](#56-message-decryption)
   - 5.7 [Digital Signatures (ECDSA)](#57-digital-signatures-ecdsa)
   - 5.8 [Signature Verification](#58-signature-verification)
6. [Authentication & Session Management](#6-authentication--session-management)
   - 6.1 [Registration Flow](#61-registration-flow)
   - 6.2 [Login Flow](#62-login-flow)
   - 6.3 [JWT Middleware](#63-jwt-middleware)
   - 6.4 [Session Restoration (`/me`)](#64-session-restoration-me)
   - 6.5 [Logout Flow](#65-logout-flow)
   - 6.6 [Cross-Tab Sync](#66-cross-tab-sync)
7. [Database Layer](#7-database-layer)
   - 7.1 [Schema Design](#71-schema-design)
   - 7.2 [Connection Pool & Resilience](#72-connection-pool--resilience)
   - 7.3 [Migrations](#73-migrations)
8. [API Routes](#8-api-routes)
9. [Real-Time Layer (Socket.IO)](#9-real-time-layer-socketio)
   - 9.1 [Socket Authentication](#91-socket-authentication)
   - 9.2 [Connected Users Map](#92-connected-users-map)
   - 9.3 [Message Flow](#93-message-flow)
   - 9.4 [Auto-Contact Creation](#94-auto-contact-creation)
   - 9.5 [Multi-Tab Support](#95-multi-tab-support)
10. [Frontend Architecture](#10-frontend-architecture)
    - 10.1  [Entry Point & Provider Hierarchy](#101-entry-point--provider-hierarchy)
    - 10.2  [Routing & Guards](#102-routing--guards)
    - 10.3  [Health Check & Wake-Up Screen](#103-health-check--wake-up-screen)
    - 10.4  [AuthContext](#104-authcontext)
    - 10.5  [SocketContext](#105-socketcontext)
    - 10.6  [Chat Page Layout](#106-chat-page-layout)
    - 10.7  [ContactsSidebar Component](#107-contactssidebar-component)
    - 10.8  [ChatArea Component](#108-chatarea-component)
    - 10.9  [Navbar Component](#109-navbar-component)
    - 10.10 [Utility Modules](#1010-utility-modules)
    - 10.11 [Styling System](#1011-styling-system)
11. [Data Flow: Sending a Message (End-to-End)](#11-data-flow-sending-a-message-end-to-end)
12. [Data Flow: Receiving a Message (End-to-End)](#12-data-flow-receiving-a-message-end-to-end)
13. [Security Model](#13-security-model)
14. [Development & Deployment Configuration](#14-development--deployment-configuration)
15. [Database Migration History](#15-database-migration-history)

---

## 1. Project Overview

**What:** Whisper is a real-time web chat application that provides end-to-end encryption (E2EE). The server is a "blind courier" — it stores and routes encrypted data but can never read the plaintext of any message. All cryptographic operations happen inside the user's browser using the native Web Crypto API.

**Why:** The goal is zero-knowledge messaging. Even if the server database is fully compromised, an attacker obtains only ciphertext, IVs, signatures, and password-wrapped private keys — none of which reveal message contents without the user's password.

**How (summary):**
- **ECDH** (Elliptic Curve Diffie-Hellman) negotiates a per-pair shared secret between two users.
- **AES-256-GCM** encrypts every message with a per-message random IV.
- **ECDSA** digitally signs every outgoing ciphertext to guarantee authenticity.
- **PBKDF2** derives a wrapping key from the user's password to encrypt private keys before they ever leave the browser.

---

## 2. Repository Structure

```
whisper/                          ← Monorepo root
├── CONTEXT.md                    ← Living design document (project status & decisions)
├── README.md                     ← High-level project description
├── HowItWorks.md                 ← This file
│
├── backend/                      ← Express + Socket.IO server
│   ├── package.json              ← Backend dependencies & scripts
│   ├── tsconfig.json             ← TypeScript config (target ES2022, CommonJS output)
│   ├── drizzle.config.ts         ← Drizzle Kit config (schema path, PG dialect)
│   ├── drizzle/                  ← Generated SQL migration files
│   │   ├── 0000_gigantic_harry_osborn.sql   ← Initial schema: users, messages, contacts
│   │   ├── 0001_tiny_jasper_sitwell.sql     ← Adds conversations table + indexes
│   │   ├── 0002_loose_justice.sql           ← Adds status column to contacts
│   │   └── meta/                            ← Drizzle migration metadata/snapshots
│   └── src/
│       ├── server.ts             ← Express app, HTTP server, Socket.IO setup
│       ├── db/
│       │   ├── index.ts          ← pg Pool config, Drizzle instance, withRetry helper
│       │   └── schema.ts         ← Drizzle table definitions (users, messages, contacts, conversations)
│       └── routes/
│           └── auth.ts           ← All REST API route handlers
│
└── frontend/                     ← React 19 SPA (Vite 7)
    ├── package.json              ← Frontend dependencies & scripts
    ├── tsconfig.json             ← Root TS config (references app + node configs)
    ├── tsconfig.app.json         ← App-specific TS config
    ├── tsconfig.node.json        ← Node-specific TS config (for vite.config.ts)
    ├── vite.config.ts            ← Vite dev server + proxy config
    ├── vercel.json               ← Vercel SPA routing rewrite rules
    ├── eslint.config.js          ← ESLint configuration
    ├── index.html                ← HTML shell (mounts React into #root)
    ├── public/                   ← Static assets
    └── src/
        ├── main.tsx              ← React root render + provider hierarchy
        ├── App.tsx               ← Route definitions + health check gate
        ├── index.css             ← Tailwind v4 import + @theme custom tokens
        ├── contexts/
        │   ├── AuthContext.tsx    ← Global auth state (user, CryptoKeys, login/logout)
        │   └── SocketContext.tsx  ← Socket.IO connection lifecycle management
        ├── components/
        │   ├── Navbar.tsx        ← Top navigation bar with dynamic route pills
        │   ├── ContactsSidebar.tsx ← Contact list, search, add modal, accept/reject
        │   └── ChatArea.tsx      ← Message display, encryption/decryption, send logic
        ├── pages/
        │   ├── Chat.tsx          ← Composes Navbar + Sidebar + ChatArea
        │   ├── Login.tsx         ← Login form + key unwrapping
        │   ├── Register.tsx      ← Registration form + key generation + wrapping
        │   ├── Settings.tsx      ← Placeholder settings page
        │   └── About.tsx         ← About page
        └── utils/
            ├── api.ts            ← API_URL constant + authFetch wrapper
            ├── crypto.ts         ← All Web Crypto API functions (17 exported)
            └── contactColor.ts   ← Deterministic username → color mapping
```

---

## 3. Technology Stack & Why Each Was Chosen

| Layer | Technology | Why |
|---|---|---|
| **Language** | TypeScript (strict) | Type safety for complex CryptoKey types, compile-time error catching |
| **Frontend Framework** | React 19 + Vite 7 | Fast HMR, modern JSX transform, huge ecosystem |
| **Routing** | React Router v7 | Declarative route guards with `<Navigate replace>` |
| **Styling** | Tailwind CSS v4 | Utility-first, custom `@theme` tokens for dark vault aesthetic |
| **Backend Runtime** | Node.js + Express 5 | Event-driven, non-blocking I/O ideal for WebSocket workloads |
| **Real-Time** | Socket.IO 4.8 | Automatic reconnection, room/namespace support, fallback transports |
| **Database** | PostgreSQL | Relational integrity (FKs, unique constraints, CHECK constraints) |
| **ORM** | Drizzle ORM 0.45 | Type-safe SQL builder, zero-overhead migrations, lightweight |
| **Cryptography** | Web Crypto API (browser-native) | No external crypto dependencies, hardware-accelerated, non-extractable key support |
| **Authentication** | JWT + bcrypt | Stateless auth (JWT), industry-standard password hashing (bcrypt) |

---

## 4. Application Boot Sequence

### Backend Startup

**Where:** `backend/src/server.ts`

**When:** `npm run dev` (or `npm start` in production)

1. `dotenv.config()` loads environment variables from `.env`.
2. An Express app is created and wrapped in an `http.Server`.
3. CORS middleware is configured with `credentials: true` and the origin from `CORS_ORIGIN` env var.
4. `express.json()` middleware is mounted for JSON body parsing.
5. Auth routes are mounted at `/api/auth`.
6. A Socket.IO `Server` is created on the same HTTP server with matching CORS config.
7. A health check endpoint (`GET /api/health`) is registered — it issues a `SELECT 1` with a 4-second timeout to check DB readiness.
8. The Socket.IO instance is exposed to Express route handlers via `app.set('io', io)`.
9. Socket.IO authentication middleware is registered (JWT verification from cookie or handshake).
10. Socket connection and event handlers are registered.
11. `server.listen()` starts accepting connections.
12. Immediately after listen, a **pool pre-warm** query (`SELECT 1`) is fired to force the first database connection open, avoiding cold-start latency.

### Frontend Startup

**Where:** `frontend/src/main.tsx` → `App.tsx`

1. `ReactDOM.createRoot()` mounts the app into the `#root` div.
2. The provider hierarchy wraps the app: `BrowserRouter` → `AuthProvider` → `SocketProvider` → `App`.
3. `App.tsx` mounts with `serverReady = false` and begins polling `GET /api/health` every 4 seconds.
4. While the backend is waking up, users see a spinner with "Waking up secure server...".
5. Once `/api/health` returns 200, `serverReady` becomes `true` and the actual route tree renders.
6. Route guards check `isAuthenticated` — unauthenticated users are redirected to `/login`.

---

## 5. Cryptographic Architecture

All cryptographic code lives in **`frontend/src/utils/crypto.ts`** — 17 exported functions, zero external dependencies.

### 5.1 Key Generation (Registration)

**When:** User submits the registration form.

**Where:** `Register.tsx` → calls `generateKeyPair()` and `generateEcdsaKeyPair()` from `crypto.ts`.

**What happens:**

```
Browser generates:
  1. ECDH key pair  (P-256 curve, extractable, usages: deriveKey + deriveBits)
  2. ECDSA key pair (P-256 curve, extractable, usages: sign + verify)
```

**How:**
- `window.crypto.subtle.generateKey()` is called twice with different algorithm configs.
- Both key pairs use the **P-256** (secp256r1) elliptic curve, a NIST-approved 128-bit-security-equivalent curve.
- Keys are marked `extractable: true` because the public keys need to be exported for transmission and the private keys need to be exported for wrapping.

**Why two key pairs?**
- **ECDH** is for key agreement — deriving a shared encryption secret between two users.
- **ECDSA** is for digital signatures — proving that a message was genuinely sent by the claimed sender.
- Separation is cryptographic best practice: a signing key should never be used for key exchange, and vice versa.

### 5.2 Key Wrapping with PBKDF2

**When:** After key generation during registration.

**Where:** `Register.tsx` → `deriveKeyFromPassword()` → `wrapPrivateKey()`.

**What happens:**

```
password + random 16-byte salt
         │
         ▼
    PBKDF2 (SHA-256, 100,000 iterations)
         │
         ▼
    AES-256-GCM wrapping key (non-extractable)
         │
    ┌────┴────┐
    ▼         ▼
 Wrap ECDH   Wrap ECDSA
 private key  private key
    │         │
    ▼         ▼
 wrappedKey   wrappedKey
 + IV         + IV
```

**How (step by step):**

1. A random 16-byte `salt` is generated with `crypto.getRandomValues()`.
2. The user's password is imported as a raw `PBKDF2` key via `importKey('raw', ...)`.
3. `deriveKey()` produces an AES-256-GCM key from the password + salt, using 100,000 PBKDF2 iterations.
4. Each private key is exported to PKCS8 format, then encrypted with AES-GCM using the derived wrapping key and a random 12-byte IV.
5. The results (wrapped key blobs + IVs) are Base64-encoded for JSON transmission.

**Why PBKDF2?**
- 100,000 iterations of SHA-256 makes brute-force password guessing computationally expensive.
- The random salt prevents rainbow table attacks.
- The same salt is reused for both private key wrappings (ECDH + ECDSA) — this is safe because the IVs are unique, and the wrapping key is the same anyway.

**What gets sent to the server:**

| Field | Content | Can the server read the private key? |
|---|---|---|
| `publicKey` | Raw ECDH public key (Base64) | N/A (public) |
| `encryptedPrivateKey` | AES-GCM wrapped ECDH private key | **No** — needs password |
| `keyIv` | IV used for ECDH wrapping | Not useful without password |
| `keySalt` | PBKDF2 salt | Not useful without password |
| `publicSigningKey` | Raw ECDSA public key (Base64) | N/A (public) |
| `encryptedSigningPrivateKey` | AES-GCM wrapped ECDSA private key | **No** — needs password |
| `signingKeyIv` | IV used for ECDSA wrapping | Not useful without password |

### 5.3 Key Unwrapping (Login)

**When:** User submits the login form and the server returns their encrypted key material.

**Where:** `Login.tsx`

**What happens:**

```
Server returns: { keySalt, encryptedPrivateKey, keyIv, encryptedSigningPrivateKey, signingKeyIv }

password + keySalt
         │
         ▼
    PBKDF2 → wrapperKey
         │
    ┌────┴────────────────┐
    ▼                     ▼
 Unwrap ECDH            Unwrap ECDSA
 (AES-GCM decrypt       (AES-GCM decrypt
  → importKey ECDH)      → importKey ECDSA)
    │                     │
    ▼                     ▼
 CryptoKey in memory    CryptoKey in memory
```

**How:**
1. The salt from the server is Base64-decoded back to a `Uint8Array`.
2. `deriveKeyFromPassword(password, salt)` re-derives the same AES-256-GCM wrapping key.
3. `unwrapPrivateKey()` AES-GCM-decrypts the ECDH blob, then `importKey('pkcs8', ...)` restores it as an ECDH `CryptoKey`.
4. `unwrapEcdsaPrivateKey()` does the same for the ECDSA blob, but imports with algorithm `ECDSA` and usage `['sign']`.
5. Both `CryptoKey` objects are passed to `AuthContext.login()` and stored **only in React state** — never written to localStorage or IndexedDB.

**Why separate unwrap functions for ECDH and ECDSA?**
- The Web Crypto API requires you to specify the exact algorithm and key usages at import time. An ECDH key must be tagged `{ name: 'ECDH', namedCurve: 'P-256' }` with usages `['deriveKey', 'deriveBits']`, while an ECDSA key must be tagged `{ name: 'ECDSA', namedCurve: 'P-256' }` with usages `['sign']`. Using the wrong algorithm would cause the browser to reject the key.

### 5.4 Shared Secret Derivation (ECDH)

**When:** Before encrypting or decrypting a message for/from a specific contact.

**Where:** `ChatArea.tsx` → `getCryptoKeys()` → `deriveSharedSecret()` in `crypto.ts`.

**What happens:**

```
My ECDH Private Key + Their ECDH Public Key
                     │
                     ▼
            ECDH key agreement
                     │
                     ▼
          AES-256-GCM shared secret
          (same for both parties)
```

**How:**
1. The contact's Base64 public key is imported via `importPublicKey()`.
2. `window.crypto.subtle.deriveKey()` combines the local private key with the remote public key using ECDH.
3. The output is an AES-256-GCM `CryptoKey` that can encrypt and decrypt.
4. Thanks to the mathematical properties of elliptic curves, both parties derive **the exact same shared secret** — without ever transmitting it.

**Caching:**
- `ChatArea.tsx` maintains a `cryptoCacheRef` that stores the derived keys per contact ID.
- If the user switches back to the same contact, the cached keys are reused — avoiding expensive `deriveKey` calls.
- The cache is cleared whenever the selected contact changes.

### 5.5 Message Encryption (AES-256-GCM)

**When:** User presses Send.

**Where:** `ChatArea.tsx` → `handleSendMessage()` → `encryptMessage()` in `crypto.ts`.

**How:**
1. The plaintext string is encoded to bytes via `TextEncoder`.
2. A random 12-byte **Initialization Vector (IV)** is generated with `crypto.getRandomValues()`.
3. `window.crypto.subtle.encrypt()` with AES-GCM produces the ciphertext (which includes a 16-byte authentication tag appended by GCM).
4. Both the ciphertext and IV are Base64-encoded for JSON transmission.

**Why a random IV per message?**
- AES-GCM is catastrophically insecure if the same (key, IV) pair is reused — it would allow XOR-based plaintext recovery.
- A cryptographically random 96-bit IV virtually guarantees uniqueness (collision probability is negligible).

### 5.6 Message Decryption

**When:** Loading chat history, or receiving a real-time message.

**Where:** `ChatArea.tsx` → `decryptMessage()` in `crypto.ts`.

**How:**
1. The Base64 ciphertext and IV are decoded to `ArrayBuffer`.
2. `window.crypto.subtle.decrypt()` with AES-GCM reverses the encryption.
3. GCM's built-in authentication tag is verified — if the ciphertext was tampered with, decryption throws an error.
4. The decrypted bytes are decoded to a string via `TextDecoder`.

**Failure handling:**
- If decryption fails (tampered data, wrong key, etc.), the message is displayed as `"⚠️ [Security Warning - Validation Failed]"` with `isVerified: false`, which renders in a distinct red/warning style.

### 5.7 Digital Signatures (ECDSA)

**When:** Immediately after encrypting a message, before sending it via Socket.IO.

**Where:** `ChatArea.tsx` → `signData()` in `crypto.ts`.

**What is signed:** The **ciphertext** string (not the plaintext). This is intentional — the server sees and stores the ciphertext, so signing the ciphertext lets the recipient verify that the ciphertext wasn't tampered with in transit or at rest.

**How:**
1. The ciphertext string is encoded to bytes.
2. `window.crypto.subtle.sign()` with ECDSA + SHA-256 produces a signature.
3. The signature is Base64-encoded.

### 5.8 Signature Verification

**When:** When receiving a message from a contact (both real-time and historical).

**Where:** `ChatArea.tsx` → `verifySignature()` in `crypto.ts`.

**How:**
1. The sender's ECDSA public key is imported from the contact's stored `publicSigningKey`.
2. `window.crypto.subtle.verify()` checks the signature against the ciphertext.
3. If verification fails, the message is flagged `isVerified: false` and shown with a security warning.

**Why only verify incoming messages (not your own)?**
- You signed your own messages — re-verifying them would be redundant. The code explicitly skips verification when `msg.senderId === userId`.

---

## 6. Authentication & Session Management

### 6.1 Registration Flow

**Where:** `Register.tsx` (frontend) → `POST /api/auth/register` (backend, `auth.ts`)

**Step-by-step:**

1. **Browser** generates ECDH + ECDSA key pairs.
2. **Browser** generates random 16-byte salt, derives PBKDF2 wrapping key from password + salt.
3. **Browser** wraps both private keys with AES-GCM, producing `{ wrappedKey, iv }` for each.
4. **Browser** exports both public keys to Base64.
5. **Browser** sends to server: `{ username, password, publicKey, encryptedPrivateKey, keyIv, keySalt, publicSigningKey, encryptedSigningPrivateKey, signingKeyIv }`.
6. **Server** hashes the password with `bcrypt` (10 salt rounds).
7. **Server** attempts an atomic INSERT with `onConflictDoNothing` on the username UNIQUE constraint.
   - If `newUser.length === 0`, the username already exists → 409 Conflict.
   - Otherwise → 201 Created.
8. **Browser** navigates to `/login` with a flash message "Vault created successfully. Please sign in."

**Security note:** The password is sent in plaintext over HTTPS. The server hashes it with bcrypt and stores only the hash. The password is also used client-side to derive the PBKDF2 wrapping key, but the wrapping key itself is never transmitted.

### 6.2 Login Flow

**Where:** `Login.tsx` (frontend) → `POST /api/auth/login` (backend, `auth.ts`)

**Step-by-step:**

1. **Browser** sends `{ username, password }` with `credentials: 'include'`.
2. **Server** looks up the user by username.
3. **Server** verifies the password with `bcrypt.compare()`.
4. **Server** signs a JWT containing `{ userId, username }` with `JWT_SECRET`, 24-hour expiry.
5. **Server** sets an HttpOnly cookie named `whisper_token`:
   - `httpOnly: true` — inaccessible to JavaScript (XSS protection)
   - `secure: true` in production (HTTPS only)
   - `sameSite: 'lax'` — sent with top-level navigations (CSRF mitigation)
   - `maxAge: 24h`
   - `domain: '.whisper-chat.app'` in production (subdomain cookie sharing)
6. **Server** responds with the user's public info + encrypted key material (but **not** the JWT in the body — it's only in the cookie).
7. **Browser** derives the PBKDF2 wrapping key from password + returned salt.
8. **Browser** unwraps both private keys into `CryptoKey` objects.
9. **Browser** calls `AuthContext.login(canonicalUsername, userId, ecdhKey, ecdsaKey)` — stores everything in React state.
10. **Browser** navigates to `/`.

### 6.3 JWT Middleware

**Where:** `backend/src/routes/auth.ts` — `authenticateToken` function.

**How:** A reusable Express middleware that:
1. Tries to extract the token from the `whisper_token` cookie (via manual `Cookie` header parsing).
2. Falls back to `Authorization: Bearer <token>` header.
3. Verifies the token with `jwt.verify()`.
4. Attaches `req.user = { userId, username }` to the request object.
5. Returns 401 if no token is found, 403 if the token is invalid/expired.

**Which routes use it:** `GET /me`, `GET /contacts`, `POST /contacts/add`, `GET /inbox`, `PATCH /contacts/:contactId/accept`, `DELETE /contacts/:contactId`, `GET /messages/:user1/:user2`.

### 6.4 Session Restoration (`/me`)

**Where:** `GET /api/auth/me` (backend) — currently **not actively called** by the frontend.

**What it does:** Returns the authenticated user's profile + encrypted key material. This endpoint exists so that a future implementation could attempt session restoration without re-login — for now, page refresh always requires re-login because the in-memory CryptoKey objects are lost (this is an intentional security tradeoff).

### 6.5 Logout Flow

**Where:** `Navbar.tsx` → `AuthContext.logout()` → `POST /api/auth/logout` (backend).

**Step-by-step:**

1. **Browser** calls `AuthContext.logout()`.
2. `logout()` sends `POST /api/auth/logout` (best-effort — continues even if it fails).
3. **Server** extracts the JWT from the cookie, finds the userId.
4. **Server** iterates all active Socket.IO sockets and disconnects any belonging to that user.
5. **Server** clears the `whisper_token` cookie.
6. **Browser** zeroes all React state: `currentUser`, `userId`, `ecdhPrivateKey`, `ecdsaPrivateKey` all set to `null`.
7. **Browser** writes `auth_sync` to localStorage to notify other tabs (see below).
8. User is navigated to `/login` by the route guard (`isAuthenticated` is now `false`).

### 6.6 Cross-Tab Sync

**Where:** `AuthContext.tsx`

**What:** When the user logs in or out, the current tab writes `localStorage.setItem('auth_sync', Date.now().toString())`. All other tabs listen for the `storage` event — when they detect a change to `auth_sync`, they `window.location.reload()`. This ensures that if you log out in one tab, all other tabs also reflect the change.

**Why not share the token via localStorage?** Because the CryptoKey objects cannot be serialized to localStorage. A reload forces re-login, which is the secure path.

---

## 7. Database Layer

### 7.1 Schema Design

**Where:** `backend/src/db/schema.ts`

#### `users` table

Stores user accounts and their cryptographic material.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK, auto) | Unique user identifier |
| `username` | `text` (UNIQUE, NOT NULL) | Display name and login identifier |
| `password_hash` | `text` (NOT NULL) | bcrypt-hashed password |
| `public_key` | `text` (NOT NULL) | ECDH public key (Base64) — shared with contacts for key agreement |
| `encrypted_private_key` | `text` (NOT NULL) | AES-GCM wrapped ECDH private key — only the user's password can unwrap it |
| `key_iv` | `text` (NOT NULL) | IV used when wrapping the ECDH private key |
| `key_salt` | `text` (NOT NULL) | PBKDF2 salt used to derive the wrapping key — shared across both key wraps |
| `public_signing_key` | `text` (NOT NULL) | ECDSA public key (Base64) — used by recipients to verify signatures |
| `encrypted_signing_private_key` | `text` (NOT NULL) | AES-GCM wrapped ECDSA private key |
| `signing_key_iv` | `text` (NOT NULL) | IV used when wrapping the ECDSA private key |
| `created_at` | `timestamp` (default now) | Account creation time |

#### `messages` table

Stores encrypted message payloads. The server never sees plaintext.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK, auto) | Unique message identifier |
| `sender_id` | `uuid` (FK → users) | Who sent the message (set from JWT, not client) |
| `receiver_id` | `uuid` (FK → users) | Who should receive the message |
| `ciphertext` | `text` (NOT NULL) | AES-256-GCM encrypted message content (Base64) |
| `iv` | `text` (NOT NULL) | Initialization vector used for this specific encryption (Base64) |
| `signature` | `text` (NOT NULL) | ECDSA signature of the ciphertext (Base64) |
| `created_at` | `timestamp` (default now) | Server timestamp when message was saved |

**Indexes:**
- `messages_sender_receiver_idx` on `(sender_id, receiver_id)` — fast lookup of messages between two users.
- `messages_receiver_created_idx` on `(receiver_id, created_at)` — enables efficient inbox queries.
- `messages_created_at_idx` on `(created_at)` — supports time-range queries.

#### `contacts` table

Stores directional contact relationships. Each row means "user A has user B in their contact list."

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK, auto) | Row identifier |
| `owner_id` | `uuid` (FK → users) | The user who owns this contact entry |
| `contact_id` | `uuid` (FK → users) | The contact being referenced |
| `status` | `text` (NOT NULL, default 'accepted') | `'accepted'` for manually added contacts; `'pending'` for auto-created entries from incoming messages |
| `created_at` | `timestamp` (default now) | When the contact was added |

**Constraints:**
- `owner_contact_unique` — UNIQUE on `(owner_id, contact_id)` prevents duplicate contact entries.

**Indexes:**
- `contacts_owner_idx` on `(owner_id)` — fast lookup of a user's contact list.
- `contacts_owner_contact_idx` on `(owner_id, contact_id)` — fast point lookups for accept/reject operations.

#### `conversations` table

A read-optimized "inbox" table that tracks the last activity time for each unique user pair.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK, auto) | Row identifier |
| `user1_id` | `uuid` (FK → users, CASCADE) | First user in the canonical pair (always the smaller UUID) |
| `user2_id` | `uuid` (FK → users, CASCADE) | Second user in the canonical pair (always the larger UUID) |
| `last_message_at` | `timestamp` (NOT NULL) | Last time a message was exchanged — updated on every `sendMessage` |
| `created_at` | `timestamp` (NOT NULL) | When the conversation was first created |

**Constraints:**
- `conversations_pair_unique` — UNIQUE on `(user1_id, user2_id)`.
- `user1_lt_user2` — CHECK constraint enforcing `user1_id < user2_id`. This canonical ordering ensures there's only one row per pair regardless of who sent the first message.

**Indexes:**
- `conversations_last_message_idx` on `(last_message_at)` — supports ordering the inbox by recent activity.
- `conversations_pair_idx` on `(user1_id, user2_id)` — fast upsert lookups.

**Why does `conversations` exist separately from `messages`?**
- Querying "show me all contacts sorted by most recent message" from the `messages` table would require a heavy `GROUP BY` + `MAX(created_at)` across potentially millions of rows.
- The `conversations` table is a denormalized, pre-computed summary — one row per pair, updated transactionally with every message. This makes inbox queries O(contacts) instead of O(messages).

### 7.2 Connection Pool & Resilience

**Where:** `backend/src/db/index.ts`

The PostgreSQL connection pool is configured for reliability in managed hosting environments (e.g., Supabase via Supavisor, Render):

```typescript
const pool = new Pool({
  max: 7,                           // Conservative ceiling — avoids overwhelming the pooler
  connectionTimeoutMillis: 10_000,   // Fail fast so retries get fresh connections
  idleTimeoutMillis: 120_000,        // 2 min — stops constant connect/disconnect churn
  keepAlive: true,                   // OS-level TCP keep-alive probes
  keepAliveInitialDelayMillis: 10_000, // Probe after 10s (Linux default is 2h)
  query_timeout: 10000,              // Kill queries running longer than 10s
  statement_timeout: 10000,          // PG-level statement timeout
  ssl: { rejectUnauthorized: false }, // Required for most managed PG hosts
});
```

**Error handling:**
- `pool.on('error')` catches broken idle clients to prevent process crashes.
- `pool.on('connect')` logs new connections and attaches per-client error handlers.
- `pool.on('remove')` detects when connections are evicted and triggers a debounced warmup if the pool is nearly empty.

**Heartbeat:** A 50-second interval sends `SELECT 1` on an idle connection to prevent intermediaries (Supavisor, NAT gateways) from killing idle connections.

**`withRetry(fn, maxAttempts=3)`:**
- A resilient query wrapper that catches connection-class errors (reset, timeout, ECONNREFUSED, etc.) and retries with exponential backoff (1s → 2s → 4s).
- The regex `RETRYABLE` matches Postgres error codes and common Node.js socket errors.
- Every query call throughout the codebase is wrapped in `withRetry()`.

### 7.3 Migrations

**Where:** `backend/drizzle/`

Migrations are generated by Drizzle Kit and applied with `npx drizzle-kit migrate`.

| Migration | What it does |
|---|---|
| `0000_gigantic_harry_osborn.sql` | Creates `users`, `messages`, `contacts` tables with FKs and initial indexes |
| `0001_tiny_jasper_sitwell.sql` | Adds `conversations` table with CHECK constraint + pair unique, adds refined indexes |
| `0002_loose_justice.sql` | Adds `status` column to `contacts` (`DEFAULT 'accepted'`) for pending/accepted contact states |

---

## 8. API Routes

All routes are defined in `backend/src/routes/auth.ts` and mounted at `/api/auth`.

### `POST /register` — Create Account
- **Auth required:** No
- **Body:** `{ username, password, publicKey, encryptedPrivateKey, keyIv, keySalt, publicSigningKey, encryptedSigningPrivateKey, signingKeyIv }`
- **What:** Validates all fields are present → bcrypt-hashes the password → atomic INSERT with `onConflictDoNothing` on username → returns 201 with `{ id, username }` or 409 if username taken.
- **Why `onConflictDoNothing` instead of a SELECT-then-INSERT?** Avoids a TOCTOU (Time of Check to Time of Use) race condition where two simultaneous registrations with the same username could both pass the SELECT check.

### `POST /login` — Authenticate
- **Auth required:** No
- **Body:** `{ username, password }`
- **What:** Looks up user → bcrypt-compares password → signs JWT → sets HttpOnly cookie → returns user profile + all encrypted key material.
- **JWT is NOT in the response body** — only in the `Set-Cookie` header.

### `GET /me` — Session Check
- **Auth required:** Yes (JWT middleware)
- **What:** Returns the current user's full profile including encrypted key material. Useful for session restoration.

### `POST /logout` — End Session
- **Auth required:** No (reads cookie directly)
- **What:** Extracts userId from cookie → disconnects all their Socket.IO sessions → clears the cookie.

### `GET /users/:id/key` — Public Key Lookup
- **Auth required:** No
- **What:** Returns `{ publicKey, publicSigningKey }` for a given user ID. Used when establishing a new contact.

### `POST /contacts/add` — Add Contact
- **Auth required:** Yes
- **Body:** `{ contactUsername }`
- **What:** Normalizes + trims username → finds target user → prevents self-add → INSERT with `onConflictDoUpdate` (upgrades `pending` → `accepted`) → returns contact info with public keys.
- **Why `onConflictDoUpdate` instead of `onConflictDoNothing`?** Because if the contact was auto-created as `pending` (from an incoming message), adding them manually should upgrade the status to `accepted`.

### `GET /contacts` — List Contacts
- **Auth required:** Yes
- **What:** INNER JOIN of `contacts` → `users` where `ownerId = jwt.userId`. Returns `{ id, username, publicKey, publicSigningKey }` for each contact.

### `GET /inbox` — Unified Inbox (Contacts + Last Activity)
- **Auth required:** Yes
- **What:** Joins `contacts` → `users` LEFT JOIN `conversations` (using LEAST/GREATEST for canonical pair matching) → returns contacts with `lastActive` timestamp and `status` field → ordered by `lastMessageAt DESC`.
- **Why LEFT JOIN?** Some contacts may not have exchanged messages yet — they should still appear but with `lastActive: null`.

### `PATCH /contacts/:contactId/accept` — Accept Pending Contact
- **Auth required:** Yes
- **What:** Updates the contact's `status` from `pending` to `accepted`.

### `DELETE /contacts/:contactId` — Remove/Reject Contact
- **Auth required:** Yes
- **What:** Deletes the contact row. Can be used to reject a pending contact or remove an existing one.

### `GET /messages/:user1/:user2` — Chat History
- **Auth required:** Yes
- **What:** Validates UUID format → ensures the authenticated user is one of the two parties (403 otherwise) → uses LEAST/GREATEST canonical ordering for index-friendly queries → returns all messages ordered by `created_at ASC, id ASC`.
- **Why `ASC, id ASC`?** Messages created in the same millisecond are disambiguated by UUID sort order, ensuring stable pagination.

---

## 9. Real-Time Layer (Socket.IO)

### 9.1 Socket Authentication

**Where:** `backend/src/server.ts` — `io.use(...)` middleware.

**When:** Every new Socket.IO connection attempt (including reconnects).

**How:**
1. Parse the `whisper_token` cookie from the `socket.handshake.headers.cookie` string.
2. Fallback to `socket.handshake.auth.token` (for clients that pass the token programmatically).
3. Verify the JWT with `jwt.verify()`.
4. Store `decoded.userId` and `decoded.username` on `socket.data` for all future event handlers.
5. If verification fails → `next(new Error('...'))` rejects the connection.

**Why cookie-based socket auth?** The frontend sets `withCredentials: true` on the Socket.IO client, which automatically sends the HttpOnly cookie with the WebSocket handshake. This avoids exposing the JWT to client-side JavaScript.

### 9.2 Connected Users Map

**Where:** `backend/src/server.ts`

```typescript
const connectedUsers = new Map<string, Set<string>>();
```

- Maps each `userId` to a `Set` of active socket IDs.
- On `connection`: adds the socket ID to the user's set.
- On `disconnect`: removes the socket ID; deletes the map entry if the set is empty.

**Why a Set instead of a single socket ID?** Users can have multiple tabs open. Each tab creates its own socket. The Set tracks all of them so messages can be delivered to every tab.

### 9.3 Message Flow

**Event:** `sendMessage` (client → server)

**Payload:** `{ receiverId, ciphertext, iv, signature, tempId? }`

**Server processing:**
1. Extract `senderId` from `socket.data.userId` (JWT-authenticated — never trust client-supplied sender).
2. Validate `receiverId` UUID format with regex.
3. Compute canonical pair ordering: `user1Id = min(senderId, receiverId)`.
4. Inside a `withRetry()` **database transaction:**
   a. INSERT the message into `messages`.
   b. UPSERT into `conversations` (INSERT with `onConflictDoUpdate` on the pair).
5. Emit `messageSaved` back to the sending socket (with `tempId` for optimistic UI reconciliation).
6. Auto-create a `pending` contact for the receiver if one doesn't exist (see 9.4).
7. Emit `receiveMessage` to all sockets of both sender (except the originating socket) and receiver.

**Error handling:** If the transaction fails, `messageError` is emitted to the sender with the `tempId` so the frontend can mark the optimistic message as failed.

### 9.4 Auto-Contact Creation

**When:** After a message is saved, the server inserts a `pending` contact entry for the receiver:

```typescript
db.insert(contacts).values({
  ownerId: data.receiverId,
  contactId: senderId,
  status: 'pending',
}).onConflictDoNothing({ target: [contacts.ownerId, contacts.contactId] })
```

**Why:**
- If Alice sends a message to Bob, Bob should see Alice in their contact list even if Bob never explicitly added Alice.
- The `pending` status lets Bob's UI show an "accept/reject" prompt.
- `onConflictDoNothing` means if Bob already has Alice as a contact (accepted or pending), nothing changes.

**Notification:** If a new pending contact was actually created (`insertResult.rowCount > 0`), the server emits `inboxUpdated` to all of the receiver's sockets, prompting the sidebar to refresh.

### 9.5 Multi-Tab Support

**How it works:**
- When user sends a message from Tab A, Tab A's socket emits `sendMessage`.
- Server saves the message and emits:
  - `messageSaved` to Tab A's socket (optimistic confirmation).
  - `receiveMessage` to all other sender sockets (Tab B, Tab C, etc.) — so they show the message too.
  - `receiveMessage` to all receiver sockets (all of receiver's tabs).
- Tab A does NOT receive `receiveMessage` for its own message — it already has the optimistic entry that gets confirmed by `messageSaved`.

---

## 10. Frontend Architecture

### 10.1 Entry Point & Provider Hierarchy

**Where:** `frontend/src/main.tsx`

```tsx
<React.StrictMode>
  <BrowserRouter>
    <AuthProvider>      ← Must be outermost: SocketProvider reads auth state
      <SocketProvider>   ← Creates socket only when authenticated
        <App />          ← Route definitions + health gate
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
</React.StrictMode>
```

**Why this order?**
- `AuthProvider` must wrap `SocketProvider` because the socket connection depends on `isAuthenticated` and `userId` from `useAuth()`.
- `BrowserRouter` must wrap everything that uses `useNavigate()`, `useLocation()`, or `<Routes>`.

### 10.2 Routing & Guards

**Where:** `frontend/src/App.tsx`

| Path | Component | Guard |
|---|---|---|
| `/login` | `Login` | Only when NOT authenticated (otherwise → `/`) |
| `/register` | `Register` | Only when NOT authenticated (otherwise → `/`) |
| `/` | `Chat` | Only when authenticated (otherwise → `/login`) |
| `/settings` | `Settings` | Only when authenticated (otherwise → `/login`) |
| `/about` | `About` | Only when authenticated (otherwise → `/login`) |
| `*` | Catch-all | Redirects to `/` |

All redirects use `<Navigate replace>` to avoid polluting browser history (back button won't return to the guard page).

### 10.3 Health Check & Wake-Up Screen

**Where:** `frontend/src/App.tsx`

**What:** On mount, `App` polls `GET /api/health` every 4 seconds with a 15-second fetch timeout.

**Why:** On free-tier hosting (Render, Railway), the backend may be in a cold-start state. The health endpoint does a `SELECT 1` with a 4-second query timeout — if the DB isn't ready, it returns 503 `{ status: 'waking_up' }`.

**UX:** Users see a spinner with "Waking up secure server..." until the backend is ready. Once a 200 is received, `serverReady` flips to `true` and the actual routes render.

### 10.4 AuthContext

**Where:** `frontend/src/contexts/AuthContext.tsx`

**State:**

| State | Type | Purpose |
|---|---|---|
| `currentUser` | `string \| null` | Display username |
| `userId` | `string \| null` | User's UUID |
| `ecdhPrivateKey` | `CryptoKey \| null` | In-memory ECDH private key for deriving shared secrets |
| `ecdsaPrivateKey` | `CryptoKey \| null` | In-memory ECDSA private key for signing messages |

**Derived:**
```typescript
const isAuthenticated = currentUser !== null
                     && userId !== null
                     && ecdhPrivateKey !== null
                     && ecdsaPrivateKey !== null;
```

All four must be non-null — even if the cookie is valid, the user is not "authenticated" from the frontend's perspective until the crypto keys are loaded in memory.

**Methods:**
- `login(username, userId, ecdhKey, ecdsaKey)` — sets all four state values + triggers cross-tab notification.
- `logout()` — calls server logout endpoint, zeroes all state, triggers cross-tab notification.

**Security properties:**
- No token, key, or user ID is ever written to localStorage.
- A page refresh wipes all CryptoKey objects from memory and requires re-login.
- This is intentional: if an attacker gains physical access while the user is away, refreshing the page destroys the session.

### 10.5 SocketContext

**Where:** `frontend/src/contexts/SocketContext.tsx`

**State:**

| State | Type | Purpose |
|---|---|---|
| `socket` | `Socket \| null` | Active Socket.IO client instance |
| `isConnected` | `boolean` | Whether the socket is currently connected |

**Lifecycle:**
1. **When** `isAuthenticated` becomes `true` AND `userId` is set:
   - Creates a new `io()` connection with `withCredentials: true`.
   - On `connect`, sets `isConnected = true` and emits `registerUser` (backward compat).
   - On `disconnect`, sets `isConnected = false`.
2. **When** auth state changes or component unmounts:
   - Removes all listeners (`.off()`).
   - Disconnects the socket (`.disconnect()`).
   - Resets state to `null` / `false`.

**Socket URL:** `import.meta.env.VITE_API_URL || undefined`. When `undefined`, Socket.IO connects to the same origin that served the page.

### 10.6 Chat Page Layout

**Where:** `frontend/src/pages/Chat.tsx`

```tsx
<div className="flex flex-col h-screen">
  <Navbar />
  <div className="flex flex-1 overflow-hidden gap-3">
    <ContactsSidebar selectedContact={...} setSelectedContact={...} />
    <ChatArea selectedContact={...} />
  </div>
</div>
```

`Chat.tsx` holds the `selectedContact` state and passes it down. When a contact is clicked in the sidebar, the state updates and `ChatArea` reacts.

### 10.7 ContactsSidebar Component

**Where:** `frontend/src/components/ContactsSidebar.tsx`

**Exports:** The `Contact` interface (shared with `ChatArea`):
```typescript
interface Contact {
  id: string;
  username: string;
  publicKey: string;
  publicSigningKey: string;
  lastActive?: string | null;
  status?: 'accepted' | 'pending';
}
```

**Features:**

1. **Inbox fetch:** Calls `GET /api/auth/inbox` on mount and when messages arrive. The result is sorted by `lastMessageAt DESC` server-side, so the most recent conversations appear at the top.

2. **Debounced re-fetch:** When `receiveMessage` or `inboxUpdated` events fire, re-fetching is debounced to 300ms to prevent rapid API calls during message bursts.

3. **AbortController:** Fetch requests use `AbortController` to prevent stale responses from overwriting current data if the user ID changes or the component unmounts.

4. **Search/filter:** A text input filters the contacts list client-side by username substring match (case-insensitive).

5. **Add Contact modal:** A modal form that:
   - Trims the username before submission.
   - Sends only `{ contactUsername }` (the server derives `ownerId` from the JWT).
   - Uses `resetAddContactModal()` to centralize state cleanup on open/close/success.
   - Shows inline error messages from the server.

6. **Accept/Reject pending contacts:**
   - Accept: `PATCH /api/auth/contacts/:contactId/accept` upgrades status to `accepted`.
   - Reject: `DELETE /api/auth/contacts/:contactId` removes the contact row entirely.
   - If the rejected contact was the currently selected one, it is deselected.

7. **Contact colors:** Each contact gets a deterministic color from `getContactColor(username)` for their avatar.

### 10.8 ChatArea Component

**Where:** `frontend/src/components/ChatArea.tsx`

This is the most complex component — it handles encryption, decryption, real-time messaging, optimistic updates, and error recovery.

**State:**

| State | Type | Purpose |
|---|---|---|
| `messages` | `Message[]` | Decrypted chat messages for the current conversation |
| `inputText` | `string` | Current text in the compose box |

**Message interface:**
```typescript
interface Message {
  id: string;         // Server DB id (or tempId for optimistic entries)
  text: string;       // Decrypted plaintext
  senderId: string;
  receiverId: string;
  isOwnMessage: boolean;
  isVerified?: boolean;  // Signature verification result
  pending?: boolean;     // Awaiting server confirmation
  failed?: boolean;      // Server reported an error
}
```

**Crypto key caching:**
```typescript
cryptoCacheRef = useRef<{
  contactId: string;
  publicKey: CryptoKey;         // Their ECDH public key
  publicSigningKey: CryptoKey;  // Their ECDSA public key
  sharedSecret: CryptoKey;      // Derived AES-256-GCM key
} | null>(null);
```

This prevents redundant `deriveKey` calls when multiple operations happen for the same contact.

**History Loading (useEffect on `selectedContact.id`):**
1. Immediately clears messages and crypto cache (prevents flash of stale data).
2. Creates an `AbortController` for cancellation.
3. Fetches encrypted history from `GET /api/auth/messages/:userId/:contactId`.
4. Derives/caches crypto keys for the contact.
5. For each encrypted message:
   - If not own message → verify ECDSA signature first.
   - Decrypt with AES-GCM shared secret.
   - Push to `decryptedMessages` array.
   - On failure → push a security warning placeholder.
6. Only updates state if the effect hasn't been aborted (prevents stale writes when rapidly switching contacts).

**Real-Time Receiving (useEffect on `socket`):**
- Listens for `receiveMessage`, `messageSaved`, and `messageError` events.
- Uses an `isActive` flag that is set to `false` in the cleanup function — prevents stale async crypto operations from writing to state after the contact has changed.
- `receiveMessage` handler:
  - Only processes messages belonging to the current conversation (checks both directions).
  - Verifies signature for incoming messages (skips for own echoes from other tabs).
  - Decrypts and appends to state, deduplicating by `id`.
- `messageSaved` handler: replaces the optimistic `tempId` with the real server `id` and clears the `pending` flag.
- `messageError` handler: marks the optimistic message as `failed` so the UI shows a "Failed to send" indicator.

**Sending Messages:**
1. Validates all required state is present.
2. Clears the input immediately.
3. Generates a `crypto.randomUUID()` as `tempId`.
4. Adds an optimistic message entry to state with `pending: true`.
5. Derives/retrieves cached crypto keys.
6. Encrypts the plaintext → AES-256-GCM `{ ciphertext, iv }`.
7. Signs the ciphertext → ECDSA `signature`.
8. Emits `sendMessage` via Socket.IO with `{ receiverId, ciphertext, iv, signature, tempId }`.
9. On crypto failure → rolls back the optimistic message.

**Auto-scroll:** A ref `messagesEndRef` is scrolled into view whenever `messages` changes.

**Auto-resize textarea:** A `useEffect` on `inputText` resets the textarea height to `auto` then sets it to `scrollHeight`, allowing the textarea to grow up to `max-h-32` (8rem).

**Enter to send:** `onKeyDown` checks for Enter without Shift — sends the message. Shift+Enter inserts a newline.

**Message rendering styles:**
- Own messages: `bg-primary-900`, right-aligned, rounded bottom-right corner removed.
- Contact messages: contact's color, left-aligned, rounded bottom-left corner removed.
- Pending: 60% opacity.
- Failed: red background, "Failed to send" text.
- Unverified: secondary/warning color, security warning text.

### 10.9 Navbar Component

**Where:** `frontend/src/components/Navbar.tsx`

**Features:**
- **Dynamic route pills:** Navigation items (Home, Settings, About) are rendered as icons. The active route expands into a pill showing the icon + text label, using `transition-all duration-300` for smooth animation.
- **User dropdown:** A button showing the user's first initial that toggles a dropdown menu with:
  - Username display
  - Logout button
  - ARIA attributes: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls="user-menu"`.
  - Click-outside-to-close via `mousedown` event listener.

### 10.10 Utility Modules

#### `utils/api.ts`

**Exports:**
- `API_URL`: `import.meta.env.VITE_API_URL || ''`. Empty string in dev means relative paths, which Vite proxies to the backend.
- `authFetch(input, init?)`: A `fetch()` wrapper that:
  - Always includes `credentials: 'include'` (sends cookies).
  - On 401/403 responses: writes `auth_sync` to localStorage (triggers cross-tab sync), then redirects to `/login`. This handles expired JWTs gracefully.

#### `utils/crypto.ts`

17 exported functions covering the full cryptographic lifecycle:

| # | Function | What it does |
|---|---|---|
| — | `arrayBufferToBase64(buffer)` | Converts `ArrayBuffer` to Base64 string |
| — | `base64ToArrayBuffer(base64)` | Converts Base64 string to `ArrayBuffer` |
| 1 | `generateKeyPair()` | Generates ECDH P-256 key pair |
| 2 | `exportPublicKey(key)` | Exports public key to Base64 (raw format) |
| 3 | `exportPrivateKey(key)` | Exports private key to Base64 (PKCS8 format) |
| 4 | `importPublicKey(base64)` | Imports Base64 → ECDH public `CryptoKey` |
| 5 | `importPrivateKey(base64)` | Imports Base64 → ECDH private `CryptoKey` |
| 6 | `deriveSharedSecret(privKey, pubKey)` | ECDH → AES-256-GCM shared key |
| 7 | `encryptMessage(sharedKey, plaintext)` | AES-256-GCM encrypt → `{ ciphertext, iv }` |
| 8 | `decryptMessage(sharedKey, ciphertext, iv)` | AES-256-GCM decrypt → plaintext string |
| 9 | `deriveKeyFromPassword(password, salt)` | PBKDF2 (100k iterations, SHA-256) → AES-256-GCM key |
| 10 | `wrapPrivateKey(privateKey, wrapperKey)` | Export PKCS8 + AES-GCM encrypt → `{ wrappedKey, iv }` |
| 11 | `unwrapPrivateKey(wrapped, wrapperKey, iv)` | AES-GCM decrypt + import as ECDH key |
| 12 | `generateEcdsaKeyPair()` | Generates ECDSA P-256 key pair |
| 13 | `importEcdsaPublicKey(base64)` | Imports Base64 → ECDSA verify `CryptoKey` |
| 14 | `unwrapEcdsaPrivateKey(wrapped, wrapperKey, iv)` | AES-GCM decrypt + import as ECDSA sign key |
| 15 | `signData(privateKey, data)` | ECDSA-SHA256 sign → Base64 signature |
| 16 | `verifySignature(publicKey, signature, data)` | ECDSA-SHA256 verify → boolean |
| 17 | `importEcdsaPrivateKey(base64)` | Imports Base64 → ECDSA sign `CryptoKey` |

#### `utils/contactColor.ts`

A simple hash function that maps a username to one of 12 predefined Tailwind color classes (`bg-contact-1` through `bg-contact-12`). Used for avatar backgrounds and chat bubble colors.

```typescript
export function getContactColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash); // djb2-like hash
  }
  return colors[Math.abs(hash) % colors.length];
}
```

### 10.11 Styling System

**Where:** `frontend/src/index.css`

Tailwind CSS v4 is used with a custom `@theme` block that defines all design tokens:

**Dark theme palette:**
- `vault-base` (#0f172a) — deepest background (login/register pages)
- `vault-panel` (#1e293b) — card/form backgrounds
- `vault-highlight` (#273549) — hover states

**Brand accent:**
- `brand` (#0ea5e9) — primary action color (buttons, links)
- `brand-hover` (#0284c7) — darker on hover
- `brand-glow` — box-shadow glow effect `rgba(14, 165, 233, 0.3)`

**Primary scale (cyan/teal):** 50 through 950 — used for all chat UI elements. `primary-950` (#00111a) is the main background.

**Secondary scale (red/coral):** 50 through 950 — used for errors, warnings, security alerts.

**Contact colors:** 12 distinct hues (crimson, emerald, amber, violet, pink, orange, lime, fuchsia, indigo, teal, brick red, royal purple) for avatar and bubble differentiation.

**Scrollbar hiding:** `.hide-scrollbar` class hides scrollbars on the chat message area and contact list while preserving scroll functionality.

---

## 11. Data Flow: Sending a Message (End-to-End)

Here's the complete journey of a message from keystroke to delivery:

```
1. User types "Hello" and presses Enter
   └── ChatArea.handleSendMessage()

2. Optimistic UI update
   └── tempId = crypto.randomUUID()
   └── Add { id: tempId, text: "Hello", pending: true } to messages state
   └── Input is cleared immediately

3. Crypto operations (in browser)
   └── getCryptoKeys(contact) — derive/cache shared secret
   └── encryptMessage(sharedSecret, "Hello") → { ciphertext: "a3f2...", iv: "b7c9..." }
   └── signData(ecdsaPrivateKey, "a3f2...") → signature: "d4e5..."

4. Socket.IO emission
   └── socket.emit('sendMessage', {
         receiverId: "uuid-bob",
         ciphertext: "a3f2...",
         iv: "b7c9...",
         signature: "d4e5...",
         tempId: "uuid-temp"
       })

5. Server receives event (server.ts)
   └── senderId = socket.data.userId (from JWT, NOT from client)
   └── Validate receiverId UUID format
   └── Compute canonical pair: min(sender, receiver) = user1Id

6. Database transaction (withRetry)
   └── INSERT into messages → returns savedMessage with server-generated id + timestamp
   └── UPSERT into conversations → updates lastMessageAt

7. Server emits 'messageSaved' to sending socket
   └── { tempId: "uuid-temp", message: { id: "real-uuid", ... } }
   └── Frontend: replaces tempId with real id, clears pending flag

8. Auto-contact creation
   └── INSERT contacts (receiver → sender, status: 'pending') ON CONFLICT DO NOTHING
   └── If new row created → emit 'inboxUpdated' to receiver's sockets

9. Server emits 'receiveMessage' to:
   └── All sender sockets EXCEPT the originating one (other tabs)
   └── All receiver sockets (all tabs)

10. Receiver's browser processes 'receiveMessage'
    └── Verify this message belongs to current conversation
    └── Import sender's ECDSA public key
    └── verifySignature(pubKey, signature, ciphertext) → true/false
    └── decryptMessage(sharedSecret, ciphertext, iv) → "Hello"
    └── Append decrypted message to state
    └── Auto-scroll to bottom
```

---

## 12. Data Flow: Receiving a Message (End-to-End)

When you're looking at an existing conversation and a new message arrives:

```
1. Server emits 'receiveMessage' with savedMessage payload
   └── { id, senderId, receiverId, ciphertext, iv, signature, createdAt }

2. ChatArea 'receiveMessage' handler fires
   └── Check: is this message for the currently open conversation?
       - isInbound: senderId === selectedContact.id && receiverId === userId
       - isOwnEcho: senderId === userId && receiverId === selectedContact.id
       - If neither → ignore (message is for a different conversation)

3. Signature verification (inbound messages only)
   └── getCryptoKeys(selectedContact) — get/cache contact's ECDSA public key
   └── verifySignature(publicSigningKey, signature, ciphertext)
   └── If false → show security warning

4. Decryption
   └── decryptMessage(sharedSecret, ciphertext, iv) → plaintext string

5. State update
   └── Deduplication: if prev.some(m => m.id === savedMessage.id) → skip
   └── Append { id, text, senderId, receiverId, isOwnMessage, isVerified: true }

6. Render
   └── New message bubble appears at the bottom
   └── Auto-scroll to the latest message
```

---

## 13. Security Model

### What the server can see:
- Usernames and password hashes (bcrypt)
- ECDH and ECDSA **public** keys (Base64)
- **Wrapped** (encrypted) private keys — useless without the user's password
- PBKDF2 salt and wrapping IVs — useless without the password
- **Ciphertext** of every message — encrypted AES-256-GCM blobs
- IVs for each message — meaningless without the decryption key
- ECDSA signatures — proves authenticity but reveals nothing about content
- Timestamps and sender/receiver metadata

### What the server CANNOT see:
- Plaintext of any message
- Raw private keys (ECDH or ECDSA)
- The shared secret between any two users
- The user's password (only the bcrypt hash)

### Threat model & mitigations:

| Threat | Mitigation |
|---|---|
| **XSS (script injection)** | JWT stored in HttpOnly cookie — JS cannot access it. CryptoKey objects are non-serializable — even if XSS runs, it can't extract the private keys from memory. |
| **CSRF** | `sameSite: 'lax'` on the cookie, plus CORS origin whitelisting. |
| **Man-in-the-middle** | HTTPS in production (Secure cookie flag). AES-GCM authentication tag detects tampering. ECDSA signatures detect forgery. |
| **Database breach** | Attacker gets only ciphertext, wrapped keys, and hashes. No plaintext. Brute-forcing bcrypt + PBKDF2 is computationally prohibitive. |
| **Server compromise** | Even a fully compromised server cannot read messages — it never has the shared secrets or raw private keys. |
| **Physical access (unlocked browser)** | Keys exist only in memory. Refreshing the page or closing the tab destroys them. |
| **Replay attacks** | Each message has a unique random IV. AES-GCM rejects re-encryption with the same (key, IV) pair. Message IDs provide deduplication. |
| **Message tampering** | AES-GCM's authentication tag rejects any modified ciphertext. ECDSA signature independently verifies the ciphertext was produced by the claimed sender. |
| **SQL injection** | Drizzle ORM parameterizes all queries. UUID format is validated with regex before query. |
| **Expired sessions** | JWT has 24h expiry. `authFetch()` catches 401/403 and force-redirects to login. Server logout disconnects all active sockets. |

### Intentional security tradeoffs:
- **Page refresh requires re-login:** CryptoKey objects live in React state and cannot survive a page reload. This is by design — no private key material ever touches persistent storage.
- **No Perfect Forward Secrecy (yet):** The same ECDH key pair is used for all conversations. If the ECDH private key is compromised, all past and future messages with any contact are decryptable. The Settings page placeholder mentions PFS key rotation as a planned feature.
- **Password sent to server:** The password is transmitted over HTTPS for bcrypt hashing. It's also used client-side for PBKDF2 key derivation. The server could theoretically capture it before hashing — a fully trustless system would avoid this, but it's an acceptable tradeoff for this architecture.

---

## 14. Development & Deployment Configuration

### Environment Variables

| Variable | Location | Required | Purpose | Default |
|---|---|---|---|---|
| `JWT_SECRET` | Backend `.env` | Yes | Signs and verifies all JWTs | — |
| `DATABASE_URL` | Backend `.env` | Yes | PostgreSQL connection string | — |
| `PORT` | Backend `.env` | No | Express listen port | `3000` |
| `NODE_ENV` | Backend `.env` | No | `production` enables Secure flag on cookies | — |
| `CORS_ORIGIN` | Backend `.env` | No | Allowed CORS origin | `http://localhost:5173` |
| `VITE_API_URL` | Frontend `.env` | No | API/Socket.IO server URL | `''` (same origin) |

### Vite Dev Proxy

**Where:** `frontend/vite.config.ts`

In development, the frontend runs on `localhost:5173` and the backend on `localhost:3000`. Vite proxies API and WebSocket requests:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,  // WebSocket upgrade support
  },
}
```

This means the frontend code can use relative paths like `/api/auth/login` — Vite intercepts and forwards to the backend.

### Build & Run

**Backend:**
```bash
cd backend
npm install
npx drizzle-kit generate   # Generate SQL from schema changes
npx drizzle-kit migrate     # Apply migrations to PostgreSQL
npm run dev                  # Development (tsx watch)
npm run build                # Production build (tsc → dist/)
npm start                    # Run production build (node dist/server.js)
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                  # Development (Vite HMR, port 5173)
npm run build                # Production build (tsc + vite build → dist/)
npm run preview              # Preview production build locally
```

### TypeScript Configuration

**Backend** (`tsconfig.json`): Targets ES2022, outputs CommonJS modules to `dist/`. Strict mode enabled.

**Frontend** (`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`): Uses project references. App config targets ESNext for modern browser features. Node config is separate for `vite.config.ts`.

### Deployment

**Frontend:** Vercel with `vercel.json` that rewrites all routes to `/index.html` (SPA routing):
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Backend:** Render or Railway (Node.js service), with `DATABASE_URL` pointing to a managed PostgreSQL instance (e.g., Supabase).

---

## 15. Database Migration History

| # | File | What Changed | Why |
|---|---|---|---|
| 0 | `0000_gigantic_harry_osborn.sql` | Created `users` (with all crypto columns), `messages` (with ciphertext, iv, signature), `contacts` (with unique constraint). Added foreign keys and indexes. | Initial schema — the foundation for E2EE messaging. |
| 1 | `0001_tiny_jasper_sitwell.sql` | Created `conversations` table (canonical pair, last_message_at, CHECK constraint). Added B-tree indexes on conversations and refined indexes on contacts/messages. | Read-optimized inbox — avoid expensive GROUP BY on messages for "recent chats" ordering. |
| 2 | `0002_loose_justice.sql` | Added `status TEXT NOT NULL DEFAULT 'accepted'` column to `contacts`. | Enable pending/accepted contact states for the auto-contact-on-message feature. |

---

## Summary

Whisper is a zero-knowledge encrypted messaging application where:

1. **All encryption happens in the browser** — the server is a blind courier.
2. **ECDH** establishes shared secrets between users without transmitting them.
3. **AES-256-GCM** encrypts every message with a unique random IV.
4. **ECDSA** signs every ciphertext for authenticity verification.
5. **PBKDF2** wraps private keys with the user's password before they touch the network.
6. **JWT in HttpOnly cookies** handles authentication without exposing tokens to JavaScript.
7. **Socket.IO** delivers real-time messages with multi-tab support.
8. **Optimistic UI** provides instant feedback with server reconciliation.
9. **The database stores only ciphertext** — even a full database breach reveals no message contents.
