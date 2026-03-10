# Technical Design: Remove Market Heatmap

**Status:** Draft  
**Author:** Architect Agent  
**Date:** 2026-03-09  
**PRD:** `docs/prd-remove-market-heatmap.md`  
**Tasks:** `docs/tasks-remove-market-heatmap.md`

---

## 1. Overview

The Market Heatmap is a `<PlaceholderWidget>` rendered unconditionally at the bottom of `app/page.tsx`. It carries no data, no API calls, and no user interaction — it is dead UI. This change removes the JSX block and its comment from the page. One E2E test that asserts the heatmap's presence must be updated to match the new reality. No schema, API, component, or styling changes are required.

---

## 2. Change Surface

### Files Modified
| File | Change | Reason |
|------|--------|--------|
| `app/page.tsx` | Delete `{/* Full-width widget */}` comment + `<PlaceholderWidget label="Market Heatmap" … />` block | PRD AC-1.1, AC-1.2, AC-1.4 |
| `e2e/dashboard.spec.ts` | Update `'placeholder widgets are present'` test | Test currently asserts `Market Heatmap` text visible and `Coming soon` count ≥ 2; both assertions break after removal |

### Files Created
_None._

### Files Deleted
_None._

---

## 3. Schema Changes

None.

---

## 4. TypeScript Interfaces / Types

None. No new types introduced.

---

## 5. API Changes

None. This is a UI-only deletion; no API routes are affected.

---

## 6. Component Changes

### `app/components/PlaceholderWidget.tsx` — **NOT CHANGED**
The component itself is intentionally left intact. It continues to be used for the Daily Market Report fallback state. Only the specific usage on the dashboard page is removed.

### `app/page.tsx` — **MODIFIED**

**What to remove** (exact block, at the bottom of the JSX return):

```tsx
      {/* Full-width widget */}
      <PlaceholderWidget
        label="Market Heatmap"
        description="S&P 500 sector performance visualized by weight and returns"
        minHeight="300px"
      />
```

**What remains after removal** — the full return body becomes:

```tsx
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Market Overview" />

      {/* Live market charts — last 7 trading days */}
      <div style={{ marginBottom: '24px' }}>
        <MarketChartsWidget />
      </div>

      {/* Full-width report widget */}
      <div className="mb-4">
        {reportWidget}
      </div>
    </>
  );
```

**Import audit:** The `PlaceholderWidget` import at the top of `app/page.tsx` must be **retained** — it is still referenced inside the `try/catch` block that renders the `Daily Market Report` fallback and error states. No import is added or removed.

**Layout impact:** Removing the heatmap block eliminates ~300px of vertical space at the bottom of the page. The existing `mb-4` on the report widget `<div>` is preserved. No additional spacing adjustments are needed — the page terminates cleanly after the report widget.

---

## 7. E2E Test Changes

### `e2e/dashboard.spec.ts` — **MODIFIED**

**Failing test** (line ~51):

```ts
test('placeholder widgets are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Daily Market Report')).toBeVisible();
  await expect(page.getByText('Market Heatmap')).toBeVisible();         // ← REMOVE this line
  const comingSoon = page.getByText('Coming soon');
  await expect(comingSoon.first()).toBeVisible();
  expect(await comingSoon.count()).toBeGreaterThanOrEqual(2);            // ← CHANGE 2 → 1
});
```

**Updated test:**

```ts
test('placeholder widgets are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Daily Market Report')).toBeVisible();
  const comingSoon = page.getByText('Coming soon');
  await expect(comingSoon.first()).toBeVisible();
  expect(await comingSoon.count()).toBeGreaterThanOrEqual(1);
});
```

**Rationale:** After removal there is at most one `PlaceholderWidget` visible on the dashboard — the `Daily Market Report` fallback, which is rendered when no report exists in the DB. The `count() >= 1` assertion is correct: in CI, no report is seeded so the fallback renders. (When a real report is present the count will be 0, but the test uses no `mockChartAPI` guard here so the fallback path is the expected path.)

**No other tests reference "Market Heatmap"** — confirmed by grep. The `__tests__/components/PlaceholderWidget.test.tsx` uses `label="Market Heatmap"` as a generic test string to exercise the component's render logic; it does not test the dashboard page and does not need to change.

---

## 8. Sequencing Notes

- TASK-01 (page change) must be committed first. The page will build and render correctly on its own.
- TASK-02 (E2E test update) depends on TASK-01 — the updated test must not run against the old page (it would incorrectly pass the old `>= 2` assertion).
- No DB migrations, no API changes, no new deps. CI should pass after TASK-01 alone except for the one E2E test, which is fixed in TASK-02.

---

## 9. Open Technical Questions

None. Scope is fully defined per PRD Section 10.

---

_Design ready for implementation._
