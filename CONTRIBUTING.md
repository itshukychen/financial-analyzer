# CONTRIBUTING.md — Contribution Guide

[Home](README.md) > [Docs Index](DOCS.md) > Contributing

## Table of Contents

1. [Development Setup](#development-setup)
2. [Worktree Workflow](#worktree-workflow)
3. [Code Standards](#code-standards)
4. [Testing Requirements](#testing-requirements)
5. [PR Checklist](#pr-checklist)
6. [PR Review Process](#pr-review-process)
7. [Common Tasks](#common-tasks)
8. [Documentation Update Process](#documentation-update-process)
9. [Onboarding Test Scenario](#onboarding-test-scenario)
10. [See Also](#see-also)

---

## Development Setup

Before contributing, ensure your environment is ready:

```bash
# 1. Clone the repo
git clone <repo-url> ~/repos/financial-analyzer
cd ~/repos/financial-analyzer

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local  # or create manually
# Required: ANTHROPIC_API_KEY=sk-ant-...
# Required: REPORT_SECRET=some-random-secret

# 4. Start the dev server (port 3001 for main dev workspace)
npm run dev -- --port 3001
```

For feature work, use worktrees (see next section) rather than working directly in `~/repos/financial-analyzer`.

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude (report generation, AI forecast) |
| `REPORT_SECRET` | Yes | Bearer token for `POST /api/reports/generate` |

---

## Worktree Workflow

Use Git worktrees to work on features in isolation without affecting other branches or the production environment.

### Creating a Feature Worktree

```bash
# Create worktree for a new feature
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh create feature/my-feature

# This creates:
#   - Branch: feature/my-feature (off main)
#   - Path: ~/worktrees/financial-analyzer/feature/my-feature
#   - Auto-assigns port 3002+
```

### Working in a Worktree

```bash
cd ~/worktrees/financial-analyzer/feature/my-feature
npm run dev -- --port 3002  # use the assigned port

# Make your changes, commit as usual
git add <files>
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

### Cleaning Up

```bash
# After PR is merged:
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh remove feature/my-feature
```

### Port Allocation

| Port | Purpose |
|---|---|
| `3000` | Production — never use |
| `3001` | Main dev workspace |
| `3002` | First feature worktree |
| `3003+` | Additional worktrees |

---

## Code Standards

### TypeScript

- **Strict mode is non-negotiable.** `"strict": true` is set in `tsconfig.json`. All code must type-check cleanly.
- **Never use `any`.** Use `unknown` with type guards, or define proper interfaces.
- **Always annotate return types** on functions (except trivial one-liners where inference is unambiguous).
- **Prefer `interface` for public APIs** (API response shapes, DB row types, component props). Use `type` for unions, mapped types, and internal aliases.

```typescript
// BAD
function processData(data: any): any {
  return data.value;
}

// GOOD
interface DataItem {
  value: number;
  timestamp: string;
}

function processData(data: DataItem): number {
  return data.value;
}
```

### React Components

- **Functional components only** — no class components.
- Define props as a TypeScript interface immediately before the component:

```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
}

export function StatCard({ label, value, change }: StatCardProps) {
  // ...
}
```

- **Named exports only** from component files (not default exports).
- Use Tailwind CSS utility classes for styling. No inline styles except for computed values (e.g., chart dimensions).
- Dark-only design — never add `dark:` conditional classes; just write for dark backgrounds.

### API Route Patterns

All route handlers in `app/api/` should follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // for DB-backed routes

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Parse and validate params
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker' }, { status: 400 });
  }

  try {
    // 2. Fetch data
    const data = fetchSomeData(ticker);

    // 3. Return response
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Key rules:
- Always validate inputs at the top; return `400` immediately on bad input.
- Wrap the core logic in `try/catch`; return `{ error: message }` with `500` on unexpected failures.
- Set `Cache-Control` headers explicitly for routes that should be cached by CDN/browser.
- Use `export const dynamic = 'force-dynamic'` for routes reading from SQLite (prevents stale static generation).

---

## Testing Requirements

All contributions must include tests. See [TESTING.md](TESTING.md) for detailed patterns and examples.

### Minimum Coverage

- **Unit tests** for all pure functions and business logic in `lib/`
- **Integration tests** for new API routes
- **Overall coverage target:** 80% line coverage (enforced in CI)

### Running Tests

```bash
# Run unit + integration tests once
npm run test

# Run in watch mode during development
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run E2E tests (requires dev server running)
npm run test:e2e
```

### Test File Location

| Test type | Location | Pattern |
|---|---|---|
| Unit | `__tests__/unit/` | `*.test.ts` |
| API integration | `__tests__/unit/api/` | `*.test.ts` |
| E2E | `e2e/` | `*.spec.ts` |

---

## PR Checklist

Before opening a PR, verify all of the following:

```
[ ] All tests pass: npm run test
[ ] No lint errors: npm run lint
[ ] No TypeScript errors: npx tsc --noEmit
[ ] No console.log() left in production code
[ ] New API endpoints are documented in API.md
[ ] Database schema changes are documented in DATABASE.md
[ ] New environment variables are documented in DEV.md
[ ] Code coverage ≥ 80% (check with npm run test:coverage)
[ ] PR description explains WHY, not just what changed
[ ] PR is scoped to a single feature/fix (no unrelated changes)
```

---

## PR Review Process

1. **Open PR** from your feature branch to `main`
2. **CI runs** automatically: lint, type check, unit tests, E2E tests
3. **Reviewer checks:**
   - Technical correctness
   - Code style and TypeScript conventions
   - Test coverage
   - Documentation updated
4. **Approval required** from at least one reviewer before merge
5. **Merge to `main`** — CD pipeline automatically deploys to production

Typical review turnaround: same business day for small PRs, 1-2 days for larger ones.

---

## Common Tasks

### Adding a New API Endpoint

1. Create the route directory and file:
   ```bash
   mkdir -p app/api/market/my-endpoint
   touch app/api/market/my-endpoint/route.ts
   ```

2. Write the handler following the template above.

3. Add tests in `__tests__/unit/api/`:
   ```bash
   touch __tests__/unit/api/my-endpoint.test.ts
   ```

4. Document the endpoint in [API.md](API.md) under the Endpoints section.

5. Test manually:
   ```bash
   curl "http://localhost:3002/api/market/my-endpoint?param=value"
   ```

### Adding a React Component

1. Create the file in the appropriate subdirectory of `app/components/`:
   ```bash
   touch app/components/charts/MyNewChart.tsx
   ```

2. Write the component with TypeScript interface for props:
   ```typescript
   interface MyNewChartProps {
     data: DataPoint[];
     height?: number;
   }

   export function MyNewChart({ data, height = 300 }: MyNewChartProps) {
     return (
       <div className="rounded-lg bg-neutral-900 p-4">
         {/* chart implementation */}
       </div>
     );
   }
   ```

3. Export from the component file (named export, not default).

4. Import and use in the relevant page.

### Modifying the Database Schema

1. Add a new migration file in `lib/migrations/`:
   ```bash
   touch lib/migrations/005_my_new_table.sql
   ```

2. Write the migration SQL:
   ```sql
   -- lib/migrations/005_my_new_table.sql
   CREATE TABLE IF NOT EXISTS my_table (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
   );
   CREATE INDEX IF NOT EXISTS idx_my_table_name ON my_table(name);
   ```

3. Apply the migration in `lib/db.ts` by updating the `migrate()` function to check for and create the new table.

4. Add TypeScript interface for the new row type.

5. Add CRUD functions to the `createDb()` factory and export from module.

6. Update [DATABASE.md](DATABASE.md) with the new table schema.

---

## Documentation Update Process

When you make code changes, update the relevant documentation **in the same PR**. Use this table as a guide:

| If you change... | Update these docs |
|---|---|
| API endpoint (add, modify, remove) | `API.md` |
| Database schema | `DATABASE.md` |
| Deployment process or `deploy.sh` | `DEPLOYMENT.md` |
| TypeScript conventions or `tsconfig.json` | `TYPESCRIPT.md` |
| Code standards or contribution process | `CONTRIBUTING.md` |
| Environment variables | `DEV.md` |
| New major feature/component | `ARCHITECTURE.md` |
| Test patterns or coverage requirements | `TESTING.md` |

**PR template checklist includes:** `[ ] Documentation updated if needed`

### Quarterly Documentation Audit

The **engineering lead** owns a quarterly documentation review every January, April, July, and October:

1. Read each doc and verify accuracy against current code
2. Run all bash code examples and verify they work
3. Check for newly added features not yet documented
4. Review metrics: onboarding time, common Slack questions answered without help
5. File issues for any gaps found

---

## Onboarding Test Scenario

To validate that this documentation is effective, new developers should be able to complete the following within one day using only these docs (no live assistance):

1. **Clone and run** (target: < 15 min)
   - Follow [README.md](README.md) quickstart
   - Dev server running on localhost:3001

2. **Understand the codebase** (target: < 30 min)
   - Read [ARCHITECTURE.md](ARCHITECTURE.md)
   - Explain to yourself: where does a request go from browser to database?

3. **Make a change** (target: < 4 hours with tests)
   - Add a simple API endpoint following the pattern in [CONTRIBUTING.md](CONTRIBUTING.md)
   - Write unit tests following [TESTING.md](TESTING.md)
   - Verify tests pass with `npm run test`

If you get stuck, note exactly where and open an issue tagging `documentation`. Your feedback directly improves these docs.

---

## See Also

- [TESTING.md](TESTING.md) — Test patterns and CI integration
- [ARCHITECTURE.md](ARCHITECTURE.md) — Codebase structure
- [TYPESCRIPT.md](TYPESCRIPT.md) — TypeScript conventions
- [DEV.md](DEV.md) — Environment setup details
