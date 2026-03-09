# Implementation Tasks: SPX Option Price Chart Overlay

**Feature:** Add SPX June 17th 3000 Strike Option Price to Chart  
**Sprint:** TBD  
**Estimated Effort:** 3-4 days (1 engineer)  
**Created:** 2026-03-09

---

## Task Breakdown

Tasks are organized by phase and dependency. Each task includes:
- **ID:** Unique identifier
- **Title:** Task description
- **Owner:** Role responsible (Engineer/QA)
- **Estimate:** Time in hours
- **Dependencies:** Blocking tasks
- **Acceptance Criteria:** Definition of done

---

## Phase 1: Database & Backend (Day 1-2)

### DB-001: Create option_prices Table

**Owner:** Engineer  
**Estimate:** 1h  
**Dependencies:** None  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Create migration file `migrations/001_add_option_prices.sql`
- [ ] Define schema with all required fields (ticker, strike, expiry_date, option_type, timestamp, price, bid, ask, volume)
- [ ] Add unique constraint on (ticker, strike, expiry_date, option_type, timestamp)
- [ ] Create composite index on lookup columns
- [ ] Create index on expiry_date
- [ ] Test migration locally (apply + rollback)
- [ ] Update migration runner to include new migration

**Acceptance Criteria:**
- ✅ Migration runs without errors
- ✅ Table created with correct schema
- ✅ Indexes created successfully
- ✅ Unique constraint enforced (insert duplicate fails)

---

### DB-002: Create Backfill Script

**Owner:** Engineer  
**Estimate:** 3h  
**Dependencies:** DB-001  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Create `scripts/backfill-option-prices.ts`
- [ ] Accept CLI args: `--ticker`, `--strike`, `--expiry`, `--type`, `--startDate`, `--endDate`
- [ ] Fetch historical option prices from Yahoo Finance (or fallback source)
- [ ] Parse response and transform to schema format
- [ ] Insert into `option_prices` table (ignore duplicates)
- [ ] Add progress logging (X of Y days processed)
- [ ] Handle errors gracefully (rate limits, missing data)
- [ ] Add dry-run mode for testing

**Acceptance Criteria:**
- ✅ Script accepts all required arguments
- ✅ Successfully fetches data from source
- ✅ Inserts data into database without errors
- ✅ Handles duplicate inserts gracefully
- ✅ Logs progress and errors clearly
- ✅ Dry-run mode works (no DB writes)

---

### DB-003: Backfill SPX 3000 Jun17 Data

**Owner:** Engineer  
**Estimate:** 1h  
**Dependencies:** DB-002  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Run backfill script for SPX 3000 Jun17 2026 call
- [ ] Verify data inserted (check row count, date range)
- [ ] Spot-check prices against known market data
- [ ] Document backfill parameters in README or wiki

**Acceptance Criteria:**
- ✅ At least 30 days of historical data loaded (or max available)
- ✅ Data passes validation (no NULL prices, timestamps in range)
- ✅ Sample queries return expected results

---

### API-001: Create /api/market/options-overlay Endpoint

**Owner:** Engineer  
**Estimate:** 4h  
**Dependencies:** DB-001  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Create `pages/api/market/options-overlay.ts`
- [ ] Parse and validate query parameters (ticker, strike, expiry, optionType, range)
- [ ] Calculate start/end timestamps based on range
- [ ] Query underlying prices from `market_data` table
- [ ] Query option prices from `option_prices` table
- [ ] Implement `mergeTimeSeries()` helper (inner join on timestamp)
- [ ] Format response payload per schema
- [ ] Add error handling (400, 404, 500)
- [ ] Set Cache-Control headers based on range
- [ ] Add input validation (whitelist tickers, validate strike/expiry format)

**Acceptance Criteria:**
- ✅ Endpoint returns 200 with valid dual-series data
- ✅ Returns 400 for missing/invalid parameters
- ✅ Returns 404 when no option data exists
- ✅ Response matches schema (points array, current values)
- ✅ Cache headers set correctly
- ✅ Response time <500ms for 1D range, <1s for 1Y range

---

### API-002: Add Unit Tests for API Endpoint

**Owner:** Engineer  
**Estimate:** 2h  
**Dependencies:** API-001  
**Priority:** P1

