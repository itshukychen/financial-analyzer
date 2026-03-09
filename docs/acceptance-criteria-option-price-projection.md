# Acceptance Criteria: Option Price Projection Feature

**Feature:** SPWX Put Options Price Projection Analysis  
**Version:** v0.2.0  
**Date:** 2026-03-09  
**Status:** Ready for QA Sign-Off

---

## Overview

This document defines the acceptance criteria for the Option Price Projection feature. A feature is **COMPLETE** when all criteria are met and signed off by QA, Product, and Engineering.

---

## Phase 1: Foundation (Database + Mock Data)

### Deliverable 1.1: Database Schema

**Component:** `lib/db.ts` + SQLite schema

**Acceptance Criteria:**

- [x] `option_snapshots` table exists with all required columns:
  - [ ] `id` (PRIMARY KEY, INTEGER)
  - [ ] `date` (TEXT, NOT NULL)
  - [ ] `ticker` (TEXT, NOT NULL)
  - [ ] `expiry` (TEXT, NOT NULL)
  - [ ] All volatility metrics (`iv_30d`, `iv_60d`, `hv_20d`, `hv_60d`, `iv_rank`)
  - [ ] All Greeks (`net_delta`, `atm_gamma`, `vega_per_1pct`, `theta_daily`)
  - [ ] Skew metrics (`call_otm_iv`, `put_otm_iv`, `skew_ratio`)
  - [ ] Implied move (`implied_move_pct`)
  - [ ] Regime classification
  - [ ] Raw JSON snapshot
  - [ ] Timestamps (`created_at`)

- [x] `option_projections` table exists with:
  - [ ] `id` (PRIMARY KEY)
  - [ ] `date`, `ticker`, `horizon_days`
  - [ ] `prob_distribution` (JSON text)
  - [ ] `key_levels` (JSON text)
  - [ ] `regime_classification`
  - [ ] `created_at` timestamp

- [x] Indexes created:
  - [ ] `idx_option_snapshots_date` on `(date DESC, ticker, expiry)`
  - [ ] `idx_option_projections_date` on `(date DESC, ticker)`

- [x] TypeScript types defined in `lib/db.ts`:
  - [ ] `OptionSnapshot` interface
  - [ ] `OptionProjection` interface
  - [ ] `ProbabilityPoint` interface
  - [ ] `KeyLevel` interface
  - [ ] `VolatilityRegime` type union

- [x] CRUD functions implemented:
  - [ ] `insertOptionSnapshot(snapshot): OptionSnapshot`
  - [ ] `getOptionSnapshot(date, ticker, expiry): OptionSnapshot | null`
  - [ ] `getLatestOptionSnapshot(ticker, expiry): OptionSnapshot | null`
  - [ ] `insertOptionProjection(projection): OptionProjection`
  - [ ] `getOptionProjection(date, ticker, horizonDays): OptionProjection | null`

- [x] All functions tested (unit tests passing)

**Test Coverage:** `npm test -- lib/db.test.ts`

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 1.2: Mock Data Generator

**Component:** `lib/mockOptionsData.ts`

**Acceptance Criteria:**

- [x] `generateMockOptionSnapshot(ticker, date)` function:
  - [ ] Returns complete `OptionSnapshot` (without id/created_at)
  - [ ] IV values: 18-24% (realistic range)
  - [ ] HV values: 16-22% (typically 1-2% below IV)
  - [ ] IV rank: 0-100
  - [ ] Delta: -100 to +100
  - [ ] Gamma: 0.001 to 0.004
  - [ ] Vega: 200-600
  - [ ] Theta: -120 to -40
  - [ ] Skew ratio: 0.9-1.1 (balanced market)
  - [ ] Implied move: 2-5%
  - [ ] Regime: correctly classified based on IV

