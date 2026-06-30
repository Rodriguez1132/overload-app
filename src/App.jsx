import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell, TrendingUp, BarChart3, Settings, ChevronLeft, ChevronRight,
  Plus, Trash2, Check, Pencil, Download, X, ArrowUp, Flame, Save, Moon,
  Hand, AlertTriangle, SkipForward, ChevronUp, ChevronDown, Search, Library
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";

/* ============================== storage ============================== */
/* Uses the artifact's window.storage when present (inside Claude). When this
   app is deployed as a standalone site, window.storage is absent, so it falls
   back to the browser's localStorage for real persistence. In-memory is the
   last resort (e.g. private-mode with storage disabled). */
const mem = {};
async function loadKey(key, fallback) {
  try {
    if (typeof window !== "undefined" && window.storage?.get) {
      const r = await window.storage.get(key, false);
      return r?.value != null ? JSON.parse(r.value) : fallback;
    }
  } catch (e) { /* missing key throws */ }
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(key);
      if (v != null) return JSON.parse(v);
    }
  } catch (e) { /* unavailable */ }
  return mem[key] !== undefined ? mem[key] : fallback;
}
async function saveKey(key, val) {
  mem[key] = val;
  try {
    if (typeof window !== "undefined" && window.storage?.set) { await window.storage.set(key, JSON.stringify(val), false); return; }
  } catch (e) { /* fall through */ }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { /* mem holds it */ }
}
const uid = () => Math.random().toString(36).slice(2, 9);

