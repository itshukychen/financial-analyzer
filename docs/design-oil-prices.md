# Design: Oil Prices — Dashboard & Report Integration

## Change Surface

| File | Action | Reason |
|------|--------|--------|
| `app/components/charts/MarketChartsWidget.tsx` | **Modify** | Add CL=F and BZ=F entries to CHARTS array; update grid column class |
| `app/components/charts/MarketChart.tsx` | **Modify** | Add dynamic `data-testid` props to root, price, and delta elements |
| `scripts/generate-report.ts` | **Modify** | Add wti/brent to MarketData interface, fetchAllMarketData(), and buildPrompt() |
| `app/api/market/chart/[ticker]/route.ts` | **No change** | Existing encodeURIComponent handling already supports CL=F and BZ=F |
| `__tests__/unit/app/api/market/chart.test.ts` | **Modify** | Add test cases for CL=F and BZ=F ticker handling |
| `__tests__/unit/scripts/generateReport.test.ts` | **Modify** | Add test cases for oil fetch calls and prompt inclusion |
| `e2e/dashboard.spec.ts` | **Modify** | Add assertions for WTI and Brent tile visibility and data-testid |

**Files created:** None  
**Files deleted:** None  
**Schema migration:** None (MarketData is JSON-serialised into `ticker_data` column — adding fields is additive and backward-compatible)

---

## Detailed Changes

### 1. `app/components/charts/MarketChart.tsx`

**Blocker resolved here.** The current component has no `data-testid` on the tile root, price span, or delta badge. These must be added dynamically from the `ticker` prop so all tiles (including new oil tiles) get correct testids automatically.

Changes:
- Root `<div>` → add `data-testid={\`ticker-tile-${ticker}\`}`
- Price `<span>` (the `formatValue(data!.current)` span) → add `data-testid={\`ticker-price-${ticker}\`}`
- Delta badge `<span>` → add `data-testid={\`ticker-delta-${ticker}\`}`
- Loading skeleton div (price row) → add `data-testid={\`ticker-price-${ticker}\`}` so the testid exists during loading state (AC-9)
- Error `<span>` (price row) → add `data-testid={\`ticker-price-${ticker}\`}`

No other logic changes to this file.

---

### 2. `app/components/charts/MarketChartsWidget.tsx`

**CHARTS array** — append two entries after the existing `DGS2` entry:

```ts
{ ticker: 'CL=F', label: 'WTI',   formatValue: (v: number) => '$' + v.toFixed(2) },
{ ticker: 'BZ=F', label: 'Brent', formatValue: (v: number) => '$' + v.toFixed(2) },
```

`formatValue` uses `$` prefix with 2 decimal places — dollar-denominated commodities (not yields, no `%` suffix).

**Grid layout** — current: `grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` (5 chart tiles + 1 FearGreed = 6 slots).  
After adding 2 oil tiles: 7 chart tiles + 1 FearGreed = 8 slots total.

Update to:
```
grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8
```

---

### 3. `scripts/generate-report.ts`

#### 3a. `MarketData` interface

```ts
interface MarketData {
  spx:      InstrumentData;
  vix:      InstrumentData;
  dxy:      InstrumentData;
  yield10y: InstrumentData;
  yield2y:  InstrumentData;
  wti:      InstrumentData;   // NEW — CL=F
  brent:    InstrumentData;   // NEW — BZ=F
}
```

#### 3b. `fetchAllMarketData()`

Add `CL=F` and `BZ=F` to `Promise.all`. Oil fetches get individual `.catch()` handlers that log a warning and return `[]` — so a Yahoo Finance failure for oil does NOT abort the entire report.