- [x] `generateMockProbabilityDistribution(spotPrice, volatility, horizonDays)` function:
  - [ ] Returns array of 10-20 `ProbabilityPoint` objects
  - [ ] Prices centered around spot ±2% to ±5%
  - [ ] Probabilities sum to ≈ 1.0 (within 0.01)
  - [ ] Normal distribution shape (peak at spot)
  - [ ] Higher volatility → wider distribution
  - [ ] Longer horizon → wider distribution

- [x] `generateMockOptionChain(ticker)` function (bonus):
  - [ ] Returns complete option chain structure
  - [ ] Multiple strikes (95%, 100%, 105% ATM)
  - [ ] Calls and puts for each strike

- [x] Data is realistic:
  - [ ] IV < HV relationship respected
  - [ ] Skew presents put-heavy bias (realistic for equities)
  - [ ] Greeks consistent with Black-Scholes
  - [ ] No negative probabilities
  - [ ] All numerical values finite (no NaN/Infinity)

- [x] All functions tested and passing

**Test Coverage:** `npm test -- lib/mockOptionsData.test.ts`

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 1.3: Backfill Script

**Component:** `scripts/backfill-option-data.ts`

**Acceptance Criteria:**

- [x] Script exists and is executable
- [x] Creates 30 days of historical snapshots:
  - [ ] One entry per day (2026-02-07 through 2026-03-09)
  - [ ] All for ticker = 'SPWX'
  - [ ] Expiry = '30d'
  - [ ] Data realistic and varied (not identical)

- [x] Creates 30 days of projections:
  - [ ] Matching snapshot dates
  - [ ] Horizon = 30 days
  - [ ] Key levels include mode + 2SD bounds

- [x] npm script added to `package.json`:
  - [ ] `npm run backfill-options` works
  - [ ] Completes in < 5 seconds
  - [ ] Outputs success message

- [x] Data persists:
  - [ ] Can query 30 days with `getLatestOptionSnapshot('SPWX', '30d')`
  - [ ] Can retrieve specific date: `getOptionSnapshot('2026-03-09', 'SPWX', '30d')`

- [x] Script is idempotent:
  - [ ] Can run multiple times (UNIQUE constraint prevents duplicates)
  - [ ] No data corruption on re-run

**Verification:**
```bash
npm run backfill-options
sqlite3 data.db "SELECT COUNT(*) FROM option_snapshots WHERE ticker='SPWX';"
# Output: 30
```

**Sign-Off:** QA → ✅ / ❌

---

## Phase 2: Analytics Library

### Deliverable 2.1: Historical Volatility

**Component:** `lib/optionsAnalytics.ts`

**Acceptance Criteria:**

- [x] `calculateHistoricalVolatility(prices, window)` function:
  - [ ] Takes array of prices and window size
  - [ ] Returns annualized volatility as percentage
  - [ ] Correct formula: stddev(log_returns) * sqrt(252) * 100
  - [ ] Works for window = 20, 60, 252
  - [ ] Returns ~0 for constant prices
  - [ ] Throws error if `window > prices.length`

- [x] Test cases passing:
  - [ ] Known price series produces realistic HV (12-25%)
  - [ ] Constant prices → ~0% HV
  - [ ] High volatility prices → higher HV
  - [ ] Edge cases handled

**Test Coverage:** `npm test -- calculateHistoricalVolatility`

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 2.2: Greeks Calculations

**Component:** `lib/optionsAnalytics.ts`

**Acceptance Criteria:**

- [x] `calculateDelta(S, K, T, σ, r, type)` function:
  - [ ] ATM call delta ≈ 0.5
  - [ ] ITM call delta > 0.5, < 1.0
  - [ ] OTM call delta 0.0 to 0.5
  - [ ] Put delta = call delta - 1
  - [ ] Works for all expirations (1w to 1y)

- [x] `calculateGamma(S, K, T, σ, r)` function:
  - [ ] Always positive
  - [ ] Maximum at ATM
  - [ ] Decreases with distance from strike
  - [ ] Non-zero (not infinitesimal)

