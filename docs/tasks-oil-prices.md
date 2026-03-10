# Tasks: Oil Prices — Dashboard & Report Integration

## TASK-1: Add data-testid to MarketChart + add WTI/Brent to MarketChartsWidget

**Files touched:**
- `app/components/charts/MarketChart.tsx`
- `app/components/charts/MarketChartsWidget.tsx`

**Depends on:** None

**Done when:**
- `MarketChart` root `<div>` has `data-testid={\`ticker-tile-${ticker}\`}`
- `MarketChart` price `<span>` has `data-testid={\`ticker-price-${ticker}\`}` (loading skeleton and error state too)
- `MarketChart` delta badge `<span>` has `data-testid={\`ticker-delta-${ticker}\`}`
- `CHARTS` array in `MarketChartsWidget.tsx` contains `CL=F` (label "WTI") and `BZ=F` (label "Brent") after `DGS2`
- `formatValue` for both oil tiles: `(v: number) => '$' + v.toFixed(2)`
- Grid class updated to `grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8`
- `npm run build` passes, no TypeScript errors

**Notes:**
- `data-testid` must be on ALL three states: loading skeleton, error, and loaded. Use the same testid on all three so selectors work regardless of state.
- Oil prices are dollar-denominated — prefix `$`, no `%` suffix.

---

## TASK-2: Add oil data to generate-report.ts

**Files touched:**
- `scripts/generate-report.ts`

**Depends on:** None (parallel with TASK-1)

**Done when:**
- `MarketData` interface has `wti: InstrumentData` and `brent: InstrumentData`
- `fetchAllMarketData()` fetches `CL=F` and `BZ=F` via `fetchYahoo()` in `Promise.all`
- Oil fetches have individual `.catch()` handlers returning `[]` with a `console.warn`
- Return maps `wti`/`brent` using `toInstrument()` with `fallbackInstrument` (`current: 0`) when array is empty
- `buildPrompt()` destructures `wti` and `brent`; computes `wtiAvail = wti.current > 0`
- WTI + Brent block inserted in prompt after `2Y/10Y Spread` section, before closing separator
- When `wtiAvail` is false, prompt shows `N/A` for WTI; same for Brent
- `Analysis` interface unchanged, Claude JSON schema unchanged
- `npm run build` passes, no TypeScript errors

**Notes:**
- `fallbackInstrument` sentinel: `{ current: 0, changePct: 0, points: [] }`. Detection via `current > 0`.
- Oil fetch failure must NOT cause `fetchAllMarketData()` to throw — existing SPX/VIX/etc. fetches still throw on failure (correct behaviour).

---

## TASK-3: Unit tests — chart API for CL=F and BZ=F

**Files touched:**
- `__tests__/unit/app/api/market/chart.test.ts`

**Depends on:** TASK-1

**Done when:**
- `it('AC-3: GET /api/market/chart/CL%3DF returns OHLCV on success')` passes
- `it('AC-4: GET /api/market/chart/BZ%3DF returns OHLCV on success')` passes
- `it('AC-8: GET /api/market/chart/CL%3DF returns error JSON on Yahoo 500')` passes
- All existing tests still pass
- Coverage thresholds maintained (≥80% branches, ≥85% functions/lines)

**Notes:**
- Follow existing mock patterns in the file.
- Test descriptions must include AC IDs.

---

## TASK-4: Unit tests — generate-report.ts oil fetch and prompt

**Files touched:**
- `__tests__/unit/scripts/generateReport.test.ts`

**Depends on:** TASK-2

**Done when:**
- `it('AC-5/AC-6: fetchAllMarketData includes wti and brent on success')` passes
- `it('AC-8 backend: fetchAllMarketData resolves with fallback when CL=F throws')` passes
- `it('AC-7: buildPrompt includes CL=F and BZ=F in prompt string')` passes
- `it('AC-8 backend: buildPrompt shows N/A when wti.current is 0')` passes
- All existing tests still pass
- Coverage thresholds maintained

**Notes:**
- No real Yahoo Finance or Anthropic API calls in tests — mock all externals.
- AC IDs in test descriptions required.

---

## TASK-5: E2E tests — dashboard WTI and Brent tiles

**Files touched:**
- `e2e/dashboard.spec.ts`

**Depends on:** TASK-1, TASK-3, TASK-4

**Done when:**
- `it('AC-1: WTI tile visible with price and delta')` — asserts `ticker-tile-CL=F`, `ticker-price-CL=F`, `ticker-delta-CL=F` visible and non-empty
- `it('AC-2: Brent tile visible with price and delta')` — asserts `ticker-tile-BZ=F`, `ticker-price-BZ=F`, `ticker-delta-BZ=F` visible and non-empty
- WTI tile appears after the last existing ticker tile in DOM order
- `npm run test:e2e` passes

**Notes:**
- E2E runs against built app with live Yahoo Finance. WTI/Brent should return real prices.
- If Yahoo Finance is blocked in CI, check existing patterns for how other ticker tests handle this.

---

## Summary

| Task | Files | Depends On | Can Parallelise |
|------|-------|------------|-----------------|
| TASK-1 | MarketChart.tsx, MarketChartsWidget.tsx | — | ✅ with TASK-2 |
| TASK-2 | generate-report.ts | — | ✅ with TASK-1 |
| TASK-3 | chart.test.ts | TASK-1 | After TASK-1 |
| TASK-4 | generateReport.test.ts | TASK-2 | After TASK-2 |
| TASK-5 | dashboard.spec.ts | TASK-1, TASK-3, TASK-4 | After all above |
