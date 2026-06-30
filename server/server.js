// Overload backend — a tiny key/value API over MongoDB.
// It deliberately mirrors the window.storage interface the app already uses:
// get / set / delete / list, scoped per user. The app stores its JSON blobs
// (wt_program, wt_logs, wt_settings) here, so nothing in App.jsx changes.

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const {
  MONGODB_URI = "mongodb://127.0.0.1:27017/overload",
  PORT = 8787,
  API_KEY = "",
} = process.env;

await mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✓ MongoDB connected"))
  .catch((e) => { console.error("✗ MongoDB error:", e.message); process.exit(1); });

const kvSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String, default: "" },
  },
  { timestamps: true }
);
kvSchema.index({ user: 1, key: 1 }, { unique: true });
const KV = mongoose.model("KV", kvSchema);

const app = express();
app.use(cors());                       // personal use: allow all origins. Restrict for production.
app.use(express.json({ limit: "8mb" }));

// Optional shared-secret check + per-user scoping.
app.use((req, res, next) => {
  if (API_KEY && req.headers["x-api-key"] !== API_KEY)
    return res.status(401).json({ error: "unauthorized" });
  req.userId = String(req.headers["x-user-id"] || "me").slice(0, 128);
  next();
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// list keys (optional ?prefix=)
app.get("/api/kv", async (req, res) => {
  const prefix = String(req.query.prefix || "");
  const filter = { user: req.userId };
  if (prefix) filter.key = { $regex: "^" + escapeRegex(prefix) };
  const docs = await KV.find(filter, { key: 1, _id: 0 });
  res.json({ keys: docs.map((d) => d.key), prefix });
});

// read one
app.get("/api/kv/:key", async (req, res) => {
  const doc = await KV.findOne({ user: req.userId, key: req.params.key });
  if (!doc) return res.status(404).json({ error: "not found" });
  res.json({ key: doc.key, value: doc.value });
});

// upsert one
app.put("/api/kv/:key", async (req, res) => {
  const value =
    typeof req.body?.value === "string"
      ? req.body.value
      : JSON.stringify(req.body?.value ?? "");
  const doc = await KV.findOneAndUpdate(
    { user: req.userId, key: req.params.key },
    { value },
    { upsert: true, new: true }
  );
  res.json({ key: doc.key, value: doc.value });
});

// delete one
app.delete("/api/kv/:key", async (req, res) => {
  await KV.deleteOne({ user: req.userId, key: req.params.key });
  res.json({ key: req.params.key, deleted: true });
});

app.listen(PORT, () => console.log(`✓ Overload API on http://localhost:${PORT}`));
