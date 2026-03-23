# Whisper: Project Context & Status

## Project Meta
* **Project Name:** Whisper
* **Repository Structure:** Monorepo (`/frontend` and `/backend`)
* **Last Updated:** March 12, 2026

## 1. Project Overview
Whisper is a real-time web chat application designed to protect user privacy through end-to-end encryption. It is built using the PERN stack with WebSockets. The backend server is designed to only route data and cannot read conversations. Encryption and decryption are handled directly inside the users' browsers using the native Web Crypto API, meaning only the users have access to plaintext.

The application uses the **ECDH** algorithm for asymmetric key exchange to agree on a shared key, **AES-256-GCM** for symmetric message encryption, and **ECDSA** for digital signatures to guarantee message authenticity.

## 2. Technical Architecture & Stack
* **Language:** TypeScript (Strict typing for Web Crypto API data types)
* **Frontend:** React 19 (via Vite 7), React Router v7, Tailwind CSS v4
* **Backend:** Node.js, Express 5
* **Database:** PostgreSQL (with Drizzle ORM 0.45)
* **Real-Time Routing:** Socket.IO 4.8
* **Cryptography Engine:** Native Web Crypto API (browser-side)
* **Authentication:** JWT (24h expiry) stored in HttpOnly cookies; bcrypt password hashing
* **Deployment (Planned):** Vercel (Frontend), Render/Railway (Backend)

## 3. Cryptographic Implementation Strategy

### Key Exchange & Encryption
* **Asymmetric Key Exchange:** Elliptic Curve Diffie-Hellman (ECDH) generates a Shared Secret without transmitting it over the network.
* **Symmetric Message Encryption:** AES-256-GCM encrypts message plaintext using the Shared Secret. The generated Initialization Vector (IV) is transmitted alongside the ciphertext.
* **Digital Signatures:** ECDSA signs every outgoing ciphertext. Recipients verify the signature against the sender's public signing key to confirm message authenticity and integrity.

### Key Management
* On **registration**, the browser generates two key pairs (ECDH + ECDSA). Each private key is wrapped (encrypted) with an AES-GCM key derived from the user's password via PBKDF2 (with a random 16-byte salt). Only the **wrapped** private keys, their IVs, and the salt are sent to the server. The server never sees raw private key material.
* On **login**, the server returns the wrapped key material. The browser re-derives the wrapping key from the password + stored salt and unwraps both private keys into `CryptoKey` objects held **in-memory only** (React state via `AuthContext`). No private key material is written to `localStorage`.
* **Server Role:** Blind courier. The server receives, stores, and broadcasts only the `ciphertext`, `iv`, and `signature`. It never sees plaintext or raw private keys.

## 4. Authentication & Session Model

### Backend
* **JWT** signed with `JWT_SECRET` env var, 24-hour expiry.
* On login the JWT is set as an **HttpOnly, SameSite=Lax, Secure (in production)** cookie named `whisper_token`.
* A reusable `authenticateToken` middleware in `auth.ts` parses the cookie (or `Authorization: Bearer` header as fallback) and attaches `req.user = { userId, username }` to all protected routes.
* Socket.IO connections are authenticated by an `io.use(...)` middleware that verifies the JWT from the cookie/handshake auth before accepting the socket. The authenticated `userId` is stored on `socket.data.userId`. The `io` instance is also exposed to Express routes via `app.set('io', io)` so that the logout handler can disconnect the user's active sockets.
* **Endpoints requiring auth:** `GET /api/auth/me`, `GET /api/auth/contacts`, `POST /api/auth/contacts/add`, `GET /api/auth/inbox`, `PATCH /api/auth/contacts/:contactId/accept`, `DELETE /api/auth/contacts/:contactId`, `GET /api/auth/messages/:user1/:user2`.

### Frontend
* `AuthContext` provides: `currentUser`, `userId`, `ecdhPrivateKey`, `ecdsaPrivateKey`, `isAuthenticated`, `login()`, `logout()`.
* **No `localStorage`** is used for tokens, usernames, user IDs, or key material. All sensitive state lives exclusively in React memory and is wiped on logout/refresh.
* `isAuthenticated` (derived: `currentUser !== null && userId !== null && ecdhPrivateKey !== null && ecdsaPrivateKey !== null`) gates all route guards in `App.tsx` and the Socket.IO connection in `SocketContext`.
* `logout()` calls `POST /api/auth/logout` (clears the HttpOnly cookie server-side and disconnects active sockets) then zeroes all in-memory state.
* A page refresh requires re-login because the in-memory CryptoKey objects are lost (this is the intentional security trade-off).

