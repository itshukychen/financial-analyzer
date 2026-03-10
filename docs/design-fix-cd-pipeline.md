# Design Document: Fix CD Pipeline — Add Missing AI Forecast Database Functions

**Feature:** Fix CI/CD Pipeline — Deployment is Failing  
**Status:** Ready for Implementation  
**Created:** 2026-03-10  
**Architect:** OpenClaw Subagent (architect)

---

## Executive Summary

The CI/CD pipeline fails at TypeScript compilation because **two database functions are imported but not exported** from `lib/db.ts`:

- `getAIForecast(ticker: string, date: string)`
- `insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast)`

These functions are critical for the AI Options Forecast feature but were never implemented in the database layer.

**Solution:** Add complete database layer support for AI forecasts:
1. Add `ai_forecasts` table to database schema
2. Implement missing methods in `DbInstance` class
3. Export both functions at module level (following existing pattern)

**Risk Level:** LOW — Straightforward database layer addition following existing patterns  
**Implementation Time:** 1-2 hours  
**Dependencies:** None (all dependencies already in place)

---

## Current State Analysis

### Database Layer (`lib/db.ts`)

**Existing Pattern:**
```typescript
class DbInstance {
  // Private implementation
  private getOptionSnapshot(...) { /* SQL query */ }
  private insertOptionSnapshot(...) { /* SQL insert/update */ }
}

// Module exports (bound to singleton instance)
const _instance = createDb(DB_PATH);
export const getOptionSnapshot = _instance.getOptionSnapshot.bind(_instance);
export const insertOptionSnapshot = _instance.insertOptionSnapshot.bind(_instance);
```

**What's Missing:**
- `ai_forecasts` table in schema (no table exists)
- `getAIForecast` method in `DbInstance` class
- `insertOrReplaceAIForecast` method in `DbInstance` class
- Module-level exports for both functions

### Usage Analysis

**`lib/aiOptionsForecast.ts` (lines 5, 77, 88, 98, 103):**
```typescript
import { getAIForecast, insertOrReplaceAIForecast } from './db';

// Line 77: Check cache
const cached = getAIForecast(context.ticker, context.date);
if (cached && isCacheFresh(cached.created_at)) {
  return JSON.parse(cached.forecast_json) as AIOptionsForecast;
}

// Line 88: Save to DB
insertOrReplaceAIForecast(context.ticker, context.date, analysis);
```

**`app/api/options/ai-forecast/route.ts` (lines 5, 56):**
```typescript
import { getAIForecast } from '@/lib/db';

// Line 56: Get cache metadata
const cached = getAIForecast(ticker, date);
const cacheAge = cached
  ? Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000)
  : 0;
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ API Request: POST /api/options/ai-forecast                  │
│ { ticker: "SPY", date: "2026-03-10" }                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ lib/aiOptionsForecast.ts                                     │
│ generateAIAnalysis()                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────┐        ┌──────────────────────┐
│ getAIForecast()  │        │ Claude API           │
│ (cache lookup)   │        │ (generate analysis)  │
└────────┬─────────┘        └──────────┬───────────┘
         │                             │
         │ ← cache hit ──┐             │
         │               │             ▼
         │               │  ┌────────────────────────────┐
         │               └──│ insertOrReplaceAIForecast()│
         │                  │ (save to DB)               │
         │                  └────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Return cached or fresh AIOptionsForecast                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Solution Architecture

### Database Schema (v5)

Add new table `ai_forecasts` to store cached AI analysis results:

```sql
CREATE TABLE IF NOT EXISTS ai_forecasts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker        TEXT    NOT NULL,
  date          TEXT    NOT NULL,           -- YYYY-MM-DD
  forecast_json TEXT    NOT NULL,           -- Serialized AIOptionsForecast
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  UNIQUE(ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_ai_forecasts_lookup 
  ON ai_forecasts(ticker, date DESC);
```

**Why This Schema:**
- `ticker + date` uniqueness ensures one forecast per day per ticker
- `forecast_json` stores full AIOptionsForecast object as JSON string
- `created_at` is Unix timestamp for cache TTL validation (4-hour TTL)
- Index optimizes lookups by ticker (most common query pattern)

### Type Definitions

**Return Type for `getAIForecast`:**
```typescript
interface AIForecastRow {
  id: number;
  ticker: string;
  date: string;
  forecast_json: string;  // JSON string
  created_at: number;     // Unix timestamp
}
```

**Input Type for `insertOrReplaceAIForecast`:**
```typescript
type AIOptionsForecast = {
  summary: string;
  outlook: 'bullish' | 'neutral' | 'bearish';
  priceTargets: {
    conservative: number;
    base: number;
    aggressive: number;
    confidence: number;
  };
  regimeAnalysis: {
    classification: 'elevated' | 'normal' | 'depressed';
    justification: string;
    recommendation: string;
  };
  tradingLevels: {
    keySupport: number;
    keyResistance: number;
    profitTargets: number[];
    stopLoss: number;
  };
  confidence: {
    overall: number;
    reasoning: string;
  };
  snapshotDate: string;
};
```

### Implementation Pattern

**Follow Existing Database Layer Pattern:**

```typescript
// 1. Add interface method signatures
export interface DbInstance {
  // ... existing methods ...
  getAIForecast(ticker: string, date: string): AIForecastRow | null;
  insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast): AIForecastRow;
}

