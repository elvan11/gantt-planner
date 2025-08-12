import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Gantt Planner – Markdown‑driven
 * -------------------------------------------------------------
 * Paste a Markdown table with columns: Epic | Task description | Estimated time in hours
 * Example:
 * | Epic | Task description | Estimated time in hours |
 * | --- | --- | --- |
 * | Onboarding | Improve registration form | 40 |
 * | Onboarding | Open access toggle | 20 |
 * | Products | Default product visibility | 0 |
 * | Notifications | Review notifications | 30 |
 *
 * Features:
 * - Speed field (developers capacity). Default 1.0
 * - Hours per day (default 8), Start date, Skip weekends toggle
 * - Drag bars horizontally to shift starts; durations automatically recompute from concurrency
 * - Tasks colored by Epic
 * - Concurrency model: If k tasks overlap on a day, each gets 1/k of the daily capacity
 * - Auto recalculation after each drag or input change
 */

export default function App() {
  // -------------------- UI State --------------------
  const [markdown, setMarkdown] = useState(`| Epic | Task description | Estimated time in hours |\n| --- | --- | ---: |\n| Onboarding | More fields on registration (country/role) | 40 |\n| Onboarding | Open access registration (auto-approve) | 20 |\n| Products | Default product visibility for all | 0 |\n| Notifications | Admin/user notifications for 2 & 3 | ~30h |`);
  const [speed, setSpeed] = useState(1.0); // developers-equivalent
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayISO);

  // Parsed tasks from Markdown
  const tasks = useMemo(() => parseMarkdownTable(markdown), [markdown]);

  // Assign stable IDs based on hash of row content to preserve position on small edits
  const tasksWithIds = useMemo(() => tasks.map((t) => ({ ...t, id: hashId(`${t.epic}|${t.desc}|${t.hours}`) })), [tasks]);

  // Start index per task (working-day index from project start). Initialize sequentially once per parse
  const [starts, setStarts] = useState({});
  useEffect(() => {
    // If tasks changed (by id set), fill missing starts sequentially
    const current = { ...starts };
    let cursor = 0;
    for (const t of tasksWithIds) {
      if (!(t.id in current)) {
        current[t.id] = cursor; // sequential initial packing
        // naive initial duration (no concurrency): days = ceil(hours / (speed*hoursPerDay))
        const cap = Math.max(1e-6, speed * hoursPerDay);
        const d = Math.max(1, Math.ceil(t.hours / cap));
        cursor += d;
      }
    }
    setStarts(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksWithIds.length]);

  // -------------------- Scheduling Engine --------------------
  const schedule = useMemo(() => {
    const data = computeSchedule({
      tasks: tasksWithIds,
      starts,
      speed: Math.max(0.01, speed),
      hoursPerDay: Math.max(0.5, hoursPerDay),
      skipWeekends,
      startDateISO: startDate,
    });
    return data;
  }, [tasksWithIds, starts, speed, hoursPerDay, skipWeekends, startDate]);

  // For display horizon
  const days = useMemo(() => {
    return buildWorkingDays({ startISO: startDate, count: schedule.horizonDays, skipWeekends });
  }, [startDate, schedule.horizonDays, skipWeekends]);

  // -------------------- Drag to move --------------------
  const dragState = useRef<null | {
    id: string;
    startPixelX: number;
    initialStartIdx: number;
  }>(null);

  // grid config
  const CELL_W = 32; // px per day
  const ROW_H = 36;

  const onBarPointerDown = (e, id) => {
    e.target.setPointerCapture(e.pointerId);
    dragState.current = {
      id,
      startPixelX: e.clientX,
      initialStartIdx: starts[id] ?? 0,
    };
  };

  const onBarPointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startPixelX;
    const deltaDays = Math.round(dx / CELL_W);
    const next = Math.max(0, dragState.current.initialStartIdx + deltaDays);
    setStarts((prev) => ({ ...prev, [dragState.current.id]: next }));
  };

  const onBarPointerUp = (e) => {
    if (!dragState.current) return;
    e.target.releasePointerCapture(e.pointerId);
    dragState.current = null;
  };

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Markdown → Gantt Planner</h1>
        <p className="text-sm text-slate-600 mt-1">Paste a Markdown table (Epic | Task description | Estimated time in hours). Drag bars to shift; durations auto-recalculate with overlap. Colors = Epic.</p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Editor */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white shadow p-3 md:p-4">
              <label className="text-sm font-medium">Markdown table</label>
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="mt-2 w-full h-64 md:h-80 font-mono text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                spellCheck={false}
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Speed (developers)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloatSafe(e.target.value, 1))}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Hours per day</label>
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(parseFloatSafe(e.target.value, 8))}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Project start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    id="skipW"
                    type="checkbox"
                    checked={skipWeekends}
                    onChange={(e) => setSkipWeekends(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="skipW" className="text-sm">Skip weekends</label>
                </div>
              </div>

              <EpicLegend tasks={tasksWithIds} />

              <div className="mt-3 text-xs text-slate-500">
                <p>
                  Tip: Use integers for hours (e.g., <code>40</code>) or soft estimates like <code>~30h</code>. Speed=1 with 8h/day means one developer working full time.
                </p>
              </div>
            </div>
          </div>

          {/* Gantt */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white shadow overflow-hidden">
              {/* Header timeline */}
              <div className="sticky top-0 z-10 overflow-x-auto border-b border-slate-200">
                <div className="min-w-[640px]" style={{ width: schedule.horizonDays * CELL_W }}>
                  <div className="grid" style={{ gridTemplateColumns: `200px repeat(${schedule.horizonDays}, ${CELL_W}px)` }}>
                    <div className="bg-white/80 backdrop-blur px-3 py-2 text-xs font-medium sticky left-0 z-20">Task</div>
                    {days.map((d, i) => (
                      <div key={i} className={`text-[10px] text-center py-1 ${isWeekend(d) ? "bg-slate-100" : "bg-white"}`}>
                        {formatShortDate(d)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-x-auto">
                <div className="min-w-[640px]" style={{ width: schedule.horizonDays * CELL_W }}>
                  {/* Rows */}
                  {tasksWithIds.map((t, rowIdx) => {
                    const row = schedule.rows[t.id];
                    const color = colorForEpic(t.epic);
                    return (
                      <div key={t.id} className="relative grid items-center" style={{ gridTemplateColumns: `200px repeat(${schedule.horizonDays}, ${CELL_W}px)`, height: ROW_H }}>
                        {/* Frozen first column with task label */}
                        <div className="sticky left-0 z-10 bg-white flex items-center gap-2 pl-3 pr-2 h-full border-b border-slate-100">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                          <div>
                            <div className="text-sm font-medium leading-tight truncate max-w-[360px]" title={`${t.desc}`}>{t.desc}</div>
                            <div className="text-[10px] text-slate-500">{t.epic} • {t.hours}h</div>
                          </div>
                        </div>

                        {/* Grid cells background */}
                        {days.map((d, i) => (
                          <div key={i} className={`h-full border-b border-slate-100 ${isWeekend(d) ? "bg-slate-50" : "bg-white"}`}></div>
                        ))}

                        {/* Bar */}
                        {row && (
                          <div
                            className="absolute rounded-2xl shadow-md border border-black/5 cursor-grab active:cursor-grabbing select-none flex items-center"
                            onPointerDown={(e) => onBarPointerDown(e, t.id)}
                            onPointerMove={onBarPointerMove}
                            onPointerUp={onBarPointerUp}
                            style={{
                              left: 200 + row.start * CELL_W,
                              top: 4,
                              height: ROW_H - 8,
                              width: Math.max(1, row.durationDays) * CELL_W,
                              backgroundColor: color,
                            }}
                            title={`${t.desc}\n${t.epic}\n${t.hours}h • ${row.durationDays}d\n${formatShortDate(days[row.start])} → ${formatShortDate(days[Math.min(days.length - 1, row.start + row.durationDays - 1)])}`}
                          >
                            <span className="ml-3 text-xs font-medium text-white drop-shadow-sm">
                              {row.durationDays}d
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer summary */}
              <div className="border-t border-slate-200 p-3 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <div>Total tasks: {tasksWithIds.length}</div>
                <div>Speed: {speed.toFixed(2)}</div>
                <div>Hours/day: {hoursPerDay}</div>
                <div>Horizon: {schedule.horizonDays} working days</div>
                <div>Projected finish: {schedule.finishDate ? formatLongDate(schedule.finishDate) : "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          <p>
            Assumptions: Capacity per day = <code>speed × hoursPerDay</code>. If <em>k</em> tasks overlap on a day, each receives <code>1/k</code> of that capacity. Durations converge via a small iterative solver after every move/change. You can toggle weekends and adjust hours/day.
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------- Components --------------------
function EpicLegend({ tasks }: { tasks: Task[] }) {
  const epics = useMemo(() => Array.from(new Set(tasks.map((t) => t.epic))), [tasks]);
  if (!epics.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-center">
      {epics.map((e) => (
        <div key={e} className="flex items-center gap-2 rounded-full border border-slate-200 px-2 py-1">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorForEpic(e) }} />
          <span className="text-xs">{e}</span>
        </div>
      ))}
    </div>
  );
}

// -------------------- Types --------------------
interface Task {
  id: string;
  epic: string;
  desc: string;
  hours: number; // estimated hours
}

interface ScheduleResult {
  horizonDays: number;
  rows: Record<string, { start: number; durationDays: number; endExclusive: number }>;
  finishDate: Date | null;
}

// -------------------- Scheduling Core --------------------
function computeSchedule({
  tasks,
  starts,
  speed,
  hoursPerDay,
  skipWeekends,
  startDateISO,
}: {
  tasks: Task[];
  starts: Record<string, number>;
  speed: number;
  hoursPerDay: number;
  skipWeekends: boolean;
  startDateISO: string;
}): ScheduleResult {
  const N = Math.max(1, tasks.length);
  const perDayCap = Math.max(1e-6, speed * hoursPerDay);
  const sumHours = tasks.reduce((a, t) => a + t.hours, 0);

  // Worst-case horizon bound (all tasks fully concurrent):
  const worstDays = Math.ceil((sumHours * N) / perDayCap) + 14; // + buffer
  const maxHorizon = clamp(worstDays, 14, 730);

  // Initialize durations with no concurrency
  const durations = new Map<string, number>();
  for (const t of tasks) {
    const d0 = Math.max(1, Math.ceil(t.hours / perDayCap));
    durations.set(t.id, d0);
  }

  // Iterative refinement
  let H = maxHorizon;
  let concurrency = new Int16Array(H);
  let changed = true;
  let iters = 0;
  while (changed && iters < 12) {
    iters++;
    changed = false;

    // Reset concurrency
    concurrency.fill(0);

    // Tally current occupancy
    for (const t of tasks) {
      const start = Math.min(H - 1, Math.max(0, starts[t.id] ?? 0));
      const dur = clamp(durations.get(t.id) ?? 1, 1, H - start);
      for (let d = start; d < start + dur && d < H; d++) concurrency[d]++;
    }

    // Recompute each task duration by simulating its daily progress under concurrency
    for (const t of tasks) {
      const start = Math.min(H - 1, Math.max(0, starts[t.id] ?? 0));
      let remaining = t.hours;
      let day = start;
      let steps = 0;
      while (remaining > 1e-6 && day < H && steps < H + 1) {
        const k = Math.max(1, concurrency[day]);
        const gained = perDayCap / k;
        remaining -= gained;
        day++;
        steps++;
      }
      const newDur = Math.max(1, day - start);
      if (newDur !== (durations.get(t.id) ?? 1)) {
        durations.set(t.id, newDur);
        changed = true;
      }
    }
  }

  // Build rows & find max end
  let maxEnd = 0;
  const rows: ScheduleResult["rows"] = {};
  for (const t of tasks) {
    const start = Math.max(0, starts[t.id] ?? 0);
    const durationDays = clamp(durations.get(t.id) ?? 1, 1, H - start);
    const endExclusive = start + durationDays;
    rows[t.id] = { start, durationDays, endExclusive };
    if (endExclusive > maxEnd) maxEnd = endExclusive;
  }

  const horizon = clamp(maxEnd + 7, 14, 730);
  const finishDate = buildWorkingDays({ startISO: startDateISO, count: horizon, skipWeekends }).at(maxEnd - 1) ?? null;

  return { horizonDays: horizon, rows, finishDate };
}

// -------------------- Markdown Parser --------------------
function parseMarkdownTable(md: string): Task[] {
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Find table rows containing pipes
  const rows = lines.filter((l) => /\|/.test(l));
  if (rows.length === 0) return [];

  // Remove header separator lines (---)
  const dataRows = rows.filter((l) => !/^\|?\s*-{2,}/.test(l));

  // If header present, drop it
  const maybeHeader = dataRows[0];
  let startIdx = 0;
  if (/Epic/i.test(maybeHeader) && /Task/i.test(maybeHeader)) startIdx = 1;

  const parsed: Task[] = [];
  for (let i = startIdx; i < dataRows.length; i++) {
    const cols = dataRows[i]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cols.length < 3) continue;
    const epic = sanitizeCell(cols[0]);
    const desc = sanitizeCell(cols[1]);
    const hours = parseHours(cols[2]);
    if (!epic || !desc) continue;
    parsed.push({ id: "", epic, desc, hours });
  }
  return parsed;
}

function sanitizeCell(s: string): string {
  // Strip Markdown emphasis and trailing pipes/spaces
  return s.replace(/^[*_`\s]+|[*_`\s]+$/g, "").replace(/\\\|/g, "|");
}

function parseHours(s: string): number {
  // Accept forms: 30, 30h, ~30h, ≈30, 30.5
  const m = String(s).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return 0;
  return Math.max(0, parseFloat(m[1]));
}

// -------------------- Date & Grid Helpers --------------------
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6; // Sun or Sat
}

function buildWorkingDays({ startISO, count, skipWeekends }: { startISO: string; count: number; skipWeekends: boolean }): Date[] {
  const start = isoToLocalDate(startISO);
  const out: Date[] = [];
  let d = new Date(start.getTime());
  while (out.length < count) {
    if (!skipWeekends || !isWeekend(d)) out.push(new Date(d.getTime()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  // Create local date (00:00) to avoid TZ drift
  const dt = new Date();
  dt.setFullYear(y, (m - 1) | 0, d | 0);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatShortDate(d: Date): string {
  const mm = d.toLocaleDateString(undefined, { month: "short" });
  const dd = d.getDate();
  return `${mm} ${dd}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// -------------------- Utils --------------------
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function parseFloatSafe(v: string, def: number) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function hashId(s: string): string {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `t_${(h >>> 0).toString(36)}`;
}

function colorForEpic(epic: string): string {
  // Deterministic pastel via HSL
  let h = 0;
  for (let i = 0; i < epic.length; i++) h = (h * 31 + epic.charCodeAt(i)) % 360;
  const hue = h;
  const sat = 70;
  const light = 65;
  return `hsl(${hue} ${sat}% ${light}%)`;
}
