# Tasks: Fix Double Vertical Scrollbars

**Epic:** UX Improvement - Layout & Navigation  
**Feature:** Fix Double Scrollbars  
**PRD:** PRD-001-FIX-DOUBLE-SCROLLBAR  
**Design:** DESIGN-001-FIX-DOUBLE-SCROLLBAR  
**Created:** 2026-03-10  
**Assignee:** Engineer Agent  

---

## Task Overview

This document breaks down the implementation of the double scrollbar fix into atomic, testable tasks.

**Total Estimated Time:** ~2 hours  
**Complexity:** Low  
**Risk:** Low  

---

## Task 1: Update globals.css (CRITICAL)

**Priority:** P0 (Critical Path)  
**Estimated Time:** 10 minutes  
**Dependencies:** None  

### Description

Fix the root cause of double scrollbars by updating html and body CSS rules to prevent overflow at the document level.

### Acceptance Criteria

- [ ] html element has `height: 100vh` and `overflow: hidden`
- [ ] body element has `height: 100vh`, `overflow: hidden`, `margin: 0`, `padding: 0`
- [ ] All existing styles (background, color, font-family) preserved
- [ ] CSS validates (no syntax errors)

### Implementation Steps

1. Open `app/globals.css`
2. Locate lines 22-26 (current html/body block):
   ```css
   html,
   body {
     background: var(--bg);
     color: var(--text-primary);
     font-family: var(--font-geist-sans), system-ui, sans-serif;
     height: 100%;
   }
   ```
3. Replace with:
   ```css
   html {
     height: 100vh;
     overflow: hidden;
   }

   body {
     height: 100vh;
     overflow: hidden;
     margin: 0;
     padding: 0;
     background: var(--bg);
     color: var(--text-primary);
     font-family: var(--font-geist-sans), system-ui, sans-serif;
   }
   ```
4. Save file
5. Verify syntax (no trailing semicolons, proper braces)

### Testing

```bash
# Start dev server
npm run dev

# Open http://localhost:3002
# Verify: body should not have scrollbar
# Verify: html should not have scrollbar
# Verify: main element should have scrollbar (if content overflows)
```

### Files Modified

- `app/globals.css` (lines 22-35)

---

## Task 2: Update AppShell.tsx

**Priority:** P0 (Critical Path)  
**Estimated Time:** 5 minutes  
**Dependencies:** Task 1  

### Description

Add `overflow-x-hidden` to the main element to prevent horizontal scrollbar and ensure proper content constraint.

### Acceptance Criteria

- [ ] main element has class `overflow-x-hidden`
- [ ] Existing classes (`flex-1`, `overflow-y-auto`, `p-4`, `md:p-6`) preserved
- [ ] Component compiles without errors
- [ ] No prop changes (backward compatible)

### Implementation Steps

1. Open `app/components/AppShell.tsx`
2. Locate line 34 (main element):
   ```tsx
   <main className="flex-1 overflow-y-auto p-4 md:p-6">
   ```
3. Update to:
   ```tsx
   <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
   ```
4. Save file
5. Verify TypeScript compilation

### Testing

```bash
# Verify TypeScript
npx tsc --noEmit

# Verify component renders
npm run dev
# Navigate to any page
# Verify: No horizontal scrollbar
# Verify: Vertical scrollbar works correctly
```

### Files Modified

- `app/components/AppShell.tsx` (line 34)

---

## Task 3: Write Unit Tests

**Priority:** P1 (High)  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 1, Task 2  

### Description

Create unit tests to verify the scrollbar layout behaves correctly.

### Acceptance Criteria

- [ ] Test file created: `__tests__/unit/layout/scrollbar.test.ts`
- [ ] All tests pass
- [ ] Coverage ≥90% for AppShell component

### Implementation Steps

1. Create directory: `mkdir -p __tests__/unit/layout`
2. Create file: `__tests__/unit/layout/scrollbar.test.ts`
3. Write tests:

```typescript
import { render } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';

describe('Scrollbar Layout', () => {
  it('should render main with overflow-y-auto', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-y-auto');
  });

  it('should render main with overflow-x-hidden', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-x-hidden');
  });

  it('should render main with flex-1', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1');
  });

  it('should render AppShell wrapper with overflow-hidden', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('overflow-hidden');
  });

  it('should render AppShell wrapper with h-screen', () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('h-screen');
  });

  it('should render children inside main element', () => {
    const { getByText } = render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    const content = getByText('Test Content');
    expect(content.closest('main')).toBeTruthy();
  });
});
```

