import React, { useEffect, useMemo, useRef, useState } from "react";
import VersionChecker from "./VersionChecker";

/**
 * Gantt Planner – Markdown‑driven
 * -------------------------------------------------------------
 * Paste a Markdown table with columns: Epic | Task description | Estimated time in hours | Start date (optional) | Customer Request (optional) | Include in Algorithm (optional) | Completion % (optional)
 * Example:
 * | Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion % |
 * | --- | --- | --- | --- | --- | --- | --- |
 * | Onboarding | Improve registration form | 40 | 2025-08-15 | Ventinova | true | 50 |
 * | Onboarding | Open access toggle | 20 | | Ventinova | true | 0 |
 * | Products | Default product visibility | 0 | | Internal | false | 100 |
 * | Notifications | Review notifications | 30 | | Paxman | true | 25 |
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
 * - Completion percentage (0-100) can be set for each task
 */

export default function App() {

  // -------------------- UI State --------------------
  // Helper to get query params
  const getQueryParam = (key) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  };

  // Function to apply include flags from query parameters
  const applyIncludeFlagsFromQuery = (markdown: string) => {
    const params = new URLSearchParams(window.location.search);
    const lines = markdown.split(/\r?\n/);
    let taskIndex = 0;
    
    const updatedLines = lines.map(line => {
      if (!line.includes('|') || line.includes('---') || line.toLowerCase().includes('epic')) {
        return line;
      }
      
      const cols = line.split('|').map(c => c.trim());
      if (cols.length < 3) return line; // Skip lines that don't have enough columns
      
      const includeParam = params.get(`task${taskIndex}_include`);
      if (includeParam !== null) {
        // Ensure we have enough columns
        while (cols.length < 8) {
          cols.push(' ');
        }
        
        // Update the include flag column (6th column, index 6)
        cols[6] = ` ${includeParam} `;
        taskIndex++;
        
        return cols.join('|');
      }
      
      taskIndex++;
      return line;
    });
    
    return updatedLines.join('\n');
  };

  // Load markdown from query param, localStorage, or default
  const defaultMarkdown = `| Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion % |\n| --- | --- | ---: | --- | --- | --- | --- |\n| Onboarding | More fields on registration (country/role) | 40 | | Ventinova | true | 0 |\n| Onboarding | Open access registration (auto-approve) | 20 | | Ventinova | true | 25 |\n| Products | Default product visibility for all | 0 | | Ventinova | true | 100 |\n| Notifications | Admin/user notifications for 2 & 3 | ~30h | | Ventinova | true | 50 |`;
  const [markdown, setMarkdown] = useState(() => {
    const qp = getQueryParam('mdTable');
    if (qp) {
      let decodedMarkdown = decodeURIComponent(qp);
      // If it doesn't have headers, add them
      decodedMarkdown = ensureMarkdownHeaders(decodedMarkdown);
      // Apply include flags from query parameters
      return applyIncludeFlagsFromQuery(decodedMarkdown);
    }
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

  // LocalStorage-backed state for settings fields, but allow query param override
  const getCachedOrQuery = (key, fallback, qpKey) => {
    const qp = getQueryParam(qpKey || key);
    if (qp !== null) {
      if (typeof fallback === 'boolean') return qp === 'true';
      if (typeof fallback === 'number') return Number(qp);
      return qp;
    }
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

  const [speed, setSpeed] = useState(() => getCachedOrQuery('ganttSpeed', 1.0, 'speed'));
  const [hoursPerDay, setHoursPerDay] = useState(() => getCachedOrQuery('ganttHoursPerDay', 8, 'hoursPerDay'));
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayDate = useMemo(() => isoToLocalDate(todayISO), [todayISO]);
  const [startDate, setStartDate] = useState(() => getCachedOrQuery('ganttStartDate', todayISO, 'startDate'));
  const [skipWeekends, setSkipWeekends] = useState(() => getCachedOrQuery('ganttSkipWeekends', true, 'skipWeekends'));
  // Filter and folding state
  const [customerFilter, setCustomerFilter] = useState(() => getCachedOrQuery('ganttCustomerFilter', "", 'customerFilter'));

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

  // Function to extract include flags as query parameters
  const getIncludeFlags = useMemo(() => {
    const flags: Record<string, boolean> = {};
    tasksWithIds.forEach((task, index) => {
      flags[`task${index}_include`] = task.includeInAlgorithm;
    });
    return flags;
  }, [tasksWithIds]);

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

  // Start index per task (working-day index from project start). Initialize from markdown start dates if present
  const [starts, setStarts] = useState({});

  // Helper: find day index for a given ISO date string
  function findDayIndexForDate(isoDate, daysArr) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
    for (let i = 0; i < daysArr.length; ++i) {
      if (daysArr[i].toISOString().slice(0, 10) === isoDate) return i;
    }
    return null;
  }

  // Effect: whenever markdown, tasks, or startDate changes, update starts from markdown start dates
  useEffect(() => {
    // Build working days array for mapping dates to indices
    const daysArr = buildWorkingDays({ startISO: startDate, count: 730, skipWeekends });
    const newStarts = {};
    let cursor = 0;
    for (const t of tasksWithIds) {
      let idx: number | null = null;
      if (t.startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(t.startDateStr)) {
        idx = findDayIndexForDate(t.startDateStr, daysArr);
      }
      if (typeof idx === 'number' && idx >= 0) {
        newStarts[t.id] = idx;
      } else {
        // fallback: sequential packing if no date
        newStarts[t.id] = cursor;
        const cap = Math.max(1e-6, speed * hoursPerDay);
        const d = Math.max(1, Math.ceil(t.hours / cap));
        cursor += d;
      }
    }
    setStarts(newStarts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, tasksWithIds.length, startDate, skipWeekends, speed, hoursPerDay]);

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
  const dragState = useRef(null as null | {
    id: string;
    startPixelX: number;
    initialStartIdx: number;
  });

  // grid config
  const [cellWidth, setCellWidth] = useState(32); // px per day
  const CELL_W = cellWidth;
  const ROW_H = 66; // Increased from 36 to allow text wrapping
  const TIMELINE_TOP_PADDING = 24;

  // Show/hide Customer and Include columns
  const [showCustomer, setShowCustomer] = useState(true);
  const [showInclude, setShowInclude] = useState(true);
  const [showCompletion, setShowCompletion] = useState(true);
  const [showTodayMarker, setShowTodayMarker] = useState(true);

  const timelineStaticOffset = 250 + (showCustomer ? 150 : 0) + (showInclude ? 62 : 0) + (showCompletion ? 80 : 0);

  const todayMarker = useMemo(() => {
    if (!days.length) return null;

    const timelineStart = timelineStaticOffset;
    const todayTime = todayDate.getTime();

    let index = days.findIndex((d) => d.toISOString().slice(0, 10) === todayISO);

    if (index === -1) {
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].getTime() <= todayTime) {
          index = i;
          break;
        }
      }

      if (index === -1) {
        for (let i = 0; i < days.length; i++) {
          if (days[i].getTime() >= todayTime) {
            index = i;
            break;
          }
        }
      }
    }

    if (index === -1) return null;

    return {
      left: timelineStart + index * CELL_W,
      label: formatShortDate(todayDate),
    };
  }, [days, timelineStaticOffset, CELL_W, todayDate, todayISO]);

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

  // Function to update the include flag for a task
  const updateTaskIncludeFlag = (taskId: string, includeFlag: boolean) => {
    const task = tasksWithIds.find(t => t.id === taskId);
    if (!task) return;
    
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
      if (epic === task.epic && desc === task.desc) {
        // Ensure we have enough columns
        while (cols.length < 8) {
          cols.push(' ');
        }
        
        // Update the include flag column (6th column, index 6)
        cols[6] = ` ${includeFlag} `;
        
        return cols.join('|');
      }
      
      return line;
    });
    
    setMarkdown(updatedLines.join('\n'));
  };

  // Function to update the completion percentage for a task
  const updateTaskCompletionPercentage = (taskId: string, completion: number) => {
    const task = tasksWithIds.find(t => t.id === taskId);
    if (!task) return;
    
    // Clamp the value between 0 and 100
    const clampedCompletion = Math.max(0, Math.min(100, completion));
    
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
      if (epic === task.epic && desc === task.desc) {
        // Ensure we have enough columns
        while (cols.length < 8) {
          cols.push(' ');
        }
        
        // Update the completion percentage column (7th column, index 7)
        cols[7] = ` ${clampedCompletion} `;
        
        return cols.join('|');
      }
      
      return line;
    });
    
    setMarkdown(updatedLines.join('\n'));
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
        
        // Detect current structure: check if col4 looks like a date or customer request
        const col4 = sanitizeCell(cols[3]);
        const isCurrentlyDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
        
        if (isCurrentlyDateLike || cols.length >= 6) {
          // Current structure: Epic | Task | Hours | Date | Customer | Include
          // Update the fourth column (start date)
          cols[4] = ` ${startDateStr} `;
          
          // Ensure we preserve the fifth column (customer request) if it exists
          if (cols.length < 6) {
            cols[5] = ' '; // Add empty customer request column if missing
          }
          
          // Ensure we preserve the sixth column (include flag) if it exists
          if (cols.length < 7) {
            cols[6] = ' true '; // Add default include flag if missing
          }
        } else {
          // Current structure: Epic | Task | Hours | Customer (no date column)
          // We need to insert a date column
          const customerRequest = cols[4] || '';
          cols[4] = ` ${startDateStr} `;
          cols[5] = ` ${customerRequest} `;
          cols[6] = ' true '; // Add default include flag
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
      
      // Detect current structure: check if col4 looks like a date or customer request
      const col4 = sanitizeCell(cols[3]);
      const isCurrentlyDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
      
      if (isCurrentlyDateLike || cols.length >= 6) {
        // Current structure: Epic | Task | Hours | Date | Customer | Include
        // Clear the fourth column (start date) but preserve structure
        cols[4] = ' '; // Empty start date
        
        // Ensure we preserve the fifth column (customer request) if it exists
        if (cols.length < 6) {
          cols[5] = ' '; // Add empty customer request column if missing
        }
        
        // Ensure we preserve the sixth column (include flag) if it exists
        if (cols.length < 7) {
          cols[6] = ' true '; // Add default include flag if missing
        }
      } else {
        // Current structure: Epic | Task | Hours | Customer (no date column)
        // We need to insert an empty date column and move customer to col5
        const customerRequest = cols[4] || '';
        cols[4] = ' '; // Empty start date
        cols[5] = ` ${customerRequest} `;
        cols[6] = ' true '; // Add default include flag
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
      <VersionChecker />
      <div className="mx-auto max-w-[2000px] p-4 md:p-6 flex flex-col w-full">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-600">Rekonnect planner</h1>
      <p className="text-sm text-slate-600">
        Paste a Markdown table (Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion %). Drag bars to shift; durations auto-recalculate with overlap. Start dates update automatically. Colors = Epic.
      </p>

  {/* Editor/Settings Section */}

        {/* Editor/Settings Section */}
        <div className="mt-4 w-full">
          <div className="rounded-2xl bg-white shadow p-3 md:p-4 w-full">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Markdown table</label>
              <button
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg"
                title="Open shareable URL with current form data"
                onClick={() => {
                  const dataOnlyMarkdown = extractDataRows(markdown);
                  const includeFlags = getIncludeFlags;
                  const params = new URLSearchParams({
                    mdTable: encodeURIComponent(dataOnlyMarkdown),
                    speed: String(speed),
                    hoursPerDay: String(hoursPerDay),
                    startDate: String(startDate),
                    skipWeekends: String(skipWeekends),
                    customerFilter: String(customerFilter),
                    ...Object.fromEntries(Object.entries(includeFlags).map(([key, value]) => [key, String(value)]))
                  });
                  window.open(`${window.location.pathname}?${params.toString()}`, '_blank');
                }}
              >
                Open Shareable URL
              </button>
            </div>
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
                  className="h-4 w-4 border-blue-200 text-blue-400 focus:ring-blue-300"
                />
                <label htmlFor="skipW" className="text-sm">Skip weekends</label>
              </div>
              
              {/* Reset Gantt Planning Button */}
              <div className="flex items-center mt-5">
                <button
                  onClick={resetGanttPlanning}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
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


            {/* Continuously update URL in address bar as form changes */}
            {React.useEffect(() => {
              const dataOnlyMarkdown = extractDataRows(markdown);
              const includeFlags = getIncludeFlags;
              const params = new URLSearchParams({
                mdTable: encodeURIComponent(dataOnlyMarkdown),
                speed: String(speed),
                hoursPerDay: String(hoursPerDay),
                startDate: String(startDate),
                skipWeekends: String(skipWeekends),
                customerFilter: String(customerFilter),
                ...Object.fromEntries(Object.entries(includeFlags).map(([key, value]) => [key, String(value)]))
              });
              window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
            }, [markdown, speed, hoursPerDay, startDate, skipWeekends, customerFilter, getIncludeFlags])}

            <div className="mt-3 text-xs text-slate-500">
              <p>
                Tip: Use integers for hours (e.g., <code>40</code>) or soft estimates like <code>~30h</code>. Add a fourth column for start dates (optional), a fifth column for customer requests, a sixth column for algorithm inclusion (true/false), and a seventh column for completion percentage (0-100). Speed=1 with 8h/day means one developer working full time.
              </p>
              <p className="mt-2">
                <strong>Include column:</strong> Use the checkboxes in the Include column to control which tasks are included in the Gantt chart's concurrency and scheduling calculations. Unchecking a box will exclude that task from the automatic calendar time calculation, but the task will still be shown in the chart.
              </p>
              <p className="mt-2">
                <strong>Completion column:</strong> Use the number input field in the Completion % column to track task progress. Values are automatically clamped between 0 and 100.
              </p>
            </div>
          </div>
        </div>

        {/* Gantt Chart Section */}
        <div className="mt-6 w-full">
          <div className="rounded-2xl bg-white shadow overflow-hidden w-full">
            {/* Chart Zoom Controls and Customer column toggle */}
            <div className="flex flex-wrap gap-4 items-center px-4 py-2 border-b border-slate-100 bg-slate-50">
              <div className="flex gap-2 items-center">
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
              <div className="flex items-center gap-2">
                <input
                  id="showCustomerCol"
                  type="checkbox"
                  checked={showCustomer}
                  onChange={e => setShowCustomer(e.target.checked)}
                  className="h-4 w-4 border-blue-200 text-blue-400 focus:ring-blue-300"
                />
                <label htmlFor="showCustomerCol" className="text-xs text-slate-600 select-none">Show Customer column</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="showIncludeCol"
                  type="checkbox"
                  checked={showInclude}
                  onChange={e => setShowInclude(e.target.checked)}
                  className="h-4 w-4 border-blue-200 text-blue-400 focus:ring-blue-300"
                />
                <label htmlFor="showIncludeCol" className="text-xs text-slate-600 select-none">Show Include column</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="showCompletionCol"
                  type="checkbox"
                  checked={showCompletion}
                  onChange={e => setShowCompletion(e.target.checked)}
                  className="h-4 w-4 border-blue-200 text-blue-400 focus:ring-blue-300"
                />
                <label htmlFor="showCompletionCol" className="text-xs text-slate-600 select-none">Show Completion column</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="showTodayMarker"
                  type="checkbox"
                  checked={showTodayMarker}
                  onChange={e => setShowTodayMarker(e.target.checked)}
                  className="h-4 w-4 border-blue-200 text-blue-400 focus:ring-blue-300"
                />
                <label htmlFor="showTodayMarker" className="text-xs text-slate-600 select-none">Show Today marker</label>
              </div>
            </div>

            {/* Scrollable container for both header and body */}
            <div className="overflow-x-auto">
              <div className="relative min-w-[640px]" style={{ width: schedule.horizonDays * CELL_W + timelineStaticOffset, paddingTop: TIMELINE_TOP_PADDING }}>
                {showTodayMarker && todayMarker && (
                  <div
                    className="pointer-events-none absolute bottom-0 w-0 border-l-2 border-rose-500 z-30"
                    style={{ left: todayMarker.left, top: TIMELINE_TOP_PADDING }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      <span className="inline-flex flex-col items-center gap-[1px] rounded bg-rose-500 px-1.5 py-[1px] text-white text-[10px] font-semibold shadow-sm">
                        <span className="leading-none text-[9px] font-medium">{todayMarker.label}</span>
                      </span>
                    </div>
                  </div>
                )}
                {/* Header timeline */}
                <div className="border-b border-slate-200">
                  <div className="grid" style={{ gridTemplateColumns: `250px${showCustomer ? ' 150px' : ''}${showInclude ? ' 62px' : ''}${showCompletion ? ' 80px' : ''} repeat(${schedule.horizonDays}, ${CELL_W}px)` }}>
                    <div className="bg-white px-3 py-2 text-xs font-medium sticky left-0 z-20 border-r border-slate-200">Task</div>
                    {showCustomer && (
                      <div className="bg-white px-3 py-2 text-xs font-medium sticky left-[250px] z-20 border-l border-slate-200 border-r border-slate-200">Customer</div>
                    )}
                    {showInclude && (
                      <div className={`bg-white px-3 py-2 text-xs font-medium sticky ${showCustomer ? 'left-[400px]' : 'left-[250px]'} z-20 border-l border-slate-200 border-r border-slate-200`}>Include</div>
                    )}
                    {showCompletion && (
                      <div className={`bg-white px-3 py-2 text-xs font-medium sticky ${showCustomer && showInclude ? 'left-[462px]' : showCustomer ? 'left-[400px]' : showInclude ? 'left-[312px]' : 'left-[250px]'} z-20 border-l border-slate-200 border-r border-slate-200`}>Done %</div>
                    )}
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
                        const isMonday = d.getDay() === 1; // Monday starts a new week
                        return (
                          <div key={i} className={`text-[10px] text-center py-1 border-l border-slate-200 ${isMonday ? 'border-l-slate-400 border-l-2' : ''} border-r border-slate-200 ${isWeekend(d) ? "bg-slate-100" : "bg-white"}`}>
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

                {/* Body - Rows grouped by Epic */}
                {Object.entries(epicGroups).map(([epic, tasks]) => {
                  const isFolded = foldedEpics.has(epic);
                  const epicSummary = getEpicSummary(tasks);
                  const gridCols = `250px${showCustomer ? ' 150px' : ''}${showInclude ? ' 62px' : ''}${showCompletion ? ' 80px' : ''} repeat(${schedule.horizonDays}, ${CELL_W}px)`;
                  return (
                    <div key={epic}>
                      {/* Epic section header */}
                      <div className="bg-slate-50 relative" style={{ gridTemplateColumns: gridCols, display: 'grid', height: ROW_H }}>
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
                          <span className="text-xs font-normal text-slate-600 ml-2">{(tasks as Task[]).length} tasks</span>
                        </div>
                        {showCustomer && (
                          <div className="sticky left-[250px] z-10 bg-slate-50 border-r border-slate-300 border-l border-slate-300 border-b border-slate-300"></div>
                        )}
                        {showInclude && (
                          <div className={`sticky ${showCustomer ? 'left-[400px]' : 'left-[250px]'} z-10 bg-slate-50 border-r border-slate-300 border-l border-slate-300 border-b border-slate-300`}></div>
                        )}
                        {showCompletion && (
                          <div className={`sticky ${showCustomer && showInclude ? 'left-[462px]' : showCustomer ? 'left-[400px]' : showInclude ? 'left-[312px]' : 'left-[250px]'} z-10 bg-slate-50 border-r border-slate-300 border-l border-slate-300 border-b border-slate-300`}></div>
                        )}
                        {/* Empty cells for timeline */}
                        {days.map((d, i) => {
                          const isMonday = d.getDay() === 1;
                          return (
                            <div key={i} className={`bg-slate-50 border-b border-slate-300 border-l border-slate-200 ${isMonday ? 'border-l-slate-400 border-l-2' : ''} border-r border-slate-200`}></div>
                          );
                        })}
                        
                        {/* Epic summary bar when folded */}
                        {isFolded && epicSummary && epicSummary.start >= 0 && (
                          <div
                            className="absolute rounded-xl shadow-sm border border-black/10 flex items-center"
                            style={{
                              left: timelineStaticOffset + Math.max(0, epicSummary.start) * CELL_W,
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
                          <div key={t.id} className="relative grid items-start" style={{ gridTemplateColumns: gridCols, height: ROW_H }}>
                            {/* Frozen first column with task label */}
                            <div className="sticky left-0 z-10 bg-white flex items-start gap-3 px-4 py-2 h-full border-b border-slate-100 border-r border-slate-200">
                              <div className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm leading-tight break-words whitespace-normal text-slate-800" style={{ wordBreak: 'break-word' }} title={`${t.desc}`}>{t.desc}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{t.epic} • {t.hours}h</div>
                              </div>
                            </div>

                            {/* Frozen second column with customer request */}
                            {showCustomer && (
                              <div className="sticky left-[250px] z-10 bg-white flex items-center justify-center px-3 py-2 h-full border-b border-slate-100 border-r border-slate-200 border-l border-slate-200">
                                {t.customerRequest && (
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">
                                    {t.customerRequest}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Frozen third column with include checkbox */}
                            {showInclude && (
                              <div className={`sticky ${showCustomer ? 'left-[400px]' : 'left-[250px]'} z-10 bg-white flex items-center justify-center px-3 py-2 h-full border-b border-slate-100 border-r border-slate-200 border-l border-slate-200`}>
                                <input
                                  type="checkbox"
                                  checked={t.includeInAlgorithm}
                                  onChange={(e) => updateTaskIncludeFlag(t.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-blue-200 text-blue-400 focus:ring-blue-300"
                                  title="Include this task in the algorithm for calculating calendar time"
                                />
                              </div>
                            )}

                            {/* Frozen fourth column with completion percentage input */}
                            {showCompletion && (
                              <div className={`sticky ${showCustomer && showInclude ? 'left-[462px]' : showCustomer ? 'left-[400px]' : showInclude ? 'left-[312px]' : 'left-[250px]'} z-10 bg-white flex items-center justify-center px-2 py-2 h-full border-b border-slate-100 border-r border-slate-200 border-l border-slate-200`}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={t.completionPercentage ?? 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                      updateTaskCompletionPercentage(t.id, val);
                                    }
                                  }}
                                  className="w-full text-center text-xs rounded border border-slate-300 px-1 py-1 focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
                                  title="Task completion percentage (0-100)"
                                />
                              </div>
                            )}

                            {/* Grid cells background */}
                            {days.map((d, i) => {
                              const isMonday = d.getDay() === 1;
                              return (
                                <div key={i} className={`h-full border-b border-slate-100 border-l border-slate-200 ${isMonday ? 'border-l-slate-400 border-l-2' : ''} border-r border-slate-200 ${isWeekend(d) ? "bg-slate-50" : "bg-white"}`}></div>
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
                                  left: timelineStaticOffset + Math.max(0, row.start) * CELL_W,
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
  includeInAlgorithm: boolean; // whether to include in concurrency algorithm
  completionPercentage?: number; // optional completion percentage (0-100)
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

  // Initialize durations
  const durations = new Map<string, number>();
  for (const t of tasks) {
    if (t.includeInAlgorithm) {
      // For tasks included in algorithm, start with no concurrency estimate
      const d0 = Math.max(1, Math.ceil(t.hours / perDayCap));
      durations.set(t.id, d0);
    } else {
      // For tasks not included in algorithm, duration is fixed based on estimated hours
      const fixedDuration = Math.max(1, Math.ceil(t.hours / perDayCap));
      durations.set(t.id, fixedDuration);
    }
  }

  // Iterative refinement (only for tasks included in algorithm)
  let H = maxHorizon;
  let concurrency = new Int16Array(H);
  let changed = true;
  let iters = 0;
  while (changed && iters < 12) {
    iters++;
    changed = false;

    // Reset concurrency
    concurrency.fill(0);

    // Tally current occupancy (only count tasks included in algorithm)
    for (const t of tasks) {
      if (!t.includeInAlgorithm) continue; // Skip tasks not included in algorithm
      
      const start = Math.min(H - 1, starts[t.id] ?? 0); // Allow negative starts
      const dur = clamp(durations.get(t.id) ?? 1, 1, H - Math.max(0, start));
      for (let d = Math.max(0, start); d < Math.max(0, start) + dur && d < H; d++) concurrency[d]++;
    }

    // Recompute durations only for tasks included in algorithm
    for (const t of tasks) {
      if (!t.includeInAlgorithm) continue; // Skip tasks not included in algorithm
      
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
    
    let startDateStr = "";
    let customerRequest = "";
    let includeInAlgorithm = true; // Default to true
    let completionPercentage: number | undefined = undefined;
    
    if (cols.length > 3) {
      const col4 = sanitizeCell(cols[3]);
      const col5 = cols.length > 4 ? sanitizeCell(cols[4]) : "";
      const col6 = cols.length > 5 ? sanitizeCell(cols[5]) : "";
      const col7 = cols.length > 6 ? sanitizeCell(cols[6]) : "";
      
      // Check if col4 looks like a date (YYYY-MM-DD format or empty)
      const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
      
      if (isDateLike) {
        // Column 4 is a date (or empty), column 5 is customer request, column 6 is include flag, column 7 is completion percentage
        startDateStr = col4;
        customerRequest = col5;
        if (col6) {
          includeInAlgorithm = parseBooleanSafe(col6, true);
        }
        if (col7) {
          completionPercentage = parseCompletionPercentage(col7);
        }
      } else {
        // Check if we have the old format without date column
        if (cols.length === 4) {
          // Column 4 is customer request, no date or include flag
          startDateStr = "";
          customerRequest = col4;
          includeInAlgorithm = true;
        } else if (cols.length === 5) {
          // Could be: Epic | Task | Hours | Customer | Include
          // or: Epic | Task | Hours | Date | Customer (old format)
          const isBooleanLike = /^(true|false|yes|no|1|0)$/i.test(col5);
          if (isBooleanLike) {
            // Epic | Task | Hours | Customer | Include
            startDateStr = "";
            customerRequest = col4;
            includeInAlgorithm = parseBooleanSafe(col5, true);
          } else {
            // Epic | Task | Hours | Date | Customer (old format)
            startDateStr = col4;
            customerRequest = col5;
            includeInAlgorithm = true;
          }
        } else {
          // cols.length >= 6, assume: Epic | Task | Hours | Customer | Date | Include
          // or Epic | Task | Hours | Date | Customer | Include | Completion
          const col6 = cols.length > 5 ? sanitizeCell(cols[5]) : "";
          const col7 = cols.length > 6 ? sanitizeCell(cols[6]) : "";
          startDateStr = "";
          customerRequest = col4;
          if (col6) {
            includeInAlgorithm = parseBooleanSafe(col6, true);
          }
          if (col7) {
            completionPercentage = parseCompletionPercentage(col7);
          }
        }
      }
    }
    
    if (!epic || !desc) continue;
    parsed.push({ id: "", epic, desc, hours, startDateStr, customerRequest, includeInAlgorithm, completionPercentage });
  }
  return parsed;
}

function sanitizeCell(s: string): string {
  // Strip Markdown emphasis and trailing pipes/spaces
  return s.replace(/^[*_`\s]+|[*_`\s]+$/g, "").replace(/\\\|/g, "|");
}

function extractDataRows(md: string): string {
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Find table rows containing pipes
  const rows = lines.filter((l) => /\|/.test(l));
  if (rows.length === 0) return "";

  // Remove header separator lines (---)
  const dataRows = rows.filter((l) => !/^\|?\s*-{2,}/.test(l));

  // If header present, drop it
  const maybeHeader = dataRows[0];
  let startIdx = 0;
  if (dataRows.length > 0 && /Epic/i.test(maybeHeader) && /Task/i.test(maybeHeader)) {
    startIdx = 1;
  }

  // Return only the data rows
  return dataRows.slice(startIdx).join('\n');
}

function ensureMarkdownHeaders(md: string): string {
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Find table rows containing pipes
  const rows = lines.filter((l) => /\|/.test(l));
  if (rows.length === 0) return md;

  // Check if first row looks like a header
  const firstRow = rows[0];
  const hasHeader = /Epic/i.test(firstRow) && /Task/i.test(firstRow);
  
  if (hasHeader) {
    return md; // Already has headers
  }

  // Add headers to the beginning
  const header = "| Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion % |";
  const separator = "| --- | --- | ---: | --- | --- | --- | --- |";
  
  return `${header}\n${separator}\n${md}`;
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

function parseBooleanSafe(v: string, def: boolean): boolean {
  const trimmed = v.toLowerCase().trim();
  if (trimmed === "true" || trimmed === "yes" || trimmed === "1") return true;
  if (trimmed === "false" || trimmed === "no" || trimmed === "0") return false;
  return def;
}

function parseCompletionPercentage(v: string): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = parseInt(v.trim(), 10);
  if (Number.isNaN(n)) return undefined;
  return Math.max(0, Math.min(100, n)); // Clamp between 0 and 100
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
