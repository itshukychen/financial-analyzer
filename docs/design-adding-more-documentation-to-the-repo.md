# Design Doc: Adding More Documentation to the Repo

**Document ID:** DESIGN-2026-DOC-001  
**Status:** Ready for Implementation  
**Date:** 2026-03-11  
**Feature Slug:** adding-more-documentation-to-the-repo  
**PRD:** [prd-adding-more-documentation-to-the-repo.md](./prd-adding-more-documentation-to-the-repo.md)

---

## Table of Contents

1. [Design Overview](#design-overview)
2. [Documentation Architecture](#documentation-architecture)
3. [Content Strategy](#content-strategy)
4. [Technical Implementation](#technical-implementation)
5. [Quality Assurance](#quality-assurance)
6. [Maintenance Plan](#maintenance-plan)
7. [Risks & Mitigations](#risks--mitigations)

---

## Design Overview

### Goals

This design implements a comprehensive documentation system for the financial-analyzer repository. The system addresses three key stakeholder groups:

1. **Developers** — Understanding codebase, contributing features
2. **Operators** — Deploying, monitoring, troubleshooting production
3. **API Consumers** — Integrating with endpoints, understanding schemas

### Design Principles

**1. Progressive Disclosure**  
Documentation organized by skill level and use case. New developers start with README → ARCHITECTURE → CONTRIBUTING. Operators jump to DEPLOYMENT → TROUBLESHOOTING.

**2. Single Source of Truth**  
Each concept documented once, referenced elsewhere. API schemas live in API.md, not scattered in comments.

**3. Executable Examples**  
Every code example must be copy-pasteable and runnable. No pseudo-code or abstract examples.

**4. Living Documentation**  
Docs live alongside code in git. PRs that change behavior must update docs. Annual audit cycle for freshness.

**5. Accessibility First**  
Plain markdown, readable in terminal, GitHub web UI, or basic text editor. No complex tooling required to consume.

---

## Documentation Architecture

### File Structure

```
financial-analyzer/
├── README.md                     # Entry point, quickstart (updated)
├── DOCS.md                       # Documentation index (NEW)
├── ARCHITECTURE.md               # System design overview (NEW)
├── API.md                        # REST API reference (NEW)
├── CONTRIBUTING.md               # Contribution guidelines (NEW)
├── DATABASE.md                   # Schema, migrations, operations (NEW)
├── TROUBLESHOOTING.md            # Common issues & fixes (NEW)
├── DEPLOYMENT.md                 # Deployment procedures (NEW)
├── TESTING.md                    # Testing strategy & patterns (NEW)
├── TYPESCRIPT.md                 # Type system conventions (NEW)
├── DEV.md                        # Development workflow (expanded)
├── FEATURE.md                    # Feature overview (keep as-is)
└── docs/
    ├── prd-*.md                  # Feature PRDs
    ├── design-*.md               # Feature designs
    └── tasks-*.md                # Feature task lists
```

### Navigation Model

**Entry Points by Persona:**

| Persona | Path |
|---------|------|
| New Developer | README → ARCHITECTURE → DEV → CONTRIBUTING |
| API Consumer | README → API → TROUBLESHOOTING |
| Operator/DevOps | DEPLOYMENT → TROUBLESHOOTING → DATABASE |
| Code Reviewer | CONTRIBUTING → TESTING → ARCHITECTURE |
| Feature Contributor | CONTRIBUTING → TESTING → API |

**Cross-Linking Strategy:**

- Every doc has breadcrumb at top: `[Home](README.md) > [Docs Index](DOCS.md) > Current Doc`
- Related docs linked in "See Also" section at bottom
- Code examples link to relevant API.md sections
- Error messages in TROUBLESHOOTING.md link to solution sections

---

## Content Strategy

### 1. ARCHITECTURE.md

**Purpose:** Answer "How is this system built?"

**Content Outline:**

```markdown
# Architecture Overview

## System Components
- Next.js App Router (Frontend + API)
- SQLite Database (data persistence)
- React Components (UI layer)
- Scripts (data backfill, utilities)

## Request Flow
User Browser → Next.js Server → API Routes → Database → Response

## Directory Structure
/app                 — Next.js routes and components
  /api               — REST endpoints
  /components        — React UI components
  /watchlist         — Watchlist page
  /lib               — Shared utilities
/lib                 — Core libraries (db, utils)
/scripts             — CLI utilities and data scripts
/__tests__           — Unit tests (Vitest)
/e2e                 — End-to-end tests (Playwright)
/public              — Static assets
/docs                — Feature documentation

## Data Flow
1. User interaction triggers React component
2. Component calls fetch() to API route
3. API route queries SQLite via lib/db.ts
4. Results formatted and cached
5. Response returned to component
6. Component updates UI

## Key Design Decisions
- **Why SQLite?** Simple, embedded, sufficient for current scale
- **Why Next.js App Router?** Server components, built-in API routes
- **Why Vitest + Playwright?** Fast unit tests, reliable E2E

## Architecture Diagrams
[ASCII diagram of request flow]
[Component hierarchy diagram]
```

**Success Criteria:**
- New developer can mentally map any file to its purpose in 5 minutes
- Diagram accurately reflects actual code structure

---

### 2. API.md

**Purpose:** Complete REST API reference

**Template per Endpoint:**

```markdown
### GET /api/market/chart/[ticker]

**Description:** Fetch historical price chart data for a ticker.

**Path Parameters:**
- `ticker` (string, required): Stock ticker symbol (e.g., 'SPX', 'SPY')

**Query Parameters:**
- `range` (string, optional): Time range ['1D', '5D', '1M', '3M', '6M', '1Y'], default '1D'
- `interval` (string, optional): Data granularity ['1m', '5m', '1h', '1d'], default varies by range

**Response (200 OK):**
```json
{
  "ticker": "SPX",
  "range": "1M",
  "points": [
    {"time": "2026-02-09T16:00:00Z", "price": 5850.25, "volume": 1250000},
    ...
  ],
  "current": {"price": 5925.50, "change": 75.25, "changePercent": 1.29}
}
```

**Error Responses:**
- `400 Bad Request`: Invalid ticker or range parameter
- `404 Not Found`: No data available for ticker
- `500 Internal Server Error`: Database or fetch error

**Example Request:**
```bash
curl 'http://localhost:3000/api/market/chart/SPX?range=1M'
```

**Caching:**
- 1D range: 60s cache, 5min stale-while-revalidate
- Other ranges: 15min cache, 1hr stale-while-revalidate

**Notes:**
- Data sourced from SQLite if available, otherwise fetched from external provider
- Volume data may be null for index tickers
```

**Endpoints to Document:**

From codebase analysis:
- `GET /api/market/chart/[ticker]` — Chart data
- `GET /api/market/options-overlay` — Option price overlay
- `GET /api/options/snapshot` — Current option prices
- `GET /api/options/projection` — Option price projections
- `GET /api/options/ai-forecast` — AI-driven forecasts
- `GET /api/fear-greed` — Fear & Greed index
- `GET /api/reports` — List reports
- `GET /api/reports/latest` — Latest report
- `GET /api/reports/[date]` — Report by date
- `POST /api/reports/generate` — Generate new report

**Success Criteria:**
- API consumer can integrate without asking questions
- 100% of endpoints documented with working examples

---

### 3. CONTRIBUTING.md

**Purpose:** Onboard contributors with clear standards

**Content Outline:**

```markdown
# Contributing to Financial Analyzer

## Quick Start
1. Fork and clone the repo
2. Create a worktree: `bash scripts/dev-worktree.sh create feature/my-feature`
3. Make changes, test locally
4. Push and open PR

## Development Workflow
[Detailed worktree setup from DEV.md]
[Port allocation]
[Branch naming conventions]

## Code Standards

### TypeScript
- Enable strict mode (no `any`, use `unknown` + guards)
- Interfaces for public APIs, types for internal
- Always specify return types for functions

### React Components
- Functional components with hooks
- Props interfaces at top of file
- Use CSS modules for styles

### API Routes
- Validate inputs with zod or manual checks
- Return consistent error shapes: `{error: string, code: string}`
- Add appropriate cache headers

### Testing Requirements
- Unit tests for business logic (lib/, utilities)
- Integration tests for API routes
- E2E tests for critical user flows
- Minimum 80% coverage for new code

## PR Checklist
- [ ] Tests added/updated
- [ ] All tests pass (`npm run test:all`)
- [ ] Linting passes (`npm run lint`)
- [ ] No console errors in dev mode
- [ ] Updated relevant docs (API.md if endpoint changed, etc.)
- [ ] Added feature doc (docs/design-*.md) if new feature

## PR Review Process
1. CI runs tests and linting
2. Reviewer checks code quality, test coverage
3. Reviewer verifies docs updated
4. On approval, merge to main → CI deploys

## Common Tasks

### Adding a New API Endpoint
[Step-by-step walkthrough]

### Adding a React Component
[Step-by-step walkthrough]

### Adding Database Schema Change
[Migration process]
```

**Success Criteria:**
- First-time contributor submits clean PR without coaching
- 95% of PRs pass CI on first push

---

### 4. DATABASE.md

**Purpose:** Database schema and operations reference

**Content Outline:**

```markdown
# Database Schema & Operations

## Overview
- Engine: SQLite 3
- Location: `data/reports.db`
- Migrations: Automatic via `lib/db.ts` `migrate()` function

## Schema (Current Version: 4)

### Table: reports
Stores generated financial reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Auto-increment ID |
| date | TEXT | UNIQUE, NOT NULL | Report date (YYYY-MM-DD) |
| summary | TEXT | NOT NULL | Report summary text |
| data | TEXT | | JSON-serialized report data |
| created_at | INTEGER | | Unix timestamp |

**Indexes:**
- `idx_reports_date` on `date` (unique)

---

### Table: option_prices
Historical option pricing data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Auto-increment ID |
| ticker | TEXT | NOT NULL | Ticker symbol (e.g., 'SPX') |
| strike | REAL | NOT NULL | Strike price |
| expiry_date | TEXT | NOT NULL | Expiration (YYYY-MM-DD) |
| option_type | TEXT | DEFAULT 'call' | 'call' or 'put' |
| timestamp | INTEGER | NOT NULL | Unix timestamp |
| price | REAL | NOT NULL | Option price |
| bid | REAL | | Bid price |
| ask | REAL | | Ask price |
| volume | INTEGER | | Trading volume |
| created_at | INTEGER | | Record creation time |

**Indexes:**
- `idx_option_prices_lookup` on `(ticker, strike, expiry_date, option_type, timestamp)`

**Unique Constraint:**
`(ticker, strike, expiry_date, option_type, timestamp)` — prevents duplicates

---

## Common Queries

### Query Recent Option Prices
```sql
SELECT timestamp, price 
FROM option_prices 
WHERE ticker='SPX' AND strike=3000 AND option_type='call' 
ORDER BY timestamp DESC 
LIMIT 30;
```

### List All Available Option Contracts
```sql
SELECT DISTINCT ticker, strike, expiry_date, option_type 
FROM option_prices 
ORDER BY ticker, expiry_date, strike;
```

### Get Latest Report
```sql
SELECT * FROM reports 
ORDER BY date DESC 
LIMIT 1;
```

---

## Backfill Scripts

### Backfill Option Prices
```bash
npm run backfill:options -- \
  --ticker SPX \
  --strike 3000 \
  --expiry 2026-06-17 \
  --type call
```

[Additional script documentation]

---

## Backup & Recovery

### Manual Backup
```bash
cp data/reports.db data/reports.db.backup-$(date +%Y%m%d)
```

### Automated Backup (systemd timer)
[Setup instructions]

### Recovery
```bash
cp data/reports.db.backup-YYYYMMDD data/reports.db
systemctl --user restart financial-analyzer
```

---

## Performance Tips
- Query with indexed columns (ticker, timestamp)
- Use LIMIT for large result sets
- Vacuum database quarterly: `sqlite3 data/reports.db "VACUUM;"`
```

**Success Criteria:**
- Operator can inspect schema without reading code
- Backup/recovery procedure tested and verified

---

### 5. TROUBLESHOOTING.md

**Purpose:** Self-service debugging guide

**Format per Issue:**

```markdown
### Issue: "Module not found" error during npm install

**Symptoms:**
- Error message: `Cannot find module 'next'`
- Occurs after: git clone or branch switch

**Root Causes:**
1. Dependencies not installed
2. Corrupted node_modules
3. Package-lock.json mismatch

**Solutions:**

**Quick Fix:**
```bash
npm install
```

**Nuclear Option (if quick fix fails):**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Verification:**
```bash
npm ls next  # Should show next@14.x.x
npm run dev  # Server should start
```

**Prevention:**
- Always run `npm install` after branch switch
- Commit package-lock.json changes

**Related:**
- [DEV.md: Development setup](./DEV.md)
```

**Issues to Cover:**

- Port already in use
- Database file not found
- API returns 404 (no data)
- Component not rendering
- TypeScript errors
- E2E tests timing out
- Build failures
- systemd service won't start
- Data inconsistencies

**Success Criteria:**
- 80% of issues self-solvable via this guide
- Slack/support volume reduced by 50%

---

### 6. DEPLOYMENT.md

**Purpose:** Production deployment procedures

**Content Outline:**

```markdown
# Deployment Guide

## Architecture

### Environments
| Environment | Path | Port | Branch | Managed By |
|-------------|------|------|--------|------------|
| Production | `~/prod/financial-analyzer` | 3000 | main | GitHub Actions + systemd |
| Dev Worktrees | `~/worktrees/financial-analyzer/*` | 3001+ | feature/* | Manual |

### Deployment Flow
1. Developer pushes to feature branch
2. PR opened to `main`
3. GitHub Actions runs CI (tests, lint)
4. On merge to `main`, GitHub Actions triggers webhook
5. Webhook calls `deploy.sh` on server
6. Deploy script:
   - Pulls latest `main`
   - Runs `npm install`
   - Runs `npm run build`
   - Restarts systemd service
7. Users see new version

---

## Manual Deployment (Emergency)

**Use only when GitHub Actions is down.**

```bash
# SSH to server
ssh user@prod-server

# Navigate to prod directory
cd ~/prod/financial-analyzer

# Pull latest
git pull origin main

# Install deps
npm install

# Build
npm run build

# Restart service
systemctl --user restart financial-analyzer

# Verify
systemctl --user status financial-analyzer
curl http://localhost:3000/api/fear-greed
```

---

## Pre-Deployment Checklist
- [ ] All tests pass locally
- [ ] PR approved and merged
- [ ] CI green on main branch
- [ ] Database migrations tested in dev
- [ ] Backup taken (if schema changes)

---

## Rollback Procedure

**If deployment breaks production:**

```bash
# SSH to server
cd ~/prod/financial-analyzer

# Find last working commit
git log --oneline -10

# Revert to last good commit
git reset --hard <commit-hash>

# Reinstall deps (if package.json changed)
npm install

# Rebuild
npm run build

# Restart
systemctl --user restart financial-analyzer
```

---

## Monitoring

### Check Service Status
```bash
systemctl --user status financial-analyzer
```

### View Logs
```bash
journalctl --user -u financial-analyzer -n 100 -f
```

### Check Health Endpoint
```bash
curl http://localhost:3000/api/fear-greed
# Should return JSON, not 500
```
```

**Success Criteria:**
- Operator can deploy without developer assistance
- Rollback completes in < 5 minutes

---

### 7. TESTING.md

**Purpose:** Testing strategy and patterns

**Content Outline:**

```markdown
# Testing Strategy

## Three-Layer Approach

### 1. Unit Tests (Vitest)
**Scope:** Pure functions, utilities, business logic

**Location:** `__tests__/unit/`

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateGreeks } from '@/lib/options-math';

describe('calculateGreeks', () => {
  it('returns correct delta for ATM call', () => {
    const result = calculateGreeks({
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
      type: 'call'
    });
    expect(result.delta).toBeCloseTo(0.54, 2);
  });
});
```

**Run:**
```bash
npm run test              # All unit tests
npm run test:coverage     # With coverage report
```

---

### 2. Integration Tests (Vitest)
**Scope:** API routes, database interactions

**Location:** `__tests__/unit/api/`

**Example:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/market/chart/[ticker]/route';

describe('GET /api/market/chart/[ticker]', () => {
  it('returns chart data for valid ticker', async () => {
    const req = new Request('http://localhost/api/market/chart/SPX?range=1D');
    const res = await GET(req, { params: { ticker: 'SPX' } });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ticker).toBe('SPX');
    expect(data.points).toBeInstanceOf(Array);
  });
});
```

---

### 3. E2E Tests (Playwright)
**Scope:** Full user workflows, UI interactions

**Location:** `e2e/`

**Example:**
```typescript
import { test, expect } from '@playwright/test';

test('user can view SPX chart', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for chart to load
  await expect(page.locator('[data-testid="chart-spx"]')).toBeVisible();
  
  // Click to open modal
  await page.locator('[data-testid="chart-spx"]').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  // Verify chart rendered
  await expect(page.locator('canvas')).toBeVisible();
});
```

**Run:**
```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # With Playwright UI
```

---

## Coverage Targets
- **Unit tests:** > 80% coverage
- **API routes:** 100% coverage (all endpoints tested)
- **Critical paths:** E2E tested (dashboard load, chart open, report generate)

---

## Test Patterns

### Mocking API Responses
[Example with vi.mock()]

### Testing Error Cases
[Example with expect().rejects.toThrow()]

### Testing React Components
[Example with @testing-library/react]

---

## CI/CD Integration
- Tests run on every PR
- Coverage report posted to PR
- Merge blocked if tests fail or coverage drops
```

**Success Criteria:**
- New developer can write tests following patterns
- Test failures are actionable (clear error messages)

---

### 8. TYPESCRIPT.md

**Purpose:** Type system conventions and setup

**Content Outline:**

```markdown
# TypeScript Configuration & Conventions

## tsconfig.json Explained

```json
{
  "compilerOptions": {
    "strict": true,              // Enable all strict checks
    "noUncheckedIndexedAccess": true,  // Index access returns T | undefined
    "moduleResolution": "bundler",
    "jsx": "preserve",           // Next.js handles JSX
    "paths": {
      "@/*": ["./*"]             // Absolute imports: import X from '@/lib/...'
    }
  }
}
```

---

## Conventions

### Prefer Interfaces for Public APIs
```typescript
// Good: Interface for component props
interface ChartProps {
  ticker: string;
  range: '1D' | '5D' | '1M';
}

// Good: Type for internal data
type ChartDataPoint = { time: string; price: number };
```

### No `any` — Use `unknown` + Type Guards
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (typeof data === 'string') {
    // TypeScript knows data is string here
  }
}
```

### Always Specify Return Types
```typescript
// Bad
function calculate(x: number) {
  return x * 2;
}

// Good
function calculate(x: number): number {
  return x * 2;
}
```

---

## Common Patterns

### API Response Types
```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

// Usage
const res: ApiResponse<ChartData> = await fetch(...).then(r => r.json());
```

### Database Row Types
```typescript
interface OptionPriceRow {
  id: number;
  ticker: string;
  strike: number;
  expiry_date: string;
  // ... etc
}
```

---

## IDE Setup (VSCode)

### Recommended Extensions
- ESLint
- Prettier
- TypeScript Vue Plugin (for JSX support)

### Settings
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## Debugging Type Errors

### "Property X does not exist on type Y"
- Check interface definition
- Ensure import path correct
- Restart TS server (Cmd+Shift+P → "TypeScript: Restart TS Server")

### "Type X is not assignable to type Y"
- Check for missing properties
- Verify union types match
- Use type guards to narrow type
```

**Success Criteria:**
- Zero `any` types in new code
- Type errors are rare in PR reviews

---

### 9. DOCS.md (Documentation Index)

**Purpose:** Central navigation hub

```markdown
# Documentation Index

Welcome to the financial-analyzer documentation. Choose your path:

---

## 🚀 New Developer

Start here if you're contributing for the first time.

1. **[README.md](./README.md)** — Project overview, quickstart
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — How the system is built
3. **[DEV.md](./DEV.md)** — Development workflow, worktrees
4. **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Code standards, PR process
5. **[TESTING.md](./TESTING.md)** — Writing and running tests

---

## 🔌 API Consumer

Integrating with our REST API? Start here.

1. **[API.md](./API.md)** — Complete API reference
2. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — Common issues

---

## 🛠️ Operator / DevOps

Deploying or maintaining production? Start here.

1. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deployment procedures
2. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — Debugging guide
3. **[DATABASE.md](./DATABASE.md)** — Schema, backups, operations

---

## 👀 Code Reviewer

Reviewing PRs? Reference these.

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Code standards
2. **[TESTING.md](./TESTING.md)** — Test coverage expectations
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Design decisions

---

## 📚 All Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project quickstart |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design |
| [API.md](./API.md) | REST API reference |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guide |
| [DATABASE.md](./DATABASE.md) | Schema & operations |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Debugging guide |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment procedures |
| [TESTING.md](./TESTING.md) | Testing strategy |
| [TYPESCRIPT.md](./TYPESCRIPT.md) | Type conventions |
| [DEV.md](./DEV.md) | Development workflow |
| [FEATURE.md](./FEATURE.md) | Feature overview |

---

## 🧭 Quick Links

- [GitHub Issues](https://github.com/org/financial-analyzer/issues)
- [CI/CD Pipeline](https://github.com/org/financial-analyzer/actions)
- [Production Dashboard](http://prod-server:3000)
```

---

## Technical Implementation

### Documentation Generation Workflow

**Phase 1: Content Creation (Manual)**

1. Create markdown files in repo root
2. Follow templates for consistency
3. Write executable code examples
4. Add cross-reference links

**Phase 2: Validation (Automated)**

```bash
# scripts/validate-docs.sh
#!/bin/bash

# Check for broken internal links
find . -name "*.md" -exec grep -H '\[.*\](\.\/.*\.md)' {} \; | \
  while read line; do
    file=$(echo $line | cut -d: -f1)
    link=$(echo $line | sed 's/.*](\(.*\))/\1/')
    target=$(dirname $file)/$link
    if [ ! -f "$target" ]; then
      echo "Broken link in $file: $link"
    fi
  done

# Verify code examples are syntactically valid
# Extract code blocks and run through linter
find . -name "*.md" -exec sed -n '/```bash/,/```/p' {} \; > /tmp/bash-blocks.sh
bash -n /tmp/bash-blocks.sh || echo "Bash syntax errors in docs"

# Check for required sections (TOC, examples, etc.)
for doc in ARCHITECTURE.md API.md CONTRIBUTING.md; do
  if ! grep -q "## Table of Contents" $doc; then
    echo "Missing TOC in $doc"
  fi
done
```

**Phase 3: Review & Merge**

- Peer review for technical accuracy
- Test all code examples in fresh environment
- Verify links work in GitHub web UI
- Spell-check and grammar pass

---

### Automation Tools

**Link Checker (CI Integration)**

```yaml
# .github/workflows/docs-check.yml
name: Documentation Check

on: [pull_request]

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check markdown links
        uses: gaurav-nelson/github-action-markdown-link-check@v1
      - name: Validate code examples
        run: bash scripts/validate-docs.sh
```

**Code Example Verification**

Test harness that extracts and runs code examples:

```bash
# Extract bash examples and verify syntax
sed -n '/```bash/,/```/p' DEPLOYMENT.md | sed '1d;$d' > /tmp/test.sh
bash -n /tmp/test.sh  # Check syntax
```

---

## Quality Assurance

### Review Checklist

Before marking documentation complete:

- [ ] **Accuracy:** All code examples run without modification
- [ ] **Completeness:** Every public API endpoint documented
- [ ] **Clarity:** Junior developer can follow without help
- [ ] **Links:** All internal links verified (no 404s)
- [ ] **Grammar:** Proofread, no typos
- [ ] **Examples:** Minimum 2 working examples per major concept
- [ ] **Structure:** TOC present for docs > 1000 words
- [ ] **Formatting:** Consistent markdown style
- [ ] **Cross-refs:** Related docs linked in "See Also" sections

### Testing Documentation

**Onboarding Simulation:**

1. Give fresh developer README.md only
2. Time how long to:
   - Clone repo and run dev server (target: < 15 min)
   - Understand codebase structure (target: < 30 min)
   - Submit first PR with passing tests (target: < 4 hours)

**API Integration Test:**

1. Give external developer API.md only
2. Ask them to integrate one endpoint
3. Measure questions asked (target: 0)

**Operator Drill:**

1. Give operator DEPLOYMENT.md and TROUBLESHOOTING.md
2. Simulate production issue (e.g., service down)
3. Measure time to resolve (target: < 10 min)

---

## Maintenance Plan

### Ownership

**Documentation Owner:** Engineering team lead  
**Review Cadence:** Quarterly

### Update Triggers

Documentation MUST be updated when:

- [ ] New API endpoint added → update API.md
- [ ] Database schema changes → update DATABASE.md
- [ ] Deployment process changes → update DEPLOYMENT.md
- [ ] New dependency added → update DEV.md, ARCHITECTURE.md
- [ ] Code standards change → update CONTRIBUTING.md

### PR Policy

All PRs that touch code in these areas must include doc updates:

| Code Area | Doc to Update |
|-----------|---------------|
| `app/api/*` | API.md |
| `lib/db.ts` schema | DATABASE.md |
| `scripts/*` | DATABASE.md or DEPLOYMENT.md |
| `.github/workflows/*` | DEPLOYMENT.md |
| Test setup changes | TESTING.md |

CI will enforce: "Files changed in `app/api/` but API.md not updated" → warning comment on PR.

---

### Annual Audit

**When:** Each January (post-holiday lull)

**Process:**

1. Check each doc for outdated content
2. Verify all code examples still work
3. Update screenshots if UI changed
4. Review success metrics (onboarding time, support volume)
5. Identify gaps (new features not documented)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Docs become outdated | High | Medium | PR policy enforces updates, quarterly review |
| Too verbose, hard to navigate | Medium | Low | Use DOCS.md as index, progressive disclosure |
| Code examples don't work | Medium | High | Automated validation in CI, manual testing |
| Unclear writing | Low | Medium | Peer review, onboarding tests |
| Duplication between docs | Medium | Low | Single source of truth, cross-links not copy-paste |

---

## Success Metrics (Post-Launch)

### Leading Indicators (Week 1)

- [ ] 100% of new PRs include doc updates where required
- [ ] 90% of team has read ARCHITECTURE.md
- [ ] Zero broken links in CI

### Lagging Indicators (Month 3)

- [ ] Onboarding time < 1 day (was 3-5 days)
- [ ] Slack "how do I..." questions -50%
- [ ] PR review time -30%
- [ ] API integration questions -80%

---

## Sign-Off

**Architect:** [Name]  
**Design Review Date:** 2026-03-11  
**Approved for Implementation:** ✅

---

**Next Steps:** See [tasks-adding-more-documentation-to-the-repo.md](./tasks-adding-more-documentation-to-the-repo.md) for implementation breakdown.