## 5. Database Schema (Drizzle ORM)

Defined in `backend/src/db/schema.ts`.

### `users` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `username` | `text` | `NOT NULL`, `UNIQUE` |
| `password_hash` | `text` | bcrypt hash |
| `public_key` | `text` | ECDH public key (base64) |
| `encrypted_private_key` | `text` | AES-GCM wrapped ECDH private key |
| `key_iv` | `text` | IV used for ECDH key wrapping |
| `key_salt` | `text` | PBKDF2 salt shared by both wrappers |
| `public_signing_key` | `text` | ECDSA public key (base64) |
| `encrypted_signing_private_key` | `text` | AES-GCM wrapped ECDSA private key |
| `signing_key_iv` | `text` | IV used for ECDSA key wrapping |
| `created_at` | `timestamp` | `defaultNow()` |

### `messages` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `sender_id` | `uuid` | FK -> `users.id` |
| `receiver_id` | `uuid` | FK -> `users.id` |
| `ciphertext` | `text` | AES-256-GCM encrypted payload |
| `iv` | `text` | Initialization vector |
| `signature` | `text` | ECDSA signature of the ciphertext |
| `created_at` | `timestamp` | `defaultNow()` |

### `contacts` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `owner_id` | `uuid` | FK -> `users.id` |
| `contact_id` | `uuid` | FK -> `users.id` |
| `status` | `text` | `NOT NULL`, `DEFAULT 'accepted'`; values: `'accepted'` (manually added or approved) / `'pending'` (auto-created on incoming message) |
| `created_at` | `timestamp` | `defaultNow()` |
| | | **`UNIQUE(owner_id, contact_id)`** constraint: `owner_contact_unique` |

### `conversations` table

Read-optimized unified inbox. One row per unique user pair, upserted transactionally on every message send.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `user1_id` | `uuid` | FK -> `users.id` (`ON DELETE CASCADE`); always the smaller UUID in the pair |
| `user2_id` | `uuid` | FK -> `users.id` (`ON DELETE CASCADE`); always the larger UUID in the pair |
| `last_message_at` | `timestamp` | `NOT NULL`, `defaultNow()`; updated on every message |
| `created_at` | `timestamp` | `NOT NULL`, `defaultNow()` |
| | | **`UNIQUE(user1_id, user2_id)`** constraint: `conversations_pair_unique` |
| | | **`CHECK(user1_id < user2_id)`** constraint: `user1_lt_user2` — canonical ordering |

### Indexes

| Index Name | Table | Column(s) |
|---|---|---|
| `contacts_owner_idx` | `contacts` | `owner_id` |
| `contacts_owner_contact_idx` | `contacts` | `owner_id, contact_id` |
| `messages_sender_receiver_idx` | `messages` | `sender_id, receiver_id` |
| `messages_receiver_created_idx` | `messages` | `receiver_id, created_at` |
| `messages_created_at_idx` | `messages` | `created_at` |
| `conversations_last_message_idx` | `conversations` | `last_message_at` |
| `conversations_pair_idx` | `conversations` | `user1_id, user2_id` |

## 6. API Routes (`/api/auth/...`)

