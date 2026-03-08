# Technical Design: Interactive Charts

**Status:** Draft  
**Author:** Architect Agent  
**Date:** 2026-03-08  
**PRD:** `docs/prd-interactive-charts.md`  
**Tasks:** `docs/tasks-interactive-charts.md`

---

## 1. Overview

This feature turns each dashboard chart tile into an entry point for a fullscreen modal chart. The modal lets the user select a time range (1D–YTD), drag-to-pan the time axis, and inspect exact values via a crosshair+tooltip. The API route gains an optional `range` query parameter that maps to appropriate Yahoo Finance `range`+`interval` pairs (or FRED point-slice equivalents for DGS2/DGS10). No schema changes are required — all chart data remains ephemeral. Three existing files are modified and one new component is created.

---

## 2. Change Surface

### Files Modified
| File | Change | Reason |
|------|--------|--------|
| `app/api/market/chart/[ticker]/route.ts` | Add optional `range` query param; new range-aware fetch helpers; 400 on invalid range; FRED `1D` unsupported response | PRD AC-A.1–A.8 |
| `app/components/charts/MarketChart.tsx` | Add `onClick` prop; `cursor: pointer` hover; border hover state; `tabIndex={0}` on tile root | PRD AC-6.1, AC-6.2, AC-5.4 |
| `app/components/charts/MarketChartsWidget.tsx` | Add `openTicker`/`triggerRef` state; pass `onClick` to each tile; render `ChartModal` when open | PRD AC-1.1 |

### Files Created
| File | Purpose |
|------|---------|
| `app/components/charts/ChartModal.tsx` | Fullscreen modal: range buttons, expanded chart, crosshair tooltip, ESC/close/backdrop dismiss | PRD US-1 through US-5 |
| `__tests__/unit/app/api/market/chart.test.ts` | Unit tests for range param logic in the API route | PRD test plan |
| `__tests__/unit/app/components/charts/ChartModal.test.tsx` | Unit tests for ChartModal component | PRD test plan |
| `__tests__/unit/app/components/charts/MarketChart.test.tsx` | Unit tests: cursor + onClick callback on tile | PRD test plan |

### Files NOT Changed
| File | Reason |
|------|--------|
| `app/page.tsx` | Already `force-dynamic`; no wiring changes needed — modal is self-contained in `MarketChartsWidget` |
| `lib/db.ts` | No schema changes (all chart data ephemeral) |
| `playwright/global-setup.ts` | No new fixture data needed for modal |
| `e2e/dashboard.spec.ts` | Modified (new E2E scenarios added; existing assertions unchanged) |

### Files Deleted
None.

---

## 3. Schema Changes

None. No SQLite changes required.

---

## 4. TypeScript Interfaces / Types

### 4.1 Shared `DataPoint` (already exists in route — no change)
```typescript
interface DataPoint {
  time: string;   // ISO date "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" for intraday
  value: number;
}
```

### 4.2 `RouteResponse` — add `unsupported` flag
```typescript
// app/api/market/chart/[ticker]/route.ts — extend existing interface
interface RouteResponse {
  symbol:      string;
  name:        string;
  points:      DataPoint[];
  current:     number;
  open:        number;
  change:      number;
  changePct:   number;
  unsupported?: boolean;   // NEW — true only when FRED ticker + range=1D
}
```

