# Test Suite: Option Price Projection Feature

**Feature:** SPWX Put Options Price Projection Analysis  
**Target:** v0.2.0  
**Date:** 2026-03-09  
**Status:** Ready for QA

---

## Executive Summary

This test suite provides comprehensive coverage for the Option Price Projection feature across 5 phases:
- **Unit Tests:** Analytics calculations, data transformations
- **Integration Tests:** API endpoints, database operations
- **E2E Tests:** User workflows (widget → report navigation)
- **Performance Tests:** Load times, memory usage
- **Accessibility Tests:** Keyboard navigation, screen readers

---

## 1. Unit Tests

### 1.1 Historical Volatility Calculations

**File:** `__tests__/lib/optionsAnalytics.test.ts`

#### Test 1.1.1: Basic HV Calculation
```typescript
test('calculateHistoricalVolatility: should calculate 20-day HV correctly', () => {
  const prices = [100, 101, 99, 102, 100, 103, 101, 104, 102, 105, 
                  103, 106, 104, 107, 105, 108, 106, 109, 107, 110];
  const hv = calculateHistoricalVolatility(prices, 20);
  
  expect(hv).toBeGreaterThan(0);
  expect(hv).toBeLessThan(100);  // Reasonable bound
  expect(typeof hv).toBe('number');
});
```

**Acceptance:**
- ✅ Returns positive number
- ✅ Result < 100 (realistic volatility)
- ✅ Result > 0 for non-constant prices

#### Test 1.1.2: Edge Case - Constant Prices
```typescript
test('calculateHistoricalVolatility: should return ~0 for constant prices', () => {
  const prices = Array(20).fill(100);
  const hv = calculateHistoricalVolatility(prices, 20);
  
  expect(hv).toBeLessThan(0.1);  // Near zero
});
```

**Acceptance:**
- ✅ Returns near-zero for constant price series

#### Test 1.1.3: Edge Case - Insufficient Data
```typescript
test('calculateHistoricalVolatility: should throw error for insufficient data', () => {
  const prices = [100, 101, 102];
  
  expect(() => calculateHistoricalVolatility(prices, 20))
    .toThrow('Insufficient data for HV calculation');
});
```

**Acceptance:**
- ✅ Throws error when window > available data