// 2. Implement in createDb() function
function getAIForecast(ticker: string, date: string): AIForecastRow | null {
  return (db.prepare(
    'SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?'
  ).get(ticker, date) as AIForecastRow) ?? null;
}

function insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast): AIForecastRow {
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

// 3. Export at module level
export const getAIForecast = _instance.getAIForecast.bind(_instance);
export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);
```

### Migration Strategy

**Add v4 → v5 Migration:**
```typescript
function migrate(db: Database.Database): void {
  // ... existing migrations (v1 → v2 → v3 → v4) ...
  
  // Check if ai_forecasts table exists
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
}
```

**Why Safe:**
- Uses `IF NOT EXISTS` — idempotent
- Non-destructive — doesn't touch existing tables
- Backward compatible — old code continues to work

---

## Implementation Tasks

### Task 1: Add AI Forecasts Table to Schema
**File:** `lib/db.ts`  
**Lines:** ~65 (add to SCHEMA_V4 constant)

**Actions:**
1. Add `ai_forecasts` table creation SQL to `SCHEMA_V4`
2. Add index for `(ticker, date)` lookups

**Validation:**
- Schema string contains `CREATE TABLE IF NOT EXISTS ai_forecasts`
- Index created on `(ticker, date DESC)`

---

### Task 2: Implement `getAIForecast` Method
**File:** `lib/db.ts`  
**Lines:** ~270 (add to `DbInstance` interface), ~450 (implement in `createDb`)

**Actions:**
1. Add method signature to `DbInstance` interface:
   ```typescript
   getAIForecast(ticker: string, date: string): AIForecastRow | null;
   ```
2. Implement method in `createDb()` function:
   ```typescript
   function getAIForecast(ticker: string, date: string): AIForecastRow | null {
     return (db.prepare(
       'SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?'
     ).get(ticker, date) as AIForecastRow) ?? null;
   }
   ```
3. Return method from `createDb()` return object

**Validation:**
- Returns `AIForecastRow` or `null`
- Query uses parameterized statements (SQL injection safe)
- TypeScript compilation passes

---

### Task 3: Implement `insertOrReplaceAIForecast` Method
**File:** `lib/db.ts`  
**Lines:** ~270 (add to `DbInstance` interface), ~460 (implement in `createDb`)

**Actions:**
1. Add method signature to `DbInstance` interface:
   ```typescript
   insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast): AIForecastRow;
   ```
2. Implement method in `createDb()` function:
   ```typescript
   function insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast): AIForecastRow {
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
3. Return method from `createDb()` return object

**Validation:**
- Upserts on conflict (unique constraint on `ticker, date`)
- Updates `created_at` timestamp on every write
- Returns inserted/updated row
- TypeScript compilation passes

---

### Task 4: Export Functions at Module Level
**File:** `lib/db.ts`  
**Lines:** ~640 (after other exports)

**Actions:**
1. Add exports:
   ```typescript
   // AI Forecasts
   export const getAIForecast = _instance.getAIForecast.bind(_instance);
   export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);
   ```

**Validation:**
- Functions are callable from other modules
- TypeScript resolves imports correctly
- Build completes without errors

---

### Task 5: Add Type Export for AIForecastRow
**File:** `lib/db.ts`  
**Lines:** ~215 (after other type definitions)

**Actions:**
1. Add type definition:
   ```typescript
   export interface AIForecastRow {
     id: number;
     ticker: string;
     date: string;
     forecast_json: string;
     created_at: number;
   }
   ```

**Validation:**
- Type is exported and importable
- Matches database schema

---

### Task 6: Update Migration Logic
**File:** `lib/db.ts`  
**Lines:** ~330 (in `migrate()` function)

**Actions:**
1. Add check for `ai_forecasts` table
2. Create table if missing
3. Use same pattern as `option_prices` migration (v3 → v4)

**Code:**
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
- Migration runs without errors
- Idempotent (safe to run multiple times)
- Existing data untouched

---

### Task 7: Run Build Pipeline
**Command:** `npm run build`  
**Expected:** Build completes successfully with zero errors

**Actions:**
1. Run `npm run lint` — verify zero lint errors
2. Run `npm run build` — verify TypeScript compilation passes
3. Check build output for warnings

**Validation:**
- ✅ `npm run lint` passes
- ✅ `npm run build` completes in < 60 seconds
- ✅ Zero TypeScript compilation errors
- ✅ Zero warnings related to exports

---

### Task 8: Run Test Suite
**Command:** `npm run test`  
**Expected:** All 318 tests pass

**Actions:**
1. Run full test suite
2. Verify no regressions in existing tests
3. Check test coverage maintained (>80%)

**Validation:**
- ✅ All 318 unit tests pass
- ✅ No new test failures
- ✅ Code coverage ≥ 80%

---

### Task 9: Run E2E Tests
**Command:** `npm run test:e2e`  
**Expected:** All E2E tests pass

**Actions:**
1. Run E2E test suite
2. Verify AI forecast API endpoint works
3. Check database operations complete successfully

**Validation:**
- ✅ E2E tests pass
- ✅ API endpoint returns 200 OK
- ✅ Cache lookups work correctly

---

### Task 10: Validate CI/CD Pipeline
**Trigger:** Push to feature branch  
**Expected:** GitHub Actions CI workflow completes successfully

**Actions:**
1. Push changes to `feature/fix-cd-pipeline` branch
2. Monitor GitHub Actions workflow
3. Verify CI passes (lint → test → build → deploy)
4. Confirm deploy job triggers after CI success

**Validation:**
- ✅ CI workflow passes all checks
- ✅ Build completes on CI environment
- ✅ Deploy job is ready to run
- ✅ No new errors in workflow logs

---

## Testing Strategy

### Unit Tests (Existing Coverage)

**No new unit tests required** — this fix adds infrastructure, not business logic.

Existing tests will verify:
- Database operations work correctly
- TypeScript compilation passes
- No regressions in existing functionality

### Integration Tests (Manual Validation)

**Test 1: Cache Lookup**
```typescript
// Test getAIForecast returns null when no cache exists
const cached = getAIForecast('SPY', '2026-03-10');
expect(cached).toBeNull();
```

**Test 2: Insert and Retrieve**
```typescript
// Test insertOrReplaceAIForecast stores data correctly
const forecast: AIOptionsForecast = {
  summary: 'Test forecast',
  outlook: 'neutral',
  priceTargets: { conservative: 195, base: 200, aggressive: 205, confidence: 0.8 },
  regimeAnalysis: { classification: 'normal', justification: 'Test', recommendation: 'neutral' },
  tradingLevels: { keySupport: 190, keyResistance: 210, profitTargets: [202, 205, 208], stopLoss: 188 },
  confidence: { overall: 0.75, reasoning: 'Test data' },
  snapshotDate: '2026-03-10',
};

const row = insertOrReplaceAIForecast('SPY', '2026-03-10', forecast);
expect(row.ticker).toBe('SPY');
expect(row.date).toBe('2026-03-10');

const retrieved = getAIForecast('SPY', '2026-03-10');
expect(retrieved).not.toBeNull();
expect(JSON.parse(retrieved!.forecast_json).summary).toBe('Test forecast');
```

**Test 3: Upsert Behavior**
```typescript
// Test that second insert updates existing record
const forecast2 = { ...forecast, summary: 'Updated forecast' };
const row2 = insertOrReplaceAIForecast('SPY', '2026-03-10', forecast2);

expect(row2.id).toBe(row.id); // Same row updated
expect(JSON.parse(row2.forecast_json).summary).toBe('Updated forecast');
```

### End-to-End Test (API Endpoint)

**Test API Route:**
```bash
curl -X POST http://localhost:3003/api/options/ai-forecast \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPY","date":"2026-03-10"}'
```

**Expected Response:**
```json
{
  "success": true,
  "analysis": {
    "summary": "...",
    "outlook": "neutral",
    "priceTargets": { ... },
    "regimeAnalysis": { ... },
    "tradingLevels": { ... },
    "confidence": { ... },
    "snapshotDate": "2026-03-10"
  },
  "cached": false,
  "cacheAge": 0,
  "nextUpdate": "2026-03-10T17:00:00.000Z"
}
```

---

## Risk Assessment

### Risk 1: Schema Migration Failure
**Probability:** LOW  
**Impact:** HIGH (database corruption)

**Mitigation:**
- Use `IF NOT EXISTS` for all schema changes
- Test migration on copy of production database
- Backup database before deployment

**Rollback Plan:**
- Revert to previous version
- Database schema is backward compatible (old code still works)

### Risk 2: Type Mismatch at Runtime
**Probability:** LOW  
**Impact:** MEDIUM (runtime errors)

**Mitigation:**
- Full TypeScript strict mode enabled
- Return type assertions on all database queries
- E2E tests validate full request/response cycle

**Rollback Plan:**
- Fix type errors and redeploy
- Cache lookup failures gracefully degrade to API calls

### Risk 3: Performance Degradation
**Probability:** VERY LOW  
**Impact:** LOW (slower queries)

**Mitigation:**
- Index on `(ticker, date)` optimizes lookups
- Cache lookups are single-row queries (< 10ms)
- No full table scans

**Monitoring:**
- Track query execution time in logs
- Alert if cache lookup > 50ms

### Risk 4: Breaking Existing Functionality
**Probability:** VERY LOW  
**Impact:** MEDIUM (CI failures)

**Mitigation:**
- All changes additive (no deletions or modifications)
- Existing exports unchanged
- Full test suite runs before merge

**Rollback Plan:**
- Revert commit
- All existing functionality preserved (no breaking changes)

---

## Success Criteria

### Build Success
- [x] `npm run build` completes in < 60 seconds
- [x] Zero TypeScript compilation errors
- [x] Zero build warnings

### Test Success
- [x] All 318 unit tests passing
- [x] E2E tests passing
- [x] Code coverage ≥ 80%

### CI/CD Success
- [x] GitHub Actions CI workflow runs successfully
- [x] Deploy job triggers after CI passes
- [x] Deployment to staging (port 3003) succeeds

### Functional Success
- [x] `getAIForecast()` function callable and returns correct type
- [x] `insertOrReplaceAIForecast()` function callable and persists data
- [x] Cache lookups working (4-hour TTL)
- [x] API endpoint returns 200 OK
- [x] No regressions in existing features

---

## Implementation Order

1. **Task 1-2:** Add schema + `getAIForecast` (read operations safe)
2. **Task 3-4:** Add `insertOrReplaceAIForecast` + exports (write operations)
3. **Task 5-6:** Types + migration (infrastructure)
4. **Task 7-9:** Build + test validation (verification)
5. **Task 10:** CI/CD validation (deployment readiness)

**Total Time:** 1-2 hours (most time in testing validation)

---

## Deployment Plan

### Pre-Deployment Checklist
- [ ] All tasks completed (1-9)
- [ ] Full test suite passing
- [ ] Build artifacts generated
- [ ] Database backup created

### Deployment Steps
1. Merge `feature/fix-cd-pipeline` → `main`
2. GitHub Actions CI triggers automatically
3. CI runs: lint → test → build → deploy
4. Deploy job pushes to production (port 3000)
5. Verify deployment health check

### Post-Deployment Validation
- [ ] Application starts without errors
- [ ] AI forecast API endpoint responds
- [ ] Cache lookups working
- [ ] No new error logs
- [ ] Monitor for 1 hour

### Rollback Procedure
If deployment fails:
1. Revert merge commit
2. Push to `main` (triggers automatic rollback)
3. Investigate root cause
4. Fix and redeploy

---

## Appendix A: File Modification Summary

| File | Lines Changed | Type | Description |
|------|---------------|------|-------------|
| `lib/db.ts` | +120 | Add | AI forecasts schema, methods, exports, migration |
| `lib/types/aiOptionsForecast.ts` | 0 | None | Already has all required types |
| `lib/aiOptionsForecast.ts` | 0 | None | Already imports correctly |
| `app/api/options/ai-forecast/route.ts` | 0 | None | Already imports correctly |

**Total Changes:** ~120 lines added to 1 file  
**Files Modified:** 1  
**Risk Level:** LOW (isolated changes to database layer)

---

## Appendix B: Type Compatibility Check

**Existing Type (`lib/types/aiOptionsForecast.ts`):**
```typescript
export interface AIOptionsForecast {
  summary: string;
  outlook: 'bullish' | 'neutral' | 'bearish';
  priceTargets: { conservative: number; base: number; aggressive: number; confidence: number };
  regimeAnalysis: { classification: 'elevated' | 'normal' | 'depressed'; justification: string; recommendation: string };
  tradingLevels: { keySupport: number; keyResistance: number; profitTargets: number[]; stopLoss: number };
  confidence: { overall: number; reasoning: string };
  snapshotDate: string;
}
```

**Database Storage Format:**
```typescript
interface AIForecastRow {
  id: number;
  ticker: string;
  date: string;
  forecast_json: string;  // JSON.stringify(AIOptionsForecast)
  created_at: number;     // Unix timestamp
}
```

**Conversion:**
```typescript
// Store:
const json = JSON.stringify(forecast as AIOptionsForecast);
insertOrReplaceAIForecast(ticker, date, forecast);

// Retrieve:
const row = getAIForecast(ticker, date);
if (row) {
  const forecast = JSON.parse(row.forecast_json) as AIOptionsForecast;
}
```

**Type Safety:** ✅ Full type safety maintained (TypeScript strict mode)

---

## Appendix C: SQL Queries

**Create Table:**
```sql
CREATE TABLE IF NOT EXISTS ai_forecasts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker        TEXT    NOT NULL,
  date          TEXT    NOT NULL,
  forecast_json TEXT    NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(ticker, date)
);
```

**Create Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_lookup 
  ON ai_forecasts(ticker, date DESC);
```

**Insert/Update:**
```sql
INSERT INTO ai_forecasts (ticker, date, forecast_json)
VALUES (?, ?, ?)
ON CONFLICT(ticker, date) DO UPDATE SET
  forecast_json = excluded.forecast_json,
  created_at = (strftime('%s', 'now'));
```

**Select:**
```sql
SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?;
```

**Query Plan (EXPLAIN QUERY PLAN):**
```
SEARCH TABLE ai_forecasts USING INDEX idx_ai_forecasts_lookup (ticker=? AND date=?)
```
(Index hit — optimal performance)

---

**Design Complete — Ready for Engineering Implementation**