4. Run tests:
   ```bash
   npm test -- scrollbar.test.ts
   ```

### Files Created

- `__tests__/unit/layout/scrollbar.test.ts`

---

## Task 4: Write E2E Tests

**Priority:** P1 (High)  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 1, Task 2  

### Description

Create end-to-end tests to verify no double scrollbars appear across all pages.

### Acceptance Criteria

- [ ] Test file created: `e2e/scrollbar-regression.spec.ts`
- [ ] All tests pass in headless mode
- [ ] Tests cover Dashboard, Reports, Watchlist pages
- [ ] Tests verify html/body overflow is hidden
- [ ] Tests verify main element overflow-y is auto

### Implementation Steps

1. Create file: `e2e/scrollbar-regression.spec.ts`
2. Write tests:

```typescript
import { test, expect } from '@playwright/test';

test.describe('No Double Scrollbars', () => {
  test('Dashboard: html and body should have overflow hidden', async ({ page }) => {
    await page.goto('http://localhost:3002');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const bodyOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.body).overflow
    );
    expect(bodyOverflow).toBe('hidden');
  });

  test('Dashboard: main element should have overflow-y auto', async ({ page }) => {
    await page.goto('http://localhost:3002');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Dashboard: main element should have overflow-x hidden', async ({ page }) => {
    await page.goto('http://localhost:3002');

    const mainOverflowX = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowX : null;
    });
    expect(mainOverflowX).toBe('hidden');
  });

  test('Reports: should show single scrollbar', async ({ page }) => {
    await page.goto('http://localhost:3002/reports');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Reports: content should scroll within main element', async ({ page }) => {
    await page.goto('http://localhost:3002/reports');

    // Scroll main element
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 100;
    });

    // Verify scroll position
    const scrollTop = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main?.scrollTop || 0;
    });
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('Watchlist: should have single scrollbar', async ({ page }) => {
    await page.goto('http://localhost:3002/watchlist');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Sidebar toggle should not affect scrollbar', async ({ page }) => {
    await page.goto('http://localhost:3002');

    // Find and click sidebar toggle (if visible)
    const toggleButton = page.locator('button').filter({ hasText: /menu|toggle/i }).first();
    const isVisible = await toggleButton.isVisible().catch(() => false);

    if (isVisible) {
      await toggleButton.click();
      await page.waitForTimeout(300); // Wait for animation
    }

    // Verify main overflow unchanged
    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });
});
```

3. Run tests:
   ```bash
   # Start dev server first
   npm run dev

   # Run e2e tests
   npx playwright test e2e/scrollbar-regression.spec.ts
   ```

### Files Created

- `e2e/scrollbar-regression.spec.ts`

---

## Task 5: Manual Cross-Browser Testing

**Priority:** P1 (High)  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 1, Task 2, Task 3, Task 4  

### Description

Manually verify the fix works across major browsers and devices.

### Acceptance Criteria

- [ ] Chrome (desktop): Single scrollbar visible, smooth scrolling
- [ ] Safari (desktop): Single scrollbar visible, no layout shift
- [ ] Firefox (desktop): Single scrollbar visible, consistent width
- [ ] Edge (desktop): Single scrollbar visible (Chromium-based, should match Chrome)
- [ ] Mobile Safari (iOS): Single scrollbar, touch scroll responsive
- [ ] Mobile Chrome (Android): No horizontal scrollbar, vertical scroll works

### Testing Checklist

#### Desktop Chrome
1. Open http://localhost:3002
2. Inspect element → verify html/body have `overflow: hidden`
3. Verify main element has `overflow-y: auto`
4. Scroll content → verify smooth scrolling
5. Toggle sidebar → verify no scrollbar flicker
6. Navigate to /reports → verify single scrollbar
7. Navigate to /watchlist → verify single scrollbar

#### Desktop Safari
1. Repeat Chrome steps 1-7
2. Verify scrollbar styling consistent
3. Check for layout shift during scroll