All routes are defined in `backend/src/routes/auth.ts`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | No | Create account with all key material |
| `POST` | `/login` | No | Authenticate; sets HttpOnly JWT cookie; returns wrapped key material (JWT is NOT included in the JSON response body) |
| `GET` | `/me` | Yes | Returns authenticated user's profile + wrapped key material |
| `POST` | `/logout` | No | Clears the `whisper_token` cookie and disconnects the user's active Socket.IO sessions |
| `GET` | `/users/:id/key` | No | Fetch a user's ECDH + ECDSA public keys by user ID |
| `POST` | `/contacts/add` | Yes | Add a contact by username (owner derived from JWT); server normalizes/trims username; uses `onConflictDoUpdate` to upgrade `pending` -> `accepted`; returns contact info with public keys |
| `GET` | `/contacts` | Yes | Fetch the authenticated user's contact list (INNER JOIN with public keys) |
| `GET` | `/inbox` | Yes | Unified inbox: contacts LEFT JOIN `conversations` (LEAST/GREATEST canonical pair matching) → returns contacts with `lastActive` timestamp + `status`, ordered by `lastMessageAt DESC` |
| `PATCH` | `/contacts/:contactId/accept` | Yes | Accept a pending contact request (sets `status = 'accepted'`); validates UUID format |
| `DELETE` | `/contacts/:contactId` | Yes | Remove/reject a contact; validates UUID format |
| `GET` | `/messages/:user1/:user2` | Yes | Fetch encrypted chat history between two users; validates UUID format on params (400 if invalid); requester must be user1 or user2 (403 otherwise); uses LEAST/GREATEST canonical pair for index-friendly query; results ordered by `created_at ASC, id ASC` |

## 7. Socket.IO Events

Defined in `backend/src/server.ts`. All socket connections require JWT authentication via middleware.

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `registerUser` | Client -> Server | `userId` | Backward-compat; server ignores the param and uses JWT-authenticated `socket.data.userId` |
| `sendMessage` | Client -> Server | `{ receiverId, ciphertext, iv, signature, tempId? }` | Server saves to DB in a `withRetry` transaction (INSERT message + UPSERT conversations), auto-creates pending contact for receiver (`onConflictDoNothing`), then distributes to all relevant sockets |
| `messageSaved` | Server -> Client | `{ tempId, message }` | Sent to the originating socket only; allows frontend to replace the optimistic tempId with the real DB id |
| `messageError` | Server -> Client | `{ tempId, error }` | Sent to the originating socket on transaction failure; frontend marks the optimistic message as `failed` |
| `receiveMessage` | Server -> Client | Full saved message row | Delivered to all sender sockets **except** the originating one (it uses `messageSaved`), plus all receiver sockets |
| `inboxUpdated` | Server -> Client | *(none)* | Emitted to all receiver sockets when a new pending contact is created; triggers sidebar re-fetch |

## 8. Frontend Architecture

### Routing (`App.tsx`)
All routes are guarded by `isAuthenticated`. Redirects use `<Navigate replace>` to avoid polluting browser history.
* `/login` -- Login page (unauthenticated only)
* `/register` -- Registration page (unauthenticated only)
* `/` -- Chat page (authenticated only)
* `/settings` -- Settings page (authenticated only)
* `/about` -- About page (authenticated only)
* `*` -- Catch-all, redirects to `/`

### Context Providers
* **`AuthProvider`** (`contexts/AuthContext.tsx`) -- Wraps the entire app. Holds user identity + CryptoKey objects in React state. No localStorage.
* **`SocketProvider`** (`contexts/SocketContext.tsx`) -- Wraps the app inside `AuthProvider`. Creates a Socket.IO connection only when `isAuthenticated` is true, with `withCredentials: true` to send the HttpOnly cookie. Uses nullable socket with proper cleanup (`.off()`, `.disconnect()`, `setSocket(null)`, `setIsConnected(false)`) on auth change or unmount. Socket origin is configurable via `VITE_API_URL` env var, falling back to same-origin.

### Key Components