- [x] `calculateVega(S, K, T, σ, r)` function:
  - [ ] Always positive
  - [ ] Per 1% vol change
  - [ ] Significant value (>100)
  - [ ] Same for calls and puts

- [x] `calculateTheta(S, K, T, σ, r, type)` function:
  - [ ] Call theta typically negative (time decay hurts longs)
  - [ ] Put theta typically negative
  - [ ] Accelerates near expiration

- [x] All Greeks tested against known reference values:
  - [ ] Within 0.01 of published Black-Scholes tables
  - [ ] Delta: ±0.01 tolerance
  - [ ] Gamma: ±0.0001 tolerance
  - [ ] Vega: ±1 tolerance
  - [ ] Theta: ±0.1 tolerance

- [x] Boundary conditions handled:
  - [ ] Expiry → 0: Delta becomes 0/1 (binary)
  - [ ] Vol → 0: Greeks asymptote correctly
  - [ ] Deep ITM/OTM: Correct limits

**Test Coverage:** `npm test -- calculateDelta`, etc.

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 2.3: Volatility Regime Classification

**Component:** `lib/optionsAnalytics.ts`

**Acceptance Criteria:**

- [x] `classifyVolatilityRegime(currentIV, historicalIVs, thresholds)` function:
  - [ ] Takes current IV, array of historical IVs, percentile thresholds
  - [ ] Returns 'low' | 'normal' | 'high'
  - [ ] 'low': current IV < 20th percentile
  - [ ] 'high': current IV > 80th percentile
  - [ ] 'normal': between percentiles
  - [ ] Respects custom thresholds if provided

- [x] `calculateIVRank(currentIV, historicalIVs)` function:
  - [ ] Returns 0-100 percentile rank
  - [ ] Minimum IV → rank 0
  - [ ] Maximum IV → rank 100
  - [ ] Median IV → rank ~50

- [x] Regime classification tested:
  - [ ] Low, normal, high regimes all work
  - [ ] IV rank calculation accurate
  - [ ] Thresholds customizable
  - [ ] Edge cases handled (all same IV, single value, etc.)

**Test Coverage:** `npm test -- classifyVolatilityRegime`

**Sign-Off:** QA → ✅ / ❌

---

## Phase 3: API Layer

### Deliverable 3.1: GET `/api/options/snapshot`

**Component:** `app/api/options/snapshot/route.ts`

**Acceptance Criteria:**

- [x] Endpoint exists and is callable
- [x] Query parameters:
  - [ ] `?ticker` (optional, default 'SPWX')
  - [ ] `?expiry` (optional, default '30d')

- [x] Response schema:
  - [ ] Status: 200 (success) or 404 (no data)
  - [ ] JSON body with all required fields:
    - [ ] `ticker` (string)
    - [ ] `timestamp` (ISO 8601)
    - [ ] `expirations` (array)
    - [ ] `volatility` object (iv_30d, iv_60d, hv_20d, hv_60d, iv_rank)
    - [ ] `greeks` object (net_delta, atm_gamma, vega_per_1pct, theta_daily)
    - [ ] `skew` object (call_otm_iv, put_otm_iv, skew_ratio, skew_direction)
    - [ ] `implied_move` object (1w_move, 30d_move, confidence bands)
    - [ ] `regime` ('low' | 'normal' | 'high')

- [x] Data correctness:
  - [ ] IV_30d > 0
  - [ ] All Greeks are numbers (not null unless no data)
  - [ ] IV_rank 0-100
  - [ ] Skew ratio positive
  - [ ] Implied move positive

- [x] Caching:
  - [ ] Recent data (< 5 min old) returned from cache
  - [ ] Cache hit indicated in response headers
  - [ ] Cache headers set (`Cache-Control: max-age=300`)

- [x] Error handling:
  - [ ] 404 if no data for ticker
  - [ ] Error message in response
  - [ ] No 500 errors (graceful degradation)

- [x] Performance:
  - [ ] Response time < 200ms (cached)
  - [ ] Response time < 500ms (cache miss)

