# Technical Design: Option Price Projection Feature

**Feature:** SPWX Put Options Price Projection Analysis  
**PRD:** [prd-option-price-projection.md](./prd-option-price-projection.md)  
**Target:** v0.2.0  
**Author:** Architect  
**Date:** 2026-03-09

---

## 1. Architecture Overview

### 1.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ MarketCharts     │  │ FearGreed        │                │
│  │ Widget           │  │ Widget           │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐                                       │
│  │ OptionProjection │  ← NEW                               │
│  │ Widget           │                                       │
│  └────────┬─────────┘                                       │
└───────────┼─────────────────────────────────────────────────┘
            │ click
            ↓
┌─────────────────────────────────────────────────────────────┐
│            /reports/[date]/option-projection                │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Executive Summary (AI headline + projections)      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Put IV & Skew Metrics                              │    │
│  │ - ATM IV, OTM IV, skew ratio                       │    │
│  │ - Historical vol comparison                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Greeks Aggregates (Delta, Gamma, Vega, Theta)      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Probability Distribution Chart                     │    │
│  │ - Histogram: price levels × probability            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Price Projection Table (1w, 4w ranges)             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ AI-Generated Put Thesis & Insights                 │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
┌─────────────────────┐
│  Market Data API    │  (Polygon.io / Mock)
│  (SPWX option chain)│
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ /api/options/       │
│   snapshot          │
│                     │
│ - Parse chain       │
│ - Calculate IV      │
│ - Compute Greeks    │
│ - Detect regime     │
└──────────┬──────────┘
           │
           ↓ save
┌─────────────────────┐
│   SQLite DB         │
│ option_snapshots    │
│ option_projections  │
└──────────┬──────────┘
           │
           ↓ read
┌─────────────────────┐
│ /api/options/       │
│   projection        │
│                     │
│ - Extract prob dist │
│ - Classify regime   │
│ - Key levels        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Widget + Report    │
│  Components         │
└─────────────────────┘
```

---

## 2. Database Schema Extensions

Extend `lib/db.ts` with new tables for option data.

### 2.1 New Tables

```sql
-- Store option chain snapshots with IV, Greeks, skew data
CREATE TABLE IF NOT EXISTS option_snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              TEXT    NOT NULL,     -- YYYY-MM-DD
  ticker            TEXT    NOT NULL,     -- 'SPWX'
  expiry            TEXT    NOT NULL,     -- '1w', '30d', '60d'
  
  -- Volatility metrics
  iv_30d            REAL,                 -- 30-day implied vol
  iv_60d            REAL,                 -- 60-day implied vol
  hv_20d            REAL,                 -- 20-day historical vol
  hv_60d            REAL,                 -- 60-day historical vol
  iv_rank           INTEGER,              -- percentile rank (0-100)
  
  -- Greeks
  net_delta         REAL,                 -- aggregate delta exposure
  atm_gamma         REAL,                 -- at-the-money gamma
  vega_per_1pct     REAL,                 -- vega sensitivity
  theta_daily       REAL,                 -- daily theta decay
  
  -- Skew
  call_otm_iv       REAL,                 -- out-of-money call IV
  put_otm_iv        REAL,                 -- out-of-money put IV
  skew_ratio        REAL,                 -- put_iv / call_iv
  
  -- Implied move
  implied_move_pct  REAL,                 -- % move implied by straddle
  
  -- Regime
  regime            TEXT,                 -- 'low' | 'normal' | 'high'
  
  -- Full snapshot JSON
  raw_json          TEXT,                 -- complete snapshot for debugging
  
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(date, ticker, expiry)
);

CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
  ON option_snapshots(date DESC, ticker, expiry);

-- Store probability distributions and projections
CREATE TABLE IF NOT EXISTS option_projections (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  date                    TEXT    NOT NULL,
  ticker                  TEXT    NOT NULL,
  horizon_days            INTEGER NOT NULL,  -- 7, 30, 90
  
  -- Probability distribution (JSON array of {price, probability})
  prob_distribution       TEXT    NOT NULL,  -- JSON
  
  -- Key price levels (JSON array of {level, type, probability})
  key_levels              TEXT    NOT NULL,  -- JSON
  
  -- Regime classification
  regime_classification   TEXT,
  
  created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(date, ticker, horizon_days)
);

