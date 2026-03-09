# Technical Design: SPX Option Price Chart Overlay

**Feature:** Add SPX June 17th 3000 Strike Option Price to Chart  
**Status:** Draft  
**Architect:** Subagent Architect  
**Created:** 2026-03-09  
**Version:** 1.0

---

## Architecture Overview

This feature adds dual-series chart visualization capability to display both underlying SPX price and specific option strike prices on the same chart. The implementation follows the existing Next.js + lightweight-charts pattern with minimal new dependencies.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────┐    ┌─────────────────────────────────┐  │
│  │ Chart Component│◄───┤ OptionsOverlaySelector (new)   │  │
│  │  (existing)    │    │  - Strike selector              │  │
│  │  + dual-series │    │  - Expiry picker                │  │
│  │    support     │    │  - Toggle control               │  │
│  └────────┬───────┘    └─────────────────────────────────┘  │
│           │                                                   │
└───────────┼───────────────────────────────────────────────────┘
            │ HTTP GET
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/market/options-overlay (new)                    │   │
│  │  - Validates params (ticker, strike, expiry, range)  │   │
│  │  - Fetches underlying + option data                  │   │
│  │  - Merges timeseries                                 │   │
│  │  - Returns dual-series payload                       │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                             │
└─────────────────┼─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer (SQLite)                        │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │ market_data          │    │ option_prices (new)      │   │
│  │  - ticker            │    │  - ticker                │   │
│  │  - timestamp         │    │  - strike                │   │
│  │  - price             │    │  - expiry_date           │   │
│  │  - ...               │    │  - timestamp             │   │
│  └──────────────────────┘    │  - price (mid/close)     │   │
│                               │  - bid, ask, volume      │   │
│                               └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Design

### New Table: `option_prices`

```sql
CREATE TABLE option_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,                  -- Underlying ticker (e.g., 'SPX')
  strike REAL NOT NULL,                  -- Strike price (e.g., 3000)
  expiry_date TEXT NOT NULL,             -- ISO date 'YYYY-MM-DD'
  option_type TEXT NOT NULL DEFAULT 'call',  -- 'call' or 'put'
  timestamp INTEGER NOT NULL,            -- Unix timestamp
  price REAL NOT NULL,                   -- Mid-price or last traded
  bid REAL,                              -- Bid price (optional)
  ask REAL,                              -- Ask price (optional)
  volume INTEGER,                        -- Volume (optional)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
);

CREATE INDEX idx_option_prices_lookup 
  ON option_prices(ticker, strike, expiry_date, option_type, timestamp);

CREATE INDEX idx_option_prices_expiry 
  ON option_prices(expiry_date);
```

**Rationale:**
- `ticker + strike + expiry_date + option_type + timestamp` forms unique constraint (one price per timestamp)
- Composite index on lookup columns for fast queries
- Expiry index to support expiry-based cleanup/archival
- Added `option_type` field for future extensibility (calls vs puts)

### Data Population Strategy

**MVP:** Manual backfill for SPX 3000 Jun17 2026 call
- Source: Yahoo Finance historical options data or existing snapshot backfills
- Frequency: Daily closes for historical; intraday 5-min bars if available
- Script: `scripts/backfill-option-prices.ts`

**Future:** Automated collection from market data feed

---

## API Design

### Endpoint: `/api/market/options-overlay`

**Method:** `GET`

**Parameters:**
```typescript
interface OptionsOverlayParams {
  ticker: string;           // Required: 'SPX'
  strike: number;           // Required: 3000
  expiry: string;           // Required: 'YYYY-MM-DD' format
  optionType?: 'call' | 'put';  // Optional: default 'call'
  range?: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';  // Optional: default '1D'
}
```

**Response:**
```typescript
interface OptionsOverlayResponse {
  ticker: string;
  strike: number;
  expiry: string;
  optionType: 'call' | 'put';
  range: string;
  points: Array<{
    time: string;           // ISO timestamp or date
    underlyingPrice: number;
    optionPrice: number;
  }>;
  current: {
    underlying: number;
    option: number;
  };
  metadata?: {
    dataAvailability: 'full' | 'partial';
    earliestTimestamp?: string;
  };
}
```

