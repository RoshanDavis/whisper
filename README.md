# Whisper

Whisper is a real-time, end-to-end encrypted chat application built as a monorepo with:

- frontend: React + Vite + TypeScript
- backend: Express + Socket.IO + Drizzle ORM + PostgreSQL

Only encrypted data is sent to and stored by the server.

## Prerequisites

- Node.js 20+ (recommended for Vite 7)
- npm 10+
- PostgreSQL database (local or hosted)

## Project Structure

- frontend: client app (Vite dev server on port 5173)
- backend: API + Socket.IO server (default port 3000)

## 1) Install Dependencies

From the repository root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 2) Configure Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=replace_with_a_long_random_secret
PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Notes:

- `DATABASE_URL` and `JWT_SECRET` are required.
- If your Postgres provider requires SSL, include the provider-specific SSL options in `DATABASE_URL`.

Optional: create `frontend/.env`:

```env
VITE_API_URL=
```

Notes:

- For local development, you can leave `VITE_API_URL` empty. The Vite proxy forwards `/api` and `/socket.io` to `http://localhost:3000`.
- Set `VITE_API_URL` only when your frontend should call a different backend origin directly.

## 3) Run Database Migrations

From `backend`:

```bash
npx drizzle-kit migrate
```

This applies SQL migrations from `backend/drizzle/` to your PostgreSQL database.

## 4) Start the Backend

From `backend`:

```bash
npm run dev
```

Backend will run on `http://localhost:3000` (or your configured `PORT`).

## 5) Start the Frontend

From `frontend` (new terminal):

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`.

## 6) Open the App

Open `http://localhost:5173` in your browser.

If the backend is still waking up, the frontend health check screen will wait and retry automatically.

## Useful Scripts

Backend (`backend/package.json`):

- `npm run dev` - Start backend in watch mode with tsx
- `npm run build` - Compile TypeScript to `dist`
- `npm run start` - Run compiled backend from `dist/server.js`

Frontend (`frontend/package.json`):

- `npm run dev` - Start Vite dev server
- `npm run build` - Type-check and build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Additional Docs

- `HowItWorks.md` - detailed architecture and cryptography walkthrough
- `CONTEXT.md` - implementation notes and project status
