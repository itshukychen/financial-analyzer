# DATABASE.md — Database Schema & Operations

[Home](README.md) > [Docs Index](DOCS.md) > Database

## Table of Contents

1. [Overview](#overview)
2. [Database Location](#database-location)
3. [Schema Version](#schema-version)
4. [Tables](#tables)
   - [reports](#reports)
   - [option_snapshots](#option_snapshots)
   - [option_projections](#option_projections)
   - [option_prices](#option_prices)
   - [ai_forecasts](#ai_forecasts)
5. [Indexes](#indexes)
6. [Common Queries](#common-queries)
7. [Migrations](#migrations)
8. [Backup Procedures](#backup-procedures)
9. [Recovery Procedures](#recovery-procedures)
10. [Database Inspection](#database-inspection)
11. [Performance Tips](#performance-tips)
12. [See Also](#see-also)

---

## Overview

The application uses **SQLite** via `better-sqlite3`. The database is a single file at `data/reports.db`. All schema creation, migration, and querying happens in `lib/db.ts`.

The database layer uses a **factory pattern** (`createDb(path)`) so tests can use in-memory databases without touching the production file.

---

## Database Location

```
financial-analyzer/
└── data/
    └── reports.db    ← Production database
```

The `data/` directory is created automatically on first startup if it doesn't exist. It is **gitignored** — the database file is never committed to version control.

The path is resolved in `lib/db.ts`:

```typescript
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'reports.db');
```

When running in a worktree, each worktree has its own `data/reports.db` — they are fully isolated.

---

## Schema Version

**Current version: v4**

Version history:
| Version | Change |
|---|---|
| v1 | Initial `reports` table (no `period` column) |
| v2 | Added `period` column to `reports`; data migrated from `v1` |
| v3 | Added `option_snapshots` and `option_projections` tables |
| v4 | Added `option_prices` table (for chart overlay feature) |

Migrations run automatically at startup in `lib/db.ts → migrate()`. There is no manual migration step.

---

## Tables

### reports

Stores AI-generated daily market reports. One report per date/period combination.

```sql
CREATE TABLE reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT    NOT NULL,              -- YYYY-MM-DD
  period       TEXT    NOT NULL DEFAULT 'eod', -- 'morning' | 'midday' | 'eod'
  generated_at INTEGER NOT NULL,              -- Unix timestamp (seconds)
  ticker_data  TEXT    NOT NULL,              -- JSON: market data snapshot
  report_json  TEXT    NOT NULL,              -- JSON: Claude's analysis output
  model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
  UNIQUE(date, period)                        -- One report per date+period
);
```

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Auto-incrementing primary key |
| `date` | TEXT | Report date in `YYYY-MM-DD` format |
| `period` | TEXT | Time of day: `morning`, `midday`, or `eod` |
| `generated_at` | INTEGER | Unix epoch seconds when report was generated |
| `ticker_data` | TEXT | JSON blob of market data used as input (SPX, VIX, etc.) |
| `report_json` | TEXT | JSON blob of Claude's structured analysis |
| `model` | TEXT | Claude model version used |

---

### option_snapshots

Stores point-in-time options analytics snapshots (IV, Greeks, skew) per ticker/expiry combination.

```sql
CREATE TABLE option_snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              TEXT    NOT NULL,    -- YYYY-MM-DD
  ticker            TEXT    NOT NULL,    -- e.g., 'SPWX'
  expiry            TEXT    NOT NULL,    -- e.g., '30d'
  iv_30d            REAL,               -- 30-day implied volatility (%)
  iv_60d            REAL,               -- 60-day implied volatility (%)
  hv_20d            REAL,               -- 20-day historical volatility (%)
  hv_60d            REAL,               -- 60-day historical volatility (%)
  iv_rank           INTEGER,            -- IV rank (0-100)
  net_delta         REAL,               -- Net delta of position
  atm_gamma         REAL,               -- At-the-money gamma
  vega_per_1pct     REAL,               -- Vega per 1% vol move
  theta_daily       REAL,               -- Daily theta decay
  call_otm_iv       REAL,               -- 25-delta OTM call IV (%)
  put_otm_iv        REAL,               -- 25-delta OTM put IV (%)
  skew_ratio        REAL,               -- put_otm_iv / call_otm_iv
  implied_move_pct  REAL,               -- Expected 1-sigma move (%)
  regime            TEXT,               -- 'low' | 'normal' | 'high'
  raw_json          TEXT,               -- Full raw data (JSON)
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(date, ticker, expiry)
);
```

---

### option_projections

Stores probability distribution data for price projections over a given horizon.

```sql
CREATE TABLE option_projections (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  date                    TEXT    NOT NULL,    -- YYYY-MM-DD
  ticker                  TEXT    NOT NULL,
  horizon_days            INTEGER NOT NULL,    -- e.g., 28 or 30
  prob_distribution       TEXT    NOT NULL,    -- JSON: [{price, probability}]
  key_levels              TEXT    NOT NULL,    -- JSON: [{level, type, probability}]
  regime_classification   TEXT,               -- 'low' | 'normal' | 'high'
  created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(date, ticker, horizon_days)
);
```

The `prob_distribution` and `key_levels` columns store JSON arrays (parsed in `lib/db.ts → parseOptionProjection()`).

---

### option_prices

Stores historical option price ticks for the chart overlay feature. Supports time-series queries for a specific contract (ticker + strike + expiry + type).

```sql
CREATE TABLE option_prices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker            TEXT    NOT NULL,           -- e.g., 'SPY'
  strike            REAL    NOT NULL,           -- Strike price (e.g., 550.0)
  expiry_date       TEXT    NOT NULL,           -- YYYY-MM-DD
  option_type       TEXT    NOT NULL DEFAULT 'call',  -- 'call' | 'put'
  timestamp         INTEGER NOT NULL,           -- Unix timestamp (seconds)
  price             REAL    NOT NULL,           -- Mark price
  bid               REAL,                       -- Bid price (nullable)
  ask               REAL,                       -- Ask price (nullable)
  volume            INTEGER,                    -- Volume (nullable)
  created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
);
```

---

### ai_forecasts

Stores AI-generated options analysis forecasts. Created via `POST /api/options/ai-forecast`. Defined in `lib/migrations/004_ai_forecasts.sql`.

```sql
CREATE TABLE ai_forecasts (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker                  TEXT    NOT NULL,
  date                    TEXT    NOT NULL,    -- YYYY-MM-DD
  snapshot_date           TEXT    NOT NULL,
  summary                 TEXT,
  outlook                 TEXT CHECK(outlook IN ('bullish','neutral','bearish')),
  pt_conservative         REAL,               -- Conservative price target
  pt_base                 REAL,               -- Base case price target
  pt_aggressive           REAL,               -- Aggressive price target
  pt_confidence           REAL CHECK(pt_confidence >= 0 AND pt_confidence <= 1),
  regime_classification   TEXT CHECK(regime_classification IN ('elevated','normal','depressed')),
  regime_justification    TEXT,
  regime_recommendation   TEXT,
  key_support             REAL,
  key_resistance          REAL,
  profit_targets          TEXT,               -- JSON array of prices
  stop_loss               REAL,
  overall_confidence      REAL CHECK(overall_confidence >= 0 AND overall_confidence <= 1),
  confidence_reasoning    TEXT,
  created_at              TEXT DEFAULT (datetime('now')),
  ai_model                TEXT DEFAULT 'claude-sonnet-4-5',
  UNIQUE(ticker, date, snapshot_date)
);
```

---

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_reports_date` | `reports` | `date DESC, period ASC` | List reports chronologically; filter by date |
| `idx_option_snapshots_date` | `option_snapshots` | `date DESC, ticker, expiry` | Get latest snapshot for ticker/expiry |
| `idx_option_projections_date` | `option_projections` | `date DESC, ticker` | Get projection for ticker/date |
| `idx_option_prices_lookup` | `option_prices` | `ticker, strike, expiry_date, option_type, timestamp` | Primary lookup for overlay chart queries |
| `idx_option_prices_expiry` | `option_prices` | `expiry_date` | Find all contracts expiring on a given date |
| `idx_ai_forecasts_ticker_date` | `ai_forecasts` | `ticker, date` | Look up forecast by ticker/date |
| `idx_ai_forecasts_created_at` | `ai_forecasts` | `created_at` | Prune old forecasts |

---

## Common Queries

These are the most useful queries for operators and developers. Run them with `sqlite3 data/reports.db`.

### List recent reports

```sql
SELECT id, date, period, datetime(generated_at, 'unixepoch') AS generated
FROM reports
ORDER BY generated_at DESC
LIMIT 10;
```

### Get latest snapshot for a ticker

```sql
SELECT date, ticker, expiry, iv_30d, iv_rank, regime
FROM option_snapshots
WHERE ticker = 'SPWX'
ORDER BY date DESC
LIMIT 1;
```

### List available option contracts (distinct combinations)

```sql
SELECT DISTINCT ticker, strike, expiry_date, option_type
FROM option_prices
ORDER BY ticker, expiry_date, strike;
```

### Get option price history for a specific contract

```sql
SELECT datetime(timestamp, 'unixepoch') AS ts, price, bid, ask
FROM option_prices
WHERE ticker = 'SPY'
  AND strike = 550.0
  AND expiry_date = '2026-06-20'
  AND option_type = 'call'
ORDER BY timestamp ASC;
```

### Count rows per table

```sql
SELECT 'reports' AS tbl, COUNT(*) AS n FROM reports
UNION ALL
SELECT 'option_snapshots', COUNT(*) FROM option_snapshots
UNION ALL
SELECT 'option_projections', COUNT(*) FROM option_projections
UNION ALL
SELECT 'option_prices', COUNT(*) FROM option_prices
UNION ALL
SELECT 'ai_forecasts', COUNT(*) FROM ai_forecasts;
```

### Check database size

```bash
ls -lh data/reports.db
```

---

## Migrations

Migrations are handled automatically at startup by the `migrate()` function in `lib/db.ts`. You do **not** run migrations manually during normal operation.

When adding a new migration:

1. Create a SQL file in `lib/migrations/` (e.g., `005_new_table.sql`)
2. Update `migrate()` in `lib/db.ts` to detect and apply the new schema
3. Update `SCHEMA_V4` (or define a new `SCHEMA_V5`) with the new `CREATE TABLE` statement

The migration function uses `PRAGMA table_info` and `sqlite_master` queries to detect the current schema state before applying changes:

```typescript
const hasOptionPrices = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='option_prices'"
).get();

if (!hasOptionPrices) {
  db.exec(`CREATE TABLE IF NOT EXISTS option_prices (...)`);
}
```

---

## Backup Procedures

### Manual Backup

```bash
# Simple file copy (safe even while app is running — SQLite uses WAL mode)
cp data/reports.db data/reports.db.bak.$(date +%Y%m%d)

# Or compress:
gzip -c data/reports.db > backups/reports-$(date +%Y%m%d-%H%M%S).db.gz
```

### Automated Backup via systemd Timer

Create a timer to run daily backups:

```ini
# ~/.config/systemd/user/financial-analyzer-backup.service
[Unit]
Description=Backup financial-analyzer SQLite database

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'gzip -c /home/claw/prod/financial-analyzer/data/reports.db > /home/claw/backups/reports-$(date +%%Y%%m%%d).db.gz'
```

```ini
# ~/.config/systemd/user/financial-analyzer-backup.timer
[Unit]
Description=Daily financial-analyzer backup

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user enable --now financial-analyzer-backup.timer
systemctl --user list-timers  # verify
```

---

## Recovery Procedures

### Restore from Backup

```bash
# Stop the service
systemctl --user stop financial-analyzer

# Replace the database
cp data/reports.db.bak.20260310 data/reports.db
# or from compressed:
gunzip -c backups/reports-20260310-120000.db.gz > data/reports.db

# Restart
systemctl --user start financial-analyzer

# Verify
curl http://localhost:3000/api/reports/latest
```

### Corruption Recovery

If SQLite reports corruption (`database disk image is malformed`):

```bash
# Attempt recovery using SQLite's built-in recovery mode
sqlite3 data/reports.db ".recover" | sqlite3 data/reports_recovered.db

# Inspect recovered data
sqlite3 data/reports_recovered.db "SELECT COUNT(*) FROM reports;"

# If OK, replace
mv data/reports.db data/reports.db.corrupt
mv data/reports_recovered.db data/reports.db

systemctl --user restart financial-analyzer
```

If recovery fails, restore from the most recent backup.

---

## Database Inspection

Use the SQLite CLI for interactive inspection:

```bash
# Open the database
sqlite3 data/reports.db

# In sqlite3:
.tables                    # list all tables
.schema reports            # show CREATE TABLE for reports
.headers on                # enable column headers
.mode column               # readable column output
SELECT * FROM reports LIMIT 5;
.quit
```

### Useful PRAGMA Commands

```sql
PRAGMA integrity_check;    -- Verify database integrity
PRAGMA table_info(reports); -- Show columns for a table
PRAGMA index_list(reports); -- Show indexes on a table
PRAGMA page_count;          -- Total pages in DB file
PRAGMA freelist_count;      -- Unused pages (fragmentation indicator)
```

---

## Performance Tips

1. **Always use indexed columns in WHERE clauses.** For `option_prices`, filter by `ticker + strike + expiry_date + option_type` — this matches the `idx_option_prices_lookup` index exactly.

2. **Use LIMIT.** The `listReports()` function always includes `LIMIT 50`. Add `LIMIT` to any ad-hoc queries on large tables.

3. **Run VACUUM quarterly** to reclaim space and defragment:
   ```bash
   sqlite3 data/reports.db "VACUUM;"
   ```

4. **WAL mode** is automatically used by `better-sqlite3`, allowing concurrent reads without blocking writes.

5. **Avoid full table scans.** Queries on `option_prices` without the lookup index columns will scan the entire table — this table can grow large with historical data.

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — Why SQLite was chosen
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Fixing database errors
- [DEPLOYMENT.md](DEPLOYMENT.md) — Database in production context