**Example Request:**
```
GET /api/market/options-overlay?ticker=SPX&strike=3000&expiry=2026-06-17&range=1M
```

**Example Response:**
```json
{
  "ticker": "SPX",
  "strike": 3000,
  "expiry": "2026-06-17",
  "optionType": "call",
  "range": "1M",
  "points": [
    {
      "time": "2026-02-09T16:00:00Z",
      "underlyingPrice": 5850.25,
      "optionPrice": 220.50
    },
    {
      "time": "2026-02-10T16:00:00Z",
      "underlyingPrice": 5865.00,
      "optionPrice": 228.75
    }
    // ... more points
  ],
  "current": {
    "underlying": 5910.25,
    "option": 242.10
  },
  "metadata": {
    "dataAvailability": "full"
  }
}
```

**Error Handling:**
- 400: Invalid parameters (missing ticker, invalid strike, bad date format)
- 404: No data available for specified option
- 500: Database or server error

**Caching Strategy:**
- `1D` range: `max-age=60, stale-while-revalidate=300` (1 min cache, 5 min stale)
- Other ranges: `max-age=900, stale-while-revalidate=3600` (15 min cache, 1 hr stale)

---

## Frontend Design

### Component Architecture

```
ChartPage
  └─ MarketChart (existing, enhanced)
       ├─ lightweight-charts instance
       ├─ OptionsOverlaySelector (new)
       │    ├─ Strike input/dropdown
       │    ├─ Expiry date picker
       │    ├─ Toggle button (show/hide overlay)
       │    └─ Option type selector (call/put)
       └─ ChartLegend (enhanced)
            ├─ Underlying series (blue)
            └─ Option series (orange) [conditional]
```

### New Component: `OptionsOverlaySelector`

**File:** `src/components/OptionsOverlaySelector.tsx`

**Props:**
```typescript
interface OptionsOverlaySelectorProps {
  ticker: string;
  onOverlayChange: (config: OverlayConfig | null) => void;
  defaultConfig?: OverlayConfig;
}

interface OverlayConfig {
  strike: number;
  expiry: string;
  optionType: 'call' | 'put';
}
```

**UI Layout:**
```
┌────────────────────────────────────────────┐
│  Add Option Overlay                  [×]   │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐   │
│  │ Strike   │ │ Expiry   │ │ Type    │   │
│  │ 3000 ▼   │ │ Jun 17 ▼ │ │ Call ▼  │   │
│  └──────────┘ └──────────┘ └─────────┘   │
│  [Apply] [Clear]                           │
└────────────────────────────────────────────┘
```

**Behavior:**
- Opens as collapsed panel/modal
- For MVP: hardcode SPX 3000 Jun17 2026 call as default
- Future: populate dropdowns from available strikes/expiries in DB
- "Apply" triggers fetch + chart update
- "Clear" removes overlay and returns to single-series view

### Chart Enhancement

**File:** `src/components/MarketChart.tsx` (existing, modify)

**Changes:**
1. Accept optional `optionOverlay` prop
2. Support dual-series mode in lightweight-charts
3. Implement dual Y-axis scaling OR normalized view

**Dual Y-Axis Approach:**
```typescript
// Left axis: underlying price
series1 = chart.addLineSeries({
  color: '#2962FF',
  priceScaleId: 'left',
  title: 'SPX'
});

// Right axis: option price
series2 = chart.addLineSeries({
  color: '#FF6D00',
  priceScaleId: 'right',
  title: 'SPX 3000C Jun17'
});

chart.priceScale('left').applyOptions({
  scaleMargins: { top: 0.1, bottom: 0.2 },
});

chart.priceScale('right').applyOptions({
  scaleMargins: { top: 0.1, bottom: 0.2 },
});
```