| Component | File | Purpose |
|---|---|---|
| `Navbar` | `components/Navbar.tsx` | Top nav bar with dynamic route pills, user dropdown with ARIA menu semantics (`aria-haspopup`, `aria-expanded`, `aria-controls`, `focus-visible` ring) |
| `ContactsSidebar` | `components/ContactsSidebar.tsx` | Left sidebar: exports `Contact` interface (with `lastActive?` and `status?` fields, shared with `ChatArea`); fetches inbox via `GET /api/auth/inbox` using `authFetch`; debounced re-fetch (300ms) on `receiveMessage` / `inboxUpdated` socket events; `AbortController` prevents stale fetch races; add-contact modal trims username, sends only `contactUsername`, uses `resetAddContactModal()` helper; accept (`PATCH`) / reject (`DELETE`) pending contacts; search/filter contacts client-side |
| `ChatArea` | `components/ChatArea.tsx` | Main chat view: clears stale messages immediately on contact switch; loads encrypted history via `authFetch` with `AbortController` + stale-contact snapshot guard + `res.ok` check; caches derived crypto keys per contact in a `useRef` (`publicKey`, `publicSigningKey`, `sharedSecret`); decrypts using in-memory `ecdhPrivateKey` from AuthContext; verifies ECDSA signatures (skips own messages); real-time handlers: `receiveMessage` (isActive flag, deduplicate by id, verify + decrypt), `messageSaved` (replace tempId with real DB id, clear pending flag), `messageError` (mark optimistic message as failed); optimistic send uses `crypto.randomUUID()` for collision-safe tempId with rollback on crypto error; auto-resize textarea (grows to max-h-32); Enter sends, Shift+Enter for newline; uses exported `Contact` type from `ContactsSidebar` (no `any`) |
| `Chat` | `pages/Chat.tsx` | Layout page composing `ContactsSidebar` + `ChatArea` with selected contact state |
| `Login` | `pages/Login.tsx` | Login form: posts to `/api/auth/login` with `credentials: 'include'`; derives PBKDF2 wrapping key from password + server-returned salt; unwraps both private keys into CryptoKey objects; calls `login(canonicalUsername, userId, ecdhKey, ecdsaKey)` using server-confirmed username |
| `Register` | `pages/Register.tsx` | Registration form: generates ECDH + ECDSA key pairs in browser; wraps private keys with password-derived AES key; posts all material (public keys, wrapped private keys, IVs, salt) to `/api/auth/register` |
| `Settings` | `pages/Settings.tsx` | Settings page (placeholder) |
| `About` | `pages/About.tsx` | About page |

### Shared Utilities

| File | Exports | Purpose |
|---|---|---|
| `utils/crypto.ts` | `generateKeyPair`, `generateEcdsaKeyPair`, `exportPublicKey`, `importPublicKey`, `importEcdsaPublicKey`, `deriveKeyFromPassword`, `wrapPrivateKey`, `unwrapPrivateKey`, `unwrapEcdsaPrivateKey`, `deriveSharedSecret`, `encryptMessage`, `decryptMessage`, `signData`, `verifySignature`, `base64ToArrayBuffer`, `arrayBufferToBase64`, `exportPrivateKey`, `importPrivateKey`, `importEcdsaPrivateKey` | All Web Crypto API wrappers for ECDH, ECDSA, AES-GCM, PBKDF2 |
| `utils/api.ts` | `API_URL`, `authFetch(input, init?)` | `API_URL`: `import.meta.env.VITE_API_URL \|\| ''`; `authFetch`: fetch wrapper that always sends `credentials: 'include'`, auto-redirects to `/login` and triggers cross-tab sync on 401/403 |
| `utils/contactColor.ts` | `getContactColor(username)` | Deterministic hash -> one of 12 Tailwind contact colors; shared by `ChatArea` and `ContactsSidebar` (extracted from duplicated inline code) |

### Styling
* **Tailwind CSS v4** with custom `@theme` tokens in `index.css`:
  * `vault-base`, `vault-panel`, `vault-highlight` -- dark background tones
  * `brand`, `brand-hover`, `brand-glow` -- accent blue
  * `primary-50` through `primary-950` -- cyan/teal scale (main UI)
  * `secondary-50` through `secondary-950` -- red/coral scale (errors, warnings)
  * `contact-1` through `contact-12` -- 12 distinct avatar/chat-bubble colors
* Scrollbar hiding is scoped to `.hide-scrollbar` CSS class (applied to chat message area and contacts list) -- not applied globally.

## 9. Dev Environment & Configuration

### Vite Dev Proxy (`frontend/vite.config.ts`)
All frontend fetch calls use **relative paths** (e.g., `/api/auth/login`). Vite proxies these in development:
* `/api` -> `http://localhost:3000` (changeOrigin)
* `/socket.io` -> `http://localhost:3000` (changeOrigin, ws)

### Environment Variables

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `JWT_SECRET` | Backend `.env` | Signs/verifies JWTs | (required) |
| `DATABASE_URL` | Backend `.env` | PostgreSQL connection string | (required) |
| `PORT` | Backend `.env` | Express listen port | `3000` |
| `NODE_ENV` | Backend `.env` | Enables `Secure` flag on cookies when `production` | -- |
| `CORS_ORIGIN` | Backend `.env` | Allowed CORS origin for Express and Socket.IO | `http://localhost:5173` |
| `VITE_API_URL` | Frontend `.env` | API base URL / Socket.IO server origin override | `''` (same origin / relative paths) |

