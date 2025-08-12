import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Gantt Planner – Markdown‑driven
 * -------------------------------------------------------------
 * Paste a Markdown table with columns: Epic | Task description | Estimated time in hours | Start date (optional) | Customer Request (optional)
 * Example:
 * | Epic | Task description | Estimated time in hours | Start date | Customer Request |
 * | --- | --- | --- | --- | --- |
 * | Onboarding | Improve registration form | 40 | 2025-08-15 | Ventinova |
 * | Onboarding | Open access toggle | 20 | | Ventinova |
 * | Products | Default product visibility | 0 | | Internal |
 * | Notifications | Review notifications | 30 | | Paxman |
 *
 * Features:
 * - Speed field (developers capacity). Default 1.0
 * - Hours per day (default 8), Start date, Skip weekends toggle
 * - Drag bars horizontally to shift starts; durations automatically recompute from concurrency
 * - Start dates in markdown table update automatically when bars are moved
 * - Customer requests display as badges in the chart
 * - Tasks colored by Epic
 * - Concurrency model: If k tasks overlap on a day, each gets 1/k of the daily capacity
 * - Auto recalculation after each drag or input change
 */

export default function App() {
  // -------------------- UI State --------------------
  // Load markdown from localStorage if available
  const defaultMarkdown = `| Epic | Task description | Estimated time in hours | Start date | Customer Request |\n| --- | --- | ---: | --- | --- |\n| Onboarding | More fields on registration (country/role) | 40 | | Ventinova |\n| Onboarding | Open access registration (auto-approve) | 20 | | Ventinova |\n| Products | Default product visibility for all | 0 | | Ventinova |\n| Notifications | Admin/user notifications for 2 & 3 | ~30h | | Ventinova |`;
  const [markdown, setMarkdown] = useState(() => {
    try {
      const cached = localStorage.getItem('ganttMarkdownTable');
      return cached || defaultMarkdown;
    } catch {
      return defaultMarkdown;
    }
  });
  // Save markdown to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ganttMarkdownTable', markdown);
    } catch (e) {}
  }, [markdown]);
  // LocalStorage-backed state for settings fields
  const getCached = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      if (typeof fallback === 'boolean') return v === 'true';
      if (typeof fallback === 'number') return Number(v);
      return v;
    } catch {
      return fallback;
    }
  };

  const [speed, setSpeed] = useState(() => getCached('ganttSpeed', 1.0));
  const [hoursPerDay, setHoursPerDay] = useState(() => getCached('ganttHoursPerDay', 8));
  const todayISO = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => getCached('ganttStartDate', todayISO));
  const [skipWeekends, setSkipWeekends] = useState(() => getCached('ganttSkipWeekends', true));
  // Filter and folding state
  const [customerFilter, setCustomerFilter] = useState(() => getCached('ganttCustomerFilter', ""));

  // Persist settings fields to localStorage
  useEffect(() => {
    try { localStorage.setItem('ganttSpeed', String(speed)); } catch (e) {}
  }, [speed]);
  useEffect(() => {
    try { localStorage.setItem('ganttHoursPerDay', String(hoursPerDay)); } catch (e) {}
  }, [hoursPerDay]);
  useEffect(() => {
    try { localStorage.setItem('ganttStartDate', String(startDate)); } catch (e) {}
  }, [startDate]);
  useEffect(() => {
    try { localStorage.setItem('ganttSkipWeekends', String(skipWeekends)); } catch (e) {}
  }, [skipWeekends]);
  useEffect(() => {
    try { localStorage.setItem('ganttCustomerFilter', String(customerFilter)); } catch (e) {}
  }, [customerFilter]);
  const [foldedEpics, setFoldedEpics] = useState(new Set()); // Set of folded epic names
  const [versionInfo, setVersionInfo] = useState({ version: '', buildDate: '', commit: '' });

  // Load version information
  useEffect(() => {
    fetch('/version.json')
      .then(response => response.json())
      .then(data => setVersionInfo(data))
      .catch(() => {
        // Fallback to current date if version.json is not available
        setVersionInfo({
          version: 'v1.0.0',
          buildDate: new Date().toISOString(),
          commit: 'dev'
        });
      });
  }, []);

  // Parsed tasks from Markdown
  const tasks = useMemo(() => parseMarkdownTable(markdown), [markdown]);

  // Assign stable IDs based on hash of row content to preserve position on small edits
  const tasksWithIds = useMemo(() => tasks.map((t) => ({ ...t, id: hashId(`${t.epic}|${t.desc}|${t.hours}`) })), [tasks]);

  // Group tasks by Epic, preserving order within each Epic
  const epicGroups = useMemo(() => {
    const groups = {};
    const filteredTasks = customerFilter 
      ? tasksWithIds.filter(t => t.customerRequest && t.customerRequest.toLowerCase().includes(customerFilter.toLowerCase()))
      : tasksWithIds;
    
    filteredTasks.forEach((t) => {
      if (!groups[t.epic]) groups[t.epic] = [];
      groups[t.epic].push(t);
    });
    return groups;
  }, [tasksWithIds, customerFilter]);

  // Get unique customer requests for filter dropdown
  const uniqueCustomers = useMemo(() => {
    const customers = tasksWithIds
      .map(t => t.customerRequest)
      .filter(Boolean)
      .filter((c, i, arr) => arr.indexOf(c) === i);
    return customers.sort();
  }, [tasksWithIds]);

  // Toggle Epic folding
  const toggleEpicFold = (epic) => {
    const newFolded = new Set(foldedEpics);
    if (newFolded.has(epic)) {
      newFolded.delete(epic);
    } else {
      newFolded.add(epic);
    }
    setFoldedEpics(newFolded);
  };

  // Calculate Epic summary (start and end dates)
  const getEpicSummary = (tasks) => {
    const validTasks = tasks.filter(t => schedule.rows[t.id]);
    if (validTasks.length === 0) return null;
    
    const starts = validTasks.map(t => schedule.rows[t.id].start);
    const ends = validTasks.map(t => schedule.rows[t.id].start + schedule.rows[t.id].durationDays);
    
    return {
      start: Math.min(...starts),
      end: Math.max(...ends),
      duration: Math.max(...ends) - Math.min(...starts)
    };
  };

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
  const [cellWidth, setCellWidth] = useState(32); // px per day
  const CELL_W = cellWidth;
  const ROW_H = 66; // Increased from 36 to allow text wrapping

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
    const next = dragState.current.initialStartIdx + deltaDays; // Allow negative values (before today)
    setStarts((prev) => ({ ...prev, [dragState.current.id]: next }));
  };

  const onBarPointerUp = (e) => {
    if (!dragState.current) return;
    e.target.releasePointerCapture(e.pointerId);
    
    // Update markdown with new start date
    updateMarkdownStartDates();
    
    dragState.current = null;
  };

  // Function to update the markdown table with calculated start dates
  const updateMarkdownStartDates = () => {
    const lines = markdown.split(/\r?\n/);
    const updatedLines = lines.map(line => {
      if (!line.includes('|') || line.includes('---') || line.toLowerCase().includes('epic')) {
        return line;
      }
      
      const cols = line.split('|').map(c => c.trim());
      if (cols.length < 4) return line; // Skip lines that don't have enough columns
      
      const epic = sanitizeCell(cols[1]);
      const desc = sanitizeCell(cols[2]);
      
      // Find matching task
      const task = tasksWithIds.find(t => t.epic === epic && t.desc === desc);
      if (task && starts[task.id] !== undefined) {
        const startDayIndex = starts[task.id];
        let startDateStr = '';
        
        if (startDayIndex >= 0 && days[startDayIndex]) {
          startDateStr = days[startDayIndex].toISOString().slice(0, 10);
        } else if (startDayIndex < 0) {
          // Calculate date before project start
          const projectStart = new Date(startDate);
          const actualStart = new Date(projectStart);
          actualStart.setDate(projectStart.getDate() + startDayIndex);
          startDateStr = actualStart.toISOString().slice(0, 10);
        }
        
        // Update the fourth column (start date)
        cols[4] = ` ${startDateStr} `;
        
        // Ensure we preserve the fifth column (customer request) if it exists
        if (cols.length < 6) {
          cols[5] = ' '; // Add empty customer request column if missing
        }
      }
      
      return cols.join('|');
    });
    
    setMarkdown(updatedLines.join('\n'));
  };

  // Function to reset Gantt planning and recalculate sequential dates
  const resetGanttPlanning = () => {
    // First, clear all start dates from the markdown table
    const lines = markdown.split(/\r?\n/);
    const updatedLines = lines.map(line => {
      if (!line.includes('|') || line.includes('---') || line.toLowerCase().includes('epic')) {
        return line;
      }
      
      const cols = line.split('|').map(c => c.trim());
      if (cols.length < 4) return line; // Skip lines that don't have enough columns
      
      // Clear the fourth column (start date) but preserve structure
      cols[4] = ' '; // Empty start date
      
      // Ensure we preserve the fifth column (customer request) if it exists
      if (cols.length < 6) {
        cols[5] = ' '; // Add empty customer request column if missing
      }
      
      return cols.join('|');
    });
    
    // Update markdown first
    setMarkdown(updatedLines.join('\n'));
    
    // Reset starts to sequential order (one task at a time)
    const newStarts = {};
    let cursor = 0;
    
    for (const task of tasksWithIds) {
      newStarts[task.id] = cursor;
      // Calculate naive duration for this task (no concurrency)
      const cap = Math.max(1e-6, speed * hoursPerDay);
      const duration = Math.max(1, Math.ceil(task.hours / cap));
      cursor += duration; // Move cursor to start of next task
    }
    
    setStarts(newStarts);
  };

  // -------------------- Render --------------------
  return (
    <div
      className="min-h-screen w-full text-slate-900"
      style={{ background: "linear-gradient(120deg,#c1e2c6 0%,#c6d4ed 100%)" }}
    >
      <div className="mx-auto max-w-[1800px] p-4 md:p-6 flex flex-col w-full">
        <div className="flex items-center gap-4 mt-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-600">Rekonnect planner</h1>
          <p className="text-sm text-slate-600">
            Paste a Markdown table (Epic | Task description | Estimated time in hours | Start date). Drag bars to shift; durations auto-recalculate with overlap. Start dates update automatically. Colors = Epic.
          </p>
        </div>

  {/* Editor/Settings Section */}

        {/* Editor/Settings Section */}
        <div className="mt-4 w-full">
          <div className="rounded-2xl bg-white shadow p-3 md:p-4 w-full">
            <label className="text-sm font-medium">Markdown table</label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="mt-2 w-full h-64 md:h-80 font-mono text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              spellCheck={false}
            />

            {/* Settings fields condensed below table */}
            <div className="mt-4 flex flex-wrap gap-3 justify-start">
              <div className="w-40">
                <label className="text-xs font-medium">Speed (developers)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloatSafe(e.target.value, 1))}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-1 text-sm"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium">Hours per day</label>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseFloatSafe(e.target.value, 8))}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-1 text-sm"
                />
              </div>
              <div className="w-48">
                <label className="text-xs font-medium">Project start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input
                  id="skipW"
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={(e) => setSkipWeekends(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="skipW" className="text-sm">Skip weekends</label>
              </div>
              
              {/* Reset Gantt Planning Button */}
              <div className="flex items-center mt-5">
                <button
                  onClick={resetGanttPlanning}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                  title="Reset all dates and recalculate tasks sequentially (one at a time)"
                >
                  Reset & Recalculate Sequential
                </button>
              </div>
            </div>

            {/* Customer Filter */}
            <div className="flex items-center gap-3 mt-3">
              <label htmlFor="customerFilter" className="text-sm font-medium">Filter by Customer:</label>
              <select
                id="customerFilter"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              >
                <option value="">All Customers</option>
                {uniqueCustomers.map(customer => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
              </select>
            </div>

            <EpicLegend tasks={tasksWithIds} />

            <div className="mt-3 text-xs text-slate-500">
              <p>
                Tip: Use integers for hours (e.g., <code>40</code>) or soft estimates like <code>~30h</code>. Add a fourth column for start dates (optional) and a fifth column for customer requests. Speed=1 with 8h/day means one developer working full time.
              </p>
            </div>
          </div>
        </div>

        {/* Gantt Chart Section */}
        <div className="mt-6 w-full">
          <div className="rounded-2xl bg-white shadow overflow-hidden w-full">
            {/* Chart Zoom Controls */}
            <div className="flex gap-2 items-center px-4 py-2 border-b border-slate-100 bg-slate-50">
              <span className="text-xs text-slate-600">Zoom:</span>
              <button
                className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-xs font-medium"
                onClick={() => setCellWidth((w) => Math.min(64, w + 8))}
                title="Zoom in"
              >+
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-xs font-medium"
                onClick={() => setCellWidth((w) => Math.max(12, w - 8))}
                title="Zoom out"
              >−
              </button>
            </div>
            {/* Header timeline */}
            <div className="sticky top-0 z-10 overflow-x-auto border-b border-slate-200">
              <div className="min-w-[640px]" style={{ width: schedule.horizonDays * CELL_W }}>
                <div className="grid" style={{ gridTemplateColumns: `250px 150px repeat(${schedule.horizonDays}, ${CELL_W}px)` }}>
                  <div className="bg-white/80 backdrop-blur px-3 py-2 text-xs font-medium sticky left-0 z-20">Task</div>
                  <div className="bg-white/80 backdrop-blur px-3 py-2 text-xs font-medium sticky left-[300px] z-20 border-l border-slate-200">Customer</div>
                  {/* Month and day header */}
                  {(() => {
                    let lastMonth = null;
                    return days.map((d, i) => {
                      const month = d.toLocaleDateString(undefined, { month: "short" });
                      const day = d.getDate();
                      let showMonth = false;
                      if (lastMonth !== month) {
                        showMonth = true;
                        lastMonth = month;
                      }
                      const isMonday = d.getDay() === 1; // Monday starts the week
                      return (
                        <div key={i} className={`text-[10px] text-center py-1 border-r border-slate-200 ${isMonday ? 'border-r-slate-400 border-r-2' : ''} ${isWeekend(d) ? "bg-slate-100" : "bg-white"}`}>
                          {showMonth ? (
                            <span className="font-semibold">{month}</span>
                          ) : null}
                          <div>{day}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-x-auto">
              <div className="min-w-[640px]" style={{ width: schedule.horizonDays * CELL_W }}>
                {/* Rows grouped by Epic */}
                {Object.entries(epicGroups).map(([epic, tasks]) => {
                  const isFolded = foldedEpics.has(epic);
                  const epicSummary = getEpicSummary(tasks);
                  
                  return (
                    <React.Fragment key={epic}>
                      {/* Epic section header */}
                      <div className="bg-slate-50 relative" style={{ gridTemplateColumns: `250px 150px repeat(${schedule.horizonDays}, ${CELL_W}px)`, display: 'grid', height: ROW_H }}>
                        <div 
                          className="sticky left-0 z-10 flex items-center gap-2 pl-4 pr-3 h-full font-semibold text-slate-800 text-sm bg-slate-50 border-r border-slate-300 border-b border-slate-300 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleEpicFold(epic)}
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${isFolded ? '' : 'rotate-90'}`} 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorForEpic(epic) }} />
                          <span>{epic}</span>
                          <span className="text-xs font-normal text-slate-600 ml-2">({(tasks as Task[]).length} tasks)</span>
                        </div>
                        <div className="sticky left-[250px] z-10 bg-slate-50 border-r border-slate-300 border-l border-slate-300 border-b border-slate-300"></div>
                        {/* Empty cells for timeline */}
                        {days.map((d, i) => {
                          const isMonday = d.getDay() === 1;
                          return (
                            <div key={i} className={`bg-slate-50 border-b border-slate-300 border-r border-slate-200 ${isMonday ? 'border-r-slate-400 border-r-2' : ''}`}></div>
                          );
                        })}
                        
                        {/* Epic summary bar when folded */}
                        {isFolded && epicSummary && epicSummary.start >= 0 && (
                          <div
                            className="absolute rounded-xl shadow-sm border border-black/10 flex items-center"
                            style={{
                              left: 400 + Math.max(0, epicSummary.start) * CELL_W,
                              top: Math.floor((ROW_H - 20) / 2),
                              height: 20,
                              width: epicSummary.duration * CELL_W,
                              backgroundColor: colorForEpic(epic),
                              opacity: 0.7,
                            }}
                          >
                            <span className="ml-2 text-xs font-medium text-white drop-shadow-sm">
                              {Math.ceil(epicSummary.duration)}d
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Tasks for this Epic - only show if not folded */}
                      {!isFolded && (tasks as Task[]).map((t) => {
                      const row = schedule.rows[t.id];
                      const color = colorForEpic(t.epic);
                      return (
                        <div key={t.id} className="relative grid items-start" style={{ gridTemplateColumns: `250px 150px repeat(${schedule.horizonDays}, ${CELL_W}px)`, height: ROW_H }}>
                          {/* Frozen first column with task label */}
                          <div className="sticky left-0 z-10 bg-white flex items-start gap-3 px-4 py-2 h-full border-b border-slate-100 border-r border-slate-200">
                            <div className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm leading-tight break-words whitespace-normal text-slate-800" style={{ wordBreak: 'break-word' }} title={`${t.desc}`}>{t.desc}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{t.epic} • {t.hours}h</div>
                            </div>
                          </div>

                          {/* Frozen second column with customer request */}
                          <div className="sticky left-[250px] z-10 bg-white flex items-center justify-center px-3 py-2 h-full border-b border-slate-100 border-r border-slate-200 border-l border-slate-200">
                            {t.customerRequest && (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">
                                {t.customerRequest}
                              </span>
                            )}
                          </div>

                          {/* Grid cells background */}
                          {days.map((d, i) => {
                            const isMonday = d.getDay() === 1;
                            return (
                              <div key={i} className={`h-full border-b border-slate-100 border-r border-slate-200 ${isMonday ? 'border-r-slate-400 border-r-2' : ''} ${isWeekend(d) ? "bg-slate-50" : "bg-white"}`}></div>
                            );
                          })}

                          {/* Bar */}
                          {row && row.start + row.durationDays > 0 && (
                            <div
                              className="absolute rounded-2xl shadow-md border border-black/5 cursor-grab active:cursor-grabbing select-none flex items-center"
                              onPointerDown={(e) => onBarPointerDown(e, t.id)}
                              onPointerMove={onBarPointerMove}
                              onPointerUp={onBarPointerUp}
                              style={{
                                left: 400 + Math.max(0, row.start) * CELL_W,
                                top: Math.floor((ROW_H - 28) / 2), // Center the 28px bar in the taller row
                                height: 28, // Fixed bar height regardless of row height
                                width: Math.max(1, row.start < 0 ? row.durationDays + row.start : row.durationDays) * CELL_W,
                                backgroundColor: color,
                              }}
                              title={`${t.desc}\n${t.epic}\n${t.hours}h • ${row.durationDays}d\n${row.start < 0 ? 'Starts before project start' : formatShortDate(days[row.start])} → ${formatShortDate(days[Math.min(days.length - 1, Math.max(0, row.start) + Math.max(1, row.start < 0 ? row.durationDays + row.start : row.durationDays) - 1)])}`}
                            >
                                <span
                                  className={`text-xs font-medium text-white drop-shadow-sm ${Math.max(1, row.start < 0 ? row.durationDays + row.start : row.durationDays) * CELL_W < 40 ? 'ml-1' : 'ml-3'}`}
                                  style={{
                                    marginLeft: Math.max(1, row.start < 0 ? row.durationDays + row.start : row.durationDays) * CELL_W < 40 ? 4 : 12,
                                    width: '100%',
                                    textAlign: Math.max(1, row.start < 0 ? row.durationDays + row.start : row.durationDays) * CELL_W < 40 ? 'center' : 'left',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {row.durationDays}d
                                </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
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

        <div className="mt-4 text-xs text-slate-500">
          <p>
            Assumptions: Capacity per day = <code>speed × hoursPerDay</code>. If <em>k</em> tasks overlap on a day, each receives <code>1/k</code> of that capacity. Durations converge via a small iterative solver after every move/change. You can toggle weekends and adjust hours/day.
          </p>
        </div>

        {/* Version Information */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            {versionInfo.version} • Built {versionInfo.buildDate ? new Date(versionInfo.buildDate).toLocaleString() : 'Unknown'} • {versionInfo.commit}
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
  startDateStr?: string; // optional start date from markdown
  customerRequest?: string; // optional customer request from markdown
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
      const start = Math.min(H - 1, starts[t.id] ?? 0); // Allow negative starts
      const dur = clamp(durations.get(t.id) ?? 1, 1, H - Math.max(0, start));
      for (let d = Math.max(0, start); d < Math.max(0, start) + dur && d < H; d++) concurrency[d]++;
    }

    // Recompute each task duration by simulating its daily progress under concurrency
    for (const t of tasks) {
      const start = Math.min(H - 1, starts[t.id] ?? 0); // Allow negative starts
      let remaining = t.hours;
      let day = Math.max(0, start); // Start counting from day 0 if start is negative
      let steps = 0;
      while (remaining > 1e-6 && day < H && steps < H + 1) {
        const k = Math.max(1, concurrency[day]);
        const gained = perDayCap / k;
        remaining -= gained;
        day++;
        steps++;
      }
      const newDur = Math.max(1, day - Math.max(0, start));
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
    const start = starts[t.id] ?? 0; // Allow negative starts
    const durationDays = clamp(durations.get(t.id) ?? 1, 1, H - Math.max(0, start));
    const endExclusive = Math.max(0, start) + durationDays;
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
    const startDateStr = cols.length > 3 ? sanitizeCell(cols[3]) : "";
    const customerRequest = cols.length > 4 ? sanitizeCell(cols[4]) : "";
    if (!epic || !desc) continue;
    parsed.push({ id: "", epic, desc, hours, startDateStr, customerRequest });
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