**Normalized Approach (Alternative):**
```typescript
// Both series on single axis, showing % change from first data point
const normalizedData = points.map(p => ({
  time: p.time,
  underlying: ((p.underlyingPrice / baselineUnderlying) - 1) * 100,
  option: ((p.optionPrice / baselineOption) - 1) * 100
}));
```

**Decision:** Use dual Y-axis for MVP (more intuitive for absolute prices).

### Tooltip Enhancement

**Existing:** Shows single value on hover  
**New:** Show both values when overlay active

```typescript
interface TooltipData {
  time: string;
  underlying: { label: 'SPX', value: number };
  option?: { label: 'SPX 3000C Jun17', value: number };
}
```

**Rendered as:**
```
┌─────────────────────┐
│ Mar 9, 2026         │
│ SPX: $5,910.25      │
│ 3000C Jun17: $242.10│
└─────────────────────┘
```

---

## Data Flow

### User Interaction Flow

```
1. User navigates to /chart?ticker=SPX
   ↓
2. Page loads, fetches SPX spot data (existing flow)
   ↓
3. User clicks "Add Option Overlay"
   ↓
4. OptionsOverlaySelector appears
   ↓
5. User selects strike=3000, expiry=Jun17, type=call
   ↓
6. User clicks "Apply"
   ↓
7. Frontend calls:
   GET /api/market/options-overlay?ticker=SPX&strike=3000&expiry=2026-06-17&range=1M
   ↓
8. API handler:
   - Queries option_prices table for matching records
   - Queries market_data for SPX prices in same time range
   - Merges on timestamp
   - Returns dual-series payload
   ↓
9. Frontend receives data, updates chart with second series
   ↓
10. User can toggle overlay on/off, change range, etc.
```

### Backend Query Logic

**Pseudo-code for `/api/market/options-overlay` handler:**

```typescript
export default async function handler(req, res) {
  const { ticker, strike, expiry, optionType = 'call', range = '1D' } = req.query;
  
  // Validate inputs
  if (!ticker || !strike || !expiry) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  // Calculate time range
  const endTime = Date.now();
  const startTime = calculateStartTime(range, endTime);
  
  // Fetch underlying prices
  const underlyingPrices = db.prepare(`
    SELECT timestamp, price 
    FROM market_data 
    WHERE ticker = ? 
      AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `).all(ticker, startTime / 1000, endTime / 1000);
  
  // Fetch option prices
  const optionPrices = db.prepare(`
    SELECT timestamp, price 
    FROM option_prices 
    WHERE ticker = ? 
      AND strike = ? 
      AND expiry_date = ?
      AND option_type = ?
      AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `).all(ticker, strike, expiry, optionType, startTime / 1000, endTime / 1000);
  
  // Merge series on timestamp
  const points = mergeTimeSeries(underlyingPrices, optionPrices);
  
  // Get current values
  const current = {
    underlying: underlyingPrices[underlyingPrices.length - 1]?.price,
    option: optionPrices[optionPrices.length - 1]?.price
  };
  
  // Return response
  res.setHeader('Cache-Control', getCacheHeader(range));
  res.status(200).json({
    ticker,
    strike: parseFloat(strike),
    expiry,
    optionType,
    range,
    points,
    current
  });
}

function mergeTimeSeries(underlying, option) {
  const underlyingMap = new Map(underlying.map(u => [u.timestamp, u.price]));
  const optionMap = new Map(option.map(o => [o.timestamp, o.price]));
  
  const allTimestamps = [...new Set([...underlyingMap.keys(), ...optionMap.keys()])].sort();
  
  return allTimestamps
    .filter(ts => underlyingMap.has(ts) && optionMap.has(ts))  // Inner join
    .map(ts => ({
      time: new Date(ts * 1000).toISOString(),
      underlyingPrice: underlyingMap.get(ts),
      optionPrice: optionMap.get(ts)
    }));
}
```