**Test Coverage:** `npm test -- api/options/snapshot.integration.test.ts`

**Verification:**
```bash
curl http://localhost:3003/api/options/snapshot
curl http://localhost:3003/api/options/snapshot?ticker=SPWX&expiry=30d
```

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 3.2: GET `/api/options/projection`

**Component:** `app/api/options/projection/route.ts`

**Acceptance Criteria:**

- [x] Endpoint exists and is callable
- [x] Query parameters:
  - [ ] `?ticker` (optional, default 'SPWX')
  - [ ] `?horizonDays` (optional, default 30)

- [x] Response schema:
  - [ ] Status: 200 or 404
  - [ ] JSON body:
    - [ ] `ticker` (string)
    - [ ] `date` (YYYY-MM-DD)
    - [ ] `expiry_horizon` (integer days)
    - [ ] `prob_distribution` (array of {price, probability})
    - [ ] `keyLevels` (array of {level, type, probability})
    - [ ] `regimeTransition` ({from, to, confidence})

- [x] Probability distribution valid:
  - [ ] Array of 10-20 points
  - [ ] Prices in realistic range (within ±10% of spot)
  - [ ] Probabilities sum to ≈ 1.0 (within 0.01)
  - [ ] All probabilities 0-1
  - [ ] No NaN or Infinity values

- [x] Key levels valid:
  - [ ] Mode level included
  - [ ] 2SD bounds included
  - [ ] Support/resistance levels optional
  - [ ] Types in enum (mode, 2sd_low, 2sd_high, etc.)

- [x] Performance:
  - [ ] Response time < 200ms

- [x] Error handling:
  - [ ] 404 if no projection data
  - [ ] No 500 errors

**Test Coverage:** `npm test -- api/options/projection.integration.test.ts`

**Verification:**
```bash
curl http://localhost:3003/api/options/projection?ticker=SPWX&horizonDays=30
```

**Sign-Off:** QA → ✅ / ❌

---

## Phase 4: UI Components

### Deliverable 4.1: Option Projection Widget

**Component:** `app/components/options/OptionProjectionWidget.tsx`

**Acceptance Criteria:**

- [x] Component renders on dashboard:
  - [ ] Visible in main grid (not broken layout)
  - [ ] Title "Option Projection" visible
  - [ ] Summary metrics displayed

- [x] Displays correct metrics:
  - [ ] Implied Move (1w): ±X.X% format
  - [ ] 30d IV: XX.X% format
  - [ ] IV Rank: 0-100
  - [ ] Regime indicator: "Low/Normal/High Volatility"

- [x] Regime color coding:
  - [ ] Low volatility: Green (🟢)
  - [ ] Normal volatility: Gray (⚪)
  - [ ] High volatility: Red (🔴)

- [x] Timestamp:
  - [ ] Shows last update time
  - [ ] Formatted in user timezone (ET)
  - [ ] Updates on refresh

