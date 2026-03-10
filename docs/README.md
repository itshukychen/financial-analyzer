# Fix CD Pipeline — Documentation Index

**Feature:** Fix CI/CD Pipeline — Deployment is Failing  
**Status:** Ready for Implementation  
**Worktree:** `/home/claw/worktrees/financial-analyzer/feature/fix-cd-pipeline`  
**Port:** 3003  
**Branch:** `feature/fix-cd-pipeline`  
**Created:** 2026-03-10

---

## Quick Links

- **[PRD](prd-fix-cd-pipeline.md)** — Product Requirements Document (scoping & acceptance criteria)
- **[Design](design-fix-cd-pipeline.md)** — Technical Design Document (architecture & solution)
- **[Tasks](tasks-fix-cd-pipeline.md)** — Implementation Checklist (step-by-step guide)

---

## Problem Summary

The CI/CD pipeline is **completely broken** and preventing deployments. The build fails at TypeScript compilation because two database functions are imported but not exported:

- `getAIForecast(ticker: string, date: string)`
- `insertOrReplaceAIForecast(ticker: string, date: string, forecast: AIOptionsForecast)`

These functions are required by the AI Options Forecast feature but were never implemented in the database layer (`lib/db.ts`).

---

## Solution Overview

**Add complete database layer support for AI forecasts:**

1. Add `ai_forecasts` table to database schema (v5)
2. Implement `getAIForecast()` method in `DbInstance` class
3. Implement `insertOrReplaceAIForecast()` method in `DbInstance` class
4. Export both functions at module level (following existing pattern)
5. Add migration logic (idempotent, backward compatible)

**Total Changes:** ~120 lines added to `lib/db.ts`  
**Risk Level:** LOW (isolated changes, additive only)  
**Implementation Time:** 1-2 hours

---

## File Structure

```
/home/claw/worktrees/financial-analyzer/feature/fix-cd-pipeline/
├── docs/
│   ├── README.md                      ← You are here
│   ├── prd-fix-cd-pipeline.md         ← Product requirements
│   ├── design-fix-cd-pipeline.md      ← Technical design
│   └── tasks-fix-cd-pipeline.md       ← Implementation tasks
├── lib/
│   ├── db.ts                          ← File to modify
│   ├── aiOptionsForecast.ts           ← Uses missing functions
│   └── types/
│       └── aiOptionsForecast.ts       ← Type definitions
└── app/
    └── api/
        └── options/
            └── ai-forecast/
                └── route.ts           ← API endpoint using missing functions
```

---

## Implementation Workflow

```
PM (scoped) → Architect (designed) → Engineer (implementing) → QA (validating) → Reviewer (approving) → Merge
                      ▲ YOU ARE HERE
```

**Next Steps:**
1. Engineer agent implements tasks from `tasks-fix-cd-pipeline.md`
2. QA agent validates build + tests + E2E functionality
3. Reviewer agent reviews PR and approves
4. Merge to `main` → Deploy to production (port 3000)

---

## Key Files to Understand

### 1. `lib/db.ts` (Database Layer)
**Current State:** Exports database functions for reports, option snapshots, projections, and prices  
**Missing:** AI forecast functions (`getAIForecast`, `insertOrReplaceAIForecast`)  
**Pattern:** All database access goes through `DbInstance` class → exported at module level

### 2. `lib/aiOptionsForecast.ts` (AI Integration)
**Purpose:** Generates AI-powered market analysis using Claude API  
**Cache Logic:** 4-hour TTL on cached forecasts (avoids redundant API calls)  
**Dependencies:** Imports `getAIForecast` and `insertOrReplaceAIForecast` from `lib/db`

### 3. `app/api/options/ai-forecast/route.ts` (API Endpoint)
**Route:** `POST /api/options/ai-forecast`  
**Inputs:** `{ ticker, date, regenerate? }`  
**Output:** AI forecast + cache metadata  
**Dependencies:** Imports `getAIForecast` from `lib/db`

---

## Database Schema (Current vs. Required)

### Current Schema (v4)
```sql
CREATE TABLE reports (...);
CREATE TABLE option_snapshots (...);
CREATE TABLE option_projections (...);
CREATE TABLE option_prices (...);
```

### Required Schema (v5)
```sql
CREATE TABLE ai_forecasts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker        TEXT    NOT NULL,
  date          TEXT    NOT NULL,
  forecast_json TEXT    NOT NULL,           -- Serialized AIOptionsForecast
  created_at    INTEGER NOT NULL,           -- Unix timestamp for cache TTL
  UNIQUE(ticker, date)
);
CREATE INDEX idx_ai_forecasts_lookup ON ai_forecasts(ticker, date DESC);
```

---

## Testing Strategy