**Note:** Uses inner join to only include timestamps where both underlying and option data exist.

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/api/options-overlay.test.ts`

```typescript
describe('/api/market/options-overlay', () => {
  test('returns 400 for missing parameters', async () => {
    const res = await fetch('/api/market/options-overlay');
    expect(res.status).toBe(400);
  });
  
  test('returns dual-series data for valid request', async () => {
    const res = await fetch('/api/market/options-overlay?ticker=SPX&strike=3000&expiry=2026-06-17&range=1D');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.points).toBeInstanceOf(Array);
    expect(data.points[0]).toHaveProperty('time');
    expect(data.points[0]).toHaveProperty('underlyingPrice');
    expect(data.points[0]).toHaveProperty('optionPrice');
  });
  
  test('handles missing option data gracefully', async () => {
    const res = await fetch('/api/market/options-overlay?ticker=SPX&strike=9999&expiry=2026-06-17');
    expect(res.status).toBe(404);
  });
  
  test('applies correct cache headers', async () => {
    const res = await fetch('/api/market/options-overlay?ticker=SPX&strike=3000&expiry=2026-06-17&range=1M');
    expect(res.headers.get('cache-control')).toContain('max-age=900');
  });
});
```

### E2E Tests

**File:** `tests/e2e/options-overlay.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('displays option overlay on chart', async ({ page }) => {
  // Navigate to chart
  await page.goto('/chart?ticker=SPX');
  
  // Wait for chart to load
  await expect(page.locator('canvas')).toBeVisible();
  
  // Click "Add Option Overlay"
  await page.click('button:has-text("Add Option Overlay")');
  
  // Select strike, expiry, type
  await page.selectOption('[name="strike"]', '3000');
  await page.selectOption('[name="expiry"]', '2026-06-17');
  await page.selectOption('[name="optionType"]', 'call');
  
  // Apply overlay
  await page.click('button:has-text("Apply")');
  
  // Wait for API call and chart update
  await page.waitForResponse(/api\/market\/options-overlay/);
  
  // Verify legend shows both series
  await expect(page.locator('text=SPX')).toBeVisible();
  await expect(page.locator('text=SPX 3000C Jun17')).toBeVisible();
  
  // Verify tooltip shows both values on hover
  const canvas = page.locator('canvas');
  await canvas.hover({ position: { x: 200, y: 100 } });
  await expect(page.locator('[data-testid="tooltip"]')).toContainText('SPX:');
  await expect(page.locator('[data-testid="tooltip"]')).toContainText('3000C Jun17:');
});

test('toggles overlay on and off', async ({ page }) => {
  await page.goto('/chart?ticker=SPX');
  
  // Add overlay
  await page.click('button:has-text("Add Option Overlay")');
  // ... apply overlay steps ...
  
  // Toggle off
  await page.click('button:has-text("Clear")');
  
  // Verify legend only shows underlying
  await expect(page.locator('text=SPX 3000C Jun17')).not.toBeVisible();
});
```

### Integration Tests

**Database:**
- Verify `option_prices` table creation
- Test data insertion with unique constraint
- Query performance benchmarks (should return <100ms for 1Y range)

**API:**
- Test time range calculations
- Verify data merging logic handles misaligned timestamps
- Test cache hit/miss behavior

---

## Performance Considerations

### Database Optimization

1. **Indexes:** Composite index on `(ticker, strike, expiry_date, option_type, timestamp)` for fast lookups
2. **Query limits:** Cap query results at reasonable threshold (e.g., 10,000 points max)
3. **Pagination:** For very large ranges, consider server-side aggregation (daily bars instead of intraday)

### Frontend Optimization

1. **Data decimation:** For large datasets (>1000 points), apply client-side decimation before rendering
2. **Lazy loading:** Load option overlay data only when user activates it (not on initial page load)
3. **Debounce:** Debounce range selector changes to avoid rapid API calls

### Caching

1. **API-level:** Use Next.js built-in caching with appropriate `max-age`
2. **Client-level:** Cache fetched option data in component state, invalidate on range change
3. **Database-level:** SQLite query results are fast; no additional caching needed

**Expected Performance:**
- API response time: <500ms (1D), <1s (1Y)
- Chart render time: <1s for dual-series
- Total page load (including overlay): <2s

---

## Security & Validation

### Input Validation

```typescript
const VALID_TICKERS = ['SPX', 'SPY', /* ... */];
const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y'];
const VALID_OPTION_TYPES = ['call', 'put'];