#### Desktop Firefox
1. Repeat Chrome steps 1-7
2. Verify scrollbar width matches design

#### Mobile Safari (iOS Simulator or Device)
1. Open http://localhost:3002 on iPhone/iPad
2. Verify single scrollbar visible
3. Touch scroll → verify responsive
4. No horizontal scrollbar visible

#### Mobile Chrome (Android Simulator or Device)
1. Open http://localhost:3002 on Android device
2. Verify single scrollbar
3. Touch scroll → verify smooth
4. No layout issues at small viewport

### Test Report Template

```markdown
## Cross-Browser Test Report

**Date:** 2026-03-10  
**Tester:** [Your Name]  
**Build:** feature/fix-double-scrollbar  

| Browser | Version | OS | Single Scrollbar | Smooth Scroll | Sidebar Toggle | Pass/Fail |
|---------|---------|----|--------------------|---------------|----------------|-----------|
| Chrome | 120+ | macOS/Windows | ✅ | ✅ | ✅ | ✅ PASS |
| Safari | 16+ | macOS | ✅ | ✅ | ✅ | ✅ PASS |
| Firefox | 115+ | macOS/Windows | ✅ | ✅ | ✅ | ✅ PASS |
| Edge | 120+ | Windows | ✅ | ✅ | ✅ | ✅ PASS |
| Mobile Safari | iOS 16+ | iPhone | ✅ | ✅ | N/A | ✅ PASS |
| Mobile Chrome | Android 12+ | Android | ✅ | ✅ | N/A | ✅ PASS |

**Notes:**
- [Any observations or issues]

**Sign-Off:** [Your Name] — [Date]
```

---

## Task 6: Code Review & Approval

**Priority:** P0 (Critical Path)  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 1-5  

### Description

Submit PR for code review and obtain approval from reviewer.

### Acceptance Criteria

- [ ] PR created with clear title and description
- [ ] All CI checks passing (tests, linting, build)
- [ ] Code review approved by reviewer agent
- [ ] No merge conflicts

### Implementation Steps

1. Commit all changes:
   ```bash
   git add app/globals.css app/components/AppShell.tsx __tests__ e2e
   git commit -m "fix: eliminate double vertical scrollbars

   - Update html/body to height: 100vh, overflow: hidden
   - Add overflow-x-hidden to main element
   - Add unit tests for scrollbar layout
   - Add e2e tests for cross-page verification
   
   Fixes double scrollbars on Dashboard, Reports, Watchlist pages
   "
   ```

2. Push branch:
   ```bash
   git push origin feature/fix-double-scrollbar
   ```

3. Create PR:
   ```bash
   gh pr create \
     --title "Fix: Eliminate double vertical scrollbars" \
     --body "$(cat <<EOF
   ## Summary
   Fixes double vertical scrollbars appearing on all pages.

   ## Changes
   - \`app/globals.css\`: Set html/body to \`height: 100vh\`, \`overflow: hidden\`
   - \`app/components/AppShell.tsx\`: Add \`overflow-x-hidden\` to main element
   - Add unit tests: \`__tests__/unit/layout/scrollbar.test.ts\`
   - Add e2e tests: \`e2e/scrollbar-regression.spec.ts\`

   ## Testing
   - ✅ Unit tests passing (6/6)
   - ✅ E2E tests passing (7/7)
   - ✅ Manual cross-browser testing completed

   ## Screenshots
   Before: [Double scrollbar visible]
   After: [Single scrollbar only]

   ## References
   - PRD: PRD-001-FIX-DOUBLE-SCROLLBAR
   - Design: DESIGN-001-FIX-DOUBLE-SCROLLBAR
   EOF
   )"
   ```

4. Wait for CI checks
5. Request review from reviewer agent
6. Address any feedback
7. Obtain approval

---

## Task 7: Deploy to Production

**Priority:** P0 (Critical Path)  
**Estimated Time:** 10 minutes  
**Dependencies:** Task 6 (PR approved)  

### Description

Merge PR and deploy to production (port 3000).

### Acceptance Criteria

- [ ] PR merged to main branch
- [ ] Production build successful
- [ ] Production deployment complete (port 3000)
- [ ] Worktree dev server stopped (port 3002)
- [ ] Worktree directory cleaned up