### 4.3 New constants in route
```typescript
const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'] as const;
type Range = typeof VALID_RANGES[number];

const FRED_TICKERS = new Set(['DGS2', 'DGS10']);

// Maps client-facing range to Yahoo Finance API params + cache TTL
const YAHOO_RANGE_CONFIG: Record<Range, { yahooRange: string; interval: string; revalidate: number }> = {
  '1D':  { yahooRange: '1d',  interval: '5m',  revalidate: 60  },  // intraday → short TTL
  '5D':  { yahooRange: '5d',  interval: '1d',  revalidate: 900 },
  '1M':  { yahooRange: '1mo', interval: '1d',  revalidate: 900 },
  '3M':  { yahooRange: '3mo', interval: '1d',  revalidate: 900 },
  '6M':  { yahooRange: '6mo', interval: '1d',  revalidate: 900 },
  '1Y':  { yahooRange: '1y',  interval: '1d',  revalidate: 900 },
  'YTD': { yahooRange: 'ytd', interval: '1d',  revalidate: 900 },
};

// Maps range to cutoff offset in days (how far back to fetch FRED CSV) and how many points to slice
const FRED_RANGE_CONFIG: Record<Exclude<Range, '1D'>, { cutoffDays: number; sliceLast: number | 'ytd' }> = {
  '5D':  { cutoffDays: 15,  sliceLast: 5   },
  '1M':  { cutoffDays: 35,  sliceLast: 22  },
  '3M':  { cutoffDays: 100, sliceLast: 66  },
  '6M':  { cutoffDays: 200, sliceLast: 130 },
  '1Y':  { cutoffDays: 400, sliceLast: 252 },
  'YTD': { cutoffDays: 0,   sliceLast: 'ytd' }, // cutoffDays unused; filter by Jan 1 of current year
};
```

### 4.4 `ChartConfig` (internal to `MarketChartsWidget` and `ChartModal`)
```typescript
// Used in MarketChartsWidget.tsx and ChartModal.tsx
interface ChartConfig {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
}
```

---

## 5. API Changes

### `GET /api/market/chart/{ticker}` — extend with `range` param

**Backward compatibility:** When `range` is absent, the route behaves exactly as today (calls unchanged `fetchFRED`/`fetchYahoo` returning last 7 points). No existing consumer is affected.

**Request:**
```
GET /api/market/chart/{ticker}?range={range}
```

**Successful response (with range):**
```
200 {
  symbol:      string,
  name:        string,
  points:      Array<{ time: string, value: number }>,
  current:     number,
  open:        number,
  change:      number,
  changePct:   number,
  unsupported?: true       // only present for FRED tickers + range=1D
}
```
- `time` format for `1D` intraday: `"YYYY-MM-DDTHH:MM:SS"` (Unix→ISO via `new Date(...).toISOString()`)
- `time` format for all daily ranges: `"YYYY-MM-DD"` (unchanged)
- `changePct` computed as `(current - open) / open * 100` across the full range's first→last points

**FRED 1D unsupported response:**
```
200 { data: [], unsupported: true }
```
(Returns 200, not an error — the UI uses this to grey-out the button. Per AC-A.8.)

**Error responses:**
```
400 { "error": "Invalid range" }   — unrecognised range value
500 { "error": string }            — upstream fetch failure
```

**Implementation notes for route.ts:**
1. Parse `range` from `req.nextUrl.searchParams.get('range')`.
2. If `range` is present but not in `VALID_RANGES` → return 400.
3. If `range` is absent → call existing `fetchFRED`/`fetchYahoo` (unchanged path).
4. If FRED ticker + `range === '1D'` → return `{ data: [], unsupported: true }`.
5. If FRED ticker + other range → call `fetchFREDRange(ticker, range)`.
6. If Yahoo ticker + any range → call `fetchYahooRange(ticker, range)`.
7. After fetching, compute `current/open/change/changePct` from returned `points` (same formula as today).
8. **No `export const revalidate`** on the route — cache TTL is set per-fetch inside `fetchYahooRange` via `next: { revalidate: config.revalidate }`. FRED fetches keep `next: { revalidate: 900 }` for all ranges (FRED updates once daily).

**`fetchYahooRange(ticker, range)` function:**
- Looks up `YAHOO_RANGE_CONFIG[range]`
- Constructs URL: `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=${yahooRange}`
- Passes `next: { revalidate }` to `fetch`
- Returns all data points (no `.slice()` — Yahoo already scopes the response to the requested range)

