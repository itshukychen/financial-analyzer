# Tasks: Interactive Charts

**Feature:** `interactive-charts`  
**Design:** `docs/design-interactive-charts.md`  
**Branch prefix:** `feature/interactive-charts`  
**Total tasks:** 6

Execute in order. Each task is independently committable.  
Recommended order: TASK-01 → TASK-03 (parallel ok) → TASK-02 → TASK-04 → TASK-05 → TASK-06.

---

## TASK-01: Extend API route with `range` query param

**Files:** `app/api/market/chart/[ticker]/route.ts`  
**Depends on:** nothing  
**Estimated size:** M

### What to do

Add an optional `range` query parameter to the existing `GET /api/market/chart/{ticker}` route. The existing no-range path must remain 100% unchanged (backward compatible). When `range` is provided, map it to the appropriate Yahoo Finance or FRED fetch, compute stats from the full returned dataset, and return the standard response shape.

### Exact changes

**1. Add constants at the top of the file (after `TICKER_NAMES`):**

```typescript
const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'] as const;
type Range = typeof VALID_RANGES[number];

const FRED_TICKERS = new Set(['DGS2', 'DGS10']);

const YAHOO_RANGE_CONFIG: Record<Range, { yahooRange: string; interval: string; revalidate: number }> = {
  '1D':  { yahooRange: '1d',  interval: '5m',  revalidate: 60  },
  '5D':  { yahooRange: '5d',  interval: '1d',  revalidate: 900 },
  '1M':  { yahooRange: '1mo', interval: '1d',  revalidate: 900 },
  '3M':  { yahooRange: '3mo', interval: '1d',  revalidate: 900 },
  '6M':  { yahooRange: '6mo', interval: '1d',  revalidate: 900 },
  '1Y':  { yahooRange: '1y',  interval: '1d',  revalidate: 900 },
  'YTD': { yahooRange: 'ytd', interval: '1d',  revalidate: 900 },
};

const FRED_RANGE_CONFIG: Record<Exclude<Range, '1D'>, { cutoffDays: number; sliceLast: number | 'ytd' }> = {
  '5D':  { cutoffDays: 15,  sliceLast: 5   },
  '1M':  { cutoffDays: 35,  sliceLast: 22  },
  '3M':  { cutoffDays: 100, sliceLast: 66  },
  '6M':  { cutoffDays: 200, sliceLast: 130 },
  '1Y':  { cutoffDays: 400, sliceLast: 252 },
  'YTD': { cutoffDays: 0,   sliceLast: 'ytd' },
};
```

**2. Add `unsupported?: boolean` to `RouteResponse` interface:**

```typescript
interface RouteResponse {
  symbol:       string;
  name:         string;
  points:       DataPoint[];
  current:      number;
  open:         number;
  change:       number;
  changePct:    number;
  unsupported?: boolean;   // only set true for FRED + range=1D
}
```

**3. Add new function `fetchYahooRange(ticker: string, range: Range): Promise<DataPoint[]>`** (after existing `fetchYahoo`):

```typescript
async function fetchYahooRange(ticker: string, range: Range): Promise<DataPoint[]> {
  const { yahooRange, interval, revalidate } = YAHOO_RANGE_CONFIG[range];
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=${yahooRange}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart result from Yahoo Finance');

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: DataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || isNaN(close)) continue;
    const date = new Date(timestamps[i] * 1000);
    // For intraday (1D/5m interval): keep full ISO timestamp so chart renders time axis correctly
    const timeStr = interval === '5m'
      ? date.toISOString().replace('Z', '')   // "YYYY-MM-DDTHH:MM:SS"
      : formatDate(date);                      // "YYYY-MM-DD"
    points.push({ time: timeStr, value: close });
  }

  return points;  // No .slice() — Yahoo already scopes the range
}
```

**4. Add new function `fetchFREDRange(ticker: string, range: Exclude<Range, '1D'>): Promise<DataPoint[]>`** (after `fetchFREDRange`):