**Tasks:**
- [ ] Create `tests/unit/api/options-overlay.test.ts`
- [ ] Test valid request returns 200 and correct data structure
- [ ] Test missing parameters return 400
- [ ] Test invalid ticker/strike/expiry return 400
- [ ] Test non-existent option returns 404
- [ ] Test cache headers match expected values per range
- [ ] Test time range calculation (1D, 1M, 1Y)
- [ ] Test data merge logic (misaligned timestamps)
- [ ] Achieve >80% code coverage

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Edge cases covered (empty results, single data point, etc.)
- ✅ Code coverage ≥80% for API handler

---

## Phase 2: Frontend (Day 2-3)

### FE-001: Create OptionsOverlaySelector Component

**Owner:** Engineer  
**Estimate:** 3h  
**Dependencies:** None (can parallelize with backend)  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Create `src/components/OptionsOverlaySelector.tsx`
- [ ] Define component props (ticker, onOverlayChange, defaultConfig)
- [ ] Build UI layout: strike input, expiry picker, option type dropdown
- [ ] Add "Apply" and "Clear" buttons
- [ ] Implement state management (local useState)
- [ ] Call `onOverlayChange` callback on Apply/Clear
- [ ] For MVP: hardcode SPX 3000 Jun17 2026 call as default
- [ ] Style with existing UI framework (Tailwind/CSS modules)
- [ ] Make responsive (mobile-friendly)

**Acceptance Criteria:**
- ✅ Component renders without errors
- ✅ Apply button triggers callback with correct config
- ✅ Clear button triggers callback with null
- ✅ Default values pre-populated
- ✅ UI matches design mockup
- ✅ Accessible (keyboard navigation, ARIA labels)

---

### FE-002: Enhance MarketChart Component for Dual-Series

**Owner:** Engineer  
**Estimate:** 4h  
**Dependencies:** FE-001  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Modify `src/components/MarketChart.tsx`
- [ ] Accept optional `optionOverlay` prop (OverlayConfig | null)
- [ ] When overlay is null: render single-series (existing behavior)
- [ ] When overlay is set: fetch data from `/api/market/options-overlay`
- [ ] Add second line series to lightweight-charts instance
- [ ] Configure dual Y-axis (left = underlying, right = option)
- [ ] Style option series (different color, dashed line optional)
- [ ] Update legend to show both series
- [ ] Handle loading states (show spinner while fetching)
- [ ] Handle errors (display error message if API fails)

**Acceptance Criteria:**
- ✅ Chart displays single series when no overlay
- ✅ Chart displays dual series when overlay active
- ✅ Both series aligned on time axis
- ✅ Y-axes scaled appropriately
- ✅ Legend shows both series with distinct colors
- ✅ Loading spinner shown during data fetch
- ✅ Error message displayed on API failure

---

### FE-003: Enhance Tooltip for Dual Values

**Owner:** Engineer  
**Estimate:** 2h  
**Dependencies:** FE-002  
**Priority:** P1

**Tasks:**
- [ ] Modify tooltip logic in `MarketChart.tsx`
- [ ] Detect which series are active (underlying only vs. underlying + option)
- [ ] On hover: display both values if dual-series mode
- [ ] Format tooltip: show labels + prices
- [ ] Style tooltip (readable, non-overlapping)
- [ ] Test on mobile (touch events)

**Acceptance Criteria:**
- ✅ Tooltip shows underlying price only when no overlay
- ✅ Tooltip shows both prices when overlay active
- ✅ Tooltip positioned correctly (no overlap with chart)
- ✅ Works on desktop (hover) and mobile (touch)

---

### FE-004: Integrate OptionsOverlaySelector into Chart Page

**Owner:** Engineer  
**Estimate:** 2h  
**Dependencies:** FE-001, FE-002  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Import `OptionsOverlaySelector` into chart page component
- [ ] Add state for overlay config (`useState<OverlayConfig | null>`)
- [ ] Pass state setter to `OptionsOverlaySelector.onOverlayChange`
- [ ] Pass overlay config to `MarketChart` component
- [ ] Add UI controls (toggle button or collapsible panel)
- [ ] Test full interaction flow (select → apply → chart updates)

**Acceptance Criteria:**
- ✅ "Add Option Overlay" button visible on chart page
- ✅ Clicking button opens selector
- ✅ Applying overlay updates chart
- ✅ Clearing overlay reverts to single-series

---

### FE-005: Add E2E Tests for Chart Overlay