CREATE INDEX IF NOT EXISTS idx_option_projections_date 
  ON option_projections(date DESC, ticker);
```

### 2.2 Database Module Extensions

Add to `lib/db.ts`:

```typescript
// ─── Option Types ─────────────────────────────────────────────────────────────

export type VolatilityRegime = 'low' | 'normal' | 'high';

export interface OptionSnapshot {
  id: number;
  date: string;
  ticker: string;
  expiry: string;
  iv_30d: number | null;
  iv_60d: number | null;
  hv_20d: number | null;
  hv_60d: number | null;
  iv_rank: number | null;
  net_delta: number | null;
  atm_gamma: number | null;
  vega_per_1pct: number | null;
  theta_daily: number | null;
  call_otm_iv: number | null;
  put_otm_iv: number | null;
  skew_ratio: number | null;
  implied_move_pct: number | null;
  regime: VolatilityRegime | null;
  raw_json: string;
  created_at: number;
}

export interface ProbabilityPoint {
  price: number;
  probability: number;
}

export interface KeyLevel {
  level: number;
  type: 'mode' | '2sd_low' | '2sd_high' | 'support' | 'resistance';
  probability: number | null;
}

export interface OptionProjection {
  id: number;
  date: string;
  ticker: string;
  horizon_days: number;
  prob_distribution: ProbabilityPoint[];
  key_levels: KeyLevel[];
  regime_classification: VolatilityRegime | null;
  created_at: number;
}

// ─── Option Functions ─────────────────────────────────────────────────────────

export function insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot;
export function getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null;
export function getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null;

export function insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection;
export function getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null;
```

---

## 3. Analytics Library

Create `lib/optionsAnalytics.ts` for IV calculations, Greeks, and volatility metrics.

### 3.1 Implied Volatility Solver

```typescript
/**
 * Calculate implied volatility using Black-Scholes model
 * Uses Newton-Raphson iteration for convergence
 */
export function calculateImpliedVolatility(
  optionPrice: number,
  spotPrice: number,
  strike: number,
  timeToExpiry: number,  // in years
  riskFreeRate: number,
  optionType: 'call' | 'put',
  tolerance: number = 0.0001,
  maxIterations: number = 100
): number | null {
  // Implementation of Black-Scholes IV solver
  // Returns null if no convergence
}
```

### 3.2 Greeks Calculations

```typescript
export interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export function calculateGreeks(
  spotPrice: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'call' | 'put'
): Greeks {
  // Analytic Black-Scholes formulas for Greeks
}

export function aggregateGreeks(
  positions: Array<{
    strike: number;
    quantity: number;
    openInterest: number;
    optionType: 'call' | 'put';
  }>,
  spotPrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): Greeks {
  // Aggregate Greeks across option chain
}
```

### 3.3 Historical Volatility

```typescript
export function calculateHistoricalVolatility(
  prices: number[],
  window: number = 20
): number {
  // Calculate HV using log returns and standard deviation
  // Returns annualized volatility
}
```

### 3.4 Volatility Regime Classification

```typescript
export interface RegimeThresholds {
  lowPercentile: number;   // e.g., 0.20 (20th percentile)
  highPercentile: number;  // e.g., 0.80 (80th percentile)
}