function validateParams(params) {
  if (!VALID_TICKERS.includes(params.ticker)) {
    throw new Error('Invalid ticker');
  }
  
  if (params.strike <= 0 || params.strike > 10000) {
    throw new Error('Invalid strike');
  }
  
  if (!isValidISODate(params.expiry)) {
    throw new Error('Invalid expiry date');
  }
  
  if (!VALID_OPTION_TYPES.includes(params.optionType)) {
    throw new Error('Invalid option type');
  }
  
  if (!VALID_RANGES.includes(params.range)) {
    throw new Error('Invalid range');
  }
}
```

### Rate Limiting

- Apply same rate limits as existing market data API (if any)
- Consider stricter limits for options overlay (more expensive query)

### Data Privacy

- No user-specific data involved; all market data is public
- No authentication required (same as existing chart endpoints)

---

## Migration & Deployment

### Database Migration

**File:** `migrations/001_add_option_prices.sql`

```sql
-- Create option_prices table
CREATE TABLE IF NOT EXISTS option_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  strike REAL NOT NULL,
  expiry_date TEXT NOT NULL,
  option_type TEXT NOT NULL DEFAULT 'call',
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  bid REAL,
  ask REAL,
  volume INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
);

CREATE INDEX idx_option_prices_lookup 
  ON option_prices(ticker, strike, expiry_date, option_type, timestamp);

CREATE INDEX idx_option_prices_expiry 
  ON option_prices(expiry_date);
```

**Run via:**
```bash
npm run migrate
```

### Data Backfill

**Script:** `scripts/backfill-option-prices.ts`

```typescript
// Fetch SPX 3000 Jun17 2026 call prices from Yahoo Finance
// Insert into option_prices table
// Run once before deployment
```

**Command:**
```bash
npm run backfill -- --ticker SPX --strike 3000 --expiry 2026-06-17 --type call
```

### Deployment Checklist

- [ ] Run database migration
- [ ] Backfill option prices for SPX 3000 Jun17 2026 call
- [ ] Deploy API endpoint (Next.js build)
- [ ] Deploy frontend changes (Next.js build)
- [ ] Verify chart loads with overlay in staging
- [ ] Monitor API response times and error rates
- [ ] Check cache hit rates

---

## Extensibility

### Future Enhancements

1. **Multiple Overlays:** Support adding multiple option strikes to same chart
2. **Options Chain View:** Display full chain (all strikes for given expiry) as heatmap
3. **IV Overlay:** Add implied volatility series
4. **Greeks Overlay:** Delta, Gamma, Theta curves
5. **Live Streaming:** WebSocket support for real-time option price updates
6. **Strategy Builder:** Visualize multi-leg strategies (spreads, butterflies, etc.)
7. **Export:** Download chart + option data as CSV

### Design for Extension

- API supports any ticker/strike/expiry (not hardcoded to SPX 3000)
- Frontend component accepts dynamic config (not hardcoded)
- Database schema includes `option_type` for calls/puts
- All time ranges supported via single `range` parameter

---

## Open Questions

1. **Data Source:** Confirmed Yahoo Finance for MVP backfill?
2. **Axis Scaling:** Dual Y-axis vs. normalized % change—user preference?
3. **Historical Depth:** How many days of backfill data needed? (7, 30, 90, full contract life?)
4. **Bid/Ask Spread:** MVP shows mid-price only, or include spread shading?
5. **Error Handling:** If option data is missing for some timestamps, show partial overlay or error?

---

## Approval & Sign-off

- [ ] PM reviewed PRD alignment
- [ ] Tech Lead approved architecture
- [ ] Frontend Lead approved component design
- [ ] Backend Lead approved API/DB design
- [ ] QA reviewed test plan
- [ ] Security reviewed input validation

**Next Step:** Proceed to task breakdown and sprint planning.

---

**End of Design Document**