**Owner:** QA / Engineer  
**Estimate:** 3h  
**Dependencies:** FE-004  
**Priority:** P1

**Tasks:**
- [ ] Create `tests/e2e/options-overlay.spec.ts`
- [ ] Test: Navigate to chart, add overlay, verify dual series
- [ ] Test: Toggle overlay on/off
- [ ] Test: Hover tooltip shows both values
- [ ] Test: Change range (1D → 1M), verify chart updates
- [ ] Test: Error handling (invalid strike, API down)
- [ ] Test: Mobile viewport (responsive layout)
- [ ] Run tests in CI pipeline

**Acceptance Criteria:**
- ✅ All E2E tests pass locally
- ✅ Tests pass in CI environment
- ✅ Tests cover happy path + error cases
- ✅ No flaky tests (run 3x without failures)

---

## Phase 3: Testing & Polish (Day 3-4)

### QA-001: Manual QA Testing

**Owner:** QA  
**Estimate:** 3h  
**Dependencies:** FE-004  
**Priority:** P1

**Test Cases:**
- [ ] Load chart, verify single-series renders correctly
- [ ] Add option overlay, verify dual-series appears
- [ ] Hover over chart, verify tooltip shows both values
- [ ] Toggle overlay off, verify chart reverts
- [ ] Change date range (1D → 1M → 1Y), verify both series update
- [ ] Test with different strikes/expiries (if available)
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test with slow network (throttle to 3G)
- [ ] Test API error scenarios (kill API server, verify error message)

**Acceptance Criteria:**
- ✅ All test cases pass
- ✅ No visual glitches or layout issues
- ✅ Performance acceptable (chart loads <2s)
- ✅ Accessibility: keyboard navigation works, screen reader compatible

---

### QA-002: Performance Testing

**Owner:** Engineer / QA  
**Estimate:** 2h  
**Dependencies:** API-001, FE-002  
**Priority:** P1

**Tasks:**
- [ ] Measure API response time for each range (1D, 5D, 1M, 3M, 6M, 1Y)
- [ ] Measure chart render time with dual-series
- [ ] Measure time-to-interactive (TTI) on chart page
- [ ] Profile database queries (EXPLAIN QUERY PLAN)
- [ ] Check for memory leaks (load/unload chart 10x)
- [ ] Verify cache hit rates (check response headers)
- [ ] Document performance metrics in test report

**Acceptance Criteria:**
- ✅ API response time: <500ms (1D), <1s (1Y)
- ✅ Chart render time: <1s for dual-series
- ✅ TTI: <2s on desktop, <3s on mobile
- ✅ No memory leaks detected
- ✅ Cache hit rate >50% for static ranges

---

### QA-003: Accessibility Audit

**Owner:** QA / Engineer  
**Estimate:** 2h  
**Dependencies:** FE-004  
**Priority:** P2

**Tasks:**
- [ ] Run axe DevTools or Lighthouse accessibility scan
- [ ] Fix WCAG 2.1 AA violations
- [ ] Test keyboard navigation (Tab, Enter, Esc)
- [ ] Test screen reader (NVDA/JAWS on Windows, VoiceOver on macOS)
- [ ] Verify color contrast meets standards
- [ ] Add ARIA labels where needed
- [ ] Document accessibility features in README

**Acceptance Criteria:**
- ✅ Zero critical accessibility violations
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation fully functional
- ✅ Screen reader announces all UI elements correctly

---

### DOC-001: Update Documentation

**Owner:** Engineer  
**Estimate:** 2h  
**Dependencies:** All implementation tasks  
**Priority:** P2

**Tasks:**
- [ ] Update main README.md with feature description
- [ ] Document API endpoint in API reference (if exists)
- [ ] Add usage examples (screenshots, curl commands)
- [ ] Update CHANGELOG.md with new feature entry
- [ ] Document backfill script usage in wiki or README
- [ ] Add code comments for complex logic (data merge, axis scaling)

**Acceptance Criteria:**
- ✅ README includes feature overview and usage
- ✅ API endpoint documented with examples
- ✅ CHANGELOG entry added
- ✅ All public functions have JSDoc comments

---

## Phase 4: Deployment (Day 4)

### DEPLOY-001: Deploy to Staging

