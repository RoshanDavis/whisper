# Whisper: Project Context & Status

## Project Meta
* **Project Name:** Whisper
* **Repository Structure:** Monorepo (`/frontend` and `/backend`)
* **Last Updated:** March 3, 2026

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
* **Endpoints requiring auth:** `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/contacts`, `POST /api/auth/contacts/add`, `GET /api/auth/messages/:user1/:user2`.

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
| `created_at` | `timestamp` | `defaultNow()` |
| | | **`UNIQUE(owner_id, contact_id)`** constraint: `owner_contact_unique` |

### Secondary Indexes (Migration SQL)

| Index Name | Table | Column(s) |
|---|---|---|
| `idx_contacts_owner_id` | `contacts` | `owner_id` |
| `idx_messages_sender_receiver` | `messages` | `sender_id, receiver_id` |
| `idx_messages_receiver_created` | `messages` | `receiver_id, created_at` |

## 6. API Routes (`/api/auth/...`)

All routes are defined in `backend/src/routes/auth.ts`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | No | Create account with all key material |
| `POST` | `/login` | No | Authenticate; sets HttpOnly JWT cookie; returns wrapped key material (JWT is NOT included in the JSON response body) |
| `GET` | `/me` | Yes | Returns authenticated user's profile + wrapped key material |
| `POST` | `/logout` | No | Clears the `whisper_token` cookie and disconnects the user's active Socket.IO sessions |
| `GET` | `/users/:id/key` | No | Fetch a user's ECDH + ECDSA public keys by user ID |
| `POST` | `/contacts/add` | Yes | Add a contact by username (owner derived from JWT); server normalizes/trims username; insert catches Postgres unique-constraint violation (23505) for race-safe 409 |
| `GET` | `/contacts` | Yes | Fetch the authenticated user's contact list (joined with public keys) |
| `GET` | `/messages/:user1/:user2` | Yes | Fetch encrypted chat history between two users; validates UUID format on params (400 if invalid); requester must be user1 or user2 (403 otherwise); results ordered by `created_at ASC, id ASC` |

## 7. Socket.IO Events

Defined in `backend/src/server.ts`. All socket connections require JWT authentication via middleware.

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `registerUser` | Client -> Server | `userId` | Backward-compat; server ignores the param and uses JWT-authenticated `socket.data.userId` |
| `sendMessage` | Client -> Server | `{ receiverId, ciphertext, iv, signature }` | Server saves to DB using `socket.data.userId` as sender, then sends privately to all sender + receiver sockets (multi-tab safe via `Set<socketId>`) |
| `receiveMessage` | Server -> Client | Full saved message row | Delivered privately to all sender and receiver sockets via `io.to(socketId).emit(...)` (supports multi-tab) |

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
* **`SocketProvider`** (`contexts/SocketContext.tsx`) -- Wraps the app inside `AuthProvider`. Creates a Socket.IO connection only when `isAuthenticated` is true, with `withCredentials: true` to send the HttpOnly cookie. Uses nullable socket with proper cleanup (`.off()`, `.disconnect()`, `setSocket(null)`, `setIsConnected(false)`) on auth change or unmount. Socket origin is configurable via `VITE_SOCKET_URL` env var, falling back to `window.location.origin`.

### Key Components

| Component | File | Purpose |
|---|---|---|
| `Navbar` | `components/Navbar.tsx` | Top nav bar with dynamic route pills, user dropdown with ARIA menu semantics (`aria-haspopup`, `aria-expanded`, `aria-controls`, `focus-visible` ring) |
| `ContactsSidebar` | `components/ContactsSidebar.tsx` | Left sidebar: exports `Contact` interface (shared with `ChatArea`); fetches contacts via `GET /api/auth/contacts` with `credentials: 'include'`; uses `AbortController` to prevent stale fetch races on userId change/unmount; add-contact modal trims username before submit, sends only `contactUsername` (no `ownerId`), uses `resetAddContactModal()` helper for centralized state cleanup on open/close/success; search/filter contacts |
| `ChatArea` | `components/ChatArea.tsx` | Main chat view: clears stale messages immediately on contact switch; loads encrypted history with `AbortController` + stale-contact snapshot guard + `res.ok` check; decrypts using in-memory `ecdhPrivateKey` from AuthContext; verifies ECDSA signatures; real-time `receiveMessage` handler uses `isActive` flag to prevent stale writes after contact change, with fallback warning on decryption/verification failure; optimistic send uses `crypto.randomUUID()` for collision-safe tempId with rollback on error; uses exported `Contact` type from `ContactsSidebar` (no `any`) |
| `Chat` | `pages/Chat.tsx` | Layout page composing `ContactsSidebar` + `ChatArea` with selected contact state |
| `Login` | `pages/Login.tsx` | Login form: posts to `/api/auth/login` with `credentials: 'include'`; derives PBKDF2 wrapping key from password + server-returned salt; unwraps both private keys into CryptoKey objects; calls `login(canonicalUsername, userId, ecdhKey, ecdsaKey)` using server-confirmed username |
| `Register` | `pages/Register.tsx` | Registration form: generates ECDH + ECDSA key pairs in browser; wraps private keys with password-derived AES key; posts all material (public keys, wrapped private keys, IVs, salt) to `/api/auth/register` |
| `Settings` | `pages/Settings.tsx` | Settings page (placeholder) |
| `About` | `pages/About.tsx` | About page |

### Shared Utilities

| File | Exports | Purpose |
|---|---|---|
| `utils/crypto.ts` | `generateKeyPair`, `generateEcdsaKeyPair`, `exportPublicKey`, `importPublicKey`, `importEcdsaPublicKey`, `deriveKeyFromPassword`, `wrapPrivateKey`, `unwrapPrivateKey`, `unwrapEcdsaPrivateKey`, `deriveSharedSecret`, `encryptMessage`, `decryptMessage`, `signData`, `verifySignature`, `base64ToArrayBuffer`, `arrayBufferToBase64`, `exportPrivateKey`, `importPrivateKey`, `importEcdsaPrivateKey` | All Web Crypto API wrappers for ECDH, ECDSA, AES-GCM, PBKDF2 |
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
| `VITE_SOCKET_URL` | Frontend `.env` | Socket.IO server origin override | `window.location.origin` |

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
* [ ] **Phase 8:** Deployment & Network Traffic Verification

## 12. Pending Action Items
1. **Run the Drizzle migration** for the new `owner_contact_unique` constraint:
   ```bash
   cd backend
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```
   *(The last `npx drizzle-kit migrate` exited with an error -- this needs to be resolved before the backend will reflect the new unique constraint in the DB.)*
2. **Restart both dev servers** after the security hardening changes.
3. **Re-register / re-login** -- since `localStorage`-based auth was removed, existing sessions will not carry over. All users must log in again. Private keys are now in-memory only, so a **page refresh requires re-login**.
4. **(Production)** Set `CORS_ORIGIN` and `NODE_ENV=production` on the backend; optionally set `VITE_SOCKET_URL` on the frontend if the Socket.IO server is on a different origin.
