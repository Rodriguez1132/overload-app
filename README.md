# Overload — workout tracker (full stack)

Progressive-overload training log with clean/assisted-rep logging, double-progression +
RIR autoregulation, mesocycles/deloads, split templates (PPL, Upper/Lower, Arnold, Bro,
full-body, 2–7 day), a 67-exercise picker, and progress charts. Installable on iPhone (PWA),
runs offline, and can optionally sync across devices through your own Node/Mongo backend.

## Architecture (why it's simple to extend)

Every read/write in the app goes through one tiny interface — `window.storage` with
`get / set / delete / list`. That's the only seam between the UI and storage, so you can change
*where* data lives without touching `src/App.jsx`:

```
React app (src/App.jsx)
        │  window.storage.get/set/delete/list
        ▼
src/storage-shim.js   ──►  localStorage           (default: local-only, no server)
                      ──►  Node API + localStorage (synced: set VITE_API_URL)
                                   │
                                   ▼
                       server/  Express + Mongoose  ──►  MongoDB
```

## 1. Frontend — run it (5 min)

Node 18+ required.

```bash
cd overload-app
npm install
npm run dev          # http://localhost:5173
```

Out of the box it's **local-only**: data saved in your browser, no backend needed. Good for one device.

## 2. Backend — optional sync across devices

You only need this to share data between, say, your phone and laptop.

```bash
cd server
cp .env.example .env          # set MONGODB_URI (local Mongo, or a free MongoDB Atlas string)
npm install
npm run dev                   # http://localhost:8787
```

Then turn on sync in the frontend: copy the root `.env.example` to `.env`, set
`VITE_API_URL=http://localhost:8787`, and restart `npm run dev` in the root. Use the same
`VITE_USER_ID` on every device you want to share data. The frontend keeps localStorage as an
offline cache, so the gym wifi dropping never loses a logged set — it re-syncs when you're back online.

**Database choice:** the backend uses MongoDB because you asked for it; a free Atlas cluster
means you don't install anything locally. If you'd rather, the same key/value API maps cleanly
onto SQLite (simplest, single file), Postgres/Supabase (hosted + auth), or PocketBase/Firebase
(turnkey) — swapping the DB only touches `server/server.js`, not the app.

## 3. iPhone

- **Now (free):** `npm run build`, deploy `dist/` (Netlify drop or Vercel), open the https URL in
  Safari → Share → Add to Home Screen. Full-screen app, offline-capable.
- **App Store (later):** Capacitor is pre-wired (`capacitor.config.json`, `ios:*` scripts). Needs a
  Mac + Xcode + Apple Developer ($99/yr) + review. No UI rewrite. See below / CLAUDE.md.

## Editing with Claude Code

Open the folder in VS Code, use the Claude Code extension. It reads `CLAUDE.md` for full context.

## Layout

`src/App.jsx` (whole app) · `src/storage-shim.js` (storage adapter: local or API) ·
`src/main.jsx` (entry + service worker) · `public/` (PWA manifest, SW, icons) ·
`server/` (Node + Express + Mongoose API) · `capacitor.config.json` (native iOS) · build config.