**Owner:** Engineer  
**Estimate:** 1h  
**Dependencies:** All Phase 1-3 tasks  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Run database migration on staging DB
- [ ] Run backfill script on staging (SPX 3000 Jun17 data)
- [ ] Build and deploy Next.js app to staging environment
- [ ] Smoke test: verify chart loads with overlay
- [ ] Check API logs for errors
- [ ] Monitor staging metrics (response times, error rates)

**Acceptance Criteria:**
- ✅ Staging environment updated successfully
- ✅ Chart overlay works in staging
- ✅ No errors in logs
- ✅ Performance metrics within SLA

---

### DEPLOY-002: Deploy to Production

**Owner:** Engineer  
**Estimate:** 1h  
**Dependencies:** DEPLOY-001, stakeholder approval  
**Priority:** P0 (blocking)

**Tasks:**
- [ ] Get stakeholder approval (PM, Tech Lead)
- [ ] Run database migration on production DB
- [ ] Run backfill script on production (SPX 3000 Jun17 data)
- [ ] Build and deploy Next.js app to production
- [ ] Smoke test: verify chart loads with overlay
- [ ] Monitor production metrics for 1 hour
- [ ] Rollback plan ready (if needed)

**Acceptance Criteria:**
- ✅ Production deployment successful
- ✅ Zero downtime during deployment
- ✅ Feature works for end users
- ✅ Metrics stable (no spikes in errors or latency)

---

## Task Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Database & Backend | DB-001, DB-002, DB-003, API-001, API-002 | 11h |
| Phase 2: Frontend | FE-001, FE-002, FE-003, FE-004, FE-005 | 14h |
| Phase 3: Testing & Polish | QA-001, QA-002, QA-003, DOC-001 | 9h |
| Phase 4: Deployment | DEPLOY-001, DEPLOY-002 | 2h |
| **Total** | **18 tasks** | **36h (~4.5 days)** |

**Adjusted for single engineer:** 3-4 working days (accounting for context switching, debugging, code review)

---

## Dependencies Graph

```
DB-001 (Create table)
  ├─► DB-002 (Backfill script)
  │     └─► DB-003 (Run backfill)
  └─► API-001 (API endpoint)
        └─► API-002 (Unit tests)

FE-001 (Selector component)
  └─► FE-002 (Chart enhancement)
        ├─► FE-003 (Tooltip)
        └─► FE-004 (Integration)
              └─► FE-005 (E2E tests)

All implementation tasks
  └─► QA-001, QA-002, QA-003 (Testing)
        └─► DOC-001 (Documentation)
              └─► DEPLOY-001 (Staging)
                    └─► DEPLOY-002 (Production)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **No historical option data available** | Use synthetic data or fallback source; document limitation in MVP |
| **API rate limits during backfill** | Implement exponential backoff; split backfill into smaller batches |
| **Chart performance degrades with large datasets** | Implement data decimation; limit query results to 10k points |
| **Dual Y-axis confusing to users** | Add toggle for normalized view (% change); gather user feedback |
| **Options contract expires before feature ships** | Build generic selector; don't hardcode Jun17 expiry |

---

## Definition of Done

A task is complete when:
- [ ] Code written and tested locally
- [ ] Unit tests added (where applicable) and passing
- [ ] E2E tests added (where applicable) and passing
- [ ] Code reviewed and approved by peer
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Merged to main branch
- [ ] Deployed to staging and smoke-tested

---

## Sprint Planning

**Recommended Sprint:** 1 week (single engineer, 40h work week)

**Day 1:**
- Morning: DB-001, DB-002 (4h)
- Afternoon: DB-003, start API-001 (4h)

**Day 2:**
- Morning: Finish API-001, API-002 (4h)
- Afternoon: FE-001, start FE-002 (4h)

**Day 3:**
- Morning: Finish FE-002, FE-003 (4h)
- Afternoon: FE-004, start FE-005 (4h)

**Day 4:**
- Morning: Finish FE-005, QA-001 (4h)
- Afternoon: QA-002, QA-003 (4h)

**Day 5:**
- Morning: DOC-001, DEPLOY-001 (3h)
- Afternoon: DEPLOY-002, monitoring, retrospective (2h)

---

## Open Items

- [ ] Confirm data source for backfill (Yahoo Finance vs. alternative)
- [ ] Get design approval for OptionsOverlaySelector UI
- [ ] Decide on dual Y-axis vs. normalized view for MVP
- [ ] Allocate engineer to project
- [ ] Schedule code review sessions
- [ ] Set up staging environment (if not already done)

---

**End of Tasks Document**
