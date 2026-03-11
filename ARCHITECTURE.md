# ARCHITECTURE.md — System Architecture

[Home](README.md) > [Docs Index](DOCS.md) > Architecture

## Table of Contents

1. [Overview](#overview)
2. [Directory Layout](#directory-layout)
3. [Request Flow](#request-flow)
4. [Component Hierarchy](#component-hierarchy)
5. [Data Flow Diagram](#data-flow-diagram)
6. [Key Design Decisions](#key-design-decisions)
7. [External Dependencies](#external-dependencies)
8. [See Also](#see-also)

---

## Overview

`financial-analyzer` is a **Next.js App Router** application that provides real-time market analysis dashboards, options analytics, and AI-generated market reports. It runs as a single-server application backed by **SQLite** via `better-sqlite3`, with no external database dependency.

The application is structured around three domains:
- **Market charts** — live price feeds from Yahoo Finance and FRED
- **Options analytics** — IV, Greeks, projections, and AI forecasts
- **Reports** — AI-generated daily market summaries (morning / midday / EOD)

---

## Directory Layout

```
financial-analyzer/
├── app/                        # Next.js App Router (pages + API routes)
│   ├── api/                    # REST API route handlers
│   │   ├── fear-greed/         # CNN Fear & Greed index proxy
│   │   ├── market/
│   │   │   ├── chart/[ticker]/ # Historical price data (Yahoo/FRED)
│   │   │   └── options-overlay/# Option price overlay data (DB)
│   │   ├── options/
│   │   │   ├── ai-forecast/    # AI-generated options analysis (POST)
│   │   │   ├── projection/     # Probability distribution projections
│   │   │   └── snapshot/       # Current IV/Greeks snapshot
│   │   └── reports/            # Daily market reports CRUD
│   │       ├── [date]/         # Report by date
│   │       ├── generate/       # Trigger report generation (POST)
│   │       ├── latest/         # Most recent report
│   │       └── route.ts        # List all reports
│   ├── components/             # Shared React components
│   │   ├── charts/             # Chart components (MarketChart, ChartModal, etc.)
│   │   ├── options/            # Options analytics components
│   │   └── reports/            # Report display components
│   ├── markets/                # /markets page
│   ├── reports/                # /reports page
│   ├── watchlist/              # /watchlist page
│   ├── alerts/                 # /alerts page
│   ├── layout.tsx              # Root layout (AppShell)
│   └── page.tsx                # Home page (dashboard)
│
├── lib/                        # Server-side utilities and shared logic
│   ├── db.ts                   # SQLite database layer (createDb factory + singleton)
│   ├── optionsAnalytics.ts     # Black-Scholes, Greeks, volatility calculations
│   ├── aiOptionsForecast.ts    # Claude AI integration for options analysis
│   ├── mockOptionsData.ts      # Seed data for testing/demo
│   ├── migrations/             # SQL migration files
│   │   └── 004_ai_forecasts.sql
│   └── types/                  # Shared TypeScript type definitions
│
├── scripts/                    # Utility scripts (not part of web app)
│   ├── generate-report.ts      # Market report generation logic
│   ├── backfill-option-data.ts # Historical options data backfill
│   ├── backfill-option-prices.ts
│   ├── backfill-ai-forecasts.ts
│   └── dev-worktree.sh         # Worktree management helper
│
├── __tests__/                  # Test suite
│   ├── unit/                   # Unit tests (Vitest)
│   │   ├── api/                # API route handler tests
│   │   └── lib/                # Library function tests
│   └── e2e/                    # End-to-end tests (Playwright)
│
├── e2e/                        # Playwright test specs
├── data/                       # Runtime data (gitignored)
│   └── reports.db              # SQLite database file
├── public/                     # Static assets
├── DEV.md                      # Development workflow
├── deploy.sh                   # Production deployment script
└── docs/                       # Feature design documents
```

---

## Request Flow

The following diagram shows how a user request travels from browser to database and back for a typical API call:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REQUEST FLOW                                │
│                                                                     │
│  Browser                                                            │
│    │                                                                │
│    │  HTTP GET /api/market/chart/^GSPC?range=1M                    │
│    ▼                                                                │
│  Next.js Server (Node.js)                                           │
│    │                                                                │
│    │  App Router matches route:                                     │
│    │  app/api/market/chart/[ticker]/route.ts                        │
│    ▼                                                                │
│  Route Handler                                                      │
│    │  1. Extract params (ticker=^GSPC, range=1M)                    │
│    │  2. Validate range against VALID_RANGES                        │
│    │  3. Check if ticker needs FRED vs Yahoo Finance                │
│    ▼                                                                │
│  External API (Yahoo Finance or FRED)                               │
│    │  fetch() with Next.js cache (revalidate: 900s)                │
│    │  Returns raw JSON/CSV price data                               │
│    ▼                                                                │
│  Route Handler (continued)                                          │
│    │  4. Parse/normalize data into DataPoint[]                      │
│    │  5. Calculate change, changePct from first/last values         │
│    │  6. Build RouteResponse object                                 │
│    ▼                                                                │
│  NextResponse.json(response)                                        │
│    │                                                                │
│    ▼                                                                │
│  Browser receives JSON                                              │
│  React component renders chart                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**For database-backed routes** (options overlay, reports, snapshots):

```
┌─────────────────────────────────────────────────────────────────────┐
│              DATABASE-BACKED REQUEST FLOW                           │
│                                                                     │
│  Browser                                                            │
│    │  HTTP GET /api/options/snapshot?ticker=SPWX&expiry=30d         │
│    ▼                                                                │
│  Route Handler (app/api/options/snapshot/route.ts)                 │
│    │  1. Parse query params                                          │
│    │  2. Call getLatestOptionSnapshot(ticker, expiry)               │
│    ▼                                                                │
│  lib/db.ts (singleton)                                              │
│    │  better-sqlite3 synchronous query                              │
│    │  SELECT * FROM option_snapshots WHERE ...                      │
│    ▼                                                                │
│  SQLite (data/reports.db)                                           │
│    │  Returns row(s)                                                │
│    ▼                                                                │
│  Route Handler                                                      │
│    │  3. Parse raw_json field                                        │
│    │  4. Shape response object                                      │
│    │  5. Return NextResponse.json(response)                         │
│    ▼                                                                │
│  Browser                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

The React component tree starts from the root layout and branches into feature-specific components:

```
AppShell (app/layout.tsx → app/components/AppShell.tsx)
├── Sidebar
│   └── Navigation links (Home, Markets, Options, Reports, Watchlist, Alerts)
├── TopBar
│   └── FearGreedWidget          ← Fetches /api/fear-greed
│
└── Page Content (slot)
    │
    ├── Home (app/page.tsx)
    │   ├── StatCard (×N)        ← Summary statistics
    │   └── MarketChartsWidget   ← Fetches /api/market/chart/[ticker]
    │       └── MarketChart      ← Lightweight-charts integration
    │           └── ChartModal   ← Expanded chart view
    │               └── OptionsOverlaySelector  ← Fetches options-overlay
    │
    ├── Markets (app/markets/)
    │   └── MarketChartsWidget (same as above)
    │
    ├── Options (app/lib/ page)
    │   ├── AIOptionsForecastSection  ← Fetches /api/options/ai-forecast
    │   ├── OptionProjectionWidget    ← Fetches /api/options/projection
    │   └── RegimeChangeAlert
    │
    └── Reports (app/reports/)
        ├── ReportHeader
        ├── DataSnapshot
        └── ReportSection
```

**Key component design principles:**
- Components are **functional only** — no class components
- Props interfaces are defined with TypeScript interfaces (prefix with `I` not required)
- Components handle their own data fetching via `fetch()` in client components or server components
- Dark-only design — no light/dark toggle, all styles assume dark background

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                                   │
│                                                                  │
│  Yahoo Finance API         FRED (Federal Reserve)                │
│  query1.finance.yahoo.com  fred.stlouisfed.org                   │
│  (equities, ETFs, VIX)     (DGS2, DGS10 treasury yields)        │
│         │                          │                             │
│         └──────────┬───────────────┘                             │
│                    ▼                                             │
│          Next.js fetch() cache                                   │
│          revalidate: 60s (1D) / 900s (other ranges)             │
│                    │                                             │
│         ┌──────────┴───────────────┐                             │
│         ▼                          ▼                             │
│  Market Chart API             CNN Fear & Greed                   │
│  /api/market/chart/[ticker]   /api/fear-greed                    │
│                                                                  │
│  SQLite (data/reports.db)                                        │
│  ┌──────────────────────────────────────────┐                    │
│  │  reports          option_snapshots        │                    │
│  │  option_prices    option_projections      │                    │
│  │  ai_forecasts                            │                    │
│  └──────────────────────────────────────────┘                    │
│         │                                                        │
│         ├── /api/reports/*                                       │
│         ├── /api/options/snapshot                                │
│         ├── /api/options/projection                              │
│         ├── /api/options/ai-forecast                             │
│         └── /api/market/options-overlay                          │
│                                                                  │
│  Anthropic Claude API                                            │
│  (for /api/reports/generate and /api/options/ai-forecast)        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### Why SQLite?

**Decision:** Use SQLite via `better-sqlite3` for all persistent storage.

**Rationale:**
- The application is a **single-server deployment** — no need for a network database
- `better-sqlite3` is **synchronous**, which simplifies the async model in Next.js API routes and avoids connection pool management
- SQLite files are trivially backed up (`cp data/reports.db backup/`)
- Schema migrations are handled in-process via the `migrate()` function in `lib/db.ts`, keeping the DB layer self-contained
- The data volume (daily reports, option snapshots) is well within SQLite's performance envelope

**Trade-off:** Cannot horizontally scale the database. Acceptable for a single-operator financial dashboard.

### Why Next.js App Router?

**Decision:** Use Next.js 16 with App Router (not Pages Router).

**Rationale:**
- App Router enables **server components by default**, reducing client-side JavaScript for content-heavy pages like reports
- **Built-in caching** (`next: { revalidate: N }` in fetch calls) replaces need for an external cache layer
- Route handlers in `app/api/` co-locate API logic with the pages that use it
- The project started after App Router was stable, so there was no Pages Router legacy to migrate from

**Trade-off:** App Router has a steeper learning curve. New developers should read the [Next.js App Router docs](https://nextjs.org/docs/app) before contributing.

### Why TypeScript Strict Mode?

**Decision:** `"strict": true` in tsconfig.json.

**Rationale:**
- Catches null/undefined errors at compile time, critical for financial data where `null` option prices must be handled explicitly
- Forces explicit return types, making API contracts self-documenting
- The small upfront cost in verbose types pays off in long-term maintainability

See [TYPESCRIPT.md](TYPESCRIPT.md) for conventions and common patterns.

### Why a `createDb` Factory Pattern?

**Decision:** `lib/db.ts` exports a factory function `createDb(path)` in addition to module-level singletons.

**Rationale:**
- Tests use `createDb(':memory:')` to get an in-memory SQLite instance, completely isolated from the production `data/reports.db`
- The singleton (`_instance`) is initialized at module load time for production use
- This avoids mocking the database module in tests while still testing real SQL queries

### Why No External State Management?

**Decision:** No Redux, Zustand, or similar library. State lives in React component state and props.

**Rationale:**
- The application has **minimal cross-component state** — each widget fetches its own data
- `useState` and `useEffect` (or server components) are sufficient
- Adding a state library would increase bundle size and complexity without benefit

---

## External Dependencies

| Dependency | Purpose | Version |
|---|---|---|
| `next` | Framework (routing, SSR, caching) | 16.x |
| `react` / `react-dom` | UI rendering | 19.x |
| `better-sqlite3` | SQLite database access (synchronous) | 12.x |
| `@anthropic-ai/sdk` | Claude AI API client | 0.78+ |
| `lightweight-charts` | Financial chart rendering | 5.x |
| `tailwindcss` | Utility-first CSS | 4.x |
| `typescript` | Type checking | 5.x |
| `vitest` | Unit/integration test runner | 4.x |
| `@playwright/test` | End-to-end test runner | 1.58+ |

---

## See Also

- [API.md](API.md) — Complete endpoint documentation
- [DATABASE.md](DATABASE.md) — Schema details and maintenance
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to add features
- [DEV.md](DEV.md) — Development environment setup
