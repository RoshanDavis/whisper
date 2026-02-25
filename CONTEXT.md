# Whisper: Project Context & Status

## Project Meta
* **Project Name:** Whisper
* **Repository Structure:** Monorepo (`/frontend` and `/backend`)

## 1. Project Overview
Whisper is a real-time web chat application that is designed to protect the user’s privacy through end-to-end encryption. It will be built using the PERN stack with WebSockets. The backend server will be designed to only route the data and will not be able to read the conversations. The encryption and decryption will be handled directly inside the users’ browsers. This means only the users will have access to the plaintext. 

The application will use the ECDH algorithm for an asymmetric key exchange to agree on a shared key. It will then use the shared key for AES-256-GCM to encrypt and decrypt the messages.

## 2. Technical Architecture & Stack
* **Language:** TypeScript (Strict typing for Web Crypto API data types)
* **Frontend:** React.js (via Vite)
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (with Drizzle ORM)
* **Real-Time Routing:** Socket.io
* **Cryptography Engine:** Native Web Crypto API
* **Deployment (Planned):** Vercel (Frontend), Render/Railway (Backend)

## 3. Cryptographic Implementation Strategy
* **Asymmetric Key Exchange:** Elliptic Curve Diffie-Hellman (ECDH) is used to generate a Shared Secret without transmitting it over the network.
* **Symmetric Message Encryption:** AES-256-GCM is used to encrypt message plaintext, utilizing the Shared Secret. Requires transmitting the generated Initialization Vector (IV) alongside the ciphertext.
* **Server Role:** Blind courier. The server receives, stores, and broadcasts only the `ciphertext` and `iv`. It never sees plaintext or private keys.

## 4. Iterative Development Roadmap (MVP vs Stretch)
* **Level 1 (Static Key MVP):** Generate ECDH key pair once upon registration. Public key lives permanently in PostgreSQL; private key is saved to the browser's `localStorage`. (Goal: Guarantee a working E2EE chat app for the class presentation).
* **Level 2 (Ephemeral Keys - Stretch Goal 1):** Generate keys dynamically upon user login. Wipe the public key from the database upon Socket.io disconnection.
* **Level 3 (Device Bound History - Stretch Goal 2):** Migrate private key storage from `localStorage` to IndexedDB to allow users to decrypt historical messages stored in PostgreSQL upon returning to the site.

## 5. Current Progress
* [x] **Phase 0:** Write & Finalize Project Proposal (Completed February 2026)
* [x] **Phase 1:** Initialize Monorepo Architecture (`/frontend` and `/backend` folders created, `package.json` initialized)
* [ ] **Phase 2:** Configure TypeScript (`tsconfig.json`) for backend
* [ ] **Phase 3:** Set up PostgreSQL database schema (Users, Messages) with Drizzle ORM
* [ ] **Phase 4:** Build basic React UI (Vite)
* [ ] **Phase 5:** Establish plaintext Socket.io connection (Routing)
* [ ] **Phase 6:** Implement user registration/login (Static Key Generation)
* [ ] **Phase 7:** Implement Cryptography Engine (ECDH Key Exchange + AES-256-GCM Encryption/Decryption)
* [ ] **Phase 8:** Deployment & Network Traffic Verification