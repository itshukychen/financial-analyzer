# Task Breakdown: Option Price Projection Feature

**Epic:** SPWX Put Options Price Projection  
**Target:** v0.2.0  
**Branch:** `feature/option-price-projection`  
**Worktree:** `/home/claw/worktrees/financial-analyzer/feature/option-price-projection`  
**Port:** 3003

---

## Task Overview

```
Phase 1: Foundation (Database + Mock Data)      ← Start here
Phase 2: Analytics Library (IV, Greeks, HV)
Phase 3: API Layer (Endpoints + Business Logic)
Phase 4: UI Components (Widget + Report Page)
Phase 5: Integration + Polish
```

**Estimated Time:** 5-7 days (1 week sprint)

---

## Phase 1: Foundation (Database + Mock Data)

**Goal:** Set up database schema and generate test data

### Task 1.1: Extend Database Schema

**File:** `lib/db.ts`

**Actions:**
1. Add new table definitions to `SCHEMA_V2`:
   ```sql
   CREATE TABLE IF NOT EXISTS option_snapshots (
     -- see design doc for full schema
   );
   
   CREATE TABLE IF NOT EXISTS option_projections (
     -- see design doc for full schema
   );
   ```

2. Add TypeScript types:
   ```typescript
   export type VolatilityRegime = 'low' | 'normal' | 'high';
   export interface OptionSnapshot { /* ... */ }
   export interface OptionProjection { /* ... */ }
   ```

3. Add CRUD functions:
   ```typescript
   export function insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot;
   export function getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null;
   export function getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null;
   
   export function insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection;
   export function getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null;
   ```

4. Run migration:
   ```bash
   npm run dev  # triggers schema creation
   ```

**Test:**
```bash
# Unit test
npm test -- lib/db.test.ts
```

**Acceptance:**
- [ ] Tables created in SQLite DB
- [ ] CRUD functions work
- [ ] Unit tests pass

---

### Task 1.2: Create Mock Data Generator

**File:** `lib/mockOptionsData.ts`

**Actions:**
1. Create mock snapshot generator:
   ```typescript
   export function generateMockOptionSnapshot(ticker: string, date: string): Omit<OptionSnapshot, 'id' | 'created_at'> {
     const baseIV = 18 + Math.random() * 6; // 18-24%
     const hvSpread = -2 + Math.random() * 4;
     
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
       regime: baseIV < 16 ? 'low' : baseIV > 22 ? 'high' : 'normal',
       raw_json: JSON.stringify({ mockData: true }),
     };
   }
   ```

2. Create mock probability distribution generator:
   ```typescript
   export function generateMockProbabilityDistribution(
     spotPrice: number,
     volatility: number,
     horizonDays: number
   ): ProbabilityPoint[] {
     const numPoints = 15;
     const range = spotPrice * (volatility / 100) * Math.sqrt(horizonDays / 365);
     const distribution: ProbabilityPoint[] = [];
     
     for (let i = 0; i < numPoints; i++) {
       const price = spotPrice - range + (2 * range * i) / (numPoints - 1);
       const z = (price - spotPrice) / range;
       const probability = Math.exp(-0.5 * z ** 2) / Math.sqrt(2 * Math.PI);
       distribution.push({ price: Math.round(price), probability });
     }
     
     // Normalize
     const sum = distribution.reduce((acc, p) => acc + p.probability, 0);
     return distribution.map(p => ({ ...p, probability: p.probability / sum }));
   }
   ```

**Acceptance:**
- [ ] Mock data functions exist
- [ ] Generated data looks realistic

---

### Task 1.3: Backfill Script

**File:** `scripts/backfill-option-data.ts`

**Actions:**
1. Create backfill script:
   ```typescript
   import { insertOptionSnapshot, insertOptionProjection } from '../lib/db';
   import { generateMockOptionSnapshot, generateMockProbabilityDistribution } from '../lib/mockOptionsData';
   
   function getDateMinusDays(daysAgo: number): string {
     const date = new Date();
     date.setDate(date.getDate() - daysAgo);
     return date.toISOString().split('T')[0];
   }
   
   const BACKFILL_DAYS = 30;
   const TICKER = 'SPWX';
   const SPOT_PRICE = 475; // SPY price
   
   console.log(`Backfilling ${BACKFILL_DAYS} days of option data for ${TICKER}...`);
   
   for (let i = 0; i < BACKFILL_DAYS; i++) {
     const date = getDateMinusDays(i);
     
     // Snapshot
     const snapshot = generateMockOptionSnapshot(TICKER, date);
     insertOptionSnapshot(snapshot);
     
     // Projection (30-day horizon)
     const probDist = generateMockProbabilityDistribution(SPOT_PRICE, snapshot.iv_30d!, 30);
     const projection = {
       date,
       ticker: TICKER,
       horizon_days: 30,
       prob_distribution: probDist,
       key_levels: [
         { level: SPOT_PRICE, type: 'mode' as const, probability: 0.35 },
         { level: Math.round(SPOT_PRICE * 0.98), type: '2sd_low' as const, probability: null },
         { level: Math.round(SPOT_PRICE * 1.02), type: '2sd_high' as const, probability: null },
       ],
       regime_classification: snapshot.regime,
     };
     insertOptionProjection(projection);
   }
   
   console.log(`✅ Backfilled ${BACKFILL_DAYS} days`);
   ```

2. Add npm script to `package.json`:
   ```json
   "scripts": {
     "backfill-options": "tsx scripts/backfill-option-data.ts"
   }
   ```

3. Run it:
   ```bash
   npm run backfill-options
   ```

**Acceptance:**
- [ ] 30 rows in `option_snapshots` table
- [ ] 30 rows in `option_projections` table
- [ ] Data viewable via SQLite browser

---

## Phase 2: Analytics Library

**Goal:** Implement IV solver, Greeks, HV calculations

### Task 2.1: Historical Volatility

**File:** `lib/optionsAnalytics.ts`

**Actions:**
1. Create HV calculator:
   ```typescript
   /**
    * Calculate annualized historical volatility from price series
    */
   export function calculateHistoricalVolatility(prices: number[], window: number = 20): number {
     if (prices.length < window) {
       throw new Error('Insufficient data for HV calculation');
     }
     
     const recentPrices = prices.slice(-window);
     const logReturns: number[] = [];
     
     for (let i = 1; i < recentPrices.length; i++) {
       logReturns.push(Math.log(recentPrices[i] / recentPrices[i - 1]));
     }
     
     const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
     const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
     const dailyVol = Math.sqrt(variance);
     
     // Annualize (252 trading days)
     return dailyVol * Math.sqrt(252) * 100; // return as percentage
   }
   ```

**Test:**
```typescript
describe('calculateHistoricalVolatility', () => {
  it('should calculate 20-day HV', () => {
    const prices = [100, 101, 99, 102, 100, 103, 101, 104, 102, 105, 103, 106, 104, 107, 105, 108, 106, 109, 107, 110];
    const hv = calculateHistoricalVolatility(prices, 20);
    expect(hv).toBeGreaterThan(0);
    expect(hv).toBeLessThan(100);
  });
});
```

---

### Task 2.2: Greeks (Simplified)

**File:** `lib/optionsAnalytics.ts`

**Actions:**
1. Add helper functions:
   ```typescript
   /** Standard normal CDF approximation */
   function normalCDF(x: number): number {
     const t = 1 / (1 + 0.2316419 * Math.abs(x));
     const d = 0.3989423 * Math.exp(-x * x / 2);
     const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
     return x > 0 ? 1 - p : p;
   }
   
   /** Standard normal PDF */
   function normalPDF(x: number): number {
     return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
   }
   ```

2. Implement Delta:
   ```typescript
   export function calculateDelta(
     spotPrice: number,
     strike: number,
     timeToExpiry: number,  // in years
     volatility: number,     // decimal (e.g., 0.20 for 20%)
     riskFreeRate: number,   // decimal (e.g., 0.05 for 5%)
     optionType: 'call' | 'put'
   ): number {
     if (timeToExpiry <= 0 || volatility <= 0) return optionType === 'call' ? 1 : -1;
     
     const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) 
                / (volatility * Math.sqrt(timeToExpiry));
     
     return optionType === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;
   }
   ```

3. Implement Gamma:
   ```typescript
   export function calculateGamma(
     spotPrice: number,
     strike: number,
     timeToExpiry: number,
     volatility: number,
     riskFreeRate: number
   ): number {
     if (timeToExpiry <= 0 || volatility <= 0) return 0;
     
     const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) 
                / (volatility * Math.sqrt(timeToExpiry));
     
     return normalPDF(d1) / (spotPrice * volatility * Math.sqrt(timeToExpiry));
   }
   ```

4. Implement Vega (per 1% vol change):
   ```typescript
   export function calculateVega(
     spotPrice: number,
     strike: number,
     timeToExpiry: number,
     volatility: number,
     riskFreeRate: number
   ): number {
     if (timeToExpiry <= 0 || volatility <= 0) return 0;
     
     const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) 
                / (volatility * Math.sqrt(timeToExpiry));
     
     return spotPrice * Math.sqrt(timeToExpiry) * normalPDF(d1) / 100; // per 1% move
   }
   ```

5. Implement Theta (daily decay):
   ```typescript
   export function calculateTheta(
     spotPrice: number,
     strike: number,
     timeToExpiry: number,
     volatility: number,
     riskFreeRate: number,
     optionType: 'call' | 'put'
   ): number {
     if (timeToExpiry <= 0) return 0;
     
     const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) 
                / (volatility * Math.sqrt(timeToExpiry));
     const d2 = d1 - volatility * Math.sqrt(timeToExpiry);
     
     const term1 = -(spotPrice * volatility * normalPDF(d1)) / (2 * Math.sqrt(timeToExpiry));
     
     if (optionType === 'call') {
       const term2 = riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
       return (term1 - term2) / 365; // daily theta
     } else {
       const term2 = riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2);
       return (term1 + term2) / 365;
     }
   }
   ```

**Test:**
```typescript
describe('Greeks calculations', () => {
  const params = { S: 100, K: 100, T: 0.25, v: 0.20, r: 0.05 };
  
  it('should calculate ATM call delta ~0.5', () => {
    const delta = calculateDelta(params.S, params.K, params.T, params.v, params.r, 'call');
    expect(delta).toBeCloseTo(0.5, 1);
  });
  
  it('should calculate positive gamma', () => {
    const gamma = calculateGamma(params.S, params.K, params.T, params.v, params.r);
    expect(gamma).toBeGreaterThan(0);
  });
});
```

**Acceptance:**
- [ ] All Greek functions implemented
- [ ] Unit tests pass
- [ ] Greeks match reference values (use online calculator for validation)

---

### Task 2.3: Volatility Regime Classifier

**File:** `lib/optionsAnalytics.ts`

**Actions:**
1. Implement regime classifier:
   ```typescript
   export type VolatilityRegime = 'low' | 'normal' | 'high';
   
   export function classifyVolatilityRegime(
     currentIV: number,
     historicalIVs: number[],
     thresholds: { lowPercentile: number; highPercentile: number } = { lowPercentile: 0.20, highPercentile: 0.80 }
   ): VolatilityRegime {
     const sorted = [...historicalIVs].sort((a, b) => a - b);
     const lowThreshold = sorted[Math.floor(sorted.length * thresholds.lowPercentile)];
     const highThreshold = sorted[Math.floor(sorted.length * thresholds.highPercentile)];
     
     if (currentIV < lowThreshold) return 'low';
     if (currentIV > highThreshold) return 'high';
     return 'normal';
   }
   
   export function calculateIVRank(currentIV: number, historicalIVs: number[]): number {
     const countBelow = historicalIVs.filter(iv => iv < currentIV).length;
     return Math.round((countBelow / historicalIVs.length) * 100);
   }
   ```

**Test:**
```typescript
describe('classifyVolatilityRegime', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  
  it('should classify low regime', () => {
    expect(classifyVolatilityRegime(11, historical)).toBe('low');
  });
  
  it('should classify high regime', () => {
    expect(classifyVolatilityRegime(27, historical)).toBe('high');
  });
  
  it('should classify normal regime', () => {
    expect(classifyVolatilityRegime(18, historical)).toBe('normal');
  });
});
```

**Acceptance:**
- [ ] Regime classifier works
- [ ] IV rank calculation correct

---

## Phase 3: API Layer

**Goal:** Build REST endpoints for option data

### Task 3.1: GET `/api/options/snapshot`

**File:** `app/api/options/snapshot/route.ts`

**Actions:**
1. Create API route:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { getLatestOptionSnapshot } from '@/lib/db';
   import { generateMockOptionSnapshot } from '@/lib/mockOptionsData';
   
   export const dynamic = 'force-dynamic';
   
   export async function GET(req: NextRequest) {
     const ticker = req.nextUrl.searchParams.get('ticker') ?? 'SPWX';
     const expiry = req.nextUrl.searchParams.get('expiry') ?? '30d';
     
     try {
       // Fetch from DB
       const snapshot = getLatestOptionSnapshot(ticker, expiry);
       
       if (!snapshot) {
         return NextResponse.json({ error: 'No data available' }, { status: 404 });
       }
       
       // Format response
       const response = {
         ticker: snapshot.ticker,
         timestamp: new Date(snapshot.created_at * 1000).toISOString(),
         expirations: ['1w', '30d', '60d'],
         volatility: {
           iv_30d: snapshot.iv_30d,
           iv_60d: snapshot.iv_60d,
           hv_20d: snapshot.hv_20d,
           hv_60d: snapshot.hv_60d,
           iv_rank: snapshot.iv_rank,
           iv_percentile: snapshot.iv_rank ? snapshot.iv_rank / 100 : null,
         },
         greeks: {
           net_delta: snapshot.net_delta,
           atm_gamma: snapshot.atm_gamma,
           vega_per_1pct: snapshot.vega_per_1pct,
           theta_daily: snapshot.theta_daily,
         },
         skew: {
           call_otm_iv_25d: snapshot.call_otm_iv,
           put_otm_iv_25d: snapshot.put_otm_iv,
           skew_ratio: snapshot.skew_ratio,
           skew_direction: 
             snapshot.skew_ratio && snapshot.skew_ratio > 1.05 ? 'put_heavy' :
             snapshot.skew_ratio && snapshot.skew_ratio < 0.95 ? 'call_heavy' :
             'balanced',
         },
         implied_move: {
           '1w_move_pct': snapshot.implied_move_pct ? snapshot.implied_move_pct / 2 : null,
           '30d_move_pct': snapshot.implied_move_pct,
           // Calculate confidence bands (mock for now)
           '1w_conf_low': 475 * (1 - (snapshot.implied_move_pct || 2) / 200),
           '1w_conf_high': 475 * (1 + (snapshot.implied_move_pct || 2) / 200),
           '2sd_low': 475 * (1 - (snapshot.implied_move_pct || 2) / 100),
           '2sd_high': 475 * (1 + (snapshot.implied_move_pct || 2) / 100),
         },
         regime: snapshot.regime,
       };
       
       return NextResponse.json(response);
     } catch (error) {
       console.error('Error fetching option snapshot:', error);
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       );
     }
   }
   ```

**Test:**
```bash
curl http://localhost:3003/api/options/snapshot?ticker=SPWX
```

**Acceptance:**
- [ ] Returns 200 with valid JSON
- [ ] All fields present
- [ ] Matches response schema in design doc

---

### Task 3.2: GET `/api/options/projection`

**File:** `app/api/options/projection/route.ts`

**Actions:**
1. Create route:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { getOptionProjection, getLatestOptionSnapshot } from '@/lib/db';
   
   export const dynamic = 'force-dynamic';
   
   export async function GET(req: NextRequest) {
     const ticker = req.nextUrl.searchParams.get('ticker') ?? 'SPWX';
     const horizonDays = parseInt(req.nextUrl.searchParams.get('horizonDays') ?? '30');
     
     try {
       // Get latest date from snapshots
       const latestSnapshot = getLatestOptionSnapshot(ticker, '30d');
       if (!latestSnapshot) {
         return NextResponse.json({ error: 'No data available' }, { status: 404 });
       }
       
       const projection = getOptionProjection(latestSnapshot.date, ticker, horizonDays);
       if (!projection) {
         return NextResponse.json({ error: 'No projection data' }, { status: 404 });
       }
       
       return NextResponse.json({
         ticker: projection.ticker,
         date: projection.date,
         expiry_horizon: projection.horizon_days,
         prob_distribution: projection.prob_distribution,
         keyLevels: projection.key_levels,
         regimeTransition: {
           from: latestSnapshot.regime,
           to: projection.regime_classification,
           confidence: 0.75, // Mock confidence for now
         },
       });
     } catch (error) {
       console.error('Error fetching projection:', error);
       return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
     }
   }
   ```

**Test:**
```bash
curl http://localhost:3003/api/options/projection?ticker=SPWX&horizonDays=30
```

**Acceptance:**
- [ ] Returns probability distribution array
- [ ] Key levels included
- [ ] Regime transition present

---

## Phase 4: UI Components

**Goal:** Build widget and report page

### Task 4.1: Option Projection Widget

**File:** `app/components/options/OptionProjectionWidget.tsx`

**Actions:**
1. Create widget component:
   ```typescript
   'use client';
   
   import { useState, useEffect } from 'react';
   import Link from 'next/link';
   import StatCard from '@/app/components/StatCard';
   import type { DeltaDirection } from '@/app/types';
   
   interface SnapshotData {
     volatility: { iv_30d: number; iv_rank: number };
     implied_move: { '1w_move_pct': number };
     regime: 'low' | 'normal' | 'high';
     timestamp: string;
   }
   
   export default function OptionProjectionWidget() {
     const [data, setData] = useState<SnapshotData | null>(null);
     const [loading, setLoading] = useState(true);
     
     useEffect(() => {
       async function fetchData() {
         try {
           const res = await fetch('/api/options/snapshot?ticker=SPWX&expiry=30d');
           const json = await res.json();
           setData(json);
         } catch (error) {
           console.error('Failed to fetch option data:', error);
         } finally {
           setLoading(false);
         }
       }
       
       fetchData();
       const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min refresh
       return () => clearInterval(interval);
     }, []);
     
     if (loading) {
       return (
         <div className="widget-container loading">
           <div className="skeleton" />
         </div>
       );
     }
     
     if (!data) {
       return (
         <div className="widget-container error">
           <p>Unable to load option data</p>
         </div>
       );
     }
     
     const regimeColor = 
       data.regime === 'low' ? 'var(--gain)' :
       data.regime === 'high' ? 'var(--loss)' :
       'var(--text-muted)';
     
     const regimeLabel = 
       data.regime === 'low' ? '🟢 Low Volatility' :
       data.regime === 'high' ? '🔴 High Volatility' :
       '⚪ Normal Volatility';
     
     return (
       <div
         className="flex flex-col gap-4 rounded-lg p-6 border"
         style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
       >
         <header className="flex justify-between items-start">
           <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
             Option Projection
           </h3>
           <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
             Last updated: {new Date(data.timestamp).toLocaleTimeString('en-US', { 
               hour: 'numeric', 
               minute: '2-digit',
               timeZone: 'America/New_York'
             })} ET
           </span>
         </header>
         
         <div className="grid grid-cols-2 gap-3">
           <StatCard
             label="Implied Move (1w)"
             value={`±${data.implied_move['1w_move_pct'].toFixed(1)}%`}
             delta={undefined}
           />
           <StatCard
             label="30d IV"
             value={`${data.volatility.iv_30d.toFixed(1)}%`}
             delta={`Rank: ${data.volatility.iv_rank}`}
           />
         </div>
         
         <div
           className="text-center py-2 px-3 rounded-md text-sm font-semibold"
           style={{ color: regimeColor, background: `${regimeColor}22` }}
         >
           {regimeLabel}
         </div>
         
         <Link
           href="/reports/option-projection"
           className="text-sm font-medium hover:underline"
           style={{ color: 'var(--accent)' }}
         >
           View Full Analysis →
         </Link>
       </div>
     );
   }
   ```

2. Add to dashboard (`app/page.tsx`):
   ```typescript
   import OptionProjectionWidget from '@/app/components/options/OptionProjectionWidget';
   
   // Inside dashboard grid:
   <OptionProjectionWidget />
   ```

**Test:**
- Visit `http://localhost:3003`
- Widget should appear below existing widgets
- Click "View Full Analysis" → should navigate to report page

**Acceptance:**
- [ ] Widget renders on dashboard
- [ ] Shows IV, implied move, regime
- [ ] Auto-refreshes every 5 minutes
- [ ] Loading state works
- [ ] Link navigates correctly

---

### Task 4.2: Report Page Structure

**File:** `app/reports/option-projection/page.tsx`

**Actions:**
1. Create report page:
   ```typescript
   'use client';
   
   import { useState, useEffect } from 'react';
   import ReportHeader from '@/app/components/reports/ReportHeader';
   import ReportSection from '@/app/components/reports/ReportSection';
   import StatCard from '@/app/components/StatCard';
   import AppShell from '@/app/components/AppShell';
   
   export default function OptionProjectionReport() {
     const [snapshot, setSnapshot] = useState<any>(null);
     const [projection, setProjection] = useState<any>(null);
     const [loading, setLoading] = useState(true);
     
     useEffect(() => {
       async function fetchData() {
         try {
           const [snapshotRes, projectionRes] = await Promise.all([
             fetch('/api/options/snapshot?ticker=SPWX'),
             fetch('/api/options/projection?ticker=SPWX&horizonDays=30'),
           ]);
           
           const snapshotData = await snapshotRes.json();
           const projectionData = await projectionRes.json();
           
           setSnapshot(snapshotData);
           setProjection(projectionData);
         } catch (error) {
           console.error('Failed to fetch report data:', error);
         } finally {
           setLoading(false);
         }
       }
       
       fetchData();
     }, []);
     
     if (loading) {
       return (
         <AppShell>
           <div className="loading">Loading option analysis...</div>
         </AppShell>
       );
     }
     
     if (!snapshot || !projection) {
       return (
         <AppShell>
           <div className="error">Unable to load report data</div>
         </AppShell>
       );
     }
     
     return (
       <AppShell>
         <div className="report-container">
           <ReportHeader
             title="SPWX Option Price Projection"
             subtitle="Put Options Analysis & Price Forecasting"
             date={new Date().toISOString().split('T')[0]}
           />
           
           {/* Executive Summary */}
           <ReportSection title="Executive Summary">
             <div className="prose" style={{ color: 'var(--text-primary)' }}>
               <p className="text-lg font-semibold">
                 {getHeadline(snapshot)}
               </p>
               <div className="grid grid-cols-2 gap-4 mt-4">
                 <ProjectionCard 
                   horizon="1 Week" 
                   low={snapshot.implied_move['1w_conf_low'].toFixed(0)}
                   high={snapshot.implied_move['1w_conf_high'].toFixed(0)}
                 />
                 <ProjectionCard 
                   horizon="4 Weeks" 
                   low={snapshot.implied_move['2sd_low'].toFixed(0)}
                   high={snapshot.implied_move['2sd_high'].toFixed(0)}
                 />
               </div>
             </div>
           </ReportSection>
           
           {/* Put IV & Skew */}
           <ReportSection title="Put Implied Volatility & Skew">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <StatCard label="Put IV (ATM)" value={`${snapshot.volatility.iv_30d.toFixed(1)}%`} />
               <StatCard label="IV Rank" value={`${snapshot.volatility.iv_rank}`} />
               <StatCard label="Skew Ratio" value={snapshot.skew.skew_ratio.toFixed(2)} />
               <StatCard label="IV/HV Spread" value={`${(snapshot.volatility.iv_30d - snapshot.volatility.hv_20d).toFixed(1)}%`} />
             </div>
             <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
               {getSkewInterpretation(snapshot.skew)}
             </p>
           </ReportSection>
           
           {/* Greeks */}
           <ReportSection title="Greeks Aggregates">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <StatCard label="Net Delta" value={snapshot.greeks.net_delta.toFixed(0)} />
               <StatCard label="ATM Gamma" value={snapshot.greeks.atm_gamma.toFixed(4)} />
               <StatCard label="Vega (per 1%)" value={snapshot.greeks.vega_per_1pct.toFixed(0)} />
               <StatCard label="Theta (daily)" value={snapshot.greeks.theta_daily.toFixed(0)} />
             </div>
           </ReportSection>
           
           {/* Probability Distribution (placeholder for chart) */}
           <ReportSection title="Implied Price Distribution">
             <div className="h-64 flex items-center justify-center border rounded" style={{ borderColor: 'var(--border)' }}>
               <p style={{ color: 'var(--text-muted)' }}>
                 [Probability histogram chart - to be implemented]
               </p>
             </div>
             <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
               <p>Key levels:</p>
               <ul className="list-disc list-inside mt-2">
                 {projection.keyLevels.map((level: any) => (
                   <li key={level.level}>
                     {level.type}: ${level.level}
                   </li>
                 ))}
               </ul>
             </div>
           </ReportSection>
         </div>
       </AppShell>
     );
   }
   
   function ProjectionCard({ horizon, low, high }: { horizon: string; low: string; high: string }) {
     return (
       <div className="border rounded p-4" style={{ borderColor: 'var(--border)' }}>
         <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
           {horizon} Range
         </h4>
         <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
           ${low} - ${high}
         </p>
       </div>
     );
   }
   
   function getHeadline(snapshot: any): string {
     const regime = snapshot.regime;
     const skew = snapshot.skew.skew_direction;
     
     if (regime === 'high' && skew === 'put_heavy') {
       return '⚠️ High volatility + put hedging demand — downside protection expensive';
     } else if (regime === 'low' && skew === 'call_heavy') {
       return '📈 Low volatility + call demand — bullish sentiment';
     }
     return '📊 Normal volatility regime — balanced market';
   }
   
   function getSkewInterpretation(skew: any): string {
     if (skew.skew_direction === 'put_heavy') {
       return 'Puts are more expensive than calls (skew ratio > 1.05). Market participants are buying downside protection, indicating concern about potential drops.';
     } else if (skew.skew_direction === 'call_heavy') {
       return 'Calls are more expensive than puts (skew ratio < 0.95). This suggests bullish positioning and potential for upside moves.';
     }
     return 'Skew is balanced. No strong directional bias in option pricing.';
   }
   ```