```typescript
async function fetchFREDRange(ticker: string, range: Exclude<Range, '1D'>): Promise<DataPoint[]> {
  const config = FRED_RANGE_CONFIG[range];
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ticker}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`FRED fetch failed: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n').slice(1); // skip header

  let cutoffStr: string;
  if (range === 'YTD') {
    cutoffStr = `${new Date().getFullYear()}-01-01`;
  } else {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.cutoffDays);
    cutoffStr = formatDate(cutoff);
  }

  const points: DataPoint[] = [];
  for (const line of lines) {
    const [date, valueStr] = line.split(',');
    if (!date || !valueStr) continue;
    const trimmedDate  = date.trim();
    const trimmedValue = valueStr.trim();
    if (!trimmedValue || trimmedValue === '.' || trimmedDate < cutoffStr) continue;
    const value = parseFloat(trimmedValue);
    if (isNaN(value)) continue;
    points.push({ time: trimmedDate, value });
  }

  if (config.sliceLast === 'ytd') return points;
  return points.slice(-config.sliceLast);
}
```

**5. Modify the `GET` handler** to parse and dispatch on `range`:

In the `GET` export, after `const { ticker } = await params;`, add:

```typescript
const range = _req.nextUrl.searchParams.get('range') ?? undefined;

// Validate range if provided
if (range !== undefined) {
  if (!(VALID_RANGES as readonly string[]).includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }
}

const typedRange = range as Range | undefined;
```

Then replace the existing `try` block body so it branches on `typedRange`:

```typescript
try {
  // ── FRED 1D special case ─────────────────────────────────────────────────
  if (typedRange === '1D' && FRED_TICKERS.has(ticker)) {
    return NextResponse.json({ data: [], unsupported: true });
  }

  let points: DataPoint[];

  if (typedRange !== undefined) {
    // Range-aware path
    if (FRED_TICKERS.has(ticker)) {
      points = await fetchFREDRange(ticker, typedRange as Exclude<Range, '1D'>);
    } else {
      points = await fetchYahooRange(ticker, typedRange);
    }
  } else {
    // ── Existing no-range path (unchanged) ──────────────────────────────────
    if (ticker === 'DGS2' || ticker === 'DGS10') {
      points = await fetchFRED(ticker);
    } else {
      points = await fetchYahoo(ticker);
    }
  }

  if (points.length === 0) {
    return NextResponse.json({ error: 'No data available' }, { status: 500 });
  }

  const current   = points[points.length - 1].value;
  const open      = points[0].value;
  const change    = current - open;
  const changePct = (change / open) * 100;

  const response: RouteResponse = {
    symbol: ticker,
    name:   TICKER_NAMES[ticker] ?? ticker,
    points,
    current,
    open,
    change,
    changePct,
  };

  return NextResponse.json(response);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return NextResponse.json({ error: message }, { status: 500 });
}
```

### Done when
- [ ] `GET /api/market/chart/%5EGSPC?range=1M` returns 200 with `points` array spanning ~1 month
- [ ] `GET /api/market/chart/%5EGSPC?range=invalid` returns 400 `{ "error": "Invalid range" }`
- [ ] `GET /api/market/chart/DGS2?range=1D` returns 200 `{ data: [], unsupported: true }`
- [ ] `GET /api/market/chart/%5EGSPC` (no range) returns same response shape as before (backward compat)
- [ ] `GET /api/market/chart/DGS2?range=1M` returns 200 with `points` array (FRED slice)
- [ ] TypeScript: `npm run build` exits 0
- [ ] No `export const revalidate` present in this file

---

## TASK-03: Add click affordance to `MarketChart` tile

> **Note:** Task numbering follows design doc sequencing. TASK-02 (ChartModal) can be done in parallel; TASK-03 is simpler and has no dependencies.

**Files:** `app/components/charts/MarketChart.tsx`  
**Depends on:** nothing  
**Estimated size:** S

### What to do

Add an optional `onClick` prop to `MarketChart`. When provided: change cursor to `pointer`, add `tabIndex` and ARIA attributes for keyboard accessibility, and implement a hover border highlight. The tile's visual layout must not change.

### Exact changes

**1. Extend `MarketChartProps` interface:**

```typescript
interface MarketChartProps {
  ticker:       string;
  label:        string;
  formatValue?: (v: number) => string;
  onClick?:     () => void;   // NEW
}
```

**2. Add hover state inside the component function:**

```typescript
const [hovered, setHovered] = useState(false);
```

**3. Update the root `<div>` element:**

Add these props to the existing root `<div data-testid={...}>`:
```typescript
onClick={onClick}
tabIndex={onClick ? 0 : undefined}
role={onClick ? 'button' : undefined}
aria-label={onClick ? `${label} chart, click to expand` : undefined}
onMouseEnter={() => setHovered(true)}
onMouseLeave={() => setHovered(false)}
```

Update the root div's `style` object:
```typescript
style={{
  // ... all existing styles unchanged ...
  cursor:      onClick ? 'pointer' : 'default',
  border:      hovered && onClick ? '1px solid var(--accent)' : '1px solid var(--border)',
  transition:  'border-color 0.15s ease',
}}
```

**No other changes.** The existing data-testids (`ticker-tile-${ticker}`, `ticker-price-${ticker}`, `ticker-delta-${ticker}`) are already correct.

### Done when
- [ ] Tile root div has `cursor: pointer` when `onClick` prop is passed
- [ ] Tile root div has `cursor: default` when no `onClick` prop
- [ ] Hovering tile changes border to `var(--accent)` (when `onClick` present)
- [ ] `tabIndex={0}` present when `onClick` prop is passed
- [ ] Clicking tile calls `onClick` callback
- [ ] No visual regression without `onClick` prop (existing tile appearance unchanged)
- [ ] TypeScript: `npm run build` exits 0

---

## TASK-02: Create `ChartModal` component

**Files:** `app/components/charts/ChartModal.tsx` (NEW)  
**Depends on:** TASK-01 (API range endpoint must exist)  
**Estimated size:** L

### What to do

Create the fullscreen modal component. It fetches data from the range-aware API, renders an expanded lightweight-charts instance with drag-to-pan and crosshair enabled, provides range selection buttons, and handles all close interactions (ESC, backdrop, close button).

### Exact changes

Create `app/components/charts/ChartModal.tsx` as a client component (`'use client'`).

**Imports:**
```typescript
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
```

**Constants inside the module (outside the component):**
```typescript
const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'] as const;
type Range = typeof VALID_RANGES[number];