### Backend Dependencies
`bcrypt`, `cors`, `dotenv`, `drizzle-orm`, `express` (v5), `jsonwebtoken`, `pg`, `socket.io`

### Frontend Dependencies
`react` (v19), `react-dom`, `react-router-dom` (v7), `socket.io-client`, `tailwindcss` (v4), `@tailwindcss/vite`

### Running Locally
```bash
# Terminal 1 -- Backend
cd backend
npm install
npx drizzle-kit generate   # Generate migration for schema changes
npx drizzle-kit migrate    # Apply migration to PostgreSQL
npm run dev                 # tsx watch src/server.ts -> http://localhost:3000

# Terminal 2 -- Frontend
cd frontend
npm install
npm run dev                 # Vite -> http://localhost:5173
```

### Health Check & Wake-Up Gate (`App.tsx`)
* On mount, `App` polls `GET /api/health` every 4 seconds (15 s fetch timeout).
* Backend health endpoint runs `SELECT 1` with a 4 s query timeout — returns 200 `{ status: 'ready' }` or 503 `{ status: 'waking_up' }`.
* Users see a spinner until the backend is ready. Once 200 is received, `serverReady` flips and the route tree renders.
* Handles free-tier cold starts on Render/Railway.

### Database Connection Resilience (`backend/src/db/index.ts`)
* `pg.Pool` configured with `max: 7`, `idleTimeoutMillis: 120_000`, TCP `keepAlive` (10 s initial delay), query/statement timeouts of 10 s, SSL enabled.
* Pool event handlers: `error` (discard broken idle clients), `connect` (log + attach per-client error handler), `remove` (debounced warmup when pool nearly empty).
* **Heartbeat:** 50 s interval `SELECT 1` on idle connections to prevent Supavisor/NAT gateway idle-kill.
* **Pool pre-warm:** Fire-and-forget `SELECT 1` immediately after `server.listen()` to force the first connection open.
* **`withRetry(fn, maxAttempts=3)`:** Retries connection-class errors (regex: terminated, reset, timeout, ECONNRESET, 57P01, etc.) with exponential backoff (1 s → 2 s → 4 s). All database calls are wrapped in `withRetry`.

## 10. Iterative Development Roadmap (MVP vs Stretch)
* **Level 1 (Static Key MVP):** Generate ECDH + ECDSA key pairs once upon registration. Public keys live permanently in PostgreSQL; private keys are wrapped with a password-derived AES key and stored encrypted on the server. On login, they are unwrapped in-browser and held **in-memory only**. *(Implemented)*
* **Level 2 (Ephemeral Keys - Stretch Goal 1):** Generate keys dynamically upon user login. Wipe the public key from the database upon Socket.IO disconnection.
* **Level 3 (Device Bound History - Stretch Goal 2):** Migrate private key storage from in-memory to IndexedDB to allow users to decrypt historical messages stored in PostgreSQL upon returning to the site without re-login.