**Test:**
- Navigate to `http://localhost:3003/reports/option-projection`
- All sections should render
- Data should populate from API

**Acceptance:**
- [ ] Report page accessible
- [ ] All sections render
- [ ] Data loads from APIs
- [ ] Mobile responsive
- [ ] Loading/error states work

---

### Task 4.3: Add Navigation Link

**File:** `app/components/Sidebar.tsx`

**Actions:**
1. Add option projection link:
   ```typescript
   {
     label: 'Option Projection',
     href: '/reports/option-projection',
     icon: <TrendingUpIcon />,  // or appropriate icon
   }
   ```

**Acceptance:**
- [ ] Link appears in sidebar
- [ ] Clicking navigates to report

---

## Phase 5: Integration + Polish

**Goal:** Connect everything, test, and optimize

### Task 5.1: Integration Testing

**Actions:**
1. Full user flow test:
   - Start dev server: `npm run dev`
   - Visit dashboard
   - Verify widget loads with data
   - Click "View Full Analysis"
   - Verify report page loads
   - Check all sections render
   - Test on mobile (responsive layout)

2. API testing:
   ```bash
   # Test snapshot endpoint
   curl http://localhost:3003/api/options/snapshot
   
   # Test projection endpoint
   curl http://localhost:3003/api/options/projection
   ```

**Acceptance:**
- [ ] Widget → Report flow works
- [ ] All APIs return valid data
- [ ] No console errors
- [ ] Mobile responsive

---

### Task 5.2: Unit Tests

**File:** `__tests__/lib/optionsAnalytics.test.ts`

**Actions:**
1. Write tests for analytics functions:
   ```typescript
   import { 
     calculateHistoricalVolatility, 
     calculateDelta, 
     calculateGamma,
     classifyVolatilityRegime 
   } from '@/lib/optionsAnalytics';
   
   describe('optionsAnalytics', () => {
     describe('calculateHistoricalVolatility', () => {
       it('should calculate HV from price series', () => {
         const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);
         const hv = calculateHistoricalVolatility(prices);
         expect(hv).toBeGreaterThan(0);
       });
     });
     
     describe('calculateDelta', () => {
       it('should return ~0.5 for ATM call', () => {
         const delta = calculateDelta(100, 100, 0.25, 0.20, 0.05, 'call');
         expect(delta).toBeCloseTo(0.5, 1);
       });
     });
     
     // Add more tests...
   });
   ```