const FRED_TICKERS = new Set(['DGS2', 'DGS10']);
```

**Props interface:**
```typescript
interface ChartModalProps {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
  onClose:     () => void;
}
```

**API response interface (local, no import needed):**
```typescript
interface DataPoint {
  time:  string;
  value: number;
}
interface RangeData {
  points:       DataPoint[];
  current:      number;
  changePct:    number;
  unsupported?: boolean;
}
```

**Component state & refs:**
```typescript
const [range, setRange]     = useState<Range>('1M');
const [data, setData]       = useState<RangeData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState<string | null>(null);

const chartContainerRef = useRef<HTMLDivElement>(null);
const tooltipRef        = useRef<HTMLDivElement>(null);
const abortRef          = useRef<AbortController | null>(null);

const isFredTicker = FRED_TICKERS.has(ticker);

function isDisabled(r: Range): boolean {
  return r === '1D' && isFredTicker;
}
```

**Fetch effect** (`useEffect` on `[ticker, range]`):
```typescript
useEffect(() => {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  setLoading(true);
  setError(null);
  setData(null);

  fetch(`/api/market/chart/${encodeURIComponent(ticker)}?range=${range}`, {
    signal: controller.signal,
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json) => {
      if (json.error) throw new Error(json.error);
      setData({
        points:       json.points ?? [],
        current:      json.current ?? 0,
        changePct:    json.changePct ?? 0,
        unsupported:  json.unsupported ?? false,
      });
    })
    .catch((e: Error) => {
      if (e.name === 'AbortError') return;  // superseded — ignore
      setError(e.message);
    })
    .finally(() => setLoading(false));

  return () => controller.abort();
}, [ticker, range]);
```

**ESC key effect** (`useEffect` on `[onClose]`):
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [onClose]);
```

