# Rekonnect Gantt Planner — Agent Guide

## Product Snapshot
- Markdown-driven Gantt planner that turns tabular task specs into a draggable schedule
- Single-page React app rooted in `src/gantt_planner_markdown_driven_react.tsx`; `src/App.js` just re-exports it
- Scheduling engine models developer capacity, concurrency, and optional weekend skipping
- URL and `localStorage` persistence allow the UI to round-trip state for shareable links
- `VersionChecker` polls `/version.json` so deployments advertise build metadata and offer in-app refreshes

## Core Concepts & Data Flow
- Users paste a Markdown table with columns: Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm
- `parseMarkdownTable` normalizes rows, extracts task metadata, and defaults `includeInAlgorithm` to true when absent
- Settings (`speed`, `hoursPerDay`, `startDate`, `skipWeekends`, `customerFilter`) hydrate from query params or `localStorage`, then persist on change
- Tasks receive stable IDs via `hashId` so drag operations map back to markdown rows even after edits
- Share URLs encode the data rows plus include-flags; rendering reads query params, rehydrates markdown, and adopts include toggles per task

## Scheduling Engine Highlights
- `computeSchedule` iteratively adjusts task durations based on overlap: each working day divides capacity (`speed × hoursPerDay`) by concurrent tasks marked for inclusion
- Negative start indices are honored, enabling bars to shift before the global project start while still rendering the portion that falls within the chart horizon
- Working-day sequences come from `buildWorkingDays`, which can skip weekends; formatting helpers keep UI labels localized
- `updateMarkdownStartDates` and `resetGanttPlanning` synchronize calculated starts back into the markdown source so exported tables stay authoritative
- Horizon length clamps between 14–730 working days; finish date derives from horizon indexing for footer display

## UI & Interaction Notes
- Dragging bars updates `starts` state immediately; releasing triggers markdown rewrite so share links and text area stay in sync
- Checkboxes in the "Include" column toggle participation in concurrency math without hiding the task row
- Foldable epic groups summarize duration when collapsed; legend colors are deterministic HSLs keyed by epic name
- Zoom controls adjust `CELL_W` (pixels per day); `timelineStaticOffset` keeps sticky columns aligned when optional customer/include columns vanish
- `VersionChecker` compares `/version.json` with stored version and forces reload plus cache eviction when a new build is published

## Tooling & Scripts
- Install: `npm install`
- Develop: `npm start` (CRA dev server)
- Test: `npm test` (React Testing Library + Jest)
- Build: `npm run build` (runs `update-version.js`, then `react-scripts build`)
- `generate_standalone_html.js` creates a CDN-backed standalone HTML bundle by stripping TS-specific syntax from the main component
- `update-version.js` refreshes `public/version.json` with ISO build time and the current git commit (falls back to random token if git unavailable)

## Extension Points & Cautions
- Parsing logic accepts loose hour estimates (e.g. `~30h`); ensure new formats still pass `parseHours`
- When altering markdown synchronization, maintain column order so legacy tables (missing date/include) continue to round-trip cleanly
- Drag interactions rely on pointer events and `setPointerCapture`; test on touch devices if adjusting the gesture layer
- Changes to scheduling math should keep the iteration cap (`iters < 12`) and horizon clamps to avoid infinite loops or oversized arrays
- Query param schema (`task{index}_include`) powers shared links; add new params conservatively to preserve backwards compatibility