**Run tests:**
```bash
npm test
```

**Acceptance:**
- [ ] All tests pass
- [ ] Coverage > 80% for analytics library

---

### Task 5.3: E2E Tests

**File:** `e2e/option-projection.spec.ts`

**Actions:**
1. Create E2E test:
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test.describe('Option Projection Feature', () => {
     test('should display widget on dashboard', async ({ page }) => {
       await page.goto('/');
       await expect(page.locator('text=Option Projection')).toBeVisible();
       await expect(page.locator('text=Implied Move')).toBeVisible();
     });
     
     test('should navigate to report page', async ({ page }) => {
       await page.goto('/');
       await page.click('text=View Full Analysis');
       await expect(page).toHaveURL(/\/reports\/option-projection/);
       await expect(page.locator('text=Executive Summary')).toBeVisible();
     });
     
     test('should load all report sections', async ({ page }) => {
       await page.goto('/reports/option-projection');
       
       await expect(page.locator('text=Put Implied Volatility')).toBeVisible();
       await expect(page.locator('text=Greeks')).toBeVisible();
       await expect(page.locator('text=Probability Distribution')).toBeVisible();
     });
   });
   ```

**Run E2E:**
```bash
npm run test:e2e
```

**Acceptance:**
- [ ] All E2E tests pass

---

### Task 5.4: Performance Audit

**Actions:**
1. Test widget load time:
   - Open DevTools Network tab
   - Measure time to first paint
   - Target: < 500ms

2. Test report page load:
   - Measure time to interactive
   - Target: < 2s

3. Optimize if needed:
   - Memoize expensive components
   - Lazy load charts
   - Use `React.memo` where appropriate

**Acceptance:**
- [ ] Widget loads in < 500ms
- [ ] Report loads in < 2s
- [ ] No unnecessary re-renders

---

### Task 5.5: Documentation

**Actions:**
1. Add section to `README.md`:
   ```markdown
   ## Option Price Projection
   
   Analyzes SPWX put options to project SPY price movements.
   
   - **Widget:** Dashboard quick view of IV, implied move, and regime
   - **Report:** `/reports/option-projection` - detailed analysis with Greeks, probability distributions, and AI insights
   
   ### Data Source
   Currently using mock data. To enable live data:
   1. Set `POLYGON_API_KEY` in `.env.local`
   2. Set `USE_MOCK_DATA=false`
   ```

2. Update `DEV.md` with:
   - How to run backfill script
   - How to test APIs
   - Component locations

**Acceptance:**
- [ ] README updated
- [ ] DEV.md updated
- [ ] Code comments added to complex functions

---

## Final Checklist

Before marking complete:

- [ ] Database schema created and migrated
- [ ] Mock data generated (30 days)
- [ ] Analytics library implemented (HV, Greeks, regime)
- [ ] API endpoints working (`/api/options/snapshot`, `/api/options/projection`)
- [ ] Widget renders on dashboard
- [ ] Report page accessible and functional
- [ ] Navigation link added
- [ ] Unit tests passing (> 80% coverage)
- [ ] E2E tests passing
- [ ] Performance targets met (widget < 500ms, report < 2s)
- [ ] Mobile responsive
- [ ] Documentation updated
- [ ] No console errors
- [ ] Branch committed and ready for PR

---

## Time Estimates

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | Database + Mock Data | 4-6 hours |
| Phase 2 | Analytics Library | 6-8 hours |
| Phase 3 | API Layer | 4-6 hours |
| Phase 4 | UI Components | 8-10 hours |
| Phase 5 | Integration + Polish | 4-6 hours |
| **Total** | | **26-36 hours** (3-5 days) |

---

## Notes for Engineer

- **Start with Phase 1** - get data foundation solid before building UI
- **Test each phase** before moving to next - easier to debug
- **Use existing components** - StatCard, ReportSection, etc. already styled
- **Mock data is OK for MVP** - real API integration comes in v0.2.1
- **Ask questions early** - if something is unclear, flag it
- **Commit often** - small commits are easier to review

Good luck! 🚀