**Chart effect** (`useEffect` on `[data, formatValue]`):
```typescript
useEffect(() => {
  if (!data || !data.points.length || !chartContainerRef.current) return;
  const container  = chartContainerRef.current;
  const tooltipEl  = tooltipRef.current;
  const isUp       = data.changePct >= 0;
  const lineColor  = isUp ? '#00d97e' : '#f63b3b';
  const topColor   = isUp ? 'rgba(0,217,126,0.18)' : 'rgba(246,59,59,0.18)';

  let cleanup = () => {};

  import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, CrosshairMode }) => {
    if (!container) return;

    const chart = createChart(container, {
      width:  container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor:  '#6b6b80',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { visible: true, borderVisible: false },
      leftPriceScale:  { visible: false },
      timeScale:       { visible: true, borderVisible: false },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale:  false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor:            'rgba(0,0,0,0)',
      lineWidth:              2,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: true,
    });

    series.setData(data.points as { time: string; value: number }[]);
    chart.timeScale().fitContent();

    // Custom tooltip via crosshair subscription
    if (tooltipEl) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time || !param.seriesData.get(series)) {
          tooltipEl.style.display = 'none';
          return;
        }
        const seriesValue = (param.seriesData.get(series) as { value: number } | undefined)?.value;
        if (seriesValue === undefined) { tooltipEl.style.display = 'none'; return; }

        // Build tooltip content
        const timeStr = typeof param.time === 'string'
          ? param.time
          : String(param.time);
        // Date formatting: try ISO parse; fallback to raw string
        let dateLabel = timeStr;
        try {
          const parsed = new Date(timeStr.length === 10 ? timeStr + 'T00:00:00' : timeStr);
          if (!isNaN(parsed.getTime())) {
            dateLabel = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        } catch { /* use raw timeStr */ }

        tooltipEl.innerHTML = `<div style="color:var(--text-muted);font-size:11px">${dateLabel}</div>`
          + `<div style="color:var(--text-primary);font-weight:700">${formatValue(seriesValue)}</div>`;

        // Position tooltip, clamped within container
        const tw = tooltipEl.offsetWidth;
        const th = tooltipEl.offsetHeight;
        let left = param.point.x + 12;
        let top  = param.point.y - th - 8;
        if (left + tw > container.clientWidth)  left = param.point.x - tw - 12;
        if (top < 0)                            top  = param.point.y + 12;
        tooltipEl.style.left    = left + 'px';
        tooltipEl.style.top     = top  + 'px';
        tooltipEl.style.display = 'block';
      });
    }

    // Responsive resize
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) chart.resize(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(container);

    cleanup = () => {
      ro.disconnect();
      chart.remove();
      if (tooltipEl) tooltipEl.style.display = 'none';
    };
  });

  return () => cleanup();
}, [data, formatValue]);
```

**changePct badge styling (derive inside render):**
```typescript
const isUp      = data && data.changePct >= 0;
const deltaBg   = !data ? 'transparent' : isUp ? 'rgba(0,217,126,0.12)' : 'rgba(246,59,59,0.12)';
const deltaColor= !data ? 'var(--text-muted)' : isUp ? '#00d97e' : '#f63b3b';
```

**JSX structure** (see Section 6 of design doc for full DOM tree). Key requirements:
- Outer backdrop `div`: `data-testid="chart-modal"`, `role="dialog"`, `aria-modal="true"`, `aria-label="{label} chart"`, fixed position covering full viewport, `z-index: 50`, `onClick={onClose}`
- Inner panel `div`: `onClick={(e) => e.stopPropagation()}`, max-width 1000px, rounded, dark surface bg
- Header row: `{label}` text (large), `changePct` badge (when data loaded), close button with `data-testid="modal-close-btn"` and inline SVG `×` icon (width/height 20, `aria-hidden="true"`)
- Range button row: map over `VALID_RANGES`, each with `data-testid={\`range-btn-${r}\`}`, disabled + style changes per `isDisabled(r)`
- Chart area: `flex:1; min-height:400px; position:relative; padding: 0 20px 20px`
  - Loading state: `data-testid="modal-chart-skeleton"` pulsing div (visible when `loading`)
  - Error state: `data-testid="modal-chart-error"` centered error text (visible when `!loading && error`)
  - Empty state: `data-testid="modal-chart-empty"` "No data available for this range" (visible when `!loading && !error && data?.points?.length === 0`)
  - Chart container: `ref={chartContainerRef}`, `data-testid="modal-chart-container"`, `width:100%; height:100%`, `visibility: loading || error || !data?.points?.length ? 'hidden' : 'visible'`
  - Tooltip div: `ref={tooltipRef}`, `data-testid="chart-tooltip"`, `position:absolute; display:none; pointer-events:none`, styled with surface bg + border