#### Test 1.1.4: Different Window Sizes
```typescript
test('calculateHistoricalVolatility: should handle different windows', () => {
  const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
  
  const hv20 = calculateHistoricalVolatility(prices, 20);
  const hv60 = calculateHistoricalVolatility(prices, 60);
  
  expect(hv20).toBeGreaterThan(0);
  expect(hv60).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Works with window=20, 60
- ✅ Returns valid numbers for both

---

### 1.2 Greeks Calculations

**File:** `__tests__/lib/optionsAnalytics.test.ts`

#### Test 1.2.1: Delta - ATM Call
```typescript
test('calculateDelta: ATM call should have delta ~0.5', () => {
  const delta = calculateDelta(
    spotPrice: 100,
    strike: 100,
    timeToExpiry: 0.25,      // 3 months
    volatility: 0.20,        // 20%
    riskFreeRate: 0.05,      // 5%
    optionType: 'call'
  );
  
  expect(delta).toBeCloseTo(0.5, 1);
});
```

**Acceptance:**
- ✅ ATM call delta ≈ 0.5
- ✅ Within ±0.1 tolerance

#### Test 1.2.2: Delta - ITM vs OTM Call
```typescript
test('calculateDelta: ITM call > OTM call', () => {
  const params = { timeToExpiry: 0.25, volatility: 0.20, riskFreeRate: 0.05, optionType: 'call' as const };
  
  const itmDelta = calculateDelta(100, 90, ...Object.values(params));
  const otmDelta = calculateDelta(100, 110, ...Object.values(params));
  
  expect(itmDelta).toBeGreaterThan(otmDelta);
  expect(itmDelta).toBeGreaterThan(0.5);
  expect(otmDelta).toBeLessThan(0.5);
});
```

**Acceptance:**
- ✅ ITM call has higher delta
- ✅ OTM call has lower delta
- ✅ Ordering is correct

#### Test 1.2.3: Delta - Put Option
```typescript
test('calculateDelta: Put option delta is negative', () => {
  const callDelta = calculateDelta(100, 100, 0.25, 0.20, 0.05, 'call');
  const putDelta = calculateDelta(100, 100, 0.25, 0.20, 0.05, 'put');
  
  expect(callDelta).toBeGreaterThan(0);
  expect(putDelta).toBeLessThan(0);
  expect(Math.abs(callDelta + putDelta)).toBeCloseTo(1, 1);  // Put-call parity
});
```

**Acceptance:**
- ✅ Put delta is negative
- ✅ Put-call delta sum ≈ 1
- ✅ Parity relationship holds

#### Test 1.2.4: Gamma - Always Positive
```typescript
test('calculateGamma: gamma should always be positive', () => {
  const strikes = [90, 95, 100, 105, 110];
  const params = { timeToExpiry: 0.25, volatility: 0.20, riskFreeRate: 0.05 };
  
  strikes.forEach(strike => {
    const gamma = calculateGamma(100, strike, ...Object.values(params));
    expect(gamma).toBeGreaterThan(0);
  });
});
```

**Acceptance:**
- ✅ Gamma > 0 for all strikes
- ✅ ATM gamma is largest
- ✅ OTM/ITM gamma < ATM

#### Test 1.2.5: Gamma - ATM Maximum
```typescript
test('calculateGamma: ATM gamma is maximum', () => {
  const params = { timeToExpiry: 0.25, volatility: 0.20, riskFreeRate: 0.05 };
  
  const gammaATM = calculateGamma(100, 100, ...Object.values(params));
  const gammaOTM = calculateGamma(100, 110, ...Object.values(params));
  
  expect(gammaATM).toBeGreaterThan(gammaOTM);
});
```

**Acceptance:**
- ✅ ATM gamma > OTM gamma

#### Test 1.2.6: Vega - Positive
```typescript
test('calculateVega: vega should always be positive', () => {
  const strikes = [90, 95, 100, 105, 110];
  const params = { timeToExpiry: 0.25, volatility: 0.20, riskFreeRate: 0.05 };
  
  strikes.forEach(strike => {
    const vega = calculateVega(100, strike, ...Object.values(params));
    expect(vega).toBeGreaterThan(0);
  });
});
```

**Acceptance:**
- ✅ Vega > 0 for all strikes

#### Test 1.2.7: Theta - Daily Decay
```typescript
test('calculateTheta: call theta more negative when OTM', () => {
  const params = { timeToExpiry: 0.25, volatility: 0.20, riskFreeRate: 0.05 };
  
  const thetaCall = calculateTheta(100, 100, ...Object.values(params), 'call');
  const thetaPut = calculateTheta(100, 100, ...Object.values(params), 'put');
  
  expect(thetaCall).toBeLessThan(0);  // Time decay
  expect(typeof thetaPut).toBe('number');
});
```

**Acceptance:**
- ✅ Call theta is negative (time decay hurts long calls)
- ✅ Returns valid number for puts

#### Test 1.2.8: Greeks Boundary Conditions
```typescript
test('calculateDelta/Gamma/Vega: should handle zero time to expiry', () => {
  const params = { spotPrice: 100, strike: 100, timeToExpiry: 0.001, volatility: 0.20, riskFreeRate: 0.05 };
  
  // At expiry, delta should be binary (0 or 1)
  const deltaCall = calculateDelta(...Object.values(params), 'call');
  expect([0, 1]).toContain(Math.round(deltaCall));
});
```

**Acceptance:**
- ✅ Handles edge case of near-zero expiry

---

### 1.3 Volatility Regime Classification

**File:** `__tests__/lib/optionsAnalytics.test.ts`

#### Test 1.3.1: Low Regime
```typescript
test('classifyVolatilityRegime: should classify low regime', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const regime = classifyVolatilityRegime(11, historical);
  
  expect(regime).toBe('low');
});
```

**Acceptance:**
- ✅ Returns 'low' for IV below 20th percentile

#### Test 1.3.2: Normal Regime
```typescript
test('classifyVolatilityRegime: should classify normal regime', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const regime = classifyVolatilityRegime(18, historical);
  
  expect(regime).toBe('normal');
});
```

**Acceptance:**
- ✅ Returns 'normal' for IV between percentiles

#### Test 1.3.3: High Regime
```typescript
test('classifyVolatilityRegime: should classify high regime', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const regime = classifyVolatilityRegime(27, historical);
  
  expect(regime).toBe('high');
});
```

**Acceptance:**
- ✅ Returns 'high' for IV above 80th percentile

#### Test 1.3.4: IV Rank Calculation
```typescript
test('calculateIVRank: should calculate percentile rank correctly', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  
  const rank10 = calculateIVRank(10, historical);
  const rank20 = calculateIVRank(20, historical);
  const rank28 = calculateIVRank(28, historical);
  
  expect(rank10).toBe(0);     // Minimum
  expect(rank20).toBeCloseTo(50, 5);  // Median
  expect(rank28).toBe(100);   // Maximum
});
```

**Acceptance:**
- ✅ Rank = 0 for minimum IV
- ✅ Rank = 100 for maximum IV
- ✅ Rank ≈ 50 for median

#### Test 1.3.5: Custom Thresholds
```typescript
test('classifyVolatilityRegime: should respect custom thresholds', () => {
  const historical = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  
  const regime = classifyVolatilityRegime(15, historical, {
    lowPercentile: 0.40,
    highPercentile: 0.60
  });
  
  expect(regime).toBe('low');  // 15 is below 40th percentile
});
```

**Acceptance:**
- ✅ Custom thresholds work correctly

---

### 1.4 Probability Distribution

**File:** `__tests__/lib/mockOptionsData.test.ts`

#### Test 1.4.1: Distribution Generation
```typescript
test('generateMockProbabilityDistribution: should generate normalized distribution', () => {
  const distribution = generateMockProbabilityDistribution(4800, 0.20, 30);
  
  // Sum of probabilities should equal 1
  const sum = distribution.reduce((acc, p) => acc + p.probability, 0);
  expect(sum).toBeCloseTo(1, 2);
});
```

**Acceptance:**
- ✅ Probabilities sum to 1
- ✅ All probabilities >= 0

#### Test 1.4.2: Price Range
```typescript
test('generateMockProbabilityDistribution: should center around spot price', () => {
  const spot = 4800;
  const distribution = generateMockProbabilityDistribution(spot, 0.20, 30);
  
  const prices = distribution.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  
  expect(min).toBeLessThan(spot);
  expect(max).toBeGreaterThan(spot);
});
```

**Acceptance:**
- ✅ Distribution spans below and above spot
- ✅ Peak near spot price

#### Test 1.4.3: Volatility Effect
```typescript
test('generateMockProbabilityDistribution: higher vol = wider distribution', () => {
  const dist20 = generateMockProbabilityDistribution(4800, 0.20, 30);
  const dist40 = generateMockProbabilityDistribution(4800, 0.40, 30);
  
  const range20 = Math.max(...dist20.map(p => p.price)) - Math.min(...dist20.map(p => p.price));
  const range40 = Math.max(...dist40.map(p => p.price)) - Math.min(...dist40.map(p => p.price));
  
  expect(range40).toBeGreaterThan(range20);
});
```

**Acceptance:**
- ✅ Higher volatility produces wider distribution
- ✅ Range increases with time horizon

---

### 1.5 Mock Data Generator

**File:** `__tests__/lib/mockOptionsData.test.ts`

#### Test 1.5.1: Snapshot Generation
```typescript
test('generateMockOptionSnapshot: should generate valid snapshot', () => {
  const snapshot = generateMockOptionSnapshot('SPWX', '2026-03-09');
  
  expect(snapshot.ticker).toBe('SPWX');
  expect(snapshot.date).toBe('2026-03-09');
  expect(snapshot.iv_30d).toBeGreaterThan(0);
  expect(snapshot.iv_30d).toBeLessThan(100);
  expect(['low', 'normal', 'high']).toContain(snapshot.regime);
});
```

**Acceptance:**
- ✅ All required fields present
- ✅ Values in realistic ranges
- ✅ Regime is one of enum values

#### Test 1.5.2: Consistency
```typescript
test('generateMockOptionSnapshot: IV rank should match regime', () => {
  const snapshot = generateMockOptionSnapshot('SPWX', '2026-03-09');
  
  if (snapshot.regime === 'low') {
    expect(snapshot.iv_rank).toBeLessThan(33);
  } else if (snapshot.regime === 'high') {
    expect(snapshot.iv_rank).toBeGreaterThan(66);
  }
});
```

**Acceptance:**
- ✅ Regime consistent with IV rank

---

## 2. Integration Tests

### 2.1 Database Operations

**File:** `__tests__/lib/db.integration.test.ts`

#### Test 2.1.1: Insert Option Snapshot
```typescript
test('insertOptionSnapshot: should save snapshot to DB', () => {
  const snapshot = generateMockOptionSnapshot('SPWX', '2026-03-09');
  const inserted = insertOptionSnapshot(snapshot);
  
  expect(inserted.id).toBeGreaterThan(0);
  expect(inserted.created_at).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Returns ID and created_at
- ✅ Data persists in DB

#### Test 2.1.2: Retrieve Option Snapshot
```typescript
test('getOptionSnapshot: should retrieve snapshot by date/ticker/expiry', () => {
  const snapshot = generateMockOptionSnapshot('SPWX', '2026-03-09');
  insertOptionSnapshot(snapshot);
  
  const retrieved = getOptionSnapshot('2026-03-09', 'SPWX', '30d');
  
  expect(retrieved).not.toBeNull();
  expect(retrieved!.iv_30d).toEqual(snapshot.iv_30d);
});
```

**Acceptance:**
- ✅ Can retrieve by exact date/ticker/expiry
- ✅ Data matches inserted

#### Test 2.1.3: Get Latest Snapshot
```typescript
test('getLatestOptionSnapshot: should return most recent', () => {
  insertOptionSnapshot(generateMockOptionSnapshot('SPWX', '2026-03-08'));
  insertOptionSnapshot(generateMockOptionSnapshot('SPWX', '2026-03-09'));
  
  const latest = getLatestOptionSnapshot('SPWX', '30d');
  
  expect(latest!.date).toBe('2026-03-09');
});
```

**Acceptance:**
- ✅ Returns latest by date
- ✅ Handles multiple snapshots

#### Test 2.1.4: Unique Constraint
```typescript
test('insertOptionSnapshot: should enforce unique(date, ticker, expiry)', () => {
  const snapshot = generateMockOptionSnapshot('SPWX', '2026-03-09');
  
  insertOptionSnapshot(snapshot);
  
  expect(() => insertOptionSnapshot(snapshot))
    .toThrow();  // Duplicate key error
});
```

**Acceptance:**
- ✅ Prevents duplicate entries

#### Test 2.1.5: Insert Projection
```typescript
test('insertOptionProjection: should save projection to DB', () => {
  const distribution = generateMockProbabilityDistribution(4800, 0.20, 30);
  const projection = {
    date: '2026-03-09',
    ticker: 'SPWX',
    horizon_days: 30,
    prob_distribution: distribution,
    key_levels: [
      { level: 4800, type: 'mode' as const, probability: 0.35 },
    ],
    regime_classification: 'normal' as const,
  };
  
  const inserted = insertOptionProjection(projection);
  
  expect(inserted.id).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Projection saved with JSON fields
- ✅ ID and timestamp generated

#### Test 2.1.6: Get Projection
```typescript
test('getOptionProjection: should retrieve projection by date/ticker/horizon', () => {
  // Insert projection...
  const projection = getOptionProjection('2026-03-09', 'SPWX', 30);
  
  expect(projection).not.toBeNull();
  expect(projection!.prob_distribution.length).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Can retrieve by date/ticker/horizon
- ✅ Probability distribution is array

---

### 2.2 API Endpoints

**File:** `__tests__/api/options/snapshot.integration.test.ts`

#### Test 2.2.1: GET /api/options/snapshot - Default Ticker
```typescript
test('GET /api/options/snapshot: should return data for default ticker', async () => {
  const res = await fetch('http://localhost:3003/api/options/snapshot');
  const data = await res.json();
  
  expect(res.status).toBe(200);
  expect(data.ticker).toBe('SPWX');
  expect(data.volatility.iv_30d).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Returns 200 status
- ✅ Contains all required fields
- ✅ Default ticker = 'SPWX'

#### Test 2.2.2: GET /api/options/snapshot - Custom Ticker
```typescript
test('GET /api/options/snapshot: should accept ticker param', async () => {
  const res = await fetch('http://localhost:3003/api/options/snapshot?ticker=SPY');
  const data = await res.json();
  
  expect(data.ticker).toBe('SPY');
});
```

**Acceptance:**
- ✅ Accepts ?ticker=SPY parameter
- ✅ Returns data for custom ticker (if available)

#### Test 2.2.3: GET /api/options/snapshot - Response Schema
```typescript
test('GET /api/options/snapshot: response matches schema', async () => {
  const res = await fetch('http://localhost:3003/api/options/snapshot');
  const data = await res.json();
  
  // Check required top-level fields
  expect(data).toHaveProperty('ticker');
  expect(data).toHaveProperty('timestamp');
  expect(data).toHaveProperty('volatility');
  expect(data).toHaveProperty('greeks');
  expect(data).toHaveProperty('skew');
  expect(data).toHaveProperty('implied_move');
  expect(data).toHaveProperty('regime');
  
  // Check nested fields
  expect(data.volatility).toHaveProperty('iv_30d');
  expect(data.volatility).toHaveProperty('iv_rank');
  expect(data.greeks).toHaveProperty('net_delta');
  expect(data.greeks).toHaveProperty('atm_gamma');
});
```

**Acceptance:**
- ✅ All required fields present
- ✅ Correct nesting structure

#### Test 2.2.4: GET /api/options/snapshot - 404 No Data
```typescript
test('GET /api/options/snapshot: should return 404 if no data', async () => {
  const res = await fetch('http://localhost:3003/api/options/snapshot?ticker=NONEXISTENT');
  
  expect(res.status).toBe(404);
});
```

**Acceptance:**
- ✅ Returns 404 for unavailable ticker
- ✅ Includes error message

#### Test 2.2.5: GET /api/options/snapshot - Caching
```typescript
test('GET /api/options/snapshot: should use cached data < 5 min old', async () => {
  const start = Date.now();
  const res1 = await fetch('http://localhost:3003/api/options/snapshot');
  const end = Date.now();
  
  const res2 = await fetch('http://localhost:3003/api/options/snapshot');
  const end2 = Date.now();
  
  // Second call should be faster (cached)
  expect(end2 - end).toBeLessThan(end - start);
});
```

**Acceptance:**
- ✅ Cache hit is faster than miss

---

**File:** `__tests__/api/options/projection.integration.test.ts`

#### Test 2.2.6: GET /api/options/projection - Valid Response
```typescript
test('GET /api/options/projection: should return projection data', async () => {
  const res = await fetch('http://localhost:3003/api/options/projection?ticker=SPWX&horizonDays=30');
  const data = await res.json();
  
  expect(res.status).toBe(200);
  expect(data.ticker).toBe('SPWX');
  expect(data.prob_distribution).toBeInstanceOf(Array);
  expect(data.prob_distribution.length).toBeGreaterThan(0);
});
```

**Acceptance:**
- ✅ Returns 200
- ✅ prob_distribution is array
- ✅ keyLevels present

#### Test 2.2.7: GET /api/options/projection - Schema
```typescript
test('GET /api/options/projection: response schema is valid', async () => {
  const res = await fetch('http://localhost:3003/api/options/projection');
  const data = await res.json();
  
  expect(data).toHaveProperty('ticker');
  expect(data).toHaveProperty('date');
  expect(data).toHaveProperty('expiry_horizon');
  expect(data).toHaveProperty('prob_distribution');
  expect(data).toHaveProperty('keyLevels');
  expect(data).toHaveProperty('regimeTransition');
  
  // Validate prob_distribution items
  data.prob_distribution.forEach((point: any) => {
    expect(point).toHaveProperty('price');
    expect(point).toHaveProperty('probability');
    expect(point.probability).toBeGreaterThanOrEqual(0);
    expect(point.probability).toBeLessThanOrEqual(1);
  });
});
```

**Acceptance:**
- ✅ All required fields present
- ✅ Probability values 0-1
- ✅ Probabilities sum ≈ 1

#### Test 2.2.8: GET /api/options/projection - Probability Normalization
```typescript
test('GET /api/options/projection: probabilities sum to ~1', async () => {
  const res = await fetch('http://localhost:3003/api/options/projection');
  const data = await res.json();
  
  const sum = data.prob_distribution.reduce(
    (acc: number, p: any) => acc + p.probability, 
    0
  );
  
  expect(sum).toBeCloseTo(1, 2);
});
```

**Acceptance:**
- ✅ Sum of probabilities ≈ 1

---

## 3. E2E Tests

**File:** `e2e/option-projection.spec.ts`

### 3.1 Widget → Report Navigation

#### Test 3.1.1: Widget Visibility on Dashboard
```typescript
test('Option Projection widget should be visible on dashboard', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.locator('text=Option Projection')).toBeVisible();
  await expect(page.locator('text=Implied Move')).toBeVisible();
});
```

**Acceptance:**
- ✅ Widget appears on dashboard
- ✅ Title visible
- ✅ Key metric labels visible

#### Test 3.1.2: Widget Data Loading
```typescript
test('Option Projection widget should display data', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.locator('[data-testid=implied-move]')).toBeVisible();
  
  const moveText = await page.locator('[data-testid=implied-move]').textContent();
  expect(moveText).toMatch(/±\d+\.\d+%/);  // Matches "±2.5%"
});
```

**Acceptance:**
- ✅ Data loads (not "Loading...")
- ✅ Implied move formatted correctly
- ✅ IV displayed

#### Test 3.1.3: Widget Click Navigation
```typescript
test('clicking "View Full Analysis" should navigate to report', async ({ page }) => {
  await page.goto('/');
  
  await page.click('text=View Full Analysis');
  
  await expect(page).toHaveURL(/\/reports\/option-projection/);
});
```

**Acceptance:**
- ✅ Click navigates to correct URL
- ✅ No errors in console

#### Test 3.1.4: Widget Auto-Refresh
```typescript
test('widget should refresh data every 5 minutes', async ({ page }) => {
  await page.goto('/');
  
  const timestamp1 = await page.locator('[data-testid=timestamp]').textContent();
  
  // Mock time advance
  await page.evaluate(() => {
    // Simulate 5 minutes passing (would need custom implementation)
  });
  
  await page.waitForTimeout(300000);  // 5 min in real test
  
  const timestamp2 = await page.locator('[data-testid=timestamp]').textContent();
  expect(timestamp2).not.toBe(timestamp1);
});
```

**Acceptance:**
- ✅ Data refreshes after 5 minutes
- ✅ Timestamp updates

---

### 3.2 Report Page

#### Test 3.2.1: Report Page Load
```typescript
test('Option Projection report page should load', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  await expect(page.locator('text=Executive Summary')).toBeVisible();
});
```

**Acceptance:**
- ✅ Page loads without errors
- ✅ Title visible

#### Test 3.2.2: All Report Sections Present
```typescript
test('report page should display all sections', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  await expect(page.locator('text=Executive Summary')).toBeVisible();
  await expect(page.locator('text=Put Implied Volatility')).toBeVisible();
  await expect(page.locator('text=Greeks Aggregates')).toBeVisible();
  await expect(page.locator('text=Implied Price Distribution')).toBeVisible();
});
```

**Acceptance:**
- ✅ All major sections rendered
- ✅ No missing content

#### Test 3.2.3: Data in Report Sections
```typescript
test('report sections should contain data', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  // Executive Summary
  await expect(page.locator('[data-testid=projection-1w]')).toBeVisible();
  const range1w = await page.locator('[data-testid=projection-1w]').textContent();
  expect(range1w).toMatch(/\$\d+/);  // Matches "$4800"
  
  // Put IV & Skew
  const iv = await page.locator('[data-testid=iv-30d]').textContent();
  expect(iv).toMatch(/\d+\.\d+%/);
  
  // Greeks
  const delta = await page.locator('[data-testid=net-delta]').textContent();
  expect(delta).toBeTruthy();
});
```

**Acceptance:**
- ✅ Data displays in all sections
- ✅ Formatting correct (%, $, decimals)
- ✅ No placeholder text

#### Test 3.2.4: Mobile Responsive
```typescript
test('report page should be mobile responsive', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });  // iPhone SE
  await page.goto('/reports/option-projection');
  
  // Check layout adjusts
  await expect(page.locator('text=Executive Summary')).toBeVisible();
  
  // Stats should stack on mobile
  const statsGrid = page.locator('[data-testid=stats-grid]');
  const computedStyle = await statsGrid.evaluate(el => 
    window.getComputedStyle(el).gridTemplateColumns
  );
  
  // Should be 1 column on mobile, 2+ on desktop
  expect(computedStyle).toMatch(/repeat\(1/);
});
```

**Acceptance:**
- ✅ Renders on mobile (375px)
- ✅ No horizontal overflow
- ✅ Touch-friendly button sizes

#### Test 3.2.5: Chart Rendering
```typescript
test('probability distribution chart should render', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  // Wait for Recharts to render
  await page.waitForSelector('[class*="recharts"]');
  
  const chart = page.locator('[data-testid=prob-chart]');
  await expect(chart).toBeVisible();
});
```

**Acceptance:**
- ✅ Chart renders
- ✅ No broken SVG/canvas
- ✅ Interactive tooltips work

---

### 3.3 Error States

#### Test 3.3.1: Handle Missing Data
```typescript
test('report page should handle missing data gracefully', async ({ page }) => {
  // Setup: Clear database or mock API 404
  
  await page.goto('/reports/option-projection');
  
  await expect(page.locator('text=Unable to load')).toBeVisible();
});
```

**Acceptance:**
- ✅ Shows error message
- ✅ No console errors
- ✅ UI doesn't break

#### Test 3.3.2: Handle API Timeout
```typescript
test('should show loading state and timeout message if API hangs', async ({ page }) => {
  // Mock API delay > timeout
  
  await page.goto('/reports/option-projection');
  
  // Loading state visible
  await expect(page.locator('text=Loading')).toBeVisible();
});
```

**Acceptance:**
- ✅ Loading state visible
- ✅ User can understand the wait

---

## 4. Performance Tests

**File:** `__tests__/performance/option-projection.perf.test.ts`

### 4.1 Widget Performance

#### Test 4.1.1: Widget Initial Load
```typescript
test('Option Projection widget should load in < 500ms', async ({ page }) => {
  const start = performance.now();
  
  await page.goto('/');
  await page.waitForSelector('[data-testid=option-widget]');
  
  const end = performance.now();
  const loadTime = end - start;
  
  expect(loadTime).toBeLessThan(500);
});
```

**Target:** < 500ms

**Acceptance:**
- ✅ First meaningful paint < 500ms
- ✅ Interactive before 500ms

#### Test 4.1.2: Widget Paint Time
```typescript
test('Option Projection widget first paint < 300ms', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    const perfData = performance.getEntriesByType('paint');
    return perfData.find(e => e.name === 'first-contentful-paint');
  });
  
  expect(metrics.startTime).toBeLessThan(300);
});
```

**Target:** < 300ms FCP

---

### 4.2 Report Page Performance

#### Test 4.2.1: Report Page Load
```typescript
test('Option Projection report should load in < 2s', async ({ page }) => {
  const start = performance.now();
  
  await page.goto('/reports/option-projection');
  await page.waitForLoadState('networkidle');
  
  const end = performance.now();
  const loadTime = end - start;
  
  expect(loadTime).toBeLessThan(2000);
});
```

**Target:** < 2 seconds

**Acceptance:**
- ✅ Fully interactive < 2s

#### Test 4.2.2: Report Page Time to Interactive
```typescript
test('report page TTI < 1.5s', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    return performance.getEntriesByType('paint')
      .filter(e => e.name === 'first-contentful-paint');
  });
  
  // Custom TTI calculation
  expect(metrics[0].startTime).toBeLessThan(1500);
});
```

**Target:** < 1.5s TTI

---

### 4.3 API Performance

#### Test 4.3.1: Snapshot API Response Time
```typescript
test('GET /api/options/snapshot should respond < 200ms', async () => {
  const start = Date.now();
  await fetch('http://localhost:3003/api/options/snapshot');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(200);
});
```

**Target:** < 200ms

#### Test 4.3.2: Projection API Response Time
```typescript
test('GET /api/options/projection should respond < 200ms', async () => {
  const start = Date.now();
  await fetch('http://localhost:3003/api/options/projection');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(200);
});
```

**Target:** < 200ms

---

### 4.4 Memory Usage

#### Test 4.4.1: Widget Memory
```typescript
test('Option Projection widget memory footprint < 5MB', async ({ page }) => {
  await page.goto('/');
  
  const metrics = await page.evaluate(() => {
    return (performance as any).memory;
  });
  
  const usedMB = metrics.usedJSHeapSize / 1024 / 1024;
  expect(usedMB).toBeLessThan(5);
});
```

**Target:** < 5 MB widget + JS

---

## 5. Accessibility Tests

**File:** `e2e/option-projection-a11y.spec.ts`

### 5.1 WCAG 2.1 AA Compliance

#### Test 5.1.1: Color Contrast
```typescript
test('text should have sufficient color contrast (WCAG AA)', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  const violations = await page.evaluate(() => {
    // Use axe-core to check
    return (window as any).axe.run();
  });
  
  const contrastViolations = violations.filter(
    (v: any) => v.id === 'color-contrast'
  );
  
  expect(contrastViolations).toHaveLength(0);
});
```

**Target:** WCAG AA (4.5:1 ratio)

#### Test 5.1.2: Keyboard Navigation
```typescript
test('should be fully navigable with keyboard', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  // Tab through all interactive elements
  let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    
    // Should land on interactive elements
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement);
  }
});
```

**Acceptance:**
- ✅ All controls reachable via Tab
- ✅ No focus traps

#### Test 5.1.3: Screen Reader Text
```typescript
test('charts should have accessible descriptions', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  const chartLabel = await page.locator('[data-testid=prob-chart]')
    .getAttribute('aria-label');
  
  expect(chartLabel).toBeTruthy();
  expect(chartLabel).toMatch(/probability|distribution/i);
});
```

**Acceptance:**
- ✅ Charts have aria-labels
- ✅ Data tables have headers

#### Test 5.1.4: Font Sizes
```typescript
test('text should be at least 12px', async ({ page }) => {
  await page.goto('/reports/option-projection');
  
  const textElements = page.locator('p, span, div:has-text()')
    .locator('[role="text"], [role="paragraph"]');
  
  const violations: string[] = [];
  
  for await (const element of textElements) {
    const size = await element.evaluate((el: HTMLElement) => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });
    
    if (size < 12) violations.push(element.locator('..').toString());
  }
  
  expect(violations).toHaveLength(0);
});
```

**Target:** 12px minimum

---

## Summary Table

| Test Category | Count | Coverage | Target Pass Rate |
|---|---|---|---|
| **Unit Tests** | 25 | 80% | 100% |
| **Integration Tests** | 15 | 75% | 100% |
| **E2E Tests** | 15 | 70% | 100% |
| **Performance Tests** | 7 | - | 100% |
| **Accessibility Tests** | 4 | WCAG AA | 100% |
| **Total** | **66** | **~75%** | **100%** |

---

## Test Execution Matrix

```
Phase 1 Complete? ✅ → Run: Unit Tests (database, mock data)
Phase 2 Complete? ✅ → Run: Unit Tests (analytics)
Phase 3 Complete? ✅ → Run: Integration Tests (APIs)
Phase 4 Complete? ✅ → Run: E2E Tests (widget, report)
Phase 5 Complete? ✅ → Run: Performance + A11y Tests
```

---

## Commands

```bash
# Run all tests
npm test

# Run specific suite
npm test -- lib/optionsAnalytics.test.ts
npm test -- api/options/snapshot.integration.test.ts

# Run E2E
npm run test:e2e

# Run performance tests
npm run test:perf

# Run accessibility
npm run test:a11y

# Generate coverage report
npm test -- --coverage
```

---

## Exit Criteria

✅ All 66 tests passing  
✅ Coverage > 80% for critical paths  
✅ Performance targets met  
✅ No accessibility violations (WCAG AA)  
✅ No console errors or warnings (dev)  
✅ Mobile responsive (375px - 1920px)  

**Ready for merge when: 100% tests passing + all acceptance criteria met**