**`fetchFREDRange(ticker, range)` function:**
- Looks up `FRED_RANGE_CONFIG[range]`
- For `YTD`: cutoff = `YYYY-01-01` (current year's Jan 1)
- For others: cutoff = today minus `cutoffDays`
- Fetches FRED CSV (same URL as existing `fetchFRED`); `next: { revalidate: 900 }`
- Filters points where `date >= cutoff`
- If `sliceLast === 'ytd'` → returns all filtered points
- Else → returns `points.slice(-sliceLast)`

---

## 6. Component Changes

### `app/components/charts/MarketChart.tsx` (MODIFIED)

**New prop:**
```typescript
interface MarketChartProps {
  ticker:      string;
  label:       string;
  formatValue?: (v: number) => string;
  onClick?:    () => void;   // NEW
}
```

**Root div changes:**
- Add `onClick={onClick}` (if provided, tile is clickable)
- Add `tabIndex={0}` (makes tile keyboard-focusable for focus-return AC-5.4)
- Add `role="button"` when `onClick` is defined
- Add `aria-label={label + ' chart, click to expand'}` when `onClick` is defined
- CSS: add `cursor: onClick ? 'pointer' : 'default'` to inline style
- CSS hover effect: add a CSS class or inline `onMouseEnter`/`onMouseLeave` state to brighten the border on hover

**Hover state implementation:**
- Add `const [hovered, setHovered] = useState(false)` to the component
- Root div: add `onMouseEnter={() => setHovered(true)}` and `onMouseLeave={() => setHovered(false)}`
- Root div border style: `border: hovered && onClick ? '1px solid var(--accent)' : '1px solid var(--border)'`
- Root div transition: `transition: 'border-color 0.15s ease'`

**data-testids:** Already all present from the oil-prices feature. No new ones needed on the tile.

---

### `app/components/charts/MarketChartsWidget.tsx` (MODIFIED)

Convert from a pure render component to a stateful client component managing modal open/close.

**Additions:**
```typescript
'use client';
import { useState, useRef } from 'react';
import ChartModal from './ChartModal';

// Inside MarketChartsWidget():
const [openConfig, setOpenConfig] = useState<ChartConfig | null>(null);
const triggerRef = useRef<HTMLElement | null>(null);

function handleTileClick(config: ChartConfig, event: React.MouseEvent<HTMLDivElement>) {
  triggerRef.current = event.currentTarget;
  setOpenConfig(config);
}

function handleModalClose() {
  setOpenConfig(null);
  // Return focus to the tile that opened the modal (AC-5.4)
  setTimeout(() => triggerRef.current?.focus(), 0);
}
```

**JSX changes:**
- Pass `onClick={(e) => handleTileClick(c, e)}` to each `<MarketChart>` (using `c` from the CHARTS map loop)
- After the grid div, render:
  ```tsx
  {openConfig && (
    <ChartModal
      ticker={openConfig.ticker}
      label={openConfig.label}
      formatValue={openConfig.formatValue}
      onClose={handleModalClose}
    />
  )}
  ```

---

### `app/components/charts/ChartModal.tsx` (NEW)

**Purpose:** Fullscreen modal for a single ticker. Self-contained: manages its own data fetching, range state, and lightweight-charts instance.

**Props:**
```typescript
interface ChartModalProps {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
  onClose:     () => void;
}
```

**Internal state:**
```typescript
const [range, setRange]       = useState<Range>('1M');
const [data, setData]         = useState<RouteResponse | null>(null);
const [loading, setLoading]   = useState(true);
const [error, setError]       = useState<string | null>(null);
const [hovered, setHovered]   = useState(false);  // for optional expand-icon on hover
```

**Internal refs:**
```typescript
const chartContainerRef = useRef<HTMLDivElement>(null);
const abortRef          = useRef<AbortController | null>(null);  // for AC-E.2 race condition
```

**Derived constant:**
```typescript
const FRED_TICKERS = new Set(['DGS2', 'DGS10']);
const isFredTicker = FRED_TICKERS.has(ticker);
```

**Data fetch effect:**
```
useEffect triggered on [ticker, range]:
  1. Abort previous in-flight request via abortRef.current?.abort()
  2. Create new AbortController; store in abortRef.current
  3. Set loading=true, error=null
  4. fetch(`/api/market/chart/${encodeURIComponent(ticker)}?range=${range}`, { signal })
  5. On success: if json.unsupported → set data=null, error=null (button greyed, no chart rendered); else setData(json)
  6. On abort (DOMException name='AbortError') → do nothing (superseded)
  7. On other error → setError(message)
  8. Finally: setLoading(false)
  9. Cleanup: return () => abortRef.current?.abort()
```

**ESC key effect:**
```
useEffect on [onClose]:
  document.addEventListener('keydown', handler)
  handler: if (e.key === 'Escape') onClose()
  cleanup: document.removeEventListener('keydown', handler)
```

**Chart effect:**
```
useEffect triggered on [data]:
  If !data or !chartContainerRef.current → return
  Dynamically import('lightweight-charts')
  Create chart with:
    - width: container.clientWidth
    - height: container.clientHeight (fills the flex container)
    - layout: { background: Solid rgba(0,0,0,0), textColor: 'var(--text-muted)' using getComputedStyle }
    - grid: vertLines/horzLines visible=false
    - crosshair: { mode: CrosshairMode.Normal }
    - rightPriceScale: { visible: true }  ← visible in modal (unlike tile)
    - leftPriceScale: { visible: false }
    - timeScale: { visible: true, borderVisible: false }
    - handleScroll: { mouseWheel: false, pressedMouseMove: true }  ← drag-to-pan only (AC-3.2)
    - handleScale: false
  Add AreaSeries with same color logic as MarketChart (isUp based on data.changePct)
  Call series.setData(data.points)
  chart.timeScale().fitContent()

  Custom tooltip via subscribeCrosshairMove:
    Subscribe to crosshair move events
    On each event: if param.point is within chart bounds and param.time exists:
      1. Retrieve series value: param.seriesData.get(series)?.value
      2. Position tooltip div (tooltipRef) near param.point, clamped within container bounds
      3. Set tooltip text: formatValue(value) + '\n' + formatDate(param.time)
      4. Make tooltip visible (remove hidden class / set display=block)
    On leave (param.point undefined or outside chart): hide tooltip

  ResizeObserver:
    Observe chartContainerRef.current
    On resize: chart.resize(width, height)
    Disconnect on cleanup

  Cleanup: ro.disconnect(); chart.remove()
```

**Tooltip DOM node:**
```
const tooltipRef = useRef<HTMLDivElement>(null);
// Rendered inside chart container wrapper, positioned absolute
// data-testid="chart-tooltip"
// Initially hidden (display: none)
// Styled: dark background (var(--surface)), 1px border (var(--border)), rounded, small font
```

**DOM structure:**
```
<div data-testid="chart-modal"
     role="dialog"
     aria-modal="true"
     aria-label="{label} chart"
     style="position:fixed; inset:0; z-index:50;
            background:rgba(0,0,0,0.75);
            display:flex; align-items:center; justify-content:center;"
     onClick={onClose}>                          ← backdrop click closes (AC-5.3)

  <div role="presentation"
       onClick={(e) => e.stopPropagation()}       ← stop propagation to backdrop
       style="position:relative; width:100%; max-width:1000px; margin:16px;
              background:var(--surface); border:1px solid var(--border);
              borderRadius:12px; display:flex; flex-direction:column; gap:0;
              max-height:calc(100vh - 32px); overflow:hidden">

    {/* Header row */}
    <div style="display:flex; justify-content:space-between; align-items:center;
                padding:16px 20px 0;">
      <span style="font-size:18px; font-weight:700; color:var(--text-primary)">
        {label}
      </span>
      {/* changePct badge — only when data is loaded */}
      {data && (
        <span style="font-size:13px; font-weight:600; padding:2px 8px;
                     borderRadius:4px; background:{deltaBg}; color:{deltaColor}">
          {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}%
        </span>
      )}
      {/* Close button */}
      <button data-testid="modal-close-btn"
              onClick={onClose}
              aria-label="Close chart"
              style="background:transparent; border:none; cursor:pointer;
                     color:var(--text-muted); padding:4px;">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
          <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>

    {/* Range buttons row */}
    <div style="display:flex; gap:6px; padding:12px 20px;">
      {VALID_RANGES.map(r => (
        <button
          key={r}
          data-testid={`range-btn-${r}`}
          onClick={() => !isDisabled(r) && setRange(r)}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: range === r ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: range === r ? 'var(--accent)' : isDisabled(r) ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: isDisabled(r) ? 'not-allowed' : 'pointer',
            opacity: isDisabled(r) ? 0.4 : 1,
            fontSize: '12px',
            fontWeight: 600,
            transition: 'all 0.1s ease',
          }}
          disabled={isDisabled(r)}
        >
          {r}
        </button>
      ))}
    </div>

    {/* Chart area — takes remaining height */}
    <div style="flex:1; min-height:400px; padding:0 20px 20px; position:relative;">
      {loading && (
        <div data-testid="modal-chart-skeleton"
             style="position:absolute; inset:0 20px 20px; borderRadius:6px;
                    background:var(--border); animation:pulse 1.5s ease-in-out infinite" />
      )}
      {!loading && error && (
        <div data-testid="modal-chart-error"
             style="height:100%; display:flex; align-items:center; justify-content:center;">
          <span style="fontSize:13px; color:var(--text-muted)">{error}</span>
        </div>
      )}
      {!loading && !error && !data?.points?.length && (
        <div data-testid="modal-chart-empty"
             style="height:100%; display:flex; align-items:center; justify-content:center;">
          <span style="fontSize:13px; color:var(--text-muted)">No data available for this range</span>
        </div>
      )}
      {/* Chart container — always mounted so ref stays stable; chart renders into it */}
      <div
        ref={chartContainerRef}
        data-testid="modal-chart-container"
        style={{ width: '100%', height: '100%',
                 visibility: loading || error || !data?.points?.length ? 'hidden' : 'visible' }}
      />
      {/* Custom tooltip */}
      <div
        ref={tooltipRef}
        data-testid="chart-tooltip"
        style={{
          position: 'absolute', display: 'none', pointerEvents: 'none',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '6px', padding: '6px 10px', fontSize: '12px',
          color: 'var(--text-primary)', zIndex: 10, whiteSpace: 'nowrap',
        }}
      />
    </div>
  </div>
</div>
```

**`isDisabled(r: Range)` helper (inside component):**
```typescript
function isDisabled(r: Range): boolean {
  return r === '1D' && isFredTicker;
}
```

**Tooltip positioning clamping:**
The tooltip must not overflow the chart container. On `subscribeCrosshairMove`:
```typescript
const containerRect = chartContainerRef.current.getBoundingClientRect();
const tooltipWidth  = tooltipRef.current.offsetWidth;
const tooltipHeight = tooltipRef.current.offsetHeight;
let left = param.point.x + 12;
let top  = param.point.y - tooltipHeight - 8;
// Clamp right edge
if (left + tooltipWidth > containerRect.width) left = param.point.x - tooltipWidth - 12;
// Clamp top edge
if (top < 0) top = param.point.y + 12;
tooltipRef.current.style.left = left + 'px';
tooltipRef.current.style.top  = top  + 'px';
```

**Tooltip date formatting:**
For daily ranges: `time` is `"YYYY-MM-DD"` → format as `"MMM DD, YYYY"` using `new Date(time + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })`.  
For intraday (`1D`): `time` may include hours → format with `toLocaleTimeString` as well.  
The formatted date + `'\n'` + `formatValue(value)` are split across two `<div>` or `<span>` elements inside the tooltip, styled as date (muted) + value (primary).

---

## 7. Page Changes

**`app/page.tsx`** — No changes. The modal is entirely within `MarketChartsWidget`, which is already rendered on the dashboard page.

---

## 8. Sequencing Notes

- **TASK-01 (API route)** has no dependencies — start here.
- **TASK-02 (ChartModal)** depends on TASK-01 (fetches the new range-aware endpoint). Can be developed in parallel with TASK-01 by mocking the API.
- **TASK-03 (MarketChart onClick)** has no dependencies — can run in parallel with TASK-01/02.
- **TASK-04 (MarketChartsWidget wiring)** depends on TASK-02 and TASK-03 (needs both ChartModal and the updated MarketChart).
- **TASK-05 (unit tests)** depends on TASK-01, TASK-02, TASK-03 for files to exist.
- **TASK-06 (E2E tests)** depends on TASK-04 (full feature wired up).

Recommended execution order: TASK-01 → TASK-03 → TASK-02 → TASK-04 → TASK-05 → TASK-06.  
TASK-01 and TASK-03 can be committed independently. TASK-02 can be committed before TASK-04 (component exists, not yet wired into page).

---

## 9. Open Technical Questions

| Question | Decision |
|----------|----------|
| Cache TTL for `1D` intraday vs daily ranges? | **1D uses `next: { revalidate: 60 }` (60s); all other ranges use `next: { revalidate: 900 }` (15 min). No `export const revalidate` on the route.** Rationale: intraday data changes every few minutes; caching for 15 min would serve stale prices. 60s is a reasonable balance between freshness and Yahoo rate limits. |
| FRED `YTD` cutoff — filter server-side or send all and slice client-side? | **Filter server-side in `fetchFREDRange`.** Cutoff = `YYYY-01-01` of current year. Client receives only the YTD slice. Keeps client simple. |
| Tooltip rendered as DOM element or inside lightweight-charts canvas? | **DOM element positioned via `subscribeCrosshairMove`.** Required because the `data-testid="chart-tooltip"` must be in the DOM for Playwright queries. Canvas-internal crosshair labels are not queryable by Playwright. |
| Should the chart container div in the modal always remain mounted (even during loading) to keep the ref stable? | **Yes — always mount the container div; toggle `visibility: hidden` vs `visible` rather than conditional rendering.** This avoids lightweight-charts needing to re-create the chart on every range change. The chart is destroyed/recreated on data change, not on container mount/unmount. |
| `handleScroll` configuration — drag-to-pan only, no mouse wheel zoom? | **`handleScroll: { mouseWheel: false, pressedMouseMove: true }` + `handleScale: false`.** Wheel scroll is disabled to prevent accidental panning while scrolling the page. Drag (pressed mouse move) is the only pan input per PRD US-3. |

---

## 10. Acceptance Criteria Coverage

| AC | Covered by |
|----|-----------|
| AC-1.1 | TASK-04 (widget click → modal mount) |
| AC-1.2 | ChartModal root div `data-testid="chart-modal"` |
| AC-1.3 | ChartModal header `{label}` text |
| AC-1.4 | ChartModal chart area `min-height:400px` |
| AC-2.1 | ChartModal range button row with `data-testid="range-btn-{range}"` |
| AC-2.2 | ChartModal range change triggers fetch → re-render |
| AC-2.3 | Active range button: accent border + tinted background |
| AC-2.4 | `useState('1M')` default |
| AC-2.5 | Loading state: skeleton shown, range buttons remain interactive |
| AC-2.6 | Error state: error message shown, range buttons interactive |
| AC-2.7 | `isDisabled()` → opacity 0.4, cursor not-allowed, disabled attr on 1D for FRED |
| AC-2.8 | Modal header `changePct` uses `data.changePct` from range-fetch response |
| AC-3.1 | `handleScroll: { pressedMouseMove: true }` on modal chart |
| AC-3.2 | `mouseWheel: false` prevents page scroll trigger |
| AC-3.3 | lightweight-charts natural boundary — stops at end of data series |
| AC-4.1 | `CrosshairMode.Normal` renders vertical line |
| AC-4.2 | `subscribeCrosshairMove` → tooltip with date + formatValue |
| AC-4.3 | On crosshair leave: tooltip `display: none` |
| AC-4.4 | `data-testid="chart-tooltip"` on tooltip div |
| AC-5.1 | ESC key useEffect listener |
| AC-5.2 | Close button `data-testid="modal-close-btn"` onClick={onClose} |
| AC-5.3 | Backdrop div onClick={onClose} + panel `stopPropagation` |
| AC-5.4 | `triggerRef.current?.focus()` in `handleModalClose` |
| AC-6.1 | `cursor: pointer` when onClick present |
| AC-6.2 | `border: '1px solid var(--accent)'` on hover |
| AC-A.1–A.8 | TASK-01 API route changes |
| AC-E.1 | ChartModal empty state message |
| AC-E.2 | `AbortController` per range change |
| AC-E.3 | Modal opens and fetches independently of tile error state |

---

_Design approved by Zoe before Engineer begins._