### Done when
- [ ] Component file exists and compiles: `npm run build` exits 0
- [ ] Default range is `1M` on mount
- [ ] Range buttons `1D`–`YTD` all present with correct `data-testid`
- [ ] Clicking `5D` button triggers a new fetch to `/api/market/chart/{ticker}?range=5D`
- [ ] For `DGS2`/`DGS10` tickers: `1D` button has `opacity:0.4`, `cursor:not-allowed`, `disabled` attr
- [ ] Loading: skeleton visible, range buttons still clickable
- [ ] Error: error message shown, range buttons still clickable
- [ ] Empty data: "No data available for this range" message shown
- [ ] ESC key fires `onClose`
- [ ] Close button fires `onClose`
- [ ] Backdrop click fires `onClose` (clicking inside panel does not)
- [ ] `data-testid="chart-modal"` present on outer backdrop
- [ ] `data-testid="modal-close-btn"` present
- [ ] `data-testid="chart-tooltip"` present (initially `display:none`)
- [ ] Chart area `min-height: 400px` satisfied
- [ ] No `data-testid` uses hardcoded ticker — all derived from `ticker` prop

---

## TASK-04: Wire `MarketChartsWidget` to open/close modal

**Files:** `app/components/charts/MarketChartsWidget.tsx`  
**Depends on:** TASK-02 (ChartModal), TASK-03 (MarketChart onClick prop)  
**Estimated size:** S

### What to do

Add modal open/close state to `MarketChartsWidget`. Pass `onClick` to each `MarketChart`. Render `ChartModal` when a ticker is selected. Restore focus to the originating tile on close.

### Exact changes

**1. Add imports at the top:**
```typescript
import { useState, useRef } from 'react';
import ChartModal from './ChartModal';
```

**2. Define `ChartConfig` interface inside the file:**
```typescript
interface ChartConfig {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
}
```

**3. Inside the `MarketChartsWidget` function body, add state and refs:**
```typescript
const [openConfig, setOpenConfig] = useState<ChartConfig | null>(null);
const triggerRef = useRef<HTMLElement | null>(null);

function handleTileClick(config: ChartConfig, event: React.MouseEvent<HTMLDivElement>) {
  triggerRef.current = event.currentTarget as HTMLElement;
  setOpenConfig(config);
}

function handleModalClose() {
  setOpenConfig(null);
  // Return focus to the tile that triggered the modal (AC-5.4)
  setTimeout(() => (triggerRef.current as HTMLElement | null)?.focus(), 0);
}
```

**4. In the JSX, update the `{CHARTS.map(...)}` block:**
Pass `onClick` to each `MarketChart`:
```typescript
{CHARTS.map((c) => (
  <MarketChart
    key={c.ticker}
    ticker={c.ticker}
    label={c.label}
    formatValue={c.formatValue}
    onClick={(e: React.MouseEvent<HTMLDivElement>) => handleTileClick(c, e)}
  />
))}
```

> **Note:** `MarketChart`'s `onClick` prop type from TASK-03 is `() => void`. The `handleTileClick` call must therefore be wrapped:
```typescript
onClick={() => handleTileClick(c, { currentTarget: /* we need the element */ })}
```
Since `MarketChart` only exposes `onClick?: () => void`, we can't pass the event. Instead, in `MarketChartsWidget`, create a ref array or use `data-testid` lookup. **Simpler approach:** Change `onClick` in `MarketChart` to `() => void` and have the widget track the currently-open config via index. Focus return can use `document.querySelector(\`[data-testid="ticker-tile-${openConfig.ticker}"]\`)` on close.

