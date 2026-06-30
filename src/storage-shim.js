// Persistence for Overload. Same window.storage interface either way, so App.jsx never changes.
//
//   Local-only (default):  browser localStorage. Zero setup, one device.
//   Synced:                set VITE_API_URL to your Node/Mongo backend. Data syncs across
//                          devices; localStorage is kept as an offline cache.
//
// Configure via .env (copy .env.example -> .env). Restart `npm run dev` after editing .env.

const API = import.meta.env?.VITE_API_URL || "";
const USER = import.meta.env?.VITE_USER_ID || "me";
const APIKEY = import.meta.env?.VITE_API_KEY || "";
const PREFIX = "overload:";

const headers = () => {
  const h = { "Content-Type": "application/json", "x-user-id": USER };
  if (APIKEY) h["x-api-key"] = APIKEY;
  return h;
};
const lsGet = (k) => localStorage.getItem(PREFIX + k);
const lsSet = (k, v) => localStorage.setItem(PREFIX + k, v);
const lsDel = (k) => localStorage.removeItem(PREFIX + k);
const lsList = (prefix = "") => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      const bare = k.slice(PREFIX.length);
      if (bare.startsWith(prefix)) keys.push(bare);
    }
  }
  return { keys, prefix, shared: false };
};

const localApi = {
  async get(key) { const v = lsGet(key); if (v === null) throw new Error("not found: " + key); return { key, value: v, shared: false }; },
  async set(key, value) { lsSet(key, value); return { key, value, shared: false }; },
  async delete(key) { lsDel(key); return { key, deleted: true, shared: false }; },
  async list(prefix = "") { return lsList(prefix); },
};

const url = (key) => `${API}/api/kv/${encodeURIComponent(key)}`;
const apiBackedStorage = {
  async get(key) {
    try {
      const r = await fetch(url(key), { headers: headers() });
      if (r.status === 404) throw Object.assign(new Error("not found"), { notFound: true });
      if (!r.ok) throw new Error("api " + r.status);
      const j = await r.json();
      lsSet(key, j.value);                 // refresh offline cache
      return { key, value: j.value, shared: false };
    } catch (e) {
      if (e.notFound) throw e;             // genuinely absent on the server
      const v = lsGet(key);               // offline -> serve cached copy
      if (v === null) throw e;
      return { key, value: v, shared: false };
    }
  },
  async set(key, value) {
    lsSet(key, value);                     // write-through: never lose a log if offline
    try { await fetch(url(key), { method: "PUT", headers: headers(), body: JSON.stringify({ value }) }); }
    catch (_) { /* stays cached locally; next online write re-syncs */ }
    return { key, value, shared: false };
  },
  async delete(key) {
    lsDel(key);
    try { await fetch(url(key), { method: "DELETE", headers: headers() }); } catch (_) {}
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    try {
      const r = await fetch(`${API}/api/kv?prefix=${encodeURIComponent(prefix)}`, { headers: headers() });
      if (!r.ok) throw new Error("api " + r.status);
      const j = await r.json();
      return { keys: j.keys || [], prefix, shared: false };
    } catch (_) {
      return lsList(prefix);
    }
  },
};

if (typeof window !== "undefined" && !window.storage) {
  window.storage = API ? apiBackedStorage : localApi;
}