/* ============================== styles / presets ============================== */
const STYLES = {
  strength:    { label: "Strength",     low: 3,  high: 6,  inc: 5 },
  moderate:    { label: "Moderate",     low: 6,  high: 10, inc: 5 },
  hypertrophy: { label: "Hypertrophy",  low: 10, high: 15, inc: 5 },
  pump:        { label: "Pump",         low: 15, high: 20, inc: 5 },
};
const styleFromRange = (low, high) => {
  for (const [k, v] of Object.entries(STYLES)) if (v.low === low && v.high === high) return k;
  return "custom";
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const todayLabel = () => WEEKDAYS[(new Date().getDay() + 6) % 7];

/* ============================== exercise library ============================== */
/* [name, muscle, default style, equipment]. Used by the picker and the split presets. */
const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight"];
const equipColor = (eq) => ({ Barbell: "#f59e0b", Dumbbell: "#60a5fa", Machine: "#a78bfa", Cable: "#34d399", Bodyweight: "#fb923c" }[eq] || "#71717a");

const LIB = [
  ["Barbell Bench Press", "Chest", "strength", "Barbell"], ["Incline Barbell Press", "Chest", "moderate", "Barbell"],
  ["Dumbbell Bench Press", "Chest", "moderate", "Dumbbell"], ["Incline Dumbbell Press", "Chest", "moderate", "Dumbbell"],
  ["Machine Chest Press", "Chest", "hypertrophy", "Machine"], ["Pec Deck", "Chest", "hypertrophy", "Machine"],
  ["Cable Fly", "Chest", "hypertrophy", "Cable"], ["Dips", "Chest", "moderate", "Bodyweight"], ["Push-up", "Chest", "hypertrophy", "Bodyweight"],
  ["Deadlift", "Back", "strength", "Barbell"], ["Barbell Row", "Back", "moderate", "Barbell"], ["Pendlay Row", "Back", "moderate", "Barbell"],
  ["Dumbbell Row", "Back", "moderate", "Dumbbell"], ["T-Bar Row", "Back", "moderate", "Barbell"], ["Seated Cable Row", "Back", "hypertrophy", "Cable"],
  ["Lat Pulldown", "Back", "hypertrophy", "Cable"], ["Pull-up", "Back", "moderate", "Bodyweight"], ["Weighted Pull-up", "Back", "strength", "Bodyweight"],
  ["Chin-up", "Back", "moderate", "Bodyweight"], ["Machine Row", "Back", "hypertrophy", "Machine"], ["Straight-arm Pulldown", "Back", "pump", "Cable"],
  ["Overhead Press", "Shoulders", "strength", "Barbell"], ["Seated DB Press", "Shoulders", "moderate", "Dumbbell"],
  ["Arnold Press", "Shoulders", "moderate", "Dumbbell"], ["Machine Shoulder Press", "Shoulders", "hypertrophy", "Machine"], ["Push Press", "Shoulders", "strength", "Barbell"],
  ["Lateral Raise", "Side Delts", "pump", "Dumbbell"], ["Cable Lateral Raise", "Side Delts", "pump", "Cable"], ["Machine Lateral Raise", "Side Delts", "pump", "Machine"],
  ["Face Pull", "Rear Delts", "pump", "Cable"], ["Reverse Pec Deck", "Rear Delts", "pump", "Machine"], ["Rear Delt Fly", "Rear Delts", "pump", "Dumbbell"],
  ["Barbell Curl", "Biceps", "moderate", "Barbell"], ["Dumbbell Curl", "Biceps", "hypertrophy", "Dumbbell"], ["Incline Curl", "Biceps", "hypertrophy", "Dumbbell"],
  ["Hammer Curl", "Biceps", "hypertrophy", "Dumbbell"], ["Preacher Curl", "Biceps", "hypertrophy", "Barbell"], ["Cable Curl", "Biceps", "pump", "Cable"], ["Concentration Curl", "Biceps", "pump", "Dumbbell"],
  ["Close-grip Bench", "Triceps", "moderate", "Barbell"], ["Triceps Pushdown", "Triceps", "hypertrophy", "Cable"], ["Overhead Triceps Ext", "Triceps", "hypertrophy", "Cable"],
  ["Skull Crusher", "Triceps", "hypertrophy", "Barbell"], ["Cable Kickback", "Triceps", "pump", "Cable"],
  ["Back Squat", "Quads", "strength", "Barbell"], ["Front Squat", "Quads", "moderate", "Barbell"], ["Hack Squat", "Quads", "moderate", "Machine"],
  ["Leg Press", "Quads", "moderate", "Machine"], ["Bulgarian Split Squat", "Quads", "moderate", "Dumbbell"], ["Leg Extension", "Quads", "hypertrophy", "Machine"], ["Goblet Squat", "Quads", "moderate", "Dumbbell"],
  ["Romanian Deadlift", "Hamstrings", "moderate", "Barbell"], ["Lying Leg Curl", "Hamstrings", "hypertrophy", "Machine"], ["Seated Leg Curl", "Hamstrings", "hypertrophy", "Machine"],
  ["Stiff-leg Deadlift", "Hamstrings", "moderate", "Barbell"], ["Good Morning", "Hamstrings", "moderate", "Barbell"],
  ["Hip Thrust", "Glutes", "moderate", "Barbell"], ["Glute Bridge", "Glutes", "hypertrophy", "Bodyweight"], ["Cable Pull-through", "Glutes", "hypertrophy", "Cable"],
  ["Standing Calf Raise", "Calves", "hypertrophy", "Machine"], ["Seated Calf Raise", "Calves", "hypertrophy", "Machine"], ["Leg Press Calf Raise", "Calves", "hypertrophy", "Machine"],
  ["Hanging Leg Raise", "Abs", "hypertrophy", "Bodyweight"], ["Cable Crunch", "Abs", "hypertrophy", "Cable"], ["Plank", "Abs", "moderate", "Bodyweight"], ["Ab Wheel", "Abs", "moderate", "Bodyweight"], ["Crunch", "Abs", "pump", "Bodyweight"],
].map(([name, muscle, style, equipment]) => ({ name, muscle, style, equipment }));
const LIB_BY_NAME = Object.fromEntries(LIB.map((e) => [e.name, e]));

/* ============================== split presets ============================== */
/* d(name, weekday, [exercise names]) — names must exist in LIB. */
const d = (name, weekday, ex) => ({ name, weekday, ex });
const SPLITS = [
  { key: "fb2", name: "Full Body", sub: "2 days · time-crunched", days: [
    d("Full Body A", "Mon", ["Barbell Bench Press", "Barbell Row", "Back Squat", "Overhead Press", "Barbell Curl"]),
    d("Full Body B", "Thu", ["Incline Dumbbell Press", "Lat Pulldown", "Romanian Deadlift", "Lateral Raise", "Triceps Pushdown"]),
  ]},
  { key: "fb3", name: "Full Body", sub: "3 days · great for beginners", days: [
    d("Full Body A", "Mon", ["Barbell Bench Press", "Barbell Row", "Back Squat", "Lateral Raise", "Barbell Curl"]),
    d("Full Body B", "Wed", ["Overhead Press", "Lat Pulldown", "Romanian Deadlift", "Incline Dumbbell Press", "Triceps Pushdown"]),
    d("Full Body C", "Fri", ["Incline Barbell Press", "Seated Cable Row", "Leg Press", "Hammer Curl", "Lateral Raise"]),
  ]},
  { key: "ul4", name: "Upper / Lower", sub: "4 days · balanced & popular", days: [
    d("Upper A", "Mon", ["Barbell Bench Press", "Barbell Row", "Overhead Press", "Lat Pulldown", "Barbell Curl", "Triceps Pushdown"]),
    d("Lower A", "Tue", ["Back Squat", "Romanian Deadlift", "Leg Press", "Lying Leg Curl", "Standing Calf Raise"]),
    d("Upper B", "Thu", ["Incline Dumbbell Press", "Seated Cable Row", "Lateral Raise", "Pull-up", "Incline Curl", "Overhead Triceps Ext"]),
    d("Lower B", "Fri", ["Front Squat", "Hip Thrust", "Leg Extension", "Seated Leg Curl", "Seated Calf Raise"]),
  ]},
  { key: "ppl6", name: "Push / Pull / Legs", sub: "6 days · high volume", days: [
    d("Push A", "Mon", ["Barbell Bench Press", "Overhead Press", "Incline Dumbbell Press", "Lateral Raise", "Triceps Pushdown"]),
    d("Pull A", "Tue", ["Deadlift", "Pull-up", "Barbell Row", "Face Pull", "Barbell Curl"]),
    d("Legs A", "Wed", ["Back Squat", "Romanian Deadlift", "Leg Press", "Lying Leg Curl", "Standing Calf Raise"]),
    d("Push B", "Thu", ["Incline Barbell Press", "Seated DB Press", "Cable Fly", "Cable Lateral Raise", "Overhead Triceps Ext"]),
    d("Pull B", "Fri", ["Barbell Row", "Lat Pulldown", "Seated Cable Row", "Reverse Pec Deck", "Hammer Curl"]),
    d("Legs B", "Sat", ["Front Squat", "Hip Thrust", "Leg Extension", "Seated Leg Curl", "Seated Calf Raise"]),
  ]},
  { key: "pplul5", name: "PPL + Upper / Lower", sub: "5 days · hybrid", days: [
    d("Push", "Mon", ["Barbell Bench Press", "Overhead Press", "Incline Dumbbell Press", "Lateral Raise", "Triceps Pushdown"]),
    d("Pull", "Tue", ["Pull-up", "Barbell Row", "Lat Pulldown", "Face Pull", "Barbell Curl"]),
    d("Legs", "Wed", ["Back Squat", "Romanian Deadlift", "Leg Press", "Lying Leg Curl", "Standing Calf Raise"]),
    d("Upper", "Fri", ["Incline Barbell Press", "Seated Cable Row", "Lateral Raise", "Incline Curl", "Overhead Triceps Ext"]),
    d("Lower", "Sat", ["Front Squat", "Hip Thrust", "Leg Extension", "Seated Leg Curl", "Seated Calf Raise"]),
  ]},
  { key: "arnold6", name: "Arnold Split", sub: "6 days · chest+back / shoulders+arms / legs", days: [
    d("Chest & Back A", "Mon", ["Barbell Bench Press", "Incline Dumbbell Press", "Barbell Row", "Lat Pulldown", "Cable Fly"]),
    d("Shoulders & Arms A", "Tue", ["Overhead Press", "Lateral Raise", "Barbell Curl", "Triceps Pushdown", "Hammer Curl"]),
    d("Legs A", "Wed", ["Back Squat", "Romanian Deadlift", "Leg Press", "Lying Leg Curl", "Standing Calf Raise"]),
    d("Chest & Back B", "Thu", ["Incline Barbell Press", "Dumbbell Bench Press", "Seated Cable Row", "Pull-up", "Pec Deck"]),
    d("Shoulders & Arms B", "Fri", ["Seated DB Press", "Cable Lateral Raise", "Incline Curl", "Overhead Triceps Ext", "Cable Curl"]),
    d("Legs B", "Sat", ["Front Squat", "Hip Thrust", "Leg Extension", "Seated Leg Curl", "Seated Calf Raise"]),
  ]},
  { key: "bro5", name: "Bro Split", sub: "5 days · one muscle group per day", days: [
    d("Chest", "Mon", ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Fly", "Pec Deck", "Dips"]),
    d("Back", "Tue", ["Deadlift", "Barbell Row", "Lat Pulldown", "Seated Cable Row", "Straight-arm Pulldown"]),
    d("Shoulders", "Wed", ["Overhead Press", "Lateral Raise", "Reverse Pec Deck", "Cable Lateral Raise", "Face Pull"]),
    d("Legs", "Thu", ["Back Squat", "Romanian Deadlift", "Leg Press", "Leg Extension", "Standing Calf Raise"]),
    d("Arms", "Fri", ["Barbell Curl", "Close-grip Bench", "Incline Curl", "Triceps Pushdown", "Hammer Curl"]),
  ]},
];

/* ============================== seed ============================== */
function seedProgram() {
  const ex = (name, muscle, sets, style) => ({
    id: uid(), name, muscle, sets, style,
    repLow: STYLES[style].low, repHigh: STYLES[style].high, inc: STYLES[style].inc,
  });
  return {
    name: "My Program",
    meso: { length: 5, deload: true, startRIR: 3, addSet: false, maxSets: 6 },
    days: [
      { id: uid(), name: "Push", weekday: "Mon", exercises: [
        ex("Bench Press", "Chest", 3, "strength"),
        ex("Incline DB Press", "Chest", 3, "moderate"),
        ex("Overhead Press", "Shoulders", 3, "moderate"),
        ex("Cable Fly", "Chest", 3, "hypertrophy"),
        ex("Triceps Pushdown", "Triceps", 3, "hypertrophy"),
      ]},
      { id: uid(), name: "Pull", weekday: "Wed", exercises: [
        ex("Weighted Pull-up", "Back", 3, "strength"),
        ex("Barbell Row", "Back", 3, "moderate"),
        ex("Lat Pulldown", "Back", 3, "hypertrophy"),
        ex("Face Pull", "Rear Delts", 3, "pump"),
        ex("Barbell Curl", "Biceps", 3, "moderate"),
      ]},
      { id: uid(), name: "Arms & Shoulders", weekday: "Fri", exercises: [
        ex("Lateral Raise", "Side Delts", 4, "pump"),
        ex("Incline Curl", "Biceps", 3, "hypertrophy"),
        ex("Hammer Curl", "Biceps", 3, "hypertrophy"),
        ex("Overhead Triceps Ext", "Triceps", 3, "hypertrophy"),
        ex("Rear Delt Fly", "Rear Delts", 3, "pump"),
      ]},
    ],
  };
}
function normalizeProgram(p) {
  if (!p) return seedProgram();
  if (!p.meso) p.meso = { length: 5, deload: true, startRIR: 3, addSet: false, maxSets: 6 };
  p.days = (p.days || []).map((d) => ({
    weekday: d.weekday ?? null, ...d,
    exercises: (d.exercises || []).map((e) => {
      const style = e.style || styleFromRange(e.repLow, e.repHigh);
      const equipment = e.equipment || LIB_BY_NAME[e.name]?.equipment || "Other";
      return { ...e, style, equipment };
    }),
  }));
  return p;
}

/* ============================== meso math ============================== */
function mesoInfo(program, week) {
  const m = program.meso || { length: 5, deload: true, startRIR: 3 };
  const length = Math.max(1, m.length || 5);
  const weekInMeso = ((week - 1) % length) + 1;
  const mesoNumber = Math.floor((week - 1) / length) + 1;
  const isDeload = !!m.deload && length > 1 && weekInMeso === length;
  const targetRIR = isDeload ? Math.max(3, (m.startRIR ?? 3) + 1) : Math.max(0, (m.startRIR ?? 3) - (weekInMeso - 1));
  return { length, weekInMeso, mesoNumber, isDeload, targetRIR, settings: m };
}

/* ============================== progression engine ============================== */
const epley1RM = (w, r) => (w > 0 && r > 0 ? Math.round(w * (1 + r / 30)) : 0);
const roundToStep = (x, step) => { const s = step || 5; return Math.round(x / s) * s; };
const predictReps = (e1rm, w) => (!(e1rm > 0) || !(w > 0)) ? null : Math.min(40, Math.max(1, Math.round(30 * (e1rm / w - 1))));
const cleanOf = (s) => Math.max(0, (s.reps || 0) - (s.assist || 0)); // reps done unassisted
const bwLabel = (added) => added > 0 ? `BW+${added}` : added < 0 ? `BW−${Math.abs(added)} assisted` : "BW";

function bestE1RMHistory(logsForEx) {
  if (!logsForEx) return 0;
  let best = 0;
  for (const wk of Object.keys(logsForEx))
    for (const s of (logsForEx[wk].sets || []))
      best = Math.max(best, epley1RM(s.weight, cleanOf(s)));
  return best;
}
function cleanE1RMOfEntry(entry) {
  if (!entry?.sets) return 0;
  return entry.sets.reduce((m, s) => Math.max(m, epley1RM(s.weight, cleanOf(s))), 0);
}
function workingWeeksDesc(logsForEx, beforeWeek) {
  if (!logsForEx) return [];
  return Object.keys(logsForEx).map(Number)
    .filter((w) => w < beforeWeek && !logsForEx[w]?.deload && logsForEx[w]?.sets?.some((s) => s.reps > 0))
    .sort((a, b) => b - a);
}
function workingWeight(sets) {
  const counts = {};
  const hasNonPositive = sets.some((s) => s.weight <= 0);
  sets.forEach((s) => { if (hasNonPositive || s.weight > 0) counts[s.weight] = (counts[s.weight] || 0) + 1; });
  const e = Object.entries(counts);
  if (!e.length) return 0;
  e.sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
  return Number(e[0][0]);
}

function suggest(exercise, logsForEx, week, program) {
  const meso = mesoInfo(program, week);
  const m = meso.settings;
  const base = exercise.sets;
  let setCount = base;
  if (m.addSet && !meso.isDeload) setCount = Math.min(m.maxSets || base, base + (meso.weekInMeso - 1));
  if (meso.isDeload) setCount = Math.max(1, Math.ceil(base / 2));

  const weeks = workingWeeksDesc(logsForEx, week);
  const refWeek = weeks.length ? weeks[0] : null;
  if (refWeek == null)
    return { action: "start", weight: 0, reps: exercise.repLow, setCount, lastWeek: null, lastSets: null, note: null };

  const entry = logsForEx[refWeek];
  const lastSets = entry.sets.filter((s) => s.reps > 0);
  const w = workingWeight(lastSets);

  if (meso.isDeload)
    return { action: "deload", weight: roundToStep(w * 0.9, exercise.inc), reps: exercise.repLow, setCount, lastWeek: refWeek, lastSets, note: "Deload — lighter load, fewer sets, stay well shy of failure." };

  const setsAtW = lastSets.filter((s) => s.weight === w);
  const cleanArr = setsAtW.map(cleanOf);
  const totalArr = setsAtW.map((s) => s.reps);
  const minClean = cleanArr.length ? Math.min(...cleanArr) : 0;
  const minTotal = totalArr.length ? Math.min(...totalArr) : 0;
  const maxTotal = totalArr.length ? Math.max(...totalArr) : 0;
  const anyAssist = setsAtW.some((s) => (s.assist || 0) > 0);
  const rir = entry.rir; // nullable
  const refTargetRIR = mesoInfo(program, refWeek).targetRIR;
  const grinding = rir != null && rir <= 0;

  // 1) all working sets reached the top of the range with CLEAN reps -> add weight
  if (minClean >= exercise.repHigh)
    return { action: "weight", weight: w + exercise.inc, reps: exercise.repLow, setCount, lastWeek: refWeek, lastSets, note: null };

  // 2) reached the target reps but needed assistance -> hold, earn them clean
  if (anyAssist && minTotal >= exercise.repHigh && minClean < exercise.repHigh)
    return { action: "clean", weight: w, reps: exercise.repHigh, setCount, lastWeek: refWeek, lastSets,
      note: "You hit the reps with help last week. Keep the load and get all reps clean before it adds weight." };

  // 3) stall: grinding at failure with no clean progress vs the week before
  const prevWeek = weeks.length > 1 ? weeks[1] : null;
  const improved = prevWeek != null ? cleanE1RMOfEntry(entry) > cleanE1RMOfEntry(logsForEx[prevWeek]) : true;
  if (grinding && !improved)
    return { action: "stall", weight: w, reps: Math.min(exercise.repHigh, maxTotal + 1), setCount, lastWeek: refWeek, lastSets,
      note: prevWeek != null
        ? "Stalled here at 0 RIR. If it stalls again, take a deload or drop a back-off set."
        : "At failure with no clean progress. Hold the load and try to add one clean rep." };

  // 4) lots left in the tank -> push effort, not just a token rep
  if (rir != null && rir >= refTargetRIR + 2)
    return { action: "reps", weight: w, reps: Math.min(exercise.repHigh, maxTotal + 1), setCount, lastWeek: refWeek, lastSets,
      note: "You left several reps in reserve — push closer to your target RIR (or nudge the weight up)." };

  // 5) default double progression -> add reps
  return { action: "reps", weight: w, reps: Math.min(exercise.repHigh, maxTotal + 1), setCount, lastWeek: refWeek, lastSets, note: null };
}

/* ============================== UI atoms ============================== */
const muscleColor = (m) => ({
  Chest: "#60a5fa", Back: "#34d399", Shoulders: "#fbbf24", "Side Delts": "#f59e0b",
  "Rear Delts": "#a78bfa", Biceps: "#f472b6", Triceps: "#22d3ee", Quads: "#fb7185",
  Hamstrings: "#fb923c", Glutes: "#e879f9", Calves: "#94a3b8", Abs: "#cbd5e1",
}[m] || "#818cf8");

const tiny = { fontSize: 11 };
const tinier = { fontSize: 10, letterSpacing: "0.08em" };

function Eyebrow({ children }) { return <div className="uppercase text-zinc-500 font-medium" style={tinier}>{children}</div>; }

function Badge({ action }) {
  const map = {
    weight: { c: "#34d399", bg: "rgba(52,211,153,0.14)", t: "Add weight", I: ArrowUp },
    reps:   { c: "#38bdf8", bg: "rgba(56,189,248,0.14)", t: "Add reps", I: ArrowUp },
    clean:  { c: "#fb923c", bg: "rgba(251,146,60,0.14)", t: "Earn clean", I: Hand },
    stall:  { c: "#fb7185", bg: "rgba(251,113,133,0.14)", t: "Hold", I: AlertTriangle },
    deload: { c: "#fbbf24", bg: "rgba(251,191,36,0.14)", t: "Deload", I: Moon },
    start:  { c: "#a1a1aa", bg: "rgba(161,161,170,0.14)", t: "First week", I: Flame },
  };
  const v = map[action] || map.start; const I = v.I;
  return (
    <span className="inline-flex items-center gap-1 rounded-md font-medium px-2 py-1" style={{ color: v.c, backgroundColor: v.bg, fontSize: 12 }}>
      <I size={12} strokeWidth={2.5} /> {v.t}
    </span>
  );
}
function Empty({ label }) {
  return <div className="rounded-xl border border-dashed border-zinc-800 text-center text-zinc-500 px-6" style={{ paddingTop: 48, paddingBottom: 48, fontSize: 14 }}>{label}</div>;
}

/* ============================== app ============================== */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [logs, setLogs] = useState({});
  const [week, setWeek] = useState(1);
  const [unit, setUnit] = useState("lb");
  const [bodyweight, setBodyweight] = useState(null);
  const [tab, setTab] = useState("train");
  const [dayId, setDayId] = useState(null);

  useEffect(() => {
    (async () => {
      const p = normalizeProgram(await loadKey("wt_program", null));
      const l = await loadKey("wt_logs", {});
      const s = await loadKey("wt_settings", { week: 1, unit: "lb" });
      await saveKey("wt_program", p);
      setProgram(p); setLogs(l); setWeek(s.week || 1); setUnit(s.unit || "lb"); setBodyweight(s.bodyweight ?? null);
      const today = p.days.find((d) => d.weekday === todayLabel());
      setDayId((today || p.days[0])?.id || null);
      setLoading(false);
    })();
  }, []);

  const persistLogs = (n) => { setLogs(n); saveKey("wt_logs", n); };
  const persistProgram = (n) => { setProgram(n); saveKey("wt_program", n); };
  const persistSettings = (w, u, bw) => saveKey("wt_settings", { week: w, unit: u, bodyweight: bw ?? null });
  const changeWeek = (d) => { const w = Math.max(1, week + d); setWeek(w); persistSettings(w, unit, bodyweight); };
  const persistBodyweight = (bw) => { setBodyweight(bw); persistSettings(week, unit, bw); };

  if (loading || !program)
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono" style={{ fontSize: 14 }}>Loading your log…</div>;

  const meso = mesoInfo(program, week);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500 flex items-center justify-center" style={{ height: 32, width: 32 }}><Dumbbell size={18} className="text-white" /></div>
            <div>
              <div className="font-semibold leading-tight">Overload</div>
              <div className="text-zinc-500 leading-tight font-mono" style={tiny}>
                Meso {meso.mesoNumber} · Wk {meso.weekInMeso}/{meso.length}{meso.isDeload ? " · Deload" : ""} · {meso.targetRIR} RIR
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-1 py-1">
            <button onClick={() => changeWeek(-1)} className="p-1 rounded-md text-zinc-400 hover:bg-zinc-800"><ChevronLeft size={16} /></button>
            <div className="px-2 text-center" style={{ minWidth: 70 }}>
              <div className="uppercase text-zinc-500 leading-none" style={tinier}>Week</div>
              <div className="font-mono font-semibold leading-tight">{week}</div>
            </div>
            <button onClick={() => changeWeek(1)} className="p-1 rounded-md text-zinc-400 hover:bg-zinc-800"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4">
          <nav className="flex gap-1" style={{ marginBottom: -1 }}>
            {[["train", "Train", Dumbbell], ["progress", "Progress", TrendingUp], ["volume", "Volume", BarChart3], ["routine", "Routine", Settings]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={"flex items-center gap-1 px-3 py-2 " + (tab === id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300")}
                style={{ borderBottom: "2px solid " + (tab === id ? "#6366f1" : "transparent"), fontSize: 14 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5" style={{ paddingBottom: 96 }}>
        {tab === "train" && <TrainView program={program} logs={logs} week={week} unit={unit} meso={meso} dayId={dayId} setDayId={setDayId} persistLogs={persistLogs} bodyweight={bodyweight} />}
        {tab === "progress" && <ProgressView program={program} logs={logs} unit={unit} bodyweight={bodyweight} />}
        {tab === "volume" && <VolumeView program={program} logs={logs} week={week} meso={meso} />}
        {tab === "routine" && <RoutineView program={program} logs={logs} unit={unit} setUnit={(u) => { setUnit(u); persistSettings(week, u, bodyweight); }} persistProgram={persistProgram} persistLogs={persistLogs} bodyweight={bodyweight} persistBodyweight={persistBodyweight} />}
      </main>
    </div>
  );
}

/* ============================== TRAIN ============================== */
function TrainView({ program, logs, week, unit, meso, dayId, setDayId, persistLogs, bodyweight }) {
  const today = todayLabel();
  const day = program.days.find((d) => d.id === dayId) || program.days[0];
  if (!day) return <Empty label="No workout days yet. Add one in the Routine tab." />;
  const unscheduled = program.days.filter((d) => !d.weekday);

  const allSkipped = day.exercises.length > 0 && day.exercises.every((ex) => logs[ex.id]?.[week]?.skipped);
  const skipDay = (skip) => {
    const next = { ...logs };
    day.exercises.forEach((ex) => {
      const ex_logs = { ...(next[ex.id] || {}) };
      if (skip) ex_logs[week] = { skipped: true, ts: Date.now() };
      else if (ex_logs[week]?.skipped) delete ex_logs[week];
      next[ex.id] = ex_logs;
    });
    persistLogs(next);
  };

  return (
    <div>
      <Eyebrow>This week</Eyebrow>
      <div className="grid gap-1 mt-2 mb-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((wd) => {
          const d = program.days.find((x) => x.weekday === wd);
          const isToday = wd === today; const active = d && d.id === day.id;
          return (
            <button key={wd} disabled={!d} onClick={() => d && setDayId(d.id)}
              className={"rounded-lg border px-1 py-2 text-center " + (active ? "border-indigo-500 bg-indigo-500" : d ? "border-zinc-800 bg-zinc-900 hover:border-zinc-700" : "border-zinc-900 bg-zinc-950")}>
              <div className="uppercase" style={{ ...tinier, color: isToday ? "#818cf8" : "#71717a" }}>{wd}</div>
              <div className="truncate" style={{ fontSize: 11, color: active ? "#fff" : d ? "#d4d4d8" : "#3f3f46" }}>{d ? d.name : "Rest"}</div>
            </button>
          );
        })}
      </div>
      {unscheduled.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {unscheduled.map((d) => (
            <button key={d.id} onClick={() => setDayId(d.id)} className={"px-3 py-1 rounded-lg border " + (d.id === day.id ? "bg-indigo-500 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400")} style={{ fontSize: 13 }}>{d.name}</button>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between mt-4 mb-3">
        <h2 className="font-semibold" style={{ fontSize: 18 }}>{day.weekday ? day.weekday + " · " : ""}{day.name}</h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-zinc-500" style={tiny}>Target {meso.targetRIR} RIR{meso.isDeload ? " · deload" : ""}</span>
          {day.exercises.length > 0 && (
            <button onClick={() => skipDay(!allSkipped)} className={"rounded-md border px-2 py-1 " + (allSkipped ? "border-zinc-700 text-zinc-300" : "border-zinc-800 text-zinc-500 hover:text-zinc-300")} style={{ fontSize: 11 }}>
              {allSkipped ? "Resume day" : "Skip day"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {day.exercises.map((ex) => <ExerciseCard key={ex.id} exercise={ex} logs={logs} week={week} unit={unit} program={program} persistLogs={persistLogs} bodyweight={bodyweight} />)}
        {day.exercises.length === 0 && <Empty label="No exercises on this day yet. Add some in Routine." />}
      </div>
    </div>
  );
}

const COLS = "20px 1fr 1.1fr 22px";
const REP_GREEN = "#34d399", REP_ORANGE = "#fb923c", REP_RED = "#f87171", REP_SLASH = "#71717a", REP_GHOST = "#52525b";

function parseRep(str) {
  const parts = String(str || "").split("/");
  const clean = parseInt(parts[0], 10);
  const assist = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  return { clean: isNaN(clean) ? 0 : clean, assist: isNaN(assist) ? 0 : assist };
}

/* single field: "8" or "8/2" (clean / assisted), colored live */
function RepInput({ value, goal, onChange }) {
  const [foc, setFoc] = useState(false);
  const sanitize = (s) => s.replace(/[^0-9/]/g, "").replace(/\/+/g, "/").replace(/^\//, "").slice(0, 7);
  const parts = value.split("/");
  const a = parts[0] || "";
  const b = parts.length > 1 ? (parts[1] || "") : null;
  const cleanNum = parseInt(a, 10);
  const hasAssist = b !== null;
  const hitClean = !hasAssist && a !== "" && !isNaN(cleanNum) && cleanNum >= goal;
  const missClean = !hasAssist && a !== "" && !isNaN(cleanNum) && cleanNum < goal;

  let border = "#27272a", glow = "none";
  if (value === "") border = foc ? "#6366f1" : "#27272a";
  else if (hitClean) { border = REP_GREEN; glow = "0 0 0 1px rgba(52,211,153,0.55), 0 0 11px rgba(52,211,153,0.30)"; }
  else if (hasAssist) { border = "rgba(248,113,113,0.6)"; glow = "0 0 0 1px rgba(248,113,113,0.30)"; }
  else if (missClean) border = "rgba(251,146,60,0.7)";

  const cleanColor = hasAssist ? REP_ORANGE : (hitClean ? REP_GREEN : REP_ORANGE);
  const base = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, lineHeight: "20px", boxSizing: "border-box", padding: "8px", border: "1px solid transparent", borderRadius: 8 };

  return (
    <div style={{ position: "relative" }}>
      <div aria-hidden style={{ ...base, background: "#09090b", border: "1px solid " + border, boxShadow: glow, whiteSpace: "pre", overflow: "hidden", color: REP_GHOST, transition: "box-shadow .12s, border-color .12s" }}>
        {value === "" ? ("\u2248 " + goal) : (
          <span>
            <span style={{ color: cleanColor }}>{a}</span>
            {hasAssist && <span style={{ color: REP_SLASH }}>/</span>}
            {hasAssist && <span style={{ color: REP_RED }}>{b}</span>}
          </span>
        )}
      </div>
      <input type="text" inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        value={value} onChange={(e) => onChange(sanitize(e.target.value))} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ ...base, position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "transparent", color: "transparent", caretColor: "#e4e4e7", borderColor: "transparent", outline: "none" }} />
    </div>
  );
}

function ExerciseCard({ exercise, logs, week, unit, program, persistLogs, bodyweight }) {
  const meso = useMemo(() => mesoInfo(program, week), [program, week]);
  const isBW = exercise.equipment === "Bodyweight";
  const bwSet = bodyweight != null;
  const totalOf = (added) => (isBW && bwSet) ? bodyweight + added : added;
  const logsForEx = logs[exercise.id];
  const sug = useMemo(() => suggest(exercise, logsForEx, week, program), [exercise, logsForEx, week, program]);
  const refE1RM = useMemo(() => {
    if (!logsForEx) return 0;
    const bwAdd = (isBW && bwSet) ? bodyweight : 0;
    let best = 0;
    for (const wk of Object.keys(logsForEx))
      for (const s of (logsForEx[wk].sets || []))
        best = Math.max(best, epley1RM(bwAdd + s.weight, cleanOf(s)));
    return best;
  }, [logsForEx, bodyweight, exercise.equipment]); // eslint-disable-line react-hooks/exhaustive-deps
  const existing = logsForEx?.[week];

  const build = () => {
    if (existing?.sets?.length)
      return existing.sets.map((s) => ({ weight: isBW ? String(s.weight ?? 0) : String(s.weight || ""), repStr: s.assist ? `${(s.reps || 0) - s.assist}/${s.assist}` : (s.reps ? String(s.reps) : "") }));
    return Array.from({ length: sug.setCount }, (_, idx) => ({ weight: idx === 0 ? (isBW ? String(sug.weight) : (sug.weight ? String(sug.weight) : "")) : "", repStr: "" }));
  };
  const [rows, setRows] = useState(build);
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : "");
  const [dirty, setDirty] = useState(false);
  const logged = !!(existing?.sets?.some((s) => s.reps > 0));
  const skipped = existing?.skipped === true;
  const carried = sug.lastWeek != null && sug.lastWeek < week - 1;

  useEffect(() => { setRows(build()); setRir(existing?.rir != null ? String(existing.rir) : ""); setDirty(false); /* eslint-disable-next-line */ }, [week, exercise.id]);

  const update = (i, f, v) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
    setDirty(true);
  };
  const cascadeWeight = (i) => {
    setRows(prev => {
      const val = prev[i].weight;
      if (val === "") return prev;
      const next = [...prev];
      for (let j = i + 1; j < next.length; j++) {
        if (next[j].weight === "") next[j] = { ...next[j], weight: val };
        else break;
      }
      return next;
    });
  };
  const addSet = () => { setRows(prev => [...prev, { weight: "", repStr: "" }]); setDirty(true); };
  const removeSet = (i) => { setRows(rows.filter((_, idx) => idx !== i)); setDirty(true); };

  const skipExercise = () => {
    const next = { ...logs };
    next[exercise.id] = { ...(next[exercise.id] || {}), [week]: { skipped: true, ts: Date.now() } };
    persistLogs(next); setDirty(false);
  };
  const logInstead = () => {
    const next = { ...logs };
    if (next[exercise.id]?.[week]) { const c = { ...next[exercise.id] }; delete c[week]; next[exercise.id] = c; persistLogs(next); }
    setRows(Array.from({ length: sug.setCount }, () => ({ weight: sug.weight ? String(sug.weight) : "", repStr: "" })));
    setDirty(false);
  };

  const save = () => {
    const clean = rows.map((r) => {
      const { clean: c, assist } = parseRep(r.repStr);
      return { weight: Number(r.weight) || 0, reps: c + assist, assist };
    }).filter((r) => r.reps > 0 || r.weight > 0);
    const next = { ...logs };
    next[exercise.id] = { ...(next[exercise.id] || {}), [week]: { sets: clean, rir: rir === "" ? null : Number(rir), deload: meso.isDeload, ts: Date.now() } };
    persistLogs(next); setDirty(false);
  };

  const bestNow = rows.reduce((m, r) => Math.max(m, epley1RM(totalOf(Number(r.weight)), parseRep(r.repStr).clean)), 0);
  const fatigueDropPerSet = useMemo(() => {
    if (!sug.lastSets || sug.lastSets.length < 2) return 1;
    const reps = sug.lastSets.map(s => cleanOf(s));
    return Math.max(0, (reps[0] - reps[reps.length - 1]) / (reps.length - 1));
  }, [sug]);
  const goalForSet = (setIdx, rowWeight) => {
    const addedW = rowWeight !== "" && rowWeight !== undefined ? Number(rowWeight) : sug.weight;
    const w = totalOf(isNaN(addedW) ? sug.weight : addedW);
    const p = predictReps(refE1RM, w);
    const base = p != null ? p : (sug.action === "weight" || sug.action === "deload" ? exercise.repLow : (sug.reps || exercise.repLow));
    const set1Target = Math.min(exercise.repHigh, Math.max(exercise.repLow, base));
    return Math.max(1, Math.round(set1Target - setIdx * fatigueDropPerSet));
  };
  const weightHit = (rowWeight) => !meso.isDeload && sug.weight > 0 && Number(rowWeight) >= sug.weight;

  if (skipped) {
    return (
      <div className="rounded-xl border border-zinc-800 overflow-hidden" style={{ backgroundColor: "rgba(24,24,27,0.35)" }}>
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="font-semibold text-zinc-400">{exercise.name}</span></div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-1 py-0 rounded font-medium" style={{ ...tiny, color: muscleColor(exercise.muscle), backgroundColor: muscleColor(exercise.muscle) + "18" }}>{exercise.muscle}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md font-medium px-2 py-1" style={{ color: "#a1a1aa", backgroundColor: "rgba(161,161,170,0.14)", fontSize: 12 }}><SkipForward size={12} strokeWidth={2.5} /> Skipped</span>
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between gap-3" style={{ backgroundColor: "rgba(9,9,11,0.3)" }}>
          <span className="font-mono text-zinc-500" style={tiny}>
            {sug.lastSets ? `Carrying Week ${sug.lastWeek} forward · ${isBW ? bwLabel(sug.weight) : sug.weight + unit} × ${sug.reps}` : "Skipped — nothing logged yet"}
          </span>
          <button onClick={logInstead} className="rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800" style={{ fontSize: 13 }}>Log instead</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="font-semibold">{exercise.name}</span>{logged && <Check size={15} className="text-emerald-400" />}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-1 py-0 rounded font-medium" style={{ ...tiny, color: muscleColor(exercise.muscle), backgroundColor: muscleColor(exercise.muscle) + "22" }}>{exercise.muscle}</span>
            <span className="text-zinc-500 font-mono" style={tiny}>{exercise.repLow}–{exercise.repHigh} reps · +{exercise.inc}{unit}{refE1RM > 0 ? " · e1RM " + refE1RM : ""}</span>
          </div>
        </div>
        <Badge action={sug.action} />
      </div>

      <div className="px-4 py-2 border-t border-b border-zinc-800 font-mono text-zinc-400" style={{ ...tiny, backgroundColor: "rgba(9,9,11,0.4)" }}>
        {sug.lastSets ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-zinc-600">W{sug.lastWeek}:</span>
            {sug.lastSets.map((s, i) => {
              const cl = (s.reps || 0) - (s.assist || 0);
              return (
                <span key={i}>{isBW ? bwLabel(s.weight) : s.weight}×
                  <span style={{ color: s.assist ? REP_ORANGE : undefined }}>{s.assist ? cl : s.reps}</span>
                  {s.assist ? <><span className="text-zinc-600">/</span><span style={{ color: REP_RED }}>{s.assist}</span></> : null}
                </span>
              );
            })}
            <span className="text-zinc-700">→</span>
            <span className="text-zinc-200">{sug.action === "deload" ? "deload " : sug.action === "clean" || sug.action === "stall" ? "hold " : "target "}{isBW ? bwLabel(sug.weight) : sug.weight + unit} × {sug.reps} · {sug.setCount} sets</span>
            {carried && <span className="text-zinc-600">· carried fwd</span>}
          </div>
        ) : <span>No history yet — log this week to start the progression.</span>}
      </div>

      {sug.note && (
        <div className="px-4 py-2 border-b border-zinc-800" style={{ ...tiny, color: "#a1a1aa", backgroundColor: "rgba(9,9,11,0.25)" }}>{sug.note}</div>
      )}

      <div className="px-4 py-3 space-y-2">
        <div className="grid items-center gap-2 text-zinc-600 px-1" style={{ ...tinier, gridTemplateColumns: COLS }}>
          <span className="uppercase">#</span><span className="uppercase">{isBW ? "Added wt" : "Weight (" + unit + ")"}</span><span className="uppercase">Reps · clean/assist</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: COLS }}>
            <span className="font-mono text-zinc-500 text-center" style={{ fontSize: 14 }}>{i + 1}</span>
            <input type="number" inputMode="decimal" value={r.weight} onChange={(e) => update(i, "weight", e.target.value)} onBlur={() => cascadeWeight(i)} placeholder={isBW ? String(sug.weight) : (sug.weight ? String(sug.weight) : "")}
              className="bg-zinc-950 rounded-lg px-2 py-2 font-mono text-zinc-100 focus:outline-none" style={{ fontSize: 14, minWidth: 0, border: "1px solid " + (weightHit(r.weight) ? "rgba(52,211,153,0.55)" : "#27272a") }} />
            <RepInput value={r.repStr} goal={r.repStr !== "" ? goalForSet(0, r.weight) : goalForSet(i, r.weight)} onChange={(v) => update(i, "repStr", v)} />
            <button onClick={() => removeSet(i)} className="text-zinc-600 hover:text-rose-400 flex justify-center"><X size={15} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <button onClick={addSet} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300" style={{ fontSize: 12 }}><Plus size={13} /> Add set</button>
          <button onClick={skipExercise} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300" style={{ fontSize: 12 }}><SkipForward size={12} /> Skip this exercise</button>
        </div>
        <p className="text-zinc-600" style={{ fontSize: 10, lineHeight: 1.5 }}>
          Type clean reps; add <span className="font-mono text-zinc-400">/2</span> if you needed help, e.g. <span className="font-mono text-zinc-400">8/2</span>.
          {"  "}<span style={{ color: REP_GREEN }}>green</span> = goal hit clean · <span style={{ color: REP_ORANGE }}>orange</span> = short · <span style={{ color: REP_RED }}>red</span> = assisted. Only clean reps earn more weight.
        </p>
        {isBW && (
          <p className="text-zinc-500" style={{ fontSize: 10, lineHeight: 1.5 }}>
            {bwSet
              ? "Bodyweight exercise — enter added weight (0 = BW only, negative = assisted)."
              : <span>Bodyweight exercise — <span className="text-amber-400">set your bodyweight in Routine → Units</span> for accurate e1RM.</span>}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-zinc-500" style={tiny}>{bestNow > 0 ? "e1RM " + bestNow + unit : "\u00A0"}</span>
          <label className="flex items-center gap-1 font-mono text-zinc-500" style={tiny}>RIR
            <input type="number" inputMode="numeric" value={rir} onChange={(e) => { setRir(e.target.value); setDirty(true); }} placeholder={String(meso.targetRIR)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-center font-mono text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ width: 44, fontSize: 13 }} />
          </label>
        </div>
        <button onClick={save} disabled={!dirty} className={"flex items-center gap-1 px-3 py-1 rounded-lg font-medium " + (dirty ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-zinc-800 text-zinc-500")} style={{ fontSize: 14 }}>
          <Save size={14} /> {logged ? "Update" : "Log"}
        </button>
      </div>
    </div>
  );
}

/* ============================== PROGRESS ============================== */
function ProgressView({ program, logs, unit, bodyweight }) {
  const allEx = program.days.flatMap((d) => d.exercises.map((e) => ({ ...e, day: d.name })));
  const withData = allEx.filter((e) => logs[e.id] && Object.keys(logs[e.id]).some((w) => (logs[e.id][w].sets || []).some((s) => s.reps > 0)));
  const [exId, setExId] = useState(withData[0]?.id || null);
  useEffect(() => { if (!exId && withData[0]) setExId(withData[0].id); }, [withData, exId]);

  if (!withData.length) return <Empty label="No logged data yet. Train a few weeks and your progress charts show up here." />;
  const ex = allEx.find((e) => e.id === exId) || withData[0];
  const exLogs = logs[ex.id] || {};
  const bwOff = ex.equipment === "Bodyweight" && bodyweight != null ? bodyweight : 0;
  const data = Object.keys(exLogs).map(Number).filter((w) => (exLogs[w].sets || []).some((s) => s.reps > 0)).sort((a, b) => a - b).map((w) => {
    const sets = (exLogs[w].sets || []).filter((s) => s.reps > 0);
    return {
      week: "W" + w,
      e1rm: sets.reduce((m, s) => Math.max(m, epley1RM(bwOff + s.weight, cleanOf(s))), 0),
      topW: sets.reduce((m, s) => Math.max(m, bwOff + s.weight), 0),
      vol: sets.reduce((a, s) => a + (bwOff + s.weight) * s.reps, 0),
      sets: sets.length, deload: !!exLogs[w].deload,
      assisted: sets.some((s) => (s.assist || 0) > 0),
    };
  });

  return (
    <div>
      <Eyebrow>Exercise</Eyebrow>
      <select value={exId || ""} onChange={(e) => setExId(e.target.value)} className="mt-2 mb-5 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }}>
        {withData.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.day}</option>)}
      </select>

      <div className="rounded-xl border border-zinc-800 p-4 mb-4" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
        <div className="flex items-center justify-between mb-3"><div className="font-semibold" style={{ fontSize: 14 }}>Estimated 1RM (clean reps)</div><div className="font-mono text-zinc-500" style={tiny}>{unit}</div></div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 11 }} stroke="#3f3f46" />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} stroke="#3f3f46" domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
            <Line type="monotone" dataKey="e1rm" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 3, fill: "#818cf8" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
        <div className="font-semibold mb-3" style={{ fontSize: 14 }}>Week by week</div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 14 }}>
            <thead><tr className="uppercase text-zinc-500 text-left" style={tinier}>
              <th className="pb-2 font-medium">Week</th><th className="pb-2 font-medium">Top</th><th className="pb-2 font-medium">e1RM</th><th className="pb-2 font-medium">Sets</th><th className="pb-2 font-medium">Volume</th>
            </tr></thead>
            <tbody className="font-mono text-zinc-300">
              {data.map((d, i) => {
                const prev = data[i - 1]; const up = prev && d.e1rm > prev.e1rm;
                return (
                  <tr key={d.week} className="border-t border-zinc-800">
                    <td className="py-2 text-zinc-500">{d.week}{d.deload ? " ·D" : ""}</td>
                    <td className="py-2">{d.topW}{unit}</td>
                    <td className="py-2"><span className={up ? "text-emerald-400" : ""}>{d.e1rm}{unit}{up ? " ↑" : ""}</span>{d.assisted ? <span className="text-orange-300"> *</span> : ""}</td>
                    <td className="py-2">{d.sets}</td>
                    <td className="py-2 text-zinc-400">{d.vol.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-zinc-600 mt-2" style={tinier}><span className="text-orange-300">*</span> week included assisted reps</p>
      </div>
    </div>
  );
}

/* ============================== VOLUME ============================== */
function VolumeView({ program, logs, week, meso }) {
  const counts = {};
  program.days.forEach((d) => d.exercises.forEach((ex) => {
    const sets = logs[ex.id]?.[week]?.sets?.filter((s) => s.reps > 0) || [];
    if (sets.length) counts[ex.muscle] = (counts[ex.muscle] || 0) + sets.length;
  }));
  const data = Object.entries(counts).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
  const total = data.reduce((a, d) => a + d.sets, 0);

  return (
    <div>
      <Eyebrow>Week {week} · {total} hard sets{meso.isDeload ? " · deload" : ""}</Eyebrow>
      {data.length === 0 ? (
        <div className="mt-3"><Empty label={"Nothing logged for week " + week + " yet. Sets per muscle appear here as you train."} /></div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 p-4 mt-3 mb-4" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
            <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42)}>
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} stroke="#3f3f46" allowDecimals={false} />
                <YAxis type="category" dataKey="muscle" width={86} tick={{ fill: "#a1a1aa", fontSize: 12 }} stroke="#3f3f46" />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="sets" radius={[0, 4, 4, 0]}>{data.map((d, i) => <Cell key={i} fill={muscleColor(d.muscle)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-zinc-500 leading-relaxed" style={{ fontSize: 12 }}>
            Counting completed working sets per muscle this week. As a rough hypertrophy reference, many muscles
            respond well to about 10–20 hard sets per week, though the right number is individual and worth dialing
            in across a mesocycle. Informational, not a prescription.
          </p>
        </>
      )}
    </div>
  );
}

/* ============================== ROUTINE ============================== */
const MUSCLES = ["Chest", "Back", "Shoulders", "Side Delts", "Rear Delts", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Abs"];

const exFromLib = (entry) => {
  if (!entry) return null;
  const e = LIB_BY_NAME[entry.name] || entry;
  const st = STYLES[e.style] || STYLES.moderate;
  return { id: uid(), name: e.name, muscle: e.muscle, style: e.style, equipment: e.equipment || "Barbell", sets: 3, repLow: st.low, repHigh: st.high, inc: st.inc };
};
function buildSplit(split, prevMeso) {
  return {
    name: split.name,
    meso: prevMeso || { length: 5, deload: true, startRIR: 3, addSet: false, maxSets: 6 },
    days: split.days.map((dd) => ({ id: uid(), name: dd.name, weekday: dd.weekday || null, exercises: dd.ex.map((n) => exFromLib(LIB_BY_NAME[n])).filter(Boolean) })),
  };
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full" style={{ maxWidth: 560, maxHeight: "86vh", background: "#0c0c0f", border: "1px solid #27272a", borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div><div className="font-semibold">{title}</div>{subtitle && <div className="text-zinc-500" style={tiny}>{subtitle}</div>}</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto" }} className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

function ExercisePicker({ onAdd, onCustom, onClose }) {
  const [q, setQ] = useState("");
  const [equipFilter, setEquipFilter] = useState("All");
  const [customForm, setCustomForm] = useState(null); // null | { name, muscle, equipment }
  const ql = q.trim().toLowerCase();
  const filtered = LIB.filter((e) => {
    const matchQ = !ql || e.name.toLowerCase().includes(ql) || e.muscle.toLowerCase().includes(ql) || (e.equipment || "").toLowerCase().includes(ql);
    const matchEq = equipFilter === "All" || e.equipment === equipFilter;
    return matchQ && matchEq;
  });
  const byMuscle = {};
  filtered.forEach((e) => { (byMuscle[e.muscle] = byMuscle[e.muscle] || []).push(e); });

  if (customForm !== null) {
    return (
      <Modal title="Custom exercise" subtitle="Add an exercise not in the library" onClose={onClose}>
        <div className="space-y-3">
          <label className="text-zinc-500 block" style={tiny}>Name
            <input value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} placeholder="e.g. Landmine Press" autoFocus className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }} />
          </label>
          <label className="text-zinc-500 block" style={tiny}>Muscle group
            <select value={customForm.muscle} onChange={(e) => setCustomForm({ ...customForm, muscle: e.target.value })} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }}>
              {MUSCLES.map((mm) => <option key={mm}>{mm}</option>)}
            </select>
          </label>
          <div>
            <div className="text-zinc-500 mb-1" style={tiny}>Equipment</div>
            <div className="flex flex-wrap gap-1">
              {EQUIPMENT.map((eq) => (
                <button key={eq} onClick={() => setCustomForm({ ...customForm, equipment: eq })}
                  className={"px-2 py-1 rounded-md border text-xs font-medium transition-colors " + (customForm.equipment === eq ? "border-transparent text-zinc-900" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                  style={customForm.equipment === eq ? { backgroundColor: equipColor(eq), borderColor: equipColor(eq), fontSize: 11 } : { fontSize: 11 }}>
                  {eq}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setCustomForm(null)} className="flex-1 rounded-lg border border-zinc-700 py-2 text-zinc-400 hover:text-zinc-200" style={{ fontSize: 14 }}>Back</button>
            <button onClick={() => onCustom(customForm)} disabled={!customForm.name.trim()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 py-2 text-white font-medium" style={{ fontSize: 14 }}>Add exercise</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add exercise" subtitle="Tap to add — keep tapping to add several" onClose={onClose}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises, muscles, or equipment…" autoFocus className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 mb-2 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }} />
      <div className="flex gap-1 flex-wrap mb-3">
        {["All", ...EQUIPMENT].map((eq) => (
          <button key={eq} onClick={() => setEquipFilter(eq)}
            className={"px-2 py-1 rounded-md border font-medium transition-colors " + (equipFilter === eq ? "border-transparent text-zinc-900" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500")}
            style={equipFilter === eq ? { backgroundColor: eq === "All" ? "#6366f1" : equipColor(eq), borderColor: "transparent", fontSize: 11 } : { fontSize: 11 }}>
            {eq}
          </button>
        ))}
      </div>
      <button onClick={() => setCustomForm({ name: "", muscle: "Chest", equipment: "Bodyweight" })} className="w-full text-left rounded-lg border border-dashed border-zinc-700 px-3 py-2 mb-3 text-zinc-300 hover:border-zinc-600" style={{ fontSize: 14 }}>+ Custom exercise…</button>
      {MUSCLES.filter((mm) => byMuscle[mm]).map((mm) => (
        <div key={mm} className="mb-3">
          <div className="uppercase mb-1" style={{ ...tinier, color: muscleColor(mm) }}>{mm}</div>
          <div className="space-y-1">
            {byMuscle[mm].map((e) => (
              <button key={e.name} onClick={() => onAdd(e)} className="w-full flex items-center justify-between rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 hover:border-zinc-700" style={{ fontSize: 14 }}>
                <span className="text-left">{e.name}</span>
                <span className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="rounded px-1 py-0 font-medium" style={{ fontSize: 10, backgroundColor: equipColor(e.equipment) + "22", color: equipColor(e.equipment) }}>{e.equipment}</span>
                  <span className="rounded px-1 py-0 font-medium" style={{ fontSize: 10, backgroundColor: "#18181b", color: "#71717a" }}>{STYLES[e.style]?.label || e.style}</span>
                  <Plus size={13} className="text-zinc-600 ml-1" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-zinc-500 text-center py-6" style={{ fontSize: 13 }}>No matches — try "Custom exercise".</div>}
    </Modal>
  );
}

function SplitPicker({ onApply, onClose }) {
  return (
    <Modal title="Choose a split" subtitle="A starting template you can fully edit after" onClose={onClose}>
      <p className="text-zinc-500 mb-3" style={{ fontSize: 12 }}>Pick a template to start from, then rename days, swap exercises, and move weekdays however you like. This replaces your current routine; your logged history is kept.</p>
      <div className="space-y-2">
        {SPLITS.map((s) => (
          <button key={s.key} onClick={() => onApply(s)} className="w-full text-left rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 hover:border-indigo-500">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.name}</span>
              <span className="text-zinc-500" style={{ fontSize: 12 }}>{s.days.length} days/wk</span>
            </div>
            <div className="text-zinc-500" style={{ fontSize: 12 }}>{s.sub}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {s.days.map((dd, i) => (<span key={i} className="rounded px-1 py-0" style={{ fontSize: 10, background: "#18181b", color: "#a1a1aa" }}>{dd.weekday} · {dd.name}</span>))}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function RoutineView({ program, logs, unit, setUnit, persistProgram, persistLogs, bodyweight, persistBodyweight }) {
  const [editing, setEditing] = useState(null);
  const [picker, setPicker] = useState(null); // dayId for exercise picker
  const [splitOpen, setSplitOpen] = useState(false);

  const setMeso = (patch) => persistProgram({ ...program, meso: { ...program.meso, ...patch } });
  const addDay = () => persistProgram({ ...program, days: [...program.days, { id: uid(), name: "New Day", weekday: null, exercises: [] }] });
  const patchDay = (id, patch) => persistProgram({ ...program, days: program.days.map((d) => d.id === id ? { ...d, ...patch } : d) });
  const removeDay = (id) => persistProgram({ ...program, days: program.days.filter((d) => d.id !== id) });
  const moveDay = (id, dir) => {
    const i = program.days.findIndex((d) => d.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= program.days.length) return;
    const days = [...program.days]; [days[i], days[j]] = [days[j], days[i]];
    persistProgram({ ...program, days });
  };
  const updateExercise = (dayId, exId, patch) => persistProgram({ ...program, days: program.days.map((d) => d.id === dayId ? { ...d, exercises: d.exercises.map((e) => e.id === exId ? { ...e, ...patch } : e) } : d) });
  const removeExercise = (dayId, exId) => persistProgram({ ...program, days: program.days.map((d) => d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d) });
  const moveExercise = (dayId, exId, dir) => persistProgram({ ...program, days: program.days.map((d) => {
    if (d.id !== dayId) return d;
    const i = d.exercises.findIndex((e) => e.id === exId), j = i + dir;
    if (i < 0 || j < 0 || j >= d.exercises.length) return d;
    const ex = [...d.exercises]; [ex[i], ex[j]] = [ex[j], ex[i]]; return { ...d, exercises: ex };
  }) });
  const applyStyle = (dayId, exId, key) => {
    if (key === "custom") { updateExercise(dayId, exId, { style: "custom" }); return; }
    const s = STYLES[key]; updateExercise(dayId, exId, { style: key, repLow: s.low, repHigh: s.high, inc: s.inc });
  };
  const addFromLib = (entry) => {
    const ex = exFromLib(entry);
    persistProgram({ ...program, days: program.days.map((d) => d.id === picker ? { ...d, exercises: [...d.exercises, ex] } : d) });
  };
  const addCustom = (fields) => {
    const e = { id: uid(), name: fields.name || "New Exercise", muscle: fields.muscle || "Chest", equipment: fields.equipment || "Bodyweight", style: "moderate", sets: 3, repLow: 6, repHigh: 10, inc: 5 };
    persistProgram({ ...program, days: program.days.map((d) => d.id === picker ? { ...d, exercises: [...d.exercises, e] } : d) });
    setEditing(e.id); setPicker(null);
  };
  const applySplit = (split) => {
    if (window.confirm(`Replace your routine with "${split.name} · ${split.days.length} days"? Your logged history is kept.`)) {
      persistProgram(buildSplit(split, program.meso)); setSplitOpen(false);
    }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ program, logs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "overload-data.json"; a.click(); URL.revokeObjectURL(url);
  };
  const resetAll = () => { if (window.confirm("Erase all logs and reset to the sample routine? This can't be undone.")) { persistProgram(seedProgram()); persistLogs({}); } };

  const m = program.meso;
  return (
    <div className="space-y-6">
      <button onClick={() => setSplitOpen(true)} className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white py-3 font-medium" style={{ fontSize: 14 }}>
        <Library size={16} /> Choose a split / template
      </button>

      <div className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
        <Eyebrow>Mesocycle</Eyebrow>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <NumField label="Block length (weeks)" value={m.length} onChange={(v) => setMeso({ length: Math.max(1, v) })} />
          <NumField label="Start RIR" value={m.startRIR} onChange={(v) => setMeso({ startRIR: Math.max(0, v) })} />
          <ToggleField label="Last week is deload" value={m.deload} onChange={(v) => setMeso({ deload: v })} />
          <ToggleField label="Auto-add a set each week" value={m.addSet} onChange={(v) => setMeso({ addSet: v })} />
          {m.addSet && <NumField label="Max sets per exercise" value={m.maxSets} onChange={(v) => setMeso({ maxSets: Math.max(1, v) })} />}
        </div>
        <p className="text-zinc-500 mt-3" style={{ fontSize: 11 }}>RIR drops one per week ({m.startRIR}→0), then the deload week backs off load and sets.</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Eyebrow>Units</Eyebrow>
            <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
              {["lb", "kg"].map((u) => <button key={u} onClick={() => setUnit(u)} className={"px-3 py-1 " + (unit === u ? "bg-indigo-500 text-white" : "bg-zinc-900 text-zinc-400")} style={{ fontSize: 14 }}>{u}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eyebrow>Bodyweight</Eyebrow>
            <input type="number" inputMode="decimal" value={bodyweight ?? ""} onChange={(e) => persistBodyweight(e.target.value === "" ? null : Number(e.target.value))} placeholder="—" className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 13, width: 64 }} />
            <span className="text-zinc-500" style={tiny}>{unit}</span>
          </div>
        </div>
        <button onClick={exportData} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100" style={{ fontSize: 14 }}><Download size={15} /> Export</button>
      </div>

      {program.days.map((day, di) => (
        <div key={day.id} className="rounded-xl border border-zinc-800" style={{ backgroundColor: "rgba(24,24,27,0.6)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <div className="flex flex-col">
              <button onClick={() => moveDay(day.id, -1)} disabled={di === 0} className={di === 0 ? "text-zinc-800" : "text-zinc-600 hover:text-zinc-300"}><ChevronUp size={14} /></button>
              <button onClick={() => moveDay(day.id, 1)} disabled={di === program.days.length - 1} className={di === program.days.length - 1 ? "text-zinc-800" : "text-zinc-600 hover:text-zinc-300"}><ChevronDown size={14} /></button>
            </div>
            <input value={day.name} onChange={(e) => patchDay(day.id, { name: e.target.value })} className="bg-transparent font-semibold focus:outline-none focus:bg-zinc-800 rounded px-1 flex-1" />
            <select value={day.weekday || ""} onChange={(e) => patchDay(day.id, { weekday: e.target.value || null })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-300 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 13 }}>
              <option value="">— day —</option>{WEEKDAYS.map((wd) => <option key={wd} value={wd}>{wd}</option>)}
            </select>
            <button onClick={() => removeDay(day.id)} className="text-zinc-600 hover:text-rose-400"><Trash2 size={15} /></button>
          </div>
          <div>
            {day.exercises.map((ex, ei) => (
              <div key={ex.id} className="px-4 py-3 border-b border-zinc-800">
                {editing === ex.id ? (
                  <div className="space-y-2">
                    <input value={ex.name} onChange={(e) => updateExercise(day.id, ex.id, { name: e.target.value })} placeholder="Exercise name" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }} />
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(STYLES).map(([k, v]) => (
                        <button key={k} onClick={() => applyStyle(day.id, ex.id, k)} className={"px-2 py-1 rounded-md border " + (ex.style === k ? "bg-indigo-500 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400")} style={{ fontSize: 11 }}>{v.label} {v.low}–{v.high}</button>
                      ))}
                      <button onClick={() => applyStyle(day.id, ex.id, "custom")} className={"px-2 py-1 rounded-md border " + (ex.style === "custom" ? "bg-indigo-500 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400")} style={{ fontSize: 11 }}>Custom</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-zinc-500" style={tiny}>Muscle
                        <select value={ex.muscle} onChange={(e) => updateExercise(day.id, ex.id, { muscle: e.target.value })} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }}>
                          {MUSCLES.map((mm) => <option key={mm}>{mm}</option>)}
                        </select>
                      </label>
                      <label className="text-zinc-500" style={tiny}>Equipment
                        <select value={ex.equipment || "Barbell"} onChange={(e) => updateExercise(day.id, ex.id, { equipment: e.target.value })} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }}>
                          {EQUIPMENT.map((eq) => <option key={eq}>{eq}</option>)}
                        </select>
                      </label>
                      <NumField label="Sets" value={ex.sets} onChange={(v) => updateExercise(day.id, ex.id, { sets: v })} />
                      <NumField label="Rep low" value={ex.repLow} onChange={(v) => updateExercise(day.id, ex.id, { repLow: v, style: "custom" })} />
                      <NumField label="Rep high" value={ex.repHigh} onChange={(v) => updateExercise(day.id, ex.id, { repHigh: v, style: "custom" })} />
                      <NumField label={"Weight step (" + unit + ")"} value={ex.inc} onChange={(v) => updateExercise(day.id, ex.id, { inc: v })} />
                    </div>
                    <button onClick={() => setEditing(null)} className="text-indigo-400 hover:text-indigo-300" style={{ fontSize: 14 }}>Done</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button onClick={() => moveExercise(day.id, ex.id, -1)} disabled={ei === 0} className={ei === 0 ? "text-zinc-800" : "text-zinc-600 hover:text-zinc-300"}><ChevronUp size={13} /></button>
                        <button onClick={() => moveExercise(day.id, ex.id, 1)} disabled={ei === day.exercises.length - 1} className={ei === day.exercises.length - 1 ? "text-zinc-800" : "text-zinc-600 hover:text-zinc-300"}><ChevronDown size={13} /></button>
                      </div>
                      <div>
                        <div className="font-medium" style={{ fontSize: 14 }}>{ex.name}</div>
                        <div className="flex items-center flex-wrap gap-1 mt-0.5">
                          {ex.equipment && <span className="rounded px-1 font-medium" style={{ fontSize: 10, backgroundColor: equipColor(ex.equipment) + "22", color: equipColor(ex.equipment) }}>{ex.equipment}</span>}
                          <span className="text-zinc-500 font-mono" style={tiny}>{ex.muscle} · {ex.sets}×{ex.repLow}–{ex.repHigh} · +{ex.inc}{unit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(ex.id)} className="text-zinc-500 hover:text-zinc-200"><Pencil size={14} /></button>
                      <button onClick={() => removeExercise(day.id, ex.id)} className="text-zinc-600 hover:text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setPicker(day.id)} className="flex items-center gap-1 px-4 py-3 text-zinc-400 hover:text-zinc-100 w-full" style={{ fontSize: 14 }}><Plus size={14} /> Add exercise</button>
        </div>
      ))}

      <button onClick={addDay} className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-zinc-700 py-3 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200" style={{ fontSize: 14 }}><Plus size={15} /> Add workout day</button>
      <button onClick={resetAll} className="text-zinc-600 hover:text-rose-400" style={{ fontSize: 12 }}>Reset everything</button>

      {splitOpen && <SplitPicker onApply={applySplit} onClose={() => setSplitOpen(false)} />}
      {picker && <ExercisePicker onAdd={addFromLib} onCustom={addCustom} onClose={() => setPicker(null)} />}
    </div>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <label className="text-zinc-500" style={tiny}>{label}
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-zinc-100 focus:border-indigo-500 focus:outline-none" style={{ fontSize: 14 }} />
    </label>
  );
}
function ToggleField({ label, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-left">
      <span className="text-zinc-300" style={tiny}>{label}</span>
      <span className="rounded-full transition-colors" style={{ width: 36, height: 20, backgroundColor: value ? "#6366f1" : "#3f3f46", position: "relative" }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
}
