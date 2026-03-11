# DEV.md — Development Workflow

[Home](README.md) > [Docs Index](DOCS.md) > Development Workflow

> **Read this before touching anything.**

## Table of Contents

1. [Two Environments, One Rule](#two-environments-one-rule)
2. [Starting a Feature](#starting-a-feature)
3. [Port Convention](#port-convention)
4. [What Lives Where](#what-lives-where)
5. [Quick Reference](#quick-reference)
6. [Rules for Agents](#rules-for-agents)
7. [npm Scripts Reference](#npm-scripts-reference)
8. [Worktree Best Practices](#worktree-best-practices)
9. [Common Development Tasks](#common-development-tasks)
10. [Debugging Tips](#debugging-tips)
11. [Environment Variable Configuration](#environment-variable-configuration)

---

## Two Environments, One Rule

| Environment | Path | Port | Managed by |
|---|---|---|---|
| **Production** | `~/prod/financial-analyzer` | **3000** | CD pipeline only |
| **Dev workspace** | `~/repos/financial-analyzer` | 3001+ | Agents / devs |

**The prod clone is untouchable.** Only `deploy.sh` (triggered by GitHub Actions after CI passes on `main`) ever runs there. Never manually build, restart, or modify files in `~/prod/`.

---

## Starting a Feature

1. **Create a worktree** — isolated copy of the repo on its own branch, its own port:

   ```bash
   bash ~/repos/financial-analyzer/scripts/dev-worktree.sh create feature/my-feature
   ```

   This:
   - Creates branch `feature/my-feature` off `main`
   - Checks it out at `~/worktrees/financial-analyzer/feature/my-feature`
   - Installs deps
   - Auto-assigns a port (3002+)

2. **Start the dev server** in that worktree:

   ```bash
   cd ~/worktrees/financial-analyzer/feature/my-feature
   npm run dev -- --port <assigned-port>
   ```

3. **Iterate.** Edits in the worktree don't affect prod or any other worktree.

4. **When done:** open a PR from the feature branch. CI runs. On merge → CD deploys to prod automatically.

5. **Clean up** the worktree after merge:

   ```bash
   bash ~/repos/financial-analyzer/scripts/dev-worktree.sh remove feature/my-feature
   ```

---

## Port Convention

| Port | Purpose |
|---|---|
| `3000` | **Production** — do not use |
| `3001` | Dev preview (quick main-branch iteration) |
| `3002` | First feature worktree |
| `3003` | Second feature worktree |
| `3004+` | Additional worktrees (auto-assigned) |

The `dev-worktree.sh create` script auto-assigns the next free port starting at 3002.

---

## What Lives Where

```
~/prod/financial-analyzer/     ← CD-only. Never touch manually.
~/repos/financial-analyzer/    ← Dev workspace. Edit freely.
~/worktrees/financial-analyzer/ ← Git worktrees for parallel features.
  feature/spx-report/
  feature/watchlist-ui/
  ...
```

---

## Quick Reference

```bash
# See all environments + their status
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh list

# Create a new feature env
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh create feature/my-feature

# Remove after merge
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh remove feature/my-feature

# Check prod service
systemctl --user status financial-analyzer

# Manually trigger a prod restart (only after deploy.sh runs, not instead of it)
systemctl --user restart financial-analyzer
```

---

## Rules for Agents

- ✅ Work in `~/repos/financial-analyzer` or a worktree
- ✅ Run `npm run dev` on port 3001+
- ✅ Build and test freely in your worktree
- ✅ Push branches, open PRs
- ❌ Never run `npm run build` in `~/prod/`
- ❌ Never `systemctl restart financial-analyzer` as part of dev work
- ❌ Never push directly to `main` for feature work — use PRs

---

## npm Scripts Reference

| Script | Command | When to use |
|---|---|---|
| `dev` | `next dev` | Local development — auto-reloads on file change |
| `build` | `next build` | Production build — run in worktree to test, never in `~/prod/` |
| `start` | `next start` | Start a production build locally |
| `lint` | `eslint` | Check for lint errors before committing |
| `test` | `vitest run` | Run all unit/integration tests once |
| `test:watch` | `vitest` | Run tests in watch mode during development |
| `test:coverage` | `vitest run --coverage` | Run tests and generate coverage report |
| `test:e2e` | `playwright test` | Run end-to-end tests (requires dev server running) |
| `test:e2e:ui` | `playwright test --ui` | Interactive Playwright test runner |
| `test:all` | `npm run test:coverage && npm run test:e2e` | Full test suite (used in CI) |
| `backfill:options` | `tsx scripts/backfill-option-prices.ts` | Backfill historical option price data |

**Typical dev workflow:**
```bash
# In one terminal: start dev server
npm run dev -- --port 3002

# In another: run tests in watch mode
npm run test:watch

# Before committing:
npm run lint && npx tsc --noEmit && npm run test
```

---

## Worktree Best Practices

### When to Create a Worktree

Create a worktree when:
- Working on a feature that takes more than a few hours
- You need to test changes in isolation without affecting the main dev workspace
- You're working on something that could break the app during development

Work directly in `~/repos/financial-analyzer` when:
- Making a quick one-file fix
- Writing documentation
- Running one-off scripts or exploration

### Branch Naming

Follow this convention:

| Type | Format | Example |
|---|---|---|
| Feature | `feature/short-description` | `feature/options-overlay` |
| Bug fix | `fix/what-was-broken` | `fix/chart-nan-values` |
| Docs | `docs/what-was-documented` | `docs/api-reference` |
| Refactor | `refactor/what-changed` | `refactor/db-factory` |

---

## Common Development Tasks

### Adding a New API Endpoint

```bash
# 1. Create the route directory
mkdir -p app/api/market/my-endpoint
touch app/api/market/my-endpoint/route.ts

# 2. Write the handler (see CONTRIBUTING.md for the template)

# 3. Create tests
touch __tests__/api/my-endpoint.test.ts

# 4. Test manually
curl "http://localhost:3002/api/market/my-endpoint?param=value"

# 5. Update API.md with the new endpoint documentation
```

### Adding a React Component

```bash
# Create in appropriate subdirectory
touch app/components/charts/MyChart.tsx

# Test that it renders
# (add __tests__/components/MyChart.test.tsx if logic is non-trivial)
```

### Modifying Database Schema

```bash
# 1. Write migration SQL
touch lib/migrations/005_my_change.sql

# 2. Update migrate() function in lib/db.ts

# 3. Test migration by deleting data/reports.db and restarting dev server
rm data/reports.db
npm run dev -- --port 3002

# 4. Verify tables exist
sqlite3 data/reports.db ".tables"

# 5. Update DATABASE.md
```

---

## Debugging Tips

### Chrome DevTools

For client-side issues:
1. Open DevTools (F12)
2. **Console tab** — React errors, failed fetch calls
3. **Network tab** — API request/response details, filter by `/api/`
4. **Components tab** (React DevTools extension) — inspect component state

### Inspecting the SQLite Database

```bash
# Interactive SQLite shell
sqlite3 data/reports.db

# Quick queries
sqlite3 data/reports.db "SELECT date, period FROM reports ORDER BY generated_at DESC LIMIT 5;"
sqlite3 data/reports.db ".tables"
sqlite3 data/reports.db ".schema option_prices"
```

### Reading Next.js Error Messages

Next.js error overlays in development show:
- **The error** — TypeScript errors, runtime exceptions
- **Source file and line** — click to open in editor (if VS Code is configured as your editor: `EDITOR=code`)
- **Call stack** — trace back through component tree

For server-side errors not shown in the browser, check the terminal running `npm run dev`.

---

## Environment Variable Configuration

Create `.env.local` in the project root (not committed to git):

```bash
# Required: Anthropic API key for Claude (report generation, AI forecast)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Required: Bearer token for POST /api/reports/generate
# Generate a random secret: openssl rand -hex 32
REPORT_SECRET=your-random-secret-here
```

`.env.local` is loaded automatically by Next.js in development. In production, it's loaded from `~/prod/financial-analyzer/.env.local`.

**Never commit `.env.local` to git.** It's in `.gitignore`.

---

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md) — Code standards and PR process
- [ARCHITECTURE.md](ARCHITECTURE.md) — How the project is structured
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — When things go wrong
- [DEPLOYMENT.md](DEPLOYMENT.md) — How production works