- [x] Data loading:
  - [ ] Skeleton/loading state while fetching
  - [ ] Data appears when loaded
  - [ ] Error state if API fails
  - [ ] Graceful degradation (doesn't break dashboard)

- [x] Auto-refresh:
  - [ ] Refreshes every 5 minutes
  - [ ] Network request only once per 5min
  - [ ] No memory leaks on unmount

- [x] Click functionality:
  - [ ] "View Full Analysis" link navigates to `/reports/option-projection`
  - [ ] Link is visually obvious (colored, underlined)
  - [ ] Works on mobile (tap target > 44px)

- [x] Accessibility:
  - [ ] ARIA labels for metrics
  - [ ] Keyboard navigable
  - [ ] Screen reader announces values
  - [ ] Color not sole indicator (text + icon)

- [x] Responsive design:
  - [ ] Looks good at 375px (mobile)
  - [ ] Looks good at 1920px (desktop)
  - [ ] No overflow or text truncation
  - [ ] Touch-friendly on mobile

- [x] Performance:
  - [ ] Component renders in < 500ms
  - [ ] Initial load time < 300ms (FCP)
  - [ ] No unnecessary re-renders (React.memo if needed)

**Test Coverage:** `e2e/option-projection.spec.ts` (3.1)

**Manual Verification:**
- [ ] Open http://localhost:3003
- [ ] Widget visible (3rd position in grid)
- [ ] Data loaded (not "Loading...")
- [ ] Timestamp shows current time
- [ ] Click "View Full Analysis" → navigates to report

**Sign-Off:** QA → ✅ / ❌, Product → ✅ / ❌

---

### Deliverable 4.2: Option Projection Report Page

**Component:** `app/reports/option-projection/page.tsx`

**Acceptance Criteria:**

- [x] Page loads at `/reports/option-projection`:
  - [ ] Accessible without parameters
  - [ ] Uses today's date by default
  - [ ] URL works and is bookmarkable

- [x] Renders all 5 required sections:

#### Section A: Executive Summary
- [ ] Headline visible (AI-generated or templated)
- [ ] Shows 1-week projection range ($ values)
- [ ] Shows 4-week projection range ($ values)
- [ ] Includes confidence levels or interpretation

#### Section B: Put IV & Skew Metrics
- [ ] ATM IV displayed
- [ ] IV Rank displayed
- [ ] Skew ratio displayed
- [ ] IV/HV spread displayed
- [ ] Interpretation text explains skew direction
- [ ] "Put-heavy" or "call-heavy" clearly stated

#### Section C: Greeks Aggregates
- [ ] Net Delta displayed
- [ ] ATM Gamma displayed
- [ ] Vega (per 1%) displayed
- [ ] Theta (daily) displayed
- [ ] All values are numbers (not N/A)
- [ ] Grid layout (2x2 or responsive)

#### Section D: Probability Distribution
- [ ] Chart renders (Recharts histogram or similar)
- [ ] X-axis: price levels
- [ ] Y-axis: probability density
- [ ] Key levels marked as vertical lines (mode, 2SD bounds)
- [ ] Current price indicated
- [ ] Interactive tooltips work
- [ ] Chart responsive to viewport

#### Section E: AI-Generated Insights
- [ ] Themes/topics listed
- [ ] Actionable insights shown
- [ ] Text is readable and meaningful
- [ ] Grammar and spelling correct

- [x] Data loading and errors:
  - [ ] Loading state shown (spinner or skeleton)
  - [ ] Data appears when loaded
  - [ ] Error message if API fails
  - [ ] Retry button or clear next steps

- [x] Design consistency:
  - [ ] Uses existing site typography/colors
  - [ ] Consistent with other report pages
  - [ ] Headers/footers match
  - [ ] No broken styles

- [x] Responsive:
  - [ ] Mobile (375px): single column, readable
  - [ ] Tablet (768px): 2-column layout
  - [ ] Desktop (1920px): full layout
  - [ ] No horizontal scrolling

- [x] Performance:
  - [ ] Page loads in < 2s (TTI)
  - [ ] FCP < 1.5s
  - [ ] Charts render smoothly (60fps)
  - [ ] No janky animations

- [x] Accessibility:
  - [ ] WCAG AA compliant
  - [ ] Sufficient color contrast (4.5:1)
  - [ ] Charts have aria-labels
  - [ ] Keyboard navigation works
  - [ ] Focus indicators visible

**Test Coverage:** `e2e/option-projection.spec.ts` (3.2), `e2e/option-projection-a11y.spec.ts`

**Manual Verification:**
- [ ] Open http://localhost:3003/reports/option-projection
- [ ] All 5 sections visible
- [ ] Data populated (no placeholders)
- [ ] Charts render
- [ ] Test on mobile (use dev tools)
- [ ] Test keyboard navigation (Tab, Shift+Tab)
- [ ] Test screen reader (NVDA/JAWS or browser)

**Sign-Off:** QA → ✅ / ❌, Design → ✅ / ❌, Product → ✅ / ❌

---

### Deliverable 4.3: Navigation

**Component:** `app/components/Sidebar.tsx`, `app/page.tsx`

**Acceptance Criteria:**

- [x] Widget added to dashboard:
  - [ ] Appears in grid (3rd or 4th position)
  - [ ] Grid layout still balanced (no empty space)
  - [ ] Doesn't push other widgets off-screen

- [x] Sidebar link added:
  - [ ] "Option Projection" link visible in sidebar
  - [ ] Correct icon (TrendingUpIcon or similar)
  - [ ] Correct href: `/reports/option-projection`
  - [ ] Active state highlights when on report page
  - [ ] Mobile: menu collapses properly

**Manual Verification:**
- [ ] Open dashboard
- [ ] Widget visible in grid
- [ ] Click widget "View Full Analysis" → navigates
- [ ] Click sidebar link → navigates to report
- [ ] Both routes work

**Sign-Off:** QA → ✅ / ❌

---

## Phase 5: Integration & Polish

### Deliverable 5.1: End-to-End User Flow

**Test:** Widget → Report navigation

**Acceptance Criteria:**

- [x] Complete workflow functional:
  - [ ] Start at dashboard
  - [ ] Widget loads with data
  - [ ] Click "View Full Analysis"
  - [ ] Navigate to report page
  - [ ] Report page loads with data
  - [ ] All sections visible
  - [ ] No errors in console

- [x] No broken links:
  - [ ] All internal links work
  - [ ] External links (if any) open correctly
  - [ ] No 404s

- [x] No console errors:
  - [ ] Dev tools console is clean
  - [ ] No warnings (except expected ones)
  - [ ] No memory leaks (open/close page multiple times)

**Test Coverage:** `e2e/option-projection.spec.ts` (3.1.3)

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 5.2: Unit Test Coverage

**Acceptance Criteria:**

- [x] Analytics library tests:
  - [ ] Historical volatility: 4+ tests
  - [ ] Greeks (Delta, Gamma, Vega, Theta): 8+ tests
  - [ ] Regime classification: 5+ tests
  - [ ] Probability distribution: 3+ tests
  - [ ] All tests passing ✅

- [x] Database tests:
  - [ ] Insert snapshot: 1 test
  - [ ] Retrieve snapshot: 2 tests
  - [ ] Insert projection: 1 test
  - [ ] Retrieve projection: 1 test
  - [ ] Unique constraints: 1 test
  - [ ] All tests passing ✅

- [x] Mock data tests:
  - [ ] Snapshot generation: 2+ tests
  - [ ] Probability distribution: 3+ tests
  - [ ] Consistency checks: 1+ test
  - [ ] All tests passing ✅

- [x] Overall coverage:
  - [ ] `lib/optionsAnalytics.ts`: > 85% coverage
  - [ ] `lib/db.ts`: > 80% coverage
  - [ ] `lib/mockOptionsData.ts`: > 90% coverage

**Command:**
```bash
npm test -- --coverage
# Verify coverage thresholds met
```

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 5.3: API Integration Tests

**Acceptance Criteria:**

- [x] Endpoint tests:
  - [ ] GET `/api/options/snapshot`: 5+ tests (schema, data, errors, caching)
  - [ ] GET `/api/options/projection`: 5+ tests (schema, normalization, errors)
  - [ ] All tests passing ✅

- [x] Response validation:
  - [ ] Schema matches OpenAPI/TypeScript types
  - [ ] No extra/missing fields
  - [ ] Data types correct (number, string, array, object)
  - [ ] Enums valid ('low' | 'normal' | 'high', etc.)

**Command:**
```bash
npm test -- __tests__/api/options/
```

**Sign-Off:** QA → ✅ / ❌

---

### Deliverable 5.4: Performance Benchmarks

**Acceptance Criteria:**

- [x] Widget performance:
  - [ ] Initial load: < 500ms
  - [ ] First Contentful Paint (FCP): < 300ms
  - [ ] Time to Interactive (TTI): < 1s

- [x] Report page performance:
  - [ ] Page load (TTI): < 2s
  - [ ] FCP: < 1.5s
  - [ ] Largest Contentful Paint (LCP): < 2.5s

- [x] API performance:
  - [ ] `/api/options/snapshot`: < 200ms (cached), < 500ms (miss)
  - [ ] `/api/options/projection`: < 200ms

- [x] Memory usage:
  - [ ] Widget component: < 5MB
  - [ ] Report page: < 10MB
  - [ ] No memory leaks on unmount/remount

**Test Coverage:** `npm run test:perf`

**Tools:**
- Chrome DevTools (Lighthouse, Performance tab)
- WebPageTest
- Custom performance tests (see test-suite)

**Sign-Off:** QA → ✅ / ❌, Eng → ✅ / ❌

---

### Deliverable 5.5: Accessibility & WCAG AA

**Acceptance Criteria:**

- [x] Color contrast:
  - [ ] All text: 4.5:1 ratio (normal), 3:1 ratio (large)
  - [ ] axe-core: 0 contrast violations

- [x] Keyboard navigation:
  - [ ] All interactive elements focusable (Tab key)
  - [ ] No focus traps
  - [ ] Focus indicator visible
  - [ ] Logical tab order (left-to-right, top-to-bottom)

- [x] Screen reader support:
  - [ ] Headings: h1-h6 hierarchy correct
  - [ ] Forms: labels associated with inputs
  - [ ] Charts: aria-label or description provided
  - [ ] Meaningful alt text for images
  - [ ] ARIA roles used correctly

- [x] Semantic HTML:
  - [ ] Use `<button>` for buttons (not `<div onclick>`)
  - [ ] Use `<a>` for links
  - [ ] Use `<table>` for tabular data (if any)
  - [ ] Proper heading levels

- [x] Mobile accessibility:
  - [ ] Touch targets: 44px minimum
  - [ ] Readable at 200% zoom
  - [ ] Orientation support (landscape/portrait)

**Test Coverage:** `npm run test:a11y`, `e2e/option-projection-a11y.spec.ts`

**Tools:**
- axe DevTools browser extension
- WAVE
- Lighthouse (dev tools)
- Manual screen reader testing (NVDA/JAWS)

**Sign-Off:** QA → ✅ / ❌, A11y Lead → ✅ / ❌

---

### Deliverable 5.6: Documentation

**Acceptance Criteria:**

- [x] `README.md` updated:
  - [ ] New "Option Price Projection" section
  - [ ] Feature description
  - [ ] Link to report page
  - [ ] Data source (mock data for v0.2.0)
  - [ ] Integration instructions

- [x] `DEV.md` updated:
  - [ ] How to run backfill script
  - [ ] How to test APIs
  - [ ] Component locations
  - [ ] Database schema notes

- [x] Code comments:
  - [ ] Analytics functions documented (JSDoc)
  - [ ] Complex calculations explained
  - [ ] API routes documented
  - [ ] Component props documented

- [x] TypeScript types:
  - [ ] All types exported from `lib/db.ts`
  - [ ] Interface documentation
  - [ ] Enum values documented

**Sign-Off:** Eng → ✅ / ❌

---

## Sign-Off Matrix

| Deliverable | QA | Product | Eng | Design | A11y | Notes |
|---|---|---|---|---|---|---|
| 1.1 Database | ✅/❌ | - | ✅/❌ | - | - | Critical path |
| 1.2 Mock Data | ✅/❌ | - | ✅/❌ | - | - | |
| 1.3 Backfill | ✅/❌ | - | ✅/❌ | - | - | |
| 2.1 HV Calc | ✅/❌ | - | ✅/❌ | - | - | Critical path |
| 2.2 Greeks | ✅/❌ | - | ✅/❌ | - | - | Critical path |
| 2.3 Regime | ✅/❌ | - | ✅/❌ | - | - | |
| 3.1 Snapshot API | ✅/❌ | - | ✅/❌ | - | - | Critical path |
| 3.2 Projection API | ✅/❌ | - | ✅/❌ | - | - | Critical path |
| 4.1 Widget | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Critical path |
| 4.2 Report | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Critical path |
| 4.3 Navigation | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | - | |
| 5.1 E2E Flow | ✅/❌ | - | ✅/❌ | - | - | |
| 5.2 Unit Tests | ✅/❌ | - | ✅/❌ | - | - | |
| 5.3 API Tests | ✅/❌ | - | ✅/❌ | - | - | |
| 5.4 Performance | ✅/❌ | - | ✅/❌ | - | - | |
| 5.5 A11y | ✅/❌ | - | - | - | ✅/❌ | |
| 5.6 Docs | ✅/❌ | - | ✅/❌ | - | - | |

**Feature is COMPLETE when:**
- [ ] All critical path deliverables signed off ✅
- [ ] All tests passing (unit, integration, E2E, performance, a11y)
- [ ] No open blocking bugs
- [ ] Code review approved
- [ ] Performance targets met
- [ ] Zero accessibility violations (WCAG AA)
- [ ] Documentation complete
- [ ] Ready for production deployment

---

## Defect Classification

### P0 (Blocker)
- Feature completely non-functional
- Data loss or corruption
- Security vulnerability
- Crashes app

**Example:** Widget doesn't load, API returns 500, Greeks calculation is wrong

### P1 (Critical)
- Core feature broken but partially functional
- Major performance regression
- Significant accessibility issue

**Example:** Report page missing a section, 5+ second load time, no keyboard navigation

### P2 (Major)
- Feature works but with issues
- Minor performance impact
- Minor accessibility issue

**Example:** Color contrast slightly below 4.5:1, console warning, typo in text

### P3 (Minor)
- Nice-to-have improvements
- Non-critical bugs
- Polish

**Example:** Spacing off by 2px, animation doesn't feel smooth

---

## Regression Testing Checklist

Before final sign-off, test these areas to ensure no regressions:

- [ ] Dashboard still loads and renders other widgets
- [ ] Existing APIs unaffected
- [ ] Navigation to other pages works
- [ ] Database migrations don't affect other tables
- [ ] No new console errors or warnings
- [ ] Existing tests still pass

```bash
npm test                  # All tests
npm run dev              # Manual smoke test
npm run test:e2e         # E2E suite
```

---

## Go-Live Checklist

```bash
# 1. Run full test suite
npm test -- --coverage

# 2. Run E2E tests
npm run test:e2e

# 3. Run performance tests
npm run test:perf

# 4. Run accessibility tests
npm run test:a11y

# 5. Manual regression testing
# - Visit dashboard
# - Visit report page
# - Check mobile (Dev Tools)
# - Check keyboard navigation
# - Check with screen reader

# 6. Final verification
git status                 # No uncommitted changes
git log --oneline -5       # Recent commits present
npm run build             # Build succeeds
npm start                 # App starts cleanly
```

---

## Timeline

| Phase | Est. Duration | Target Date |
|---|---|---|
| Phase 1 | 4-6h | Day 1 (morning) |
| Phase 2 | 6-8h | Day 1-2 (afternoon) |
| Phase 3 | 4-6h | Day 2 (morning) |
| Phase 4 | 8-10h | Day 2-3 (afternoon/evening) |
| Phase 5 | 4-6h | Day 3-4 (morning) |
| **Total** | **26-36h** | **~3-4 days** |

**QA Sign-Off:** Day 4 (end of day)  
**Production Deployment:** Day 5

---

## Notes

- All acceptance criteria must be met for sign-off
- Any P0 or P1 bugs block deployment
- P2/P3 bugs can be deferred to v0.2.1
- Testing should be continuous (not just at end)
- Clear communication with stakeholders on progress
- Celebrate on launch! 🎉
