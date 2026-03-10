# Implementation Tasks: Fix CD Pipeline

**Feature:** Fix CI/CD Pipeline — Add Missing AI Forecast Database Functions  
**Status:** Ready for Implementation  
**Assigned:** Engineer Agent  
**Estimated Time:** 1-2 hours  
**Worktree:** `/home/claw/worktrees/financial-analyzer/feature/fix-cd-pipeline`

---

## Quick Summary

**Problem:** Build fails because `getAIForecast` and `insertOrReplaceAIForecast` are imported but not exported from `lib/db.ts`.

**Solution:** Add AI forecasts database layer (table + methods + exports).

**File to Modify:** `lib/db.ts` (add ~120 lines)

---

## Task Checklist

### Task 1: Add AI Forecasts Table to Schema ✅
**Location:** `lib/db.ts` — Add to `SCHEMA_V4` constant (line ~65)

**Action:** Add this SQL to the `SCHEMA_V4` string (after `option_prices` table):

```sql
  CREATE TABLE IF NOT EXISTS ai_forecasts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker        TEXT    NOT NULL,
    date          TEXT    NOT NULL,
    forecast_json TEXT    NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(ticker, date)
  );
  CREATE INDEX IF NOT EXISTS idx_ai_forecasts_lookup 
    ON ai_forecasts(ticker, date DESC);
```

**Validation:**
- [ ] SQL added to `SCHEMA_V4` constant
- [ ] Syntax matches existing tables

---

### Task 2: Add AIForecastRow Type ✅
**Location:** `lib/db.ts` — Add after `OptionPrice` interface (line ~240)

**Action:** Add type definition:

```typescript
export interface AIForecastRow {
  id: number;
  ticker: string;
  date: string;
  forecast_json: string;  // JSON-serialized AIOptionsForecast
  created_at: number;     // Unix timestamp
}
```

**Validation:**
- [ ] Type exported
- [ ] Matches database schema

---

### Task 3: Add Methods to DbInstance Interface ✅
**Location:** `lib/db.ts` — Add to `DbInstance` interface (line ~270)

**Action:** Add method signatures after `getUnderlyingPrices`:

```typescript
export interface DbInstance {
  db: Database.Database;
  // ... existing methods ...
  
  getAIForecast(ticker: string, date: string): AIForecastRow | null;
  insertOrReplaceAIForecast(ticker: string, date: string, forecast: object): AIForecastRow;
}
```

**Validation:**
- [ ] Signatures added to interface
- [ ] TypeScript compilation passes

---

### Task 4: Implement getAIForecast Method ✅
**Location:** `lib/db.ts` — Add in `createDb()` function (line ~550, after `getUnderlyingPrices`)

**Action:** Implement method:

```typescript
  // ─── AI Forecast CRUD ────────────────────────────────────────────────────────

  function getAIForecast(ticker: string, date: string): AIForecastRow | null {
    return (db.prepare(
      'SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?'
    ).get(ticker, date) as AIForecastRow) ?? null;
  }
```

**Validation:**
- [ ] Method implemented
- [ ] Uses parameterized queries (SQL injection safe)
- [ ] Returns `AIForecastRow | null`

---

### Task 5: Implement insertOrReplaceAIForecast Method ✅
**Location:** `lib/db.ts` — Add after `getAIForecast` method (line ~560)

**Action:** Implement method:

```typescript
  function insertOrReplaceAIForecast(ticker: string, date: string, forecast: object): AIForecastRow {
    db.prepare(`
      INSERT INTO ai_forecasts (ticker, date, forecast_json)
      VALUES (?, ?, ?)
      ON CONFLICT(ticker, date) DO UPDATE SET
        forecast_json = excluded.forecast_json,
        created_at = (strftime('%s', 'now'))
    `).run(ticker, date, JSON.stringify(forecast));

    return db.prepare(
      'SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?'
    ).get(ticker, date) as AIForecastRow;
  }
```

**Validation:**
- [ ] Method implemented
- [ ] Upserts on conflict (unique constraint)
- [ ] Updates `created_at` on every write
- [ ] Returns inserted/updated row