### Implementation Steps

1. Merge PR:
   ```bash
   gh pr merge --squash --delete-branch
   ```

2. Checkout main and pull:
   ```bash
   cd /home/claw/prod/financial-analyzer
   git checkout main
   git pull origin main
   ```

3. Install dependencies (if package.json changed):
   ```bash
   npm install
   ```

4. Build production:
   ```bash
   npm run build
   ```

5. Restart production server:
   ```bash
   pm2 restart financial-analyzer
   ```

6. Verify production deployment:
   ```bash
   curl http://dev-center:3000
   # Should return 200 OK
   ```

7. Stop worktree dev server:
   ```bash
   pm2 stop financial-analyzer-fix-double-scrollbar
   pm2 delete financial-analyzer-fix-double-scrollbar
   ```

8. Clean up worktree:
   ```bash
   cd /home/claw/prod/financial-analyzer
   git worktree remove /home/claw/worktrees/financial-analyzer/feature/fix-double-scrollbar
   ```

---

## Task 8: Post-Deployment Monitoring

**Priority:** P2 (Medium)  
**Estimated Time:** 15 minutes (initial), ongoing for 24 hours  
**Dependencies:** Task 7  

### Description

Monitor production for any layout issues or regressions after deployment.

### Acceptance Criteria

- [ ] Error logs clean (no layout-related errors)
- [ ] Core Web Vitals stable (CLS, LCP unchanged)
- [ ] No user complaints about scrollbar issues
- [ ] No support tickets related to layout

### Monitoring Tasks

1. Check error logs:
   ```bash
   pm2 logs financial-analyzer --lines 100
   # Look for any CSS/layout errors
   ```

2. Verify production pages:
   - http://dev-center:3000 (Dashboard)
   - http://dev-center:3000/reports
   - http://dev-center:3000/watchlist
   - http://dev-center:3000/alerts
   - http://dev-center:3000/markets

3. Monitor Core Web Vitals (Chrome DevTools):
   - CLS (Cumulative Layout Shift): Should be ≤0.1
   - LCP (Largest Contentful Paint): Should be ≤2.5s
   - FID (First Input Delay): Should be ≤100ms

4. Check for user feedback:
   - Support tickets
   - User reports
   - Analytics (if available)

5. Set reminder to check after 24 hours:
   - Review logs again
   - Confirm no regressions
   - Mark feature as "Stable"

---

## Summary Checklist

### Pre-Implementation
- [ ] Read PRD (PRD-001-FIX-DOUBLE-SCROLLBAR)
- [ ] Read Design Doc (DESIGN-001-FIX-DOUBLE-SCROLLBAR)
- [ ] Understand current state (double scrollbars)
- [ ] Understand target state (single scrollbar)

### Implementation
- [ ] Task 1: Update globals.css ✅
- [ ] Task 2: Update AppShell.tsx ✅
- [ ] Task 3: Write unit tests ✅
- [ ] Task 4: Write e2e tests ✅
- [ ] Task 5: Manual cross-browser testing ✅

### Review & Deployment
- [ ] Task 6: Code review & approval ✅
- [ ] Task 7: Deploy to production ✅
- [ ] Task 8: Post-deployment monitoring ✅

### Definition of Done
- [ ] All tests passing (unit + e2e)
- [ ] Code review approved
- [ ] Deployed to production (port 3000)
- [ ] No regressions detected
- [ ] Worktree cleaned up
- [ ] Documentation updated (this file)

---

## Rollback Plan

If critical issues arise after deployment:

1. **Immediate Rollback:**
   ```bash
   cd /home/claw/prod/financial-analyzer
   git revert HEAD
   git push origin main
   npm run build
   pm2 restart financial-analyzer
   ```

2. **Investigate Issue:**
   - Check error logs
   - Reproduce issue locally
   - Identify root cause

3. **Fix Forward:**
   - Create new branch
   - Fix issue
   - Re-test
   - Deploy again

---

## Notes

- All file paths are relative to worktree root: `/home/claw/worktrees/financial-analyzer/feature/fix-double-scrollbar`
- Dev server runs on port 3002 (worktree-specific)
- Production server runs on port 3000 (main branch)
- After merge, worktree will be deleted

---

**Ready for Engineer Agent to implement.**
