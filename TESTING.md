# TESTING.md — Testing Strategy & Patterns

[Home](README.md) > [Docs Index](DOCS.md) > Testing

## Table of Contents

1. [Overview](#overview)
2. [Three-Layer Approach](#three-layer-approach)
3. [Unit Tests](#unit-tests)
4. [Integration Tests (API Routes)](#integration-tests-api-routes)
5. [End-to-End Tests](#end-to-end-tests)
6. [Running Tests](#running-tests)
7. [Coverage Targets](#coverage-targets)
8. [Common Testing Patterns](#common-testing-patterns)
9. [CI/CD Integration](#cicd-integration)
10. [See Also](#see-also)

---

## Overview

Testing is mandatory for all contributions. The project uses a **three-layer** testing strategy:

| Layer | Tool | Location | What it tests |
|---|---|---|---|
| Unit | Vitest | `__tests__/unit/`, `__tests__/lib/`, `__tests__/components/` | Pure functions, business logic, React components |
| Integration (API) | Vitest | `__tests__/api/`, `__tests__/unit/app/api/` | API route handlers with real SQLite (in-memory) |
| End-to-End | Playwright | `e2e/` | Full user workflows in a real browser |

---

## Three-Layer Approach

### Layer 1: Unit Tests

**Scope:** Pure functions in `lib/`, React component rendering, utility functions.

Unit tests run in isolation — no network calls, no real database. They are the fastest feedback loop.

**File convention:** `__tests__/{category}/{filename}.test.ts`

Examples:
- `__tests__/lib/optionsAnalytics.test.ts` — tests Black-Scholes calculations
- `__tests__/components/StatCard.test.tsx` — tests StatCard rendering with different props
- `__tests__/lib/db.test.ts` — tests database CRUD with in-memory SQLite

### Layer 2: Integration Tests (API Routes)

**Scope:** API route handlers, testing request parsing, database queries, and response shapes.

Integration tests use a real in-memory SQLite database (via `createDb(':memory:')`), giving confidence that SQL queries work without touching production data.

**File convention:** `__tests__/api/{route-name}.test.ts` or `__tests__/unit/app/api/{route-name}.test.ts`

### Layer 3: End-to-End Tests

**Scope:** Critical user workflows in a real browser against a running dev server.

E2E tests catch integration issues that unit/integration tests miss — routing, client-side rendering, real API responses.

**File convention:** `e2e/{feature}.spec.ts`

Examples:
- `e2e/dashboard.spec.ts` — home page loads, charts render
- `e2e/reports.spec.ts` — reports page shows correct data
- `e2e/navigation.spec.ts` — sidebar links work

---

## Unit Tests

### Setup

Unit tests use **Vitest** with the `jsdom` environment (for React testing). The setup file is `vitest.setup.ts`.

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom';
```

### Writing a Unit Test for a Pure Function

```typescript
// __tests__/lib/optionsAnalytics.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDelta, normalCDF } from '@/lib/optionsAnalytics';

describe('calculateDelta', () => {
  it('returns 0.5 for ATM call with 50% time remaining', () => {
    const delta = calculateDelta(
      100,   // spot = 100
      100,   // strike = 100 (ATM)
      0.5,   // 6 months to expiry
      0.20,  // 20% IV
      0.05,  // 5% risk-free rate
      'call'
    );
    // ATM call delta should be approximately 0.5 (slightly above due to drift)
    expect(delta).toBeGreaterThan(0.45);
    expect(delta).toBeLessThan(0.65);
  });

  it('returns negative delta for put options', () => {
    const delta = calculateDelta(100, 100, 0.5, 0.20, 0.05, 'put');
    expect(delta).toBeLessThan(0);
    expect(delta).toBeGreaterThan(-1);
  });

  it('returns 0 or 1 for expired options', () => {
    const callDelta = calculateDelta(110, 100, 0, 0.20, 0.05, 'call');
    expect(callDelta).toBe(1); // ITM call at expiry
  });
});
```

### Writing a Unit Test for a React Component

```typescript
// __tests__/components/StatCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from '@/app/components/StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="S&P 500" value="5,745.12" />);
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    expect(screen.getByText('5,745.12')).toBeInTheDocument();
  });

  it('shows positive change in green', () => {
    render(<StatCard label="VIX" value="22.4" change={2.3} />);
    const changeEl = screen.getByText(/\+2\.3/);
    expect(changeEl).toBeInTheDocument();
  });

  it('shows negative change in red', () => {
    render(<StatCard label="SPX" value="5745" change={-35} />);
    const changeEl = screen.getByText(/-35/);
    expect(changeEl).toBeInTheDocument();
  });
});
```

### Writing a Database Unit Test (in-memory SQLite)

```typescript
// __tests__/lib/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, type DbInstance } from '@/lib/db';

describe('Database CRUD', () => {
  let dbInstance: DbInstance;

  beforeEach(() => {
    // Fresh in-memory DB for each test — completely isolated
    dbInstance = createDb(':memory:');
  });

  it('inserts and retrieves a report', () => {
    const marketData = { spx: { current: 5000, changePct: -1.2 } };
    const analysis = { summary: 'Markets fell today', outlook: 'bearish' };

    dbInstance.insertOrReplaceReport(
      '2026-03-11',
      'eod',
      marketData,
      analysis,
      'claude-sonnet-4-5'
    );

    const report = dbInstance.getLatestReport();
    expect(report).not.toBeNull();
    expect(report!.date).toBe('2026-03-11');
    expect(report!.period).toBe('eod');
  });

  it('returns null when no reports exist', () => {
    const report = dbInstance.getLatestReport();
    expect(report).toBeNull();
  });

  it('upserts report on duplicate date+period', () => {
    dbInstance.insertOrReplaceReport('2026-03-11', 'eod', {}, { v: 1 }, 'model-1');
    dbInstance.insertOrReplaceReport('2026-03-11', 'eod', {}, { v: 2 }, 'model-2');

    const reports = dbInstance.listReports();
    expect(reports).toHaveLength(1);
  });
});
```

---

## Integration Tests (API Routes)

API routes are tested by directly importing the route handler and calling it with mock `NextRequest` objects.

### Pattern: Testing a GET Route

```typescript
// __tests__/api/reports.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/reports/latest/route';

// Mock the db module to avoid touching the real file
vi.mock('@/lib/db', () => ({
  getLatestReport: vi.fn(),
}));

import { getLatestReport } from '@/lib/db';

describe('GET /api/reports/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no report exists', async () => {
    vi.mocked(getLatestReport).mockReturnValue(null);

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('No report available yet');
  });

  it('returns report with parsed JSON fields', async () => {
    vi.mocked(getLatestReport).mockReturnValue({
      id: 1,
      date: '2026-03-11',
      period: 'eod',
      generated_at: 1741694400,
      ticker_data: '{"spx":{"current":5000}}',
      report_json: '{"summary":"Test report"}',
      model: 'claude-sonnet-4-5',
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.date).toBe('2026-03-11');
    expect(body.marketData).toEqual({ spx: { current: 5000 } });
    expect(body.analysis).toEqual({ summary: 'Test report' });
  });
});
```

### Pattern: Testing Error Cases

```typescript
it('returns 500 on unexpected database error', async () => {
  vi.mocked(getLatestReport).mockImplementation(() => {
    throw new Error('disk I/O error');
  });

  // Route should catch and return 500, not crash
  const response = await GET();
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body.error).toContain('disk I/O error');
});
```

### Pattern: Testing with Query Parameters

```typescript
import { NextRequest } from 'next/server';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3002/api/options/snapshot');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

it('uses default ticker when none provided', async () => {
  const req = makeRequest({});
  const response = await GET(req);
  // Default ticker is 'SPWX'
  expect(mockGetLatestOptionSnapshot).toHaveBeenCalledWith('SPWX', expect.any(String));
});
```

---

## End-to-End Tests

E2E tests use **Playwright** and run against a real dev server.

### Setup

The `playwright.config.ts` configures the base URL and test directory. Tests are in `e2e/`.

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads the home page with market charts', async ({ page }) => {
    await page.goto('/');

    // Verify key elements are present
    await expect(page.getByText('S&P 500')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible(); // Chart canvas
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Reports');
    await expect(page).toHaveURL('/reports');
  });

  test('fear & greed widget displays a score', async ({ page }) => {
    await page.goto('/');
    // The fear/greed score is a number 0-100
    const score = page.locator('[data-testid="fear-greed-score"]');
    await expect(score).toBeVisible();
    const text = await score.textContent();
    expect(parseInt(text!)).toBeGreaterThanOrEqual(0);
    expect(parseInt(text!)).toBeLessThanOrEqual(100);
  });
});
```

### Pattern: Testing API Responses in E2E

```typescript
test('reports page shows correct data', async ({ page }) => {
  // Intercept the API call
  const responsePromise = page.waitForResponse('/api/reports/latest');

  await page.goto('/reports');
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toHaveProperty('date');
});
```

---

## Running Tests

```bash
# Run all unit + integration tests (one-shot)
npm run test

# Run in watch mode during development
npm run test:watch

# Run with coverage report
npm run test:coverage
# Coverage report: coverage/index.html

# Run E2E tests (requires dev server on port 3002)
npm run test:e2e

# Run E2E with interactive UI
npm run test:e2e:ui

# Run all tests (unit + coverage + E2E)
npm run test:all

# Run a single test file
npx vitest run __tests__/lib/optionsAnalytics.test.ts

# Run tests matching a pattern
npx vitest run --grep "calculateDelta"
```

---

## Coverage Targets

Coverage is enforced via `vitest.config.ts` thresholds:

| Metric | Minimum |
|---|---|
| Lines | 85% |
| Statements | 85% |
| Functions | 75% |
| Branches | 74% |

Coverage is measured over `app/**/*.{ts,tsx}` (excluding layout files, CSS, and type definitions).

If coverage drops below thresholds, `npm run test:coverage` exits with a non-zero code and CI fails.

To check current coverage:
```bash
npm run test:coverage
# Open coverage/index.html for detailed report
```

---

## Common Testing Patterns

### Mocking fetch() for External APIs

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      chart: {
        result: [{
          timestamp: [1741000000],
          indicators: { quote: [{ close: [5745.12] }] }
        }]
      }
    }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### Testing Async Operations

```typescript
it('handles async data fetching', async () => {
  const result = await someAsyncFunction('param');
  expect(result).toBeDefined();
});

it('rejects on bad input', async () => {
  await expect(someAsyncFunction('')).rejects.toThrow('Invalid param');
});
```

### Testing Error Boundaries

```typescript
it('throws for insufficient data', () => {
  expect(() => calculateHistoricalVolatility([100, 101], 20)).toThrow();
});

it('returns null for missing DB record', () => {
  const result = dbInstance.getReportByDate('2099-01-01');
  expect(result).toBeNull();
});
```

---

## CI/CD Integration

Tests run automatically on every pull request via GitHub Actions (`.github/workflows/ci.yaml`):

1. **Lint** — `npm run lint`
2. **Type check** — `npx tsc --noEmit`
3. **Unit + Integration tests** — `npm run test:coverage`
4. **Coverage thresholds** — enforced by Vitest config; fails CI if below targets
5. **E2E tests** — `npm run test:e2e` (runs against built app)

**PRs cannot be merged** unless all CI checks pass.

To reproduce CI locally:
```bash
npm run lint && npx tsc --noEmit && npm run test:coverage && npm run test:e2e
```

---

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md) — PR checklist and code standards
- [ARCHITECTURE.md](ARCHITECTURE.md) — Codebase structure to understand what to test
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — E2E test failures and timeout issues
