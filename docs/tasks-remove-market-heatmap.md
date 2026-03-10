# Tasks: Remove Market Heatmap

**Feature:** `remove-market-heatmap`  
**Design:** `docs/design-remove-market-heatmap.md`  
**Branch prefix:** `feature/remove-market-heatmap`  
**Total tasks:** 2

Execute in order. Each task is independently committable.

---

## TASK-01: Delete Market Heatmap JSX from dashboard page

**Files:** `app/page.tsx`  
**Depends on:** nothing  
**Estimated size:** S

### What to do

Open `app/page.tsx`. Locate the following block at the bottom of the JSX `return` statement (after the `{/* Full-width report widget */}` section) and delete it entirely — both the comment and the JSX element:

```tsx
      {/* Full-width widget */}
      <PlaceholderWidget
        label="Market Heatmap"
        description="S&P 500 sector performance visualized by weight and returns"
        minHeight="300px"
      />
```

The `return` body must end with the closing `</>` immediately after the `<div className="mb-4">` block:

```tsx
      {/* Full-width report widget */}
      <div className="mb-4">
        {reportWidget}
      </div>
    </>
  );
```

**Do NOT remove** the `PlaceholderWidget` import at the top of the file. It is still used in the `try/catch` fallback/error states for `Daily Market Report`.

**Do NOT change** any other part of `app/page.tsx` — no spacing adjustments, no class changes, no import modifications.

### Done when
- [ ] The text `Market Heatmap` does not appear anywhere in `app/page.tsx`
- [ ] The `{/* Full-width widget */}` comment is gone
- [ ] The `PlaceholderWidget` import line is still present at the top of the file
- [ ] `npm run build` exits 0 with no TypeScript errors
- [ ] `npm run lint` exits 0 with no warnings on `app/page.tsx`
- [ ] Loading `http://localhost:3000/` in the browser shows no Market Heatmap widget and no console errors
- [ ] The Daily Market Report widget and MarketChartsWidget are still visible on the page

---

## TASK-02: Update E2E test for removed heatmap

**Files:** `e2e/dashboard.spec.ts`  
**Depends on:** TASK-01  
**Estimated size:** S

### What to do

Open `e2e/dashboard.spec.ts`. Find the test named `'placeholder widgets are present'` (inside `test.describe('Dashboard', ...)`).

**Replace** the existing test body with the version below:

**Before:**
```ts
test('placeholder widgets are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Daily Market Report')).toBeVisible();
  await expect(page.getByText('Market Heatmap')).toBeVisible();
  const comingSoon = page.getByText('Coming soon');
  await expect(comingSoon.first()).toBeVisible();
  expect(await comingSoon.count()).toBeGreaterThanOrEqual(2);
});
```

**After:**
```ts
test('placeholder widgets are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Daily Market Report')).toBeVisible();
  const comingSoon = page.getByText('Coming soon');
  await expect(comingSoon.first()).toBeVisible();
  expect(await comingSoon.count()).toBeGreaterThanOrEqual(1);
});
```

**Exact changes:**
1. Delete the line: `await expect(page.getByText('Market Heatmap')).toBeVisible();`
2. Change `toBeGreaterThanOrEqual(2)` → `toBeGreaterThanOrEqual(1)`

No other lines in the file change.

### Done when
- [ ] The string `'Market Heatmap'` does not appear anywhere in `e2e/dashboard.spec.ts`
- [ ] The `comingSoon.count()` assertion uses `>= 1` (not 2)
- [ ] `npm run test:e2e -- --grep "placeholder widgets are present"` passes
- [ ] Full E2E suite `npm run test:e2e` exits 0 with no failures in `dashboard.spec.ts`
- [ ] `npm run lint` exits 0

---

## Completion Checklist (all tasks)

- [ ] Both tasks committed on branch `feature/remove-market-heatmap`
- [ ] `npm run lint` — 0 errors
- [ ] `npm run build` — exits 0
- [ ] `npm run test:coverage` — all pass, thresholds maintained (no new coverage gaps introduced — this is a deletion)
- [ ] `npm run test:e2e` — exits 0, all dashboard tests pass
- [ ] PR opened against `main`
- [ ] PR diff shows **only deletions** in `app/page.tsx` (zero addition lines)
- [ ] PR body includes before/after screenshot of the dashboard bottom section
- [ ] Reviewer notified
