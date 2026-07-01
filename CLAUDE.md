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
  style, equipment, sets, repLow, repHigh, inc } ] } ] }`
  - `equipment`: one of `"Barbell" | "Dumbbell" | "Machine" | "Cable" | "Bodyweight" | "Other"`.
    Backfilled on load by `normalizeProgram` from `LIB_BY_NAME` lookup then "Other" if missing.
    Spread-first pattern: `{ ...e, style, equipment }` — never let undefined in existing data win.
- **meso**: `{ length, deload, startRIR, addSet, maxSets }`
- **logs**: `{ [exerciseId]: { [weekNumber]: { sets:[{weight,reps,assist}], rir, deload, ts }
  | { skipped:true, ts } } }`
  - For bodyweight exercises `weight` stores the *added* weight (0 = BW only, negative = assisted).
    Total load is computed on-the-fly as `bodyweight + added`.
  - Reps are stored as total `reps` plus `assist` (assisted/forced reps). Clean reps = reps - assist.
- **settings**: `{ week, unit, bodyweight }` — `bodyweight` is a number (lbs or kg matching `unit`)
  or `null`. Backwards-compatible: loads as `null` if absent.
- **feedback** (`wt_feedback`): `{ [week]: { [muscle]: { soreness?, pump?, joints?, workload? } } }`.
  All values are integers; absent key = unanswered (never store `undefined`).
  - `soreness`: 0=not sore, 1=healed early, 2=just right, 3=still sore. Captured at session start,
    per muscle with prior history. Asks about recovery *since the last session*, skippable.
  - `pump`: 0=low, 1=good, 2=incredible.
  - `joints`: 0=none, 1=mild, 2=moderate, 3=significant. Only displayed when > 0.
  - `workload`: 0=too light, 1=perfect, 2=very hard, 3=overdone.
  - pump/joints/workload captured via "Finish session" modal, once per muscle (muscle = last exercise
    position ordering). Stage 2 (autoregulation — using these values to adjust set counts / volume
    recommendations) is pending and NOT yet implemented.

## Progression engine (function `suggest`)
Double progression, range-agnostic:
- All working sets hit the top of the rep range with CLEAN reps -> add weight, reset to bottom.
- Hit the reps only with assistance -> hold load, "earn clean".
- 0 RIR (grinding) with no clean progress vs prior week -> "hold/stall"; two weeks -> suggest deload.
- Lots of reps in reserve -> push effort.
- Deload week -> ~90% load, fewer sets.
- Skipped weeks are ignored by progression (it references the last real working week).
Helpers: `epley1RM`, `predictReps` (load↔rep autocorrect), `workingWeeksDesc`, `cleanOf`.

## Per-set rep targets and fatigue (ExerciseCard)
- `fatigueDropPerSet`: derived each render from `sug.lastSets`. Takes the clean-rep counts in
  order across last week's sets and computes `(firstReps - lastReps) / (numSets - 1)`. Clamped
  to ≥ 0. Falls back to 1 rep/set when fewer than 2 sets in history.
- `goalForSet(setIdx, rowWeight)`: same load→rep logic as the old flat goal, then applies
  `Math.max(1, Math.round(set1Target - setIdx * fatigueDropPerSet))`. Set 0 gets the full
  predicted target; later sets step down by the fatigue offset.
- **Placeholder vs coloring split**: `RepInput` receives two different `goal` values depending
  on whether a rep has been entered. Empty field → `goalForSet(i, w)` (per-set hint in the
  placeholder). Logged field → `goalForSet(0, w)` (flat base target, same for all sets, matches
  the progression bar). This keeps coloring consistent with what earns a weight increase.

## Weight cascade (ExerciseCard)
- Fresh week: `build()` seeds only **row 0** with `sug.weight`; rows 1+ start as `""`.
- `cascadeWeight(i)`: reads `prev[i].weight`; if non-empty, fills downstream `""` rows and
  stops at the first non-empty row. Wired to `onBlur` on the weight input so it fires once on
  the committed value, not mid-keystroke.
- New sets added via "Add set" also start as `""` and inherit the weight above on blur.
- Never overwrites a weight already typed.

## Bodyweight exercises
- `LIB` exercises include `equipment: "Bodyweight"` where appropriate.
- `bwLabel(added)`: formats added weight as "BW", "BW+25", "BW−20 assisted".
- `totalOf(added)` in ExerciseCard: `(isBW && bwSet) ? bodyweight + added : added`.
- `workingWeight(sets)`: auto-detects BW via `hasNonPositive`; includes ≤ 0 weights in the
  modal-weight calculation so BW-only (weight=0) is handled correctly.
- `refE1RM` in ExerciseCard is inlined (not `bestE1RMHistory`) so the BW offset can be added
  before `epley1RM`. `ProgressView` similarly applies a `bwOff` before charting e1RM/volume.
- Bodyweight is stored in `wt_settings` and set via a number input in Routine → Units.

## Splits & exercises
- `LIB`: 67-exercise library `[name, muscle, style, equipment]` -> objects. `LIB_BY_NAME` indexes it.
- `EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight"]`; `equipColor(eq)` maps
  each to a hex color for badges.
- `SPLITS`: presets built via `d(name, weekday, [exerciseNames])`; names MUST exist in LIB.
  `buildSplit()` turns a preset into program days. `exFromLib` is guarded against missing names.
- `ExercisePicker`: filter chips by equipment category, equipment + style badges per exercise,
  inline custom-exercise form with name/muscle/equipment selection.
- UI: `SplitPicker` (choose a template) and `ExercisePicker` (search/add from library) render
  inside `Modal`. RoutineView also supports day reorder (`moveDay`) and weekday assignment.

## Known issues
- **Cascade doesn't auto-flow on initial page load.** Row 0 is seeded by `build()` at init but no
  blur fires, so rows 2+ stay empty until the user clicks into and out of row 0. `ExerciseCard.build`
  / `cascadeWeight`.
- **`logInstead` pre-fills all rows directly**, bypassing the blur-cascade model. Inconsistent but
  harmless — all rows end up filled. `ExerciseCard.logInstead`.
- **Adding a set mid-session doesn't auto-inherit weight.** The new `""` row only fills when the
  user re-blurs a row above it. `ExerciseCard.addSet` / `cascadeWeight`.
- **Fatigue drop can mislead with drop sets.** `fatigueDropPerSet` uses `cleanOf` across all of
  last week's sets in order; if sets were at different weights the drop figure is skewed.
  `ExerciseCard.fatigueDropPerSet`.

## Good next tasks / ideas
- Cross-device sync (replace storage-shim with a backend; keep the same window.storage API).
- PWA manifest + service worker for true offline/home-screen install.
- Per-set RIR (currently one RIR per exercise per session).
- Rest timer; 1RM test mode.
- Import the JSON produced by the in-app Export button.
- Auto-cascade on mount: call `cascadeWeight(0)` inside `useEffect([week, exercise.id])` after
  `setRows(build())` so rows 1+ fill immediately on page load without requiring a blur.

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