export function classifyVolatilityRegime(
  currentIV: number,
  historicalIVs: number[],
  thresholds: RegimeThresholds = { lowPercentile: 0.20, highPercentile: 0.80 }
): VolatilityRegime {
  // Calculate percentile rank of current IV
  // Return 'low' | 'normal' | 'high'
}
```

### 3.5 Probability Distribution

```typescript
export function calculateProbabilityDistribution(
  spotPrice: number,
  optionChain: Array<{
    strike: number;
    callPrice: number;
    putPrice: number;
  }>,
  timeToExpiry: number,
  riskFreeRate: number
): ProbabilityPoint[] {
  // Breeden-Litzenberger density extraction
  // or straddle-based approximation
  // Returns array of {price, probability}
}
```

---

## 4. API Design

### 4.1 GET `/api/options/snapshot`

**Purpose:** Fetch current option metrics for a ticker  
**Query Params:**
- `ticker` (optional, default: 'SPWX')
- `expiry` (optional, default: '30d')

**Response:**
```typescript
{
  ticker: string;
  timestamp: string;          // ISO 8601
  expirations: string[];      // ['1w', '30d', '60d']
  volatility: {
    iv_30d: number;
    iv_60d: number;
    hv_20d: number;
    hv_60d: number;
    iv_rank: number;          // 0-100
    iv_percentile: number;    // 0.0-1.0
  };
  greeks: {
    net_delta: number;
    atm_gamma: number;
    vega_per_1pct: number;
    theta_daily: number;
  };
  skew: {
    call_otm_iv_25d: number;
    put_otm_iv_25d: number;
    skew_ratio: number;
    skew_direction: 'call_heavy' | 'put_heavy' | 'balanced';
  };
  implied_move: {
    '1w_move_pct': number;
    '30d_move_pct': number;
    '1w_conf_low': number;
    '1w_conf_high': number;
    '2sd_low': number;
    '2sd_high': number;
  };
  regime: VolatilityRegime;
}
```

**Implementation:**
```typescript
// app/api/options/snapshot/route.ts
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'SPWX';
  const expiry = req.nextUrl.searchParams.get('expiry') ?? '30d';
  
  // 1. Fetch from DB (latest snapshot)
  const cached = getLatestOptionSnapshot(ticker, expiry);
  
  // 2. If fresh (< 5 min old), return cached
  if (cached && isFresh(cached.created_at, 5 * 60)) {
    return NextResponse.json(parseSnapshot(cached));
  }
  
  // 3. Otherwise, fetch from market data API
  const marketData = await fetchOptionChain(ticker);
  
  // 4. Calculate metrics
  const snapshot = calculateOptionMetrics(marketData, expiry);
  
  // 5. Save to DB
  insertOptionSnapshot(snapshot);
  
  // 6. Return formatted response
  return NextResponse.json(snapshot);
}
```

### 4.2 GET `/api/options/projection`

**Purpose:** Get price projections and probability distributions  
**Query Params:**
- `ticker` (optional, default: 'SPWX')
- `horizonDays` (optional, default: 30)

**Response:**
```typescript
{
  ticker: string;
  date: string;
  expiry_horizon: number;
  prob_distribution: Array<{
    price: number;
    probability: number;
  }>;
  keyLevels: Array<{
    level: number;
    type: 'mode' | '2sd_low' | '2sd_high' | 'support' | 'resistance';
    probability: number | null;
  }>;
  regimeTransition: {
    from: VolatilityRegime;
    to: VolatilityRegime;
    confidence: number;
  };
}
```

### 4.3 POST `/api/options/analyze` (AI Narrative)

**Purpose:** Generate AI insights using Claude  
**Body:**
```typescript
{
  ticker: string;
  reportDate: string;
}
```

**Response:**
```typescript
{
  headline: string;
  themes: string[];
  actionable_insights: string[];
}
```

**Implementation:**
- Reuse existing Claude integration from `scripts/generate-report.ts`
- Build prompt with option metrics from DB
- Return structured AI response

---

## 5. UI Components

### 5.1 Dashboard Widget: `OptionProjectionWidget.tsx`

**Location:** `app/components/options/OptionProjectionWidget.tsx`

**Props:** None (self-contained, fetches own data)

**Features:**
- Displays 30d IV, implied move, skew direction
- Color-coded regime indicator
- Trend arrow (↑↓ vs 5-day average)
- Loading skeleton
- Click → navigate to `/reports/option-projection`

**Layout:**
```tsx
<div className="widget">
  <header>
    <h3>Option Projection</h3>
    <span className="timestamp">Last updated: {time}</span>
  </header>
  
  <div className="metrics">
    <StatCard 
      label="Implied Move (1w)"
      value={`±${move}%`}
      delta={trendDelta}
      deltaDirection={trendDirection}
    />
    <StatCard 
      label="30d IV"
      value={`${iv}%`}
      delta={ivChange}
    />
    <div className="regime-badge" style={{color: regimeColor}}>
      {regime} volatility
    </div>
  </div>
  
  <Link href="/reports/option-projection">
    View Full Analysis →
  </Link>