```ts
const fallbackInstrument: InstrumentData = { current: 0, changePct: 0, points: [] };

const [spxPts, vixPts, dxyPts, yield10yPts, yield2yPts, wtiPts, brentPts] = await Promise.all([
  fetchYahoo('^GSPC').then(pts => { console.log('  ✅ ^GSPC'); return pts; }),
  fetchYahoo('^VIX').then(pts => { console.log('  ✅ ^VIX'); return pts; }),
  fetchYahoo('DX-Y.NYB').then(pts => { console.log('  ✅ DX-Y.NYB'); return pts; }),
  fetchYahoo('^TNX').then(pts => { console.log('  ✅ ^TNX'); return pts; }),
  fetchFRED('DGS2').then(pts => { console.log('  ✅ DGS2'); return pts; }),
  fetchYahoo('CL=F').then(pts => { console.log('  ✅ CL=F'); return pts; }).catch(err => {
    console.warn(`  ⚠️  CL=F fetch failed: ${err.message} — using fallback`);
    return [] as DataPoint[];
  }),
  fetchYahoo('BZ=F').then(pts => { console.log('  ✅ BZ=F'); return pts; }).catch(err => {
    console.warn(`  ⚠️  BZ=F fetch failed: ${err.message} — using fallback`);
    return [] as DataPoint[];
  }),
]);

return {
  spx:      toInstrument(spxPts),
  vix:      toInstrument(vixPts),
  dxy:      toInstrument(dxyPts),
  yield10y: toInstrument(yield10yPts),
  yield2y:  toInstrument(yield2yPts),
  wti:      wtiPts.length > 0 ? toInstrument(wtiPts) : fallbackInstrument,
  brent:    brentPts.length > 0 ? toInstrument(brentPts) : fallbackInstrument,
};
```

#### 3c. `buildPrompt()`

Update destructure:
```ts
const { spx, vix, dxy, yield10y, yield2y, wti, brent } = marketData;
```

Add oil computation block after the 2Y/10Y spread calculations:
```ts
// ── WTI Crude ────────────────────────────────────────────────────────────
const wtiCur       = r1(wti.current);
const wtiPrevClose = wti.current > 0 ? wti.current / (1 + wti.changePct / 100) : 0;
const wti1dAbs     = r1(wti.current - wtiPrevClose);
const wti1dPct     = r1(wti.changePct);
const wtiAvail     = wti.current > 0;

// ── Brent Crude ──────────────────────────────────────────────────────────
const brentCur       = r1(brent.current);
const brentPrevClose = brent.current > 0 ? brent.current / (1 + brent.changePct / 100) : 0;
const brent1dAbs     = r1(brent.current - brentPrevClose);
const brent1dPct     = r1(brent.changePct);
const brentAvail     = brent.current > 0;
```

Insert into the template literal, after the `2Y/10Y Spread` block and before the closing `────` separator:
```
WTI Crude (CL=F)
  Current:      ${wtiAvail ? '$' + wtiCur : 'N/A'}
  1-day:        ${wtiAvail ? sign(wti1dAbs) + wti1dAbs + ' (' + sign(wti1dPct) + wti1dPct + '%)' : 'N/A'}

Brent Crude (BZ=F)
  Current:      ${brentAvail ? '$' + brentCur : 'N/A'}
  1-day:        ${brentAvail ? sign(brent1dAbs) + brent1dAbs + ' (' + sign(brent1dPct) + brent1dPct + '%)' : 'N/A'}
```

Do NOT change the `Analysis` interface, `SYSTEM_PROMPT`, or Claude JSON schema.

---

### 4. `app/api/market/chart/[ticker]/route.ts`

**No changes.** Next.js delivers the URL-decoded param to the handler (`CL%3DF` → `CL=F`), which re-encodes via `encodeURIComponent` for the Yahoo Finance URL. Verify via unit tests only.

---

### 5. Test spec (for QA agent)

#### `__tests__/unit/app/api/market/chart.test.ts`
- GET `/api/market/chart/CL%3DF` mocked Yahoo success → HTTP 200, OHLCV array ≥ 1 entry (AC-3)
- GET `/api/market/chart/BZ%3DF` mocked Yahoo success → HTTP 200, OHLCV array ≥ 1 entry (AC-4)
- GET `/api/market/chart/CL%3DF` mocked Yahoo 500 → structured error JSON, non-200 status (AC-8)

#### `__tests__/unit/scripts/generateReport.test.ts`
- `fetchAllMarketData()` all mocked success → `wti` and `brent` present, numeric `current` (AC-5, AC-6)
- `fetchAllMarketData()` CL=F throws → resolves, `wti.current === 0` fallback (AC-8 backend)
- `buildPrompt()` valid wti+brent → string contains `"CL=F"` and `"BZ=F"` (AC-7)
- `buildPrompt()` `wti.current === 0` → string contains `"N/A"` for WTI (AC-8 backend)

#### `e2e/dashboard.spec.ts`
- `data-testid="ticker-tile-CL=F"` visible (AC-1)
- `data-testid="ticker-price-CL=F"` non-empty text (AC-1)
- `data-testid="ticker-delta-CL=F"` non-empty text (AC-1)
- Same three for BZ=F (AC-2)
- WTI tile appears after last existing ticker in DOM order (AC-1 ordering)