**Revised focus return approach (no event needed):**
```typescript
function handleModalClose() {
  const ticker = openConfig?.ticker;
  setOpenConfig(null);
  if (ticker) {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="ticker-tile-${ticker}"]`);
      el?.focus();
    }, 0);
  }
}
```

**5. After the grid `</div>`, render the modal conditionally:**
```typescript
{openConfig && (
  <ChartModal
    ticker={openConfig.ticker}
    label={openConfig.label}
    formatValue={openConfig.formatValue}
    onClose={handleModalClose}
  />
)}
```

### Done when
- [ ] Clicking any chart tile opens the modal with the correct `label` in the header
- [ ] Clicking another tile while modal is open swaps to the new ticker (modal re-opens with new config)
- [ ] Close button / ESC / backdrop close dismisses the modal
- [ ] After close, focus moves to the tile that was clicked (keyboard nav: tile receives focus)
- [ ] `data-testid="market-charts-grid"` still present and unchanged
- [ ] `FearGreedWidget` still renders and is unaffected
- [ ] TypeScript: `npm run build` exits 0

---

## TASK-05: Unit tests

**Files:**  
- `__tests__/unit/app/api/market/chart.test.ts` (new or existing — update if present)  
- `__tests__/unit/app/components/charts/ChartModal.test.tsx` (NEW)  
- `__tests__/unit/app/components/charts/MarketChart.test.tsx` (new or existing — update if present)  
**Depends on:** TASK-01, TASK-02, TASK-03  
**Estimated size:** M

### What to do

Write Vitest unit tests covering the API range logic and both modified/created components. Follow existing test file conventions (mock `fetch` via `vi.stubGlobal`, use `@testing-library/react` for components).

### Tests for `__tests__/unit/app/api/market/chart.test.ts`

All existing tests must continue to pass. Add:

| Test | Description |
|------|-------------|
| `range=1M → Yahoo called with range=1mo, interval=1d` | Mock `fetch` to return a Yahoo-shaped response; assert request URL contains `range=1mo&interval=1d`; assert 200 + `points` array |
| `range=1D → Yahoo called with range=1d, interval=5m` | Same mock; assert URL contains `range=1d&interval=5m`; `time` values in response have hour component |
| `range=YTD → Yahoo called with range=ytd, interval=1d` | Assert URL contains `range=ytd` |
| `range=1D + ticker=DGS2 → unsupported response` | Mock not called for FRED; assert 200 `{ data: [], unsupported: true }` |
| `range=1M + ticker=DGS2 → FRED fetch, correct slice` | Mock FRED CSV with 30 rows; assert response `points.length <= 22` |
| `range=YTD + ticker=DGS2 → FRED fetch, since Jan 1` | Mock FRED CSV with rows spanning prev year + this year; assert only current-year rows returned |
| `range=badvalue → 400` | No fetch called; assert `{ error: 'Invalid range' }` + status 400 |
| `no range param → existing behavior unchanged` | Existing test should cover this; verify still passes |
| `upstream Yahoo 500 → 500 with error` | Mock Yahoo to return `500`; assert route returns 500 + `{ error: '...' }` |

### Tests for `__tests__/unit/app/components/charts/ChartModal.test.tsx`

Mock `lightweight-charts` with `vi.mock('lightweight-charts', ...)` returning stubs for `createChart`, `AreaSeries`, `ColorType`, `CrosshairMode`.

| Test | Description |
|------|-------------|
| `renders with correct ticker label` | Render `<ChartModal ticker="^GSPC" label="S&P 500" ...>`; assert heading "S&P 500" is present |
| `renders all 7 range buttons` | Assert `data-testid="range-btn-1D"` through `range-btn-YTD` all in DOM |
| `default active range is 1M` | The `range-btn-1M` button has active styling or `aria-pressed="true"` |
| `clicking range button fires fetch with new range` | Click `range-btn-6M`; assert `fetch` called with URL containing `range=6M` |
| `close button fires onClose` | Click `data-testid="modal-close-btn"`; assert `onClose` mock called once |
| `ESC key fires onClose` | Render modal; dispatch `keydown` event with `key='Escape'`; assert `onClose` called |
| `loading skeleton shown during fetch` | Mock fetch to never resolve; assert `data-testid="modal-chart-skeleton"` present |
| `error state on fetch failure` | Mock fetch to reject; assert `data-testid="modal-chart-error"` present; range buttons still enabled |
| `1D button disabled for FRED ticker` | Render with `ticker="DGS2"`; assert `range-btn-1D` is `disabled` |
| `1D button NOT disabled for Yahoo ticker` | Render with `ticker="^GSPC"`; assert `range-btn-1D` is NOT disabled |
| `backdrop click fires onClose` | Click on the `data-testid="chart-modal"` backdrop element; assert `onClose` called |
| `panel click does NOT fire onClose` | Click on the inner panel (not backdrop); assert `onClose` not called |

### Tests for `__tests__/unit/app/components/charts/MarketChart.test.tsx`

Add to existing test file (keep existing tests):

| Test | Description |
|------|-------------|
| `tile has cursor:pointer when onClick passed` | Render with `onClick={vi.fn()}`; assert root element style includes `cursor: pointer` |
| `tile has cursor:default without onClick` | Render without `onClick`; assert `cursor: default` |
| `click fires onClick callback` | Render with `onClick={vi.fn()}`; click tile; assert mock called once |
| `tile has tabIndex=0 when onClick passed` | Assert `tabIndex` attribute equals `"0"` |
| `tile does NOT have tabIndex without onClick` | Assert `tabIndex` attribute is absent |

### Done when
- [ ] All new test cases are present and passing
- [ ] All existing test cases still pass
- [ ] `npm run test:coverage` exits 0
- [ ] Coverage thresholds maintained: ≥80% branches, ≥85% functions/lines

---

## TASK-06: E2E tests

**Files:** `e2e/dashboard.spec.ts`  
**Depends on:** TASK-04 (full feature wired up and running)  
**Estimated size:** M

### What to do

Add Playwright E2E test scenarios for the interactive charts feature to `e2e/dashboard.spec.ts`. All existing scenarios must still pass.

### New scenarios to add

**Group: Chart modal**

| Scenario | Steps | Assert |
|----------|-------|--------|
| Open modal on tile click | Navigate to `/`; wait for `ticker-tile-^GSPC` visible; click it | `data-testid="chart-modal"` visible; heading contains "S&P 500" |
| Modal has correct title | (same) | Title element text matches the clicked tile's label |
| Modal chart area is at least 400px tall | Open modal | `modal-chart-container` bounding box height ≥ 400 |
| Close via close button | Open modal; click `modal-close-btn` | `chart-modal` no longer in DOM |
| Close via ESC key | Open modal; press `Escape` | `chart-modal` no longer in DOM |
| Close via backdrop click | Open modal; click the backdrop (outside the panel) | `chart-modal` no longer in DOM |
| Range buttons all visible | Open modal | `range-btn-1D`, `range-btn-5D`, `range-btn-1M`, `range-btn-3M`, `range-btn-6M`, `range-btn-1Y`, `range-btn-YTD` all visible |
| Default range is 1M | Open modal | `range-btn-1M` has active styling (check for `var(--accent)` border or aria attribute) |
| Click range button triggers reload | Open modal for `^GSPC`; click `range-btn-6M` | Chart re-renders (skeleton briefly visible then resolves); no error state |
| Crosshair tooltip appears on hover | Open modal; hover over `modal-chart-container` center | `data-testid="chart-tooltip"` has `display` not equal to `none` |
| Tooltip disappears on mouse leave | Open modal; hover over chart; move mouse away | `chart-tooltip` has `display:none` |

**Group: FRED ticker (2Y Yield)**

| Scenario | Steps | Assert |
|----------|-------|--------|
| 1D button disabled for DGS2 | Click `ticker-tile-DGS2`; open modal | `range-btn-1D` has `disabled` attribute |
| 5D–YTD buttons enabled for DGS2 | (same) | `range-btn-5D`, `range-btn-1M`, etc. are NOT disabled |

**Group: No regression**

| Scenario | Steps | Assert |
|----------|-------|--------|
| Tile price and delta still show | After opening and closing modal | `ticker-price-^GSPC` and `ticker-delta-^GSPC` still visible and non-empty |
| Fear & Greed widget unaffected | Load dashboard, open+close modal | Fear & Greed widget still present in DOM |

### Done when
- [ ] All new E2E scenarios are present and passing
- [ ] All pre-existing dashboard E2E scenarios still pass
- [ ] `npm run test:e2e` exits 0 on `ubuntu-latest`
- [ ] No `page.waitForTimeout()` calls without justification (prefer `waitForSelector`)

---

## Completion Checklist (all tasks)

- [ ] All 6 tasks committed and pushed to `feature/interactive-charts`
- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm run test:coverage` — all pass; ≥80% branches, ≥85% functions/lines
- [ ] `npm run build` — exits 0
- [ ] E2E: `npm run test:e2e` — exits 0
- [ ] PR opened against `main`
- [ ] PR body includes at least one screenshot of: tile hover state, modal open with chart, modal with range selected, tooltip visible
- [ ] PR description references PRD `docs/prd-interactive-charts.md`
- [ ] No direct commits to `main`
- [ ] Reviewer notified