</div>
```

**Data Fetching:**
```tsx
const { data, isLoading } = useSWR('/api/options/snapshot?ticker=SPWX&expiry=30d', fetcher, {
  refreshInterval: 5 * 60 * 1000, // 5 minutes
});
```

### 5.2 Report Page: `/reports/[date]/option-projection.tsx`

**Sections:**

#### A. Executive Summary
```tsx
<ReportSection title="Executive Summary">
  <div className="headline">{aiHeadline}</div>
  <div className="projections">
    <ProjectionCard horizon="1 week" range={week1Range} />
    <ProjectionCard horizon="4 weeks" range={week4Range} />
  </div>
</ReportSection>
```

#### B. Put IV & Skew
```tsx
<ReportSection title="Put Implied Volatility & Skew">
  <div className="grid">
    <StatCard label="Put IV (ATM)" value={`${atmIv}%`} delta={ivChange} />
    <StatCard label="Put IV (OTM)" value={`${otmIv}%`} />
    <StatCard label="Skew Ratio" value={skewRatio.toFixed(2)} />
    <StatCard label="IV/HV Spread" value={`+${spread} bps`} />
  </div>
  <p className="interpretation">
    {skewRatio > 1 
      ? "Puts more expensive than calls — market buying downside protection"
      : "Calls more expensive — bullish bias"}
  </p>
</ReportSection>
```

#### C. Greeks Aggregates
```tsx
<ReportSection title="Greeks Summary">
  <div className="greeks-grid">
    <GreekCard name="Delta" value={delta} />
    <GreekCard name="Gamma" value={gamma} />
    <GreekCard name="Vega" value={vega} />
    <GreekCard name="Theta" value={theta} />
  </div>
</ReportSection>
```

#### D. Probability Distribution
```tsx
<ReportSection title="Implied Price Distribution">
  <ProbabilityHistogram 
    data={probDistribution} 
    keyLevels={keyLevels}
    currentPrice={spotPrice}
  />
</ReportSection>
```

#### E. AI Thesis
```tsx
<ReportSection title="AI-Generated Put Thesis">
  <div className="themes">
    {themes.map(theme => (
      <ThemeCard key={theme} content={theme} />
    ))}
  </div>
  <div className="insights">
    <h4>Actionable Insights</h4>
    <ul>
      {insights.map(insight => (
        <li key={insight}>{insight}</li>
      ))}
    </ul>
  </div>
</ReportSection>
```

### 5.3 Supporting Components

**`VolatilityCurve.tsx`**
- Recharts line chart
- X-axis: expiration dates
- Y-axis: IV %
- Multiple series: ATM IV, OTM call IV, OTM put IV

**`SkewChart.tsx`**
- Bar chart: skew ratio over time
- Color: green (call-heavy), red (put-heavy)

**`ProbabilityHistogram.tsx`**
- Recharts bar chart
- X-axis: price levels
- Y-axis: probability density
- Overlays: key levels as vertical lines

---

## 6. Mock Data Strategy (MVP)

For MVP, use mock data generator until market API is integrated.

### 6.1 Mock Data Generator

**File:** `lib/mockOptionsData.ts`

```typescript
export function generateMockOptionSnapshot(ticker: string, date: string): OptionSnapshot {
  const baseIV = 18 + Math.random() * 6; // 18-24%
  const hvSpread = -2 + Math.random() * 4; // HV typically lower
  
  return {
    date,
    ticker,
    expiry: '30d',
    iv_30d: baseIV,
    iv_60d: baseIV + Math.random() * 2,
    hv_20d: baseIV + hvSpread,
    hv_60d: baseIV + hvSpread - 1,
    iv_rank: Math.floor(Math.random() * 100),
    net_delta: -50 + Math.random() * 100,
    atm_gamma: 0.001 + Math.random() * 0.002,
    vega_per_1pct: 400 + Math.random() * 200,
    theta_daily: -80 - Math.random() * 40,
    call_otm_iv: baseIV + Math.random() * 2,
    put_otm_iv: baseIV + Math.random() * 3,
    skew_ratio: 0.95 + Math.random() * 0.2,
    implied_move_pct: 2 + Math.random() * 3,
    regime: classifyRegime(baseIV),
    raw_json: JSON.stringify({}),
  };
}