---

### Task 6: Add Methods to createDb Return Object ✅
**Location:** `lib/db.ts` — Update `createDb()` return statement (line ~590)

**Action:** Add both methods to return object (after `getUnderlyingPrices`):

```typescript
  return {
    db,
    insertOrReplaceReport,
    getLatestReport,
    getReportByDate,
    listReports,
    insertOptionSnapshot,
    getOptionSnapshot,
    getLatestOptionSnapshot,
    insertOptionProjection,
    getOptionProjection,
    insertOptionPrice,
    getOptionPrices,
    getUnderlyingPrices,
    getAIForecast,              // ← ADD THIS
    insertOrReplaceAIForecast,  // ← ADD THIS
  };
```

**Validation:**
- [ ] Methods added to return object
- [ ] TypeScript recognizes methods on `DbInstance`

---

### Task 7: Export Functions at Module Level ✅
**Location:** `lib/db.ts` — Add after `getUnderlyingPrices` export (line ~640)

**Action:** Add exports:

```typescript
// AI Forecasts
export const getAIForecast = _instance.getAIForecast.bind(_instance);
export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);
```

**Validation:**
- [ ] Exports added
- [ ] Functions bound to singleton instance
- [ ] TypeScript resolves imports from other files

---

### Task 8: Add Migration Logic ✅
**Location:** `lib/db.ts` — Update `migrate()` function (line ~345, after `hasOptionPrices` check)

**Action:** Add migration for `ai_forecasts` table:

```typescript
  // Create v5 ai_forecasts table if it doesn't exist
  const hasAIForecasts = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_forecasts'"
  ).get();
  
  if (!hasAIForecasts) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_forecasts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker        TEXT    NOT NULL,
        date          TEXT    NOT NULL,
        forecast_json TEXT    NOT NULL,
        created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(ticker, date)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_forecasts_lookup 
        ON ai_forecasts(ticker, date DESC);
    `);
  }
```

**Validation:**
- [ ] Migration logic added
- [ ] Idempotent (safe to run multiple times)
- [ ] Uses `IF NOT EXISTS` pattern

---

### Task 9: Run Build Pipeline ✅
**Commands:**
```bash
npm run lint
npm run build
```

**Expected:**
- [ ] `npm run lint` passes (zero errors)
- [ ] `npm run build` completes successfully
- [ ] Build time < 60 seconds
- [ ] Zero TypeScript compilation errors
- [ ] Zero warnings

---

### Task 10: Run Test Suite ✅
**Command:**
```bash
npm run test
```

**Expected:**
- [ ] All 318 unit tests pass
- [ ] No new test failures
- [ ] Code coverage ≥ 80%

---

### Task 11: Run E2E Tests ✅
**Command:**
```bash
npm run test:e2e
```

**Expected:**
- [ ] E2E tests pass
- [ ] AI forecast API endpoint works
- [ ] Database operations complete successfully

---

### Task 12: Manual Validation ✅
**Test Database Operations:**

Create a simple test script (`test-ai-forecasts.ts`):

```typescript
import { getAIForecast, insertOrReplaceAIForecast } from './lib/db';

const testForecast = {
  summary: 'Test forecast',
  outlook: 'neutral' as const,
  priceTargets: { conservative: 195, base: 200, aggressive: 205, confidence: 0.8 },
  regimeAnalysis: { classification: 'normal' as const, justification: 'Test', recommendation: 'neutral' },
  tradingLevels: { keySupport: 190, keyResistance: 210, profitTargets: [202, 205, 208], stopLoss: 188 },
  confidence: { overall: 0.75, reasoning: 'Test data' },
  snapshotDate: '2026-03-10',
};

// Test 1: Insert
const inserted = insertOrReplaceAIForecast('SPY', '2026-03-10', testForecast);
console.log('✅ Inserted:', inserted.id);

// Test 2: Retrieve
const retrieved = getAIForecast('SPY', '2026-03-10');
console.log('✅ Retrieved:', retrieved?.id);