## 11. Current Progress
* [x] **Phase 0:** Write & Finalize Project Proposal (Completed February 2026)
* [x] **Phase 1:** Initialize Monorepo Architecture (`/frontend` and `/backend` folders created, `package.json` initialized)
* [x] **Phase 2:** Configure TypeScript (`tsconfig.json`) for both frontend and backend
* [x] **Phase 3:** Set up PostgreSQL database schema (Users, Messages, Contacts) with Drizzle ORM -- includes unique constraint `owner_contact_unique` on contacts
* [x] **Phase 4:** Build React UI (Vite) -- Login, Register, Chat (with ContactsSidebar + ChatArea), Settings, About, Navbar
* [x] **Phase 5:** Establish Socket.IO connection with JWT-authenticated middleware
* [x] **Phase 6:** Implement user registration/login with full key generation, wrapping, and unwrapping
* [x] **Phase 7:** Implement Cryptography Engine -- ECDH key exchange, AES-256-GCM encryption/decryption, ECDSA signing/verification
* [x] **Phase 7.5 (Security Hardening):** HttpOnly cookie auth, IDOR protection on contacts endpoints, AbortController race-condition guards, optimistic message rollback, scoped scrollbar styles, ARIA accessibility on Navbar, no private keys in localStorage, Vite dev proxy (no hardcoded URLs), Socket.IO JWT middleware
* [x] **Phase 7.6 (Security Hardening Round 2):** Secondary DB indexes (contacts owner, messages sender/receiver, messages receiver/created_at), private Socket.IO message delivery (connectedUsers keyed by userId, `io.to()` instead of broadcast), `isAuthenticated` gate includes `ecdsaPrivateKey`, messages route requires JWT auth + IDOR authorization, decryption-failure fallback in real-time handler, exported `Contact` type (no `any`)
* [x] **Phase 7.7 (Security Hardening Round 3):** Race-safe contacts insert (catches Postgres 23505 unique violation instead of select-then-insert), logout disconnects active Socket.IO sessions (`io` exposed via `app.set`), JWT removed from login JSON response body (HttpOnly cookie only), chat history ordered by `created_at ASC, id ASC`, ChatArea clears stale messages on contact switch + checks `res.ok`, receiveMessage handler uses `isActive` flag to prevent stale writes, ContactsSidebar trims username before POST, Markdown table formatting (MD058 blank lines)
* [x] **Phase 7.8 (Security Hardening Round 4):** `connectedUsers` changed from `Map<userId, socketId>` to `Map<userId, Set<socketId>>` for multi-tab support (connection adds to set, disconnect removes from set, message emit iterates all sockets), optimistic tempId uses `crypto.randomUUID()` instead of `Date.now()`, UUID format validation on `/messages/:user1/:user2` params (400 on invalid), backend normalizes/trims `contactUsername` before DB lookup, ContactsSidebar centralizes modal state cleanup via `resetAddContactModal()` helper
* [x] **Phase 7.9 (Conversations & Inbox):** Added `conversations` table (canonical pair with CHECK constraint, lastMessageAt upsert); `sendMessage` handler now runs INSERT message + UPSERT conversations in a single `withRetry` transaction; added `GET /inbox` route (contacts LEFT JOIN conversations, LEAST/GREATEST canonical pair, ordered by last activity); messages query uses LEAST/GREATEST for index-friendly canonical pair lookup; ChatArea caches derived crypto keys per contact in a `useRef`; `messageSaved` / `messageError` socket events for optimistic reconciliation; originating socket skipped in receiveMessage broadcast
* [x] **Phase 7.10 (Auto-Contacts & Pending State):** Added `status` column to contacts (`accepted` / `pending`); auto-create `pending` contact for receiver on every `sendMessage` (`onConflictDoNothing`); `inboxUpdated` socket event notifies receiver when a new pending contact is created; `POST /contacts/add` uses `onConflictDoUpdate` to upgrade `pending` → `accepted`; `PATCH /contacts/:contactId/accept` and `DELETE /contacts/:contactId` routes for accept/reject; ContactsSidebar shows accept/reject buttons for pending contacts; debounced inbox re-fetch on `receiveMessage` / `inboxUpdated`
* [x] **Phase 7.11 (Resilience & DX):** Database connection pool tuning (keepAlive, idleTimeout, heartbeat, debounced warmup); `withRetry` helper wraps all DB calls with exponential backoff; `authFetch` utility auto-redirects on 401/403 + cross-tab sync; `GET /api/health` endpoint + frontend wake-up gate with polling spinner; pool pre-warm on server start; auto-resize textarea in ChatArea
* [x] **Phase 7.12 (Documentation):** Added `HowItWorks.md` — comprehensive technical breakdown of the entire codebase (crypto, auth, DB, API, sockets, frontend architecture, data flows, security model)
* [ ] **Phase 8:** Deployment & Network Traffic Verification

## 12. Pending Action Items
1. **(Production)** Set `CORS_ORIGIN` and `NODE_ENV=production` on the backend; optionally set `VITE_API_URL` on the frontend if the API/Socket.IO server is on a different origin.
2. **Deploy frontend to Vercel** (`vercel.json` SPA rewrite already configured) and **backend to Render/Railway**.
3. **Verify E2EE over the network** — inspect that only ciphertext, IVs, and signatures traverse the wire; no plaintext leakage.