export function generateMockProbabilityDistribution(
  spotPrice: number, 
  volatility: number, 
  horizon: number
): ProbabilityPoint[] {
  // Generate normal distribution around spot
  // Adjust width based on volatility and horizon
}
```

### 6.2 Backfill Script

**File:** `scripts/backfill-option-data.ts`

```typescript
import { insertOptionSnapshot, insertOptionProjection } from '../lib/db';
import { generateMockOptionSnapshot, generateMockProbabilityDistribution } from '../lib/mockOptionsData';

const BACKFILL_DAYS = 30;
const TICKER = 'SPWX';

for (let i = 0; i < BACKFILL_DAYS; i++) {
  const date = getDateMinusDays(i);
  const snapshot = generateMockOptionSnapshot(TICKER, date);
  insertOptionSnapshot(snapshot);
  
  const projection = {
    date,
    ticker: TICKER,
    horizon_days: 30,
    prob_distribution: generateMockProbabilityDistribution(4800, snapshot.iv_30d, 30),
    key_levels: [
      { level: 4800, type: 'mode', probability: 0.35 },
      { level: 4680, type: '2sd_low', probability: null },
      { level: 4920, type: '2sd_high', probability: null },
    ],
    regime_classification: snapshot.regime,
  };
  insertOptionProjection(projection);
}

console.log(`✅ Backfilled ${BACKFILL_DAYS} days of option data`);
```

---

## 7. Integration Points

### 7.1 Market Data API (Future)

**Polygon.io Integration:**
```typescript
// lib/marketData.ts
export async function fetchOptionChain(ticker: string): Promise<OptionChain> {
  const apiKey = process.env.POLYGON_API_KEY;
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?apiKey=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  return parsePolygonOptionChain(data);
}
```

**Fallback to Mock:**
```typescript
export async function getOptionChainWithFallback(ticker: string): Promise<OptionChain> {
  if (process.env.USE_MOCK_DATA === 'true') {
    return generateMockOptionChain(ticker);
  }
  
  try {
    return await fetchOptionChain(ticker);
  } catch (error) {
    console.warn('Market API failed, using mock data:', error);
    return generateMockOptionChain(ticker);
  }
}
```

### 7.2 Dashboard Integration

Add widget to dashboard grid in `app/page.tsx`:

```tsx
import OptionProjectionWidget from '@/app/components/options/OptionProjectionWidget';