// Test 3: Upsert
const updated = insertOrReplaceAIForecast('SPY', '2026-03-10', { ...testForecast, summary: 'Updated' });
console.log('✅ Updated:', updated.id === inserted.id ? 'Same ID' : 'New ID');

// Test 4: Cache lookup
const cached = getAIForecast('SPY', '2026-03-10');
const forecast = JSON.parse(cached!.forecast_json);
console.log('✅ Cache hit:', forecast.summary === 'Updated');
```

**Run:**
```bash
npx tsx test-ai-forecasts.ts
```

**Expected Output:**
```
✅ Inserted: 1
✅ Retrieved: 1
✅ Updated: Same ID
✅ Cache hit: true
```

**Validation:**
- [ ] All operations succeed
- [ ] Upsert updates existing row (same ID)
- [ ] Cache lookup returns correct data

---

### Task 13: Validate CI/CD Pipeline ✅
**Trigger:** Push to `feature/fix-cd-pipeline` branch

**Command:**
```bash
git add .
git commit -m "fix: add AI forecast database layer"
git push origin feature/fix-cd-pipeline
```

**Expected:**
- [ ] GitHub Actions CI workflow starts
- [ ] Lint job passes
- [ ] Test job passes (all 318 tests)
- [ ] Build job passes
- [ ] Deploy job ready to run
- [ ] No workflow errors

**Validation:**
- Check GitHub Actions UI: `https://github.com/[owner]/financial-analyzer/actions`
- All jobs should show green checkmarks

---

## Completion Criteria

**When all tasks complete:**

1. Build succeeds: ✅
   - `npm run build` completes without errors
   - TypeScript compilation passes
   - Zero warnings

2. Tests pass: ✅
   - All 318 unit tests passing
   - E2E tests passing
   - Manual validation script succeeds

3. CI/CD ready: ✅
   - GitHub Actions workflow passes
   - Deploy job can run
   - No build errors in CI environment

4. Functions work: ✅
   - `getAIForecast()` callable and returns correct type
   - `insertOrReplaceAIForecast()` callable and persists data
   - Cache lookups working (4-hour TTL)
   - No regressions in existing features

---

## Quick Reference

**Files Modified:**
- `lib/db.ts` (+120 lines)

**Lines Added:**
- Schema: ~15 lines (SQL)
- Types: ~8 lines (TypeScript interface)
- Methods: ~40 lines (implementation)
- Exports: ~5 lines (module exports)
- Migration: ~20 lines (table creation)

**Total Changes:** ~120 lines in 1 file

---

## Common Issues & Solutions

### Issue 1: TypeScript "Cannot find name 'AIOptionsForecast'"
**Solution:** Import from types file:
```typescript
import type { AIOptionsForecast } from './types/aiOptionsForecast';
```

### Issue 2: Build fails with "Export not found"
**Solution:** Ensure exports are added at module level (after `_instance` creation):
```typescript
export const getAIForecast = _instance.getAIForecast.bind(_instance);
export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);
```

### Issue 3: Database "table ai_forecasts already exists"
**Solution:** Migration uses `IF NOT EXISTS` — safe to ignore. If error persists, check for syntax errors in SQL.

### Issue 4: Tests fail with "Cannot read property 'forecast_json' of null"
**Solution:** Ensure `getAIForecast` returns `null` when no record found (not `undefined`):
```typescript
return (db.prepare(...).get(ticker, date) as AIForecastRow) ?? null;
```

---

## Auto-Announce When Done

After completing all tasks and validating CI passes, report:

```
✅ Engineer Done

• Fixed: Added AI forecast database layer to lib/db.ts
• Build: ✅ Passes (0 errors)
• Tests: ✅ All 318 passing
• CI: ✅ GitHub Actions workflow passing

Changes:
- Added ai_forecasts table (schema v5)
- Implemented getAIForecast() method
- Implemented insertOrReplaceAIForecast() method
- Exported both functions at module level
- Migration logic added (idempotent)

Ready for QA validation.

Cost: ~$X.XX (est. from session_status)
```

---

**Task List Complete — Ready for Engineer Implementation**
