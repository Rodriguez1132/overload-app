# CLAUDE.md — project context

## What this is
"Overload" — a single-file React workout tracker focused on progressive overload.
All UI and logic live in `src/App.jsx` (default export `App`).

## Stack & conventions
- React 18 + Vite. Charts: `recharts`. Icons: `lucide-react`.
- Styling: **Tailwind core utility classes only** (no arbitrary values like `text-[11px]`,
  no slash-opacity like `bg-zinc-900/60`). For precise sizes, translucent backgrounds, and
  custom grid templates the code uses **inline `style={{...}}`** on purpose — keep that pattern.
- Persistence goes through `window.storage` (async get/set/delete/list). In production that
  comes from `src/storage-shim.js` (localStorage). Do NOT call localStorage directly in App.jsx.
- Keys used: `wt_program`, `wt_logs`, `wt_settings`.

## Data model
- **program**: `{ name, meso, days: [ { id, name, weekday, exercises: [ { id, name, muscle,
  style, sets, repLow, repHigh, inc } ] } ] }`
- **meso**: `{ length, deload, startRIR, addSet, maxSets }`
- **logs**: `{ [exerciseId]: { [weekNumber]: { sets:[{weight,reps,assist}], rir, deload, ts }
  | { skipped:true, ts } } }`
- Reps are stored as total `reps` plus `assist` (assisted/forced reps). Clean reps = reps - assist.

## Progression engine (function `suggest`)
Double progression, range-agnostic:
- All working sets hit the top of the rep range with CLEAN reps -> add weight, reset to bottom.
- Hit the reps only with assistance -> hold load, "earn clean".
- 0 RIR (grinding) with no clean progress vs prior week -> "hold/stall"; two weeks -> suggest deload.
- Lots of reps in reserve -> push effort.
- Deload week -> ~90% load, fewer sets.
- Skipped weeks are ignored by progression (it references the last real working week).
Helpers: `epley1RM`, `predictReps` (load↔rep autocorrect), `workingWeeksDesc`, `cleanOf`.

## Splits & exercises
- `LIB`: 67-exercise library `[name, muscle, style]` -> objects. `LIB_BY_NAME` indexes it.
- `SPLITS`: presets built via `d(name, weekday, [exerciseNames])`; names MUST exist in LIB.
  `buildSplit()` turns a preset into program days. `exFromLib` is guarded against missing names.
- UI: `SplitPicker` (choose a template) and `ExercisePicker` (search/add from library) render
  inside `Modal`. RoutineView also supports day reorder (`moveDay`) and weekday assignment.

## Good next tasks / ideas
- Cross-device sync (replace storage-shim with a backend; keep the same window.storage API).
- PWA manifest + service worker for true offline/home-screen install.
- Per-set RIR (currently one RIR per exercise per session).
- Rest timer; bodyweight/assisted-loading exercises; 1RM test mode.
- Import the JSON produced by the in-app Export button.

## iOS / App Store
- This is a PWA (manifest + `public/sw.js` + apple-touch-icon/meta in index.html). Add to Home Screen on iOS gives a full-screen app, free.
- App Store path is Capacitor (config + deps + `ios:*` scripts present). Requires a Mac + Xcode + Apple Developer ($99/yr) + review. No UI rewrite — it loads the built web app.
- Storage swap for native durability (keep the same window.storage interface):
  In `src/storage-shim.js`, when running under Capacitor (`window.Capacitor?.isNativePlatform?.()`),
  back get/set/delete/list with `@capacitor/preferences` (`Preferences.get/set/remove/keys`) instead of
  localStorage. Fall back to localStorage on web so the PWA still works. Do NOT call Capacitor APIs in App.jsx.

## Backend / data layer
- All persistence is behind `window.storage` (get/set/delete/list) defined in `src/storage-shim.js`.
  NEVER call localStorage/fetch directly from App.jsx — go through window.storage.
- Two modes, chosen by `VITE_API_URL`:
  - empty -> localStorage only (default, offline, single device).
  - set   -> talks to `server/` REST API (key/value over MongoDB) AND mirrors to localStorage as
    an offline cache (write-through on set; cache fallback on get/list when the network fails).
- Backend (`server/server.js`): Express + Mongoose. Model `KV { user, key, value, timestamps }`,
  unique index (user, key). Routes: GET/PUT/DELETE `/api/kv/:key`, GET `/api/kv?prefix=`, GET `/api/health`.
  Per-user via `x-user-id` header; optional `API_KEY` shared secret via `x-api-key`.
- The app stores JSON blobs under keys `wt_program`, `wt_logs`, `wt_settings`. To model data
  relationally later, parse those server-side — but the key/value seam is enough for personal use.
- Env: frontend `.env` (VITE_API_URL, VITE_USER_ID, VITE_API_KEY); backend `server/.env`
  (MONGODB_URI, PORT, API_KEY). Restart dev servers after editing env files.
