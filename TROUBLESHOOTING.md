# TROUBLESHOOTING.md — Debugging Guide

[Home](README.md) > [Docs Index](DOCS.md) > Troubleshooting

## Table of Contents

1. ["Module not found" errors after npm install](#module-not-found-errors-after-npm-install)
2. [Port already in use](#port-already-in-use)
3. [Database file not found](#database-file-not-found)
4. [API returning 404 or empty data](#api-returning-404-or-empty-data)
5. [React components not rendering](#react-components-not-rendering)
6. [TypeScript compilation errors](#typescript-compilation-errors)
7. [E2E tests timing out or failing](#e2e-tests-timing-out-or-failing)
8. [Build failures](#build-failures)
9. [systemd service won't start or crashes](#systemd-service-wont-start-or-crashes)
10. [Data inconsistencies in the database](#data-inconsistencies-in-the-database)

---

## "Module not found" errors after npm install

### Symptom

```
Error: Cannot find module '@/lib/db'
Cannot find module 'better-sqlite3'
Module not found: Can't resolve 'next/server'
```

### Root Causes

- `node_modules` is missing or incomplete
- Wrong directory (not in the project root)
- `npm install` failed partway through
- Worktree has a separate `node_modules` that needs refreshing

### Solutions

**Quick fix:**
```bash
# Verify you're in the right directory
pwd  # should end in .../financial-analyzer/...

# Reinstall dependencies
npm install

# Verify key packages exist
ls node_modules/better-sqlite3
ls node_modules/next
```

**Thorough fix** (if `npm install` fails or produces errors):
```bash
# Remove node_modules and lock file, start fresh
rm -rf node_modules package-lock.json
npm install
```

**Nuclear option** (if still failing):
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Verification

```bash
npm run build 2>&1 | grep -i "error\|warning" | head -20
```

### Prevention

After pulling from `main` or switching branches, always run `npm install` — new packages may have been added.

---

## Port already in use

### Symptom

```
Error: listen EADDRINUSE: address already in use :::3002
  ▲ Next.js 16.x.x
  - Local: http://localhost:3002
Error: Port 3002 is already in use.
```

### Root Causes

- Another dev server instance is already running on that port
- Previous process didn't exit cleanly (zombie process)
- Another application on the machine is using the port

### Solutions

**Quick fix:** Find and kill the process:
```bash
# Find what's using the port (e.g., 3002)
lsof -i :3002

# Kill it
kill $(lsof -ti :3002)
```

**Thorough fix:** Use a different port:
```bash
# Start on an alternate port
npm run dev -- --port 3005
```

**If you can't kill it** (permission issues):
```bash
# Check if it's your own process or system process
lsof -i :3002 -P -n
# If PID belongs to another user, use a different port instead
```

### Verification

```bash
curl http://localhost:3002  # should get a response
```

### Prevention

Keep track of which port each worktree uses (see port allocation in [DEV.md](DEV.md)).

---

## Database file not found

### Symptom

```
SQLITE_CANTOPEN: unable to open database file
Error: ENOENT: no such file or directory, open '.../data/reports.db'
```

Or API routes returning empty arrays/500 errors on first startup.

### Root Causes

- `data/` directory doesn't exist (new installation or fresh worktree)
- The application hasn't been started yet (database is created on first startup)
- Wrong working directory when running scripts

### Solutions

**Quick fix:** Start the dev server once — it auto-creates the database:
```bash
npm run dev -- --port 3002
# After server starts, Ctrl+C
# data/reports.db now exists
```

**Thorough fix:** Manually create the directory and initialize:
```bash
mkdir -p data
npm run dev -- --port 3002 &
sleep 3
curl http://localhost:3002/api/reports  # triggers DB init
kill %1
```

**If running scripts that need the DB:**
```bash
# Ensure you're in the project root
cd ~/worktrees/financial-analyzer/feature/my-feature
npm run dev -- --port 3002 &  # start server to init DB
sleep 5
npx tsx scripts/backfill-option-prices.ts
kill %1
```

### Verification

```bash
ls -la data/reports.db
sqlite3 data/reports.db ".tables"
```

---

## API returning 404 or empty data

### Symptom

- `curl http://localhost:3002/api/reports` returns `[]`
- `curl http://localhost:3002/api/options/snapshot` returns `{"error":"No data available..."}`
- `/api/market/chart/^GSPC` returns `{"error":"No data available"}`

### Root Causes

For DB-backed endpoints (`/api/options/*`, `/api/reports/*`):
- Database is empty — no data has been backfilled yet
- Wrong ticker or expiry in query params

For market data endpoints (`/api/market/chart/*`):
- Yahoo Finance or FRED returned no data for the ticker
- Market is closed and no data is cached yet
- Ticker symbol is wrong (e.g., URL-encode `^GSPC` as `%5EGSPC`)

### Solutions

**For empty database:**
```bash
# Generate a report to populate the DB
curl -X POST http://localhost:3002/api/reports/generate \
  -H "Authorization: Bearer $(grep REPORT_SECRET .env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"period":"eod"}'

# Run option data backfill
npm run backfill:options
```

**For market data 404:**
```bash
# Test with a simpler ticker first
curl "http://localhost:3002/api/market/chart/%5EGSPC"

# Check if Yahoo Finance is reachable
curl -s "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d" | head -200
```

**For wrong ticker/expiry:**
```bash
# List available option snapshots
sqlite3 data/reports.db "SELECT DISTINCT ticker, expiry FROM option_snapshots LIMIT 20;"
```

### Verification

```bash
curl http://localhost:3002/api/reports | python3 -m json.tool | head -30
```

---

## React components not rendering

### Symptom

- Page loads but shows blank or partial content
- Browser console shows React errors
- `Hydration failed` errors in browser console
- Component shows loading state indefinitely

### Root Causes

- Server/client HTML mismatch (hydration error)
- `fetch()` call failing silently in a component
- Missing `'use client'` directive for a client-side component
- Incorrect prop types causing runtime crash

### Solutions

**Check browser console first:**
```
Open DevTools → Console tab
Look for: "Error:", "Warning:", "Uncaught"
```

**For hydration errors:**
```tsx
// Add 'use client' if component uses browser APIs
'use client';

import { useState, useEffect } from 'react';
```

**For fetch failures:**
```tsx
// Add error boundary or error state
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch('/api/my-endpoint')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(setData)
    .catch(e => setError(e.message));
}, []);

if (error) return <div>Error: {error}</div>;
```

**For loading state stuck:**
```bash
# Check if the API endpoint itself works
curl "http://localhost:3002/api/options/snapshot?ticker=SPWX&expiry=30d"
```

### Verification

```bash
# Check for Next.js build errors
npm run build 2>&1 | grep -i error
```

---

## TypeScript compilation errors

### Symptom

```
Type error: Property 'xyz' does not exist on type 'ABC'
Type error: Argument of type 'string | null' is not assignable to parameter of type 'string'
Error: Object is possibly 'undefined'
```

Or `npm run build` fails with TypeScript errors.

### Root Causes

- Using a property that doesn't exist in the type definition
- Not handling `null` / `undefined` from optional chains or database queries
- Using `any` type where a specific type is expected
- Missing return type annotation on a function

### Solutions

**Check errors precisely:**
```bash
npx tsc --noEmit 2>&1 | head -50
```

**For "property does not exist":**
```typescript
// BAD
const value = response.data.items[0].value;

// GOOD — check the actual type and add safety
const value = response?.data?.items?.[0]?.value ?? 0;
```

**For "null is not assignable":**
```typescript
// BAD
function process(name: string) { ... }
process(searchParams.get('name')); // get() returns string | null

// GOOD
const name = searchParams.get('name');
if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
process(name); // now string
```

**For unknown response type from DB:**
```typescript
// BAD
const row: any = db.prepare('SELECT * FROM reports').get();

// GOOD — use proper type assertion with known schema
const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
```

### Verification

```bash
npx tsc --noEmit  # should exit with code 0
```

---

## E2E tests timing out or failing

### Symptom

```
TimeoutError: page.goto: Timeout 30000ms exceeded
Error: locator.click: Target closed
Test failed: expect(page).toHaveURL('/reports') failed
```

### Root Causes

- Dev server not running when E2E tests execute
- Wrong port configured in `playwright.config.ts`
- Element selector changed (UI refactored but test not updated)
- Test assumes data that isn't in the database

### Solutions

**Quick fix:** Ensure dev server is running:
```bash
# In one terminal:
npm run dev -- --port 3002

# In another:
npm run test:e2e
```

**Check Playwright config:**
```bash
cat playwright.config.ts | grep baseURL
# Should match your running server port
```

**For selector issues:**
```bash
# Run Playwright in UI mode to see what's on the page
npm run test:e2e:ui
```

**For data dependency:**
```bash
# Seed the database before running E2E
sqlite3 data/reports.db < __tests__/fixtures/seed.sql
npm run test:e2e
```

### Verification

```bash
# Run a single test file for faster feedback
npx playwright test e2e/reports.spec.ts --headed
```

---

## Build failures

### Symptom

```
✘ [ERROR] Build failed
Export encountered errors on following routes:
  ○ /api/options/snapshot
Error: Cannot read properties of undefined
```

### Root Causes

- TypeScript errors (see [TypeScript section](#typescript-compilation-errors))
- ESLint errors (lint is run as part of build)
- Importing a server-only module in a client component
- Missing environment variable at build time

### Solutions

**Run checks individually to isolate the issue:**
```bash
# Check TypeScript
npx tsc --noEmit

# Check ESLint
npm run lint

# Attempt build with verbose output
npm run build 2>&1 | tee /tmp/build-output.txt
cat /tmp/build-output.txt | grep -A5 "Error\|error"
```

**For server/client module boundary errors:**
```
Error: You're importing a component that needs 'better-sqlite3' but it only works in server components.
```
Ensure any file using `lib/db.ts` is not imported by a client component (`'use client'` files).

### Verification

```bash
npm run build && echo "Build OK"
```

---

## systemd service won't start or crashes

### Symptom

```bash
systemctl --user status financial-analyzer
# Shows: failed (Result: exit-code) or Active: failed
```

Or production site returns 502/connection refused.

### Root Causes

- Build artifacts missing (`.next/` doesn't exist)
- Port 3000 in use by another process
- Missing environment variables in systemd unit
- Out of memory

### Solutions

**Check logs:**
```bash
journalctl --user -u financial-analyzer -n 100 --no-pager
# Look for: Error, ENOENT, EADDRINUSE, heap out of memory
```

**If build missing:**
```bash
cd ~/prod/financial-analyzer
npm run build  # ONLY run in prod dir, not a worktree
systemctl --user start financial-analyzer
```

**If environment variables missing:**
```bash
# Check what env vars the service uses
systemctl --user cat financial-analyzer
# Verify .env.local exists and has required keys
cat ~/prod/financial-analyzer/.env.local
```

**If port conflict:**
```bash
lsof -i :3000
# Kill the conflicting process, then restart service
kill <pid>
systemctl --user start financial-analyzer
```

### Verification

```bash
systemctl --user status financial-analyzer
curl http://localhost:3000/api/reports
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full service management procedures.

---

## Data inconsistencies in the database

### Symptom

- Reports show stale/old data that doesn't match current market prices
- Option snapshots exist but projections are missing for the same date
- `api/options/snapshot` returns data from days ago instead of today

### Root Causes

- Backfill scripts ran partially and stopped
- Report generation failed mid-run
- Schema migration completed but old data wasn't backfilled
- Manual edits to the database left orphaned rows

### Solutions

**Inspect the database:**
```bash
sqlite3 data/reports.db << 'EOF'
.headers on
.mode column

-- Check report coverage
SELECT date, COUNT(*) as periods
FROM reports
GROUP BY date
ORDER BY date DESC
LIMIT 10;

-- Check option snapshot coverage
SELECT date, ticker, COUNT(*) as count
FROM option_snapshots
GROUP BY date, ticker
ORDER BY date DESC
LIMIT 10;
EOF
```

**Re-generate missing data:**
```bash
# Regenerate today's report
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Authorization: Bearer $REPORT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"period":"eod"}'

# Re-run backfills
npm run backfill:options
```

**Remove corrupted/duplicate rows:**
```bash
sqlite3 data/reports.db << 'EOF'
-- Find duplicates
SELECT date, period, COUNT(*) as n
FROM reports
GROUP BY date, period
HAVING n > 1;

-- Remove older duplicates (keep highest id)
DELETE FROM reports
WHERE id NOT IN (
  SELECT MAX(id) FROM reports GROUP BY date, period
);
EOF
```

### Verification

```bash
curl http://localhost:3000/api/reports/latest | python3 -m json.tool | grep date
```

---

## See Also

- [DATABASE.md](DATABASE.md) — Schema details and backup/recovery procedures
- [DEPLOYMENT.md](DEPLOYMENT.md) — systemd service management
- [TESTING.md](TESTING.md) — How to run and debug tests
- [API.md](API.md) — Expected API responses and error codes