### Unit Tests
**Existing:** 318 tests (all must continue to pass)  
**New:** None required (infrastructure change, not business logic)

### Integration Tests
**Manual validation script** (see `tasks-fix-cd-pipeline.md`):
- Insert forecast → verify ID
- Retrieve forecast → verify data
- Update forecast → verify upsert (same ID)
- Cache lookup → verify JSON deserialization

### E2E Tests
**Command:** `npm run test:e2e`  
**Validates:**
- API endpoint returns 200 OK
- Database operations complete successfully
- Cache lookups work correctly
- Full request/response cycle

---

## CI/CD Pipeline

### Current State (Broken ❌)
```
git push → GitHub Actions CI
  ├─ Lint: ❌ Passes
  ├─ Test: ❌ Passes
  ├─ Build: ❌ FAILS (TypeScript compilation error)
  └─ Deploy: ⏸️  Blocked (can't run if build fails)
```

### Expected State (Fixed ✅)
```
git push → GitHub Actions CI
  ├─ Lint: ✅ Passes
  ├─ Test: ✅ Passes (all 318 tests)
  ├─ Build: ✅ Passes (TypeScript compiles successfully)
  └─ Deploy: ✅ Runs (pushes to production on port 3000)
```

---

## Deployment Plan

### Pre-Merge Checklist
- [ ] All implementation tasks complete (1-13)
- [ ] Build passes locally (`npm run build`)
- [ ] Tests pass locally (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Manual validation script succeeds
- [ ] GitHub Actions CI workflow passes

### Merge & Deploy
1. Merge `feature/fix-cd-pipeline` → `main`
2. GitHub Actions CI runs automatically
3. CI jobs: lint → test → build → deploy
4. Deploy job pushes to production (port 3000)
5. Verify deployment health check

### Post-Deploy Validation
- [ ] Application starts without errors
- [ ] AI forecast API endpoint responds
- [ ] Cache lookups working
- [ ] No new error logs
- [ ] Monitor for 1 hour

---

## Cost Estimate

### Development
- PM scoping: ~$0.15 (2 min @ Claude Sonnet 4.5)
- Architect design: ~$0.30 (3 min @ Claude Sonnet 4.5)
- Engineer implementation: ~$0.80 (8 min @ Claude Sonnet 4.5)
- QA validation: ~$0.20 (2 min @ Claude Sonnet 4.5)
- Reviewer approval: ~$0.15 (1 min @ Claude Sonnet 4.5)

**Total Estimated Cost:** ~$1.60 (end-to-end pipeline)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Schema migration failure | LOW | HIGH | Use `IF NOT EXISTS`, test on copy, backup DB |
| Type mismatch at runtime | LOW | MEDIUM | Full TypeScript strict mode, E2E tests |
| Performance degradation | VERY LOW | LOW | Index on `(ticker, date)`, monitor query time |
| Breaking existing functionality | VERY LOW | MEDIUM | Additive changes only, full test suite |

**Overall Risk:** LOW (isolated, well-tested, backward compatible)

---

## Success Criteria

### Build Success
- ✅ `npm run build` completes in < 60 seconds
- ✅ Zero TypeScript compilation errors
- ✅ Zero build warnings

### Test Success
- ✅ All 318 unit tests passing
- ✅ E2E tests passing
- ✅ Code coverage ≥ 80%

### CI/CD Success
- ✅ GitHub Actions CI workflow succeeds
- ✅ Deploy job triggers after CI passes
- ✅ Deployment to production succeeds

### Functional Success
- ✅ `getAIForecast()` function callable and returns correct type
- ✅ `insertOrReplaceAIForecast()` function callable and persists data
- ✅ Cache lookups working (4-hour TTL)
- ✅ API endpoint returns 200 OK
- ✅ No regressions in existing features

---

## Related Documentation

### Internal Links
- [PRD](prd-fix-cd-pipeline.md) — Full product requirements and acceptance criteria
- [Design](design-fix-cd-pipeline.md) — Detailed technical design and architecture
- [Tasks](tasks-fix-cd-pipeline.md) — Step-by-step implementation checklist

### External Resources
- [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3/wiki/API) — Database driver API
- [TypeScript strict mode](https://www.typescriptlang.org/tsconfig#strict) — Type safety configuration
- [GitHub Actions docs](https://docs.github.com/en/actions) — CI/CD workflow reference

---

## Questions?

If anything is unclear:
1. Check the [Design Doc](design-fix-cd-pipeline.md) for technical details
2. Check the [Tasks Doc](tasks-fix-cd-pipeline.md) for implementation steps
3. Check the [PRD](prd-fix-cd-pipeline.md) for requirements and acceptance criteria

---

**Status:** Ready for Engineer Implementation  
**Last Updated:** 2026-03-10  
**Architect:** OpenClaw Subagent (architect)