export default function Dashboard() {
  return (
    <div className="dashboard-grid">
      <MarketChartsWidget />
      <FearGreedWidget />
      <OptionProjectionWidget />  {/* NEW */}
    </div>
  );
}
```

### 7.3 Navigation

Add link to sidebar in `app/components/Sidebar.tsx`:

```tsx
{
  label: 'Option Projection',
  href: '/reports/option-projection',
  icon: <TrendingUpIcon />,
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Volatility Calculations:**
```typescript
// __tests__/lib/optionsAnalytics.test.ts
describe('calculateImpliedVolatility', () => {
  it('should converge for ATM call', () => {
    const iv = calculateImpliedVolatility(10, 100, 100, 0.5, 0.05, 'call');
    expect(iv).toBeCloseTo(0.20, 2);
  });
  
  it('should return null for invalid inputs', () => {
    const iv = calculateImpliedVolatility(-10, 100, 100, 0.5, 0.05, 'call');
    expect(iv).toBeNull();
  });
});
```

**Regime Classification:**
```typescript
describe('classifyVolatilityRegime', () => {
  it('should classify low regime correctly', () => {
    const regime = classifyVolatilityRegime(12, [10, 12, 15, 18, 20, 22, 25]);
    expect(regime).toBe('low');
  });
});
```

### 8.2 Integration Tests

**API Routes:**
```typescript
// __tests__/api/options/snapshot.test.ts
describe('GET /api/options/snapshot', () => {
  it('should return snapshot for default ticker', async () => {
    const res = await fetch('/api/options/snapshot');
    const data = await res.json();
    
    expect(data.ticker).toBe('SPWX');
    expect(data.volatility.iv_30d).toBeGreaterThan(0);
  });
});
```

### 8.3 E2E Tests

**Widget → Report Flow:**
```typescript
// e2e/option-projection.spec.ts
test('should navigate from widget to full report', async ({ page }) => {
  await page.goto('/');
  
  // Click widget
  await page.click('text=Option Projection');
  await page.click('text=View Full Analysis');
  
  // Verify report page
  await expect(page).toHaveURL(/\/reports\/option-projection/);
  await expect(page.locator('text=Executive Summary')).toBeVisible();
  await expect(page.locator('text=Put Implied Volatility')).toBeVisible();
});
```

---

## 9. Performance Considerations

### 9.1 Caching Strategy
- **Widget data:** SWR with 5-minute refresh
- **Report data:** Server-side cache (5 min TTL)
- **Database queries:** Index on `(date DESC, ticker)` for fast lookups

### 9.2 Lazy Loading
- Charts load on viewport intersection (use `IntersectionObserver`)
- Probability distribution data fetched separately (not in initial snapshot)

### 9.3 Optimization
- Memoize expensive calculations (IV solver, Greeks)
- Debounce user interactions (date picker, ticker search)
- Use `React.memo` for static components

---

## 10. Deployment Checklist

- [ ] Database migration script added to `lib/db.ts`
- [ ] Mock data backfill script executed (`npm run backfill-options`)
- [ ] Environment variable `USE_MOCK_DATA=true` set
- [ ] Widget added to dashboard
- [ ] Report page accessible at `/reports/option-projection`
- [ ] All unit tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Performance audit (Lighthouse): widget <500ms, report <2s
- [ ] Mobile responsive (test on iPhone, Android)
- [ ] Accessibility audit (axe-core, keyboard navigation)

---

## 11. Future Enhancements (v0.2.1+)

1. **Real market data integration** (Polygon.io API)
2. **Multi-ticker support** (SPY, QQQ, IWM)
3. **Regime change alerts** (Telegram notifications)
4. **Historical volatility backtesting** (compare projected vs actual moves)
5. **Options flow analysis** (large block trades, unusual activity)
6. **Strategy analyzer** (iron condors, butterflies, spreads)

---

## Appendix A: Black-Scholes Formulas

```typescript
// Standard normal CDF
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Black-Scholes call price
function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

// Greeks (analytic formulas)
function delta(S: number, K: number, T: number, sigma: number, type: 'call' | 'put'): number {
  const d1 = (Math.log(S / K) + 0.5 * sigma ** 2 * T) / (sigma * Math.sqrt(T));
  return type === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;
}

function gamma(S: number, K: number, T: number, sigma: number): number {
  const d1 = (Math.log(S / K) + 0.5 * sigma ** 2 * T) / (sigma * Math.sqrt(T));
  return Math.exp(-0.5 * d1 ** 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
}

function vega(S: number, K: number, T: number, sigma: number): number {
  const d1 = (Math.log(S / K) + 0.5 * sigma ** 2 * T) / (sigma * Math.sqrt(T));
  return S * Math.sqrt(T) * Math.exp(-0.5 * d1 ** 2) / Math.sqrt(2 * Math.PI);
}

function theta(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put'): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const term1 = -(S * sigma * Math.exp(-0.5 * d1 ** 2)) / (2 * Math.sqrt(2 * Math.PI * T));
  
  if (type === 'call') {
    return term1 - r * K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return term1 + r * K * Math.exp(-r * T) * normalCDF(-d2);
  }
}
```
