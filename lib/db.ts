import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Schema (v4 — adds option prices for chart overlay) ──────────────────────

const SCHEMA_V4 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

  CREATE TABLE IF NOT EXISTS option_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT    NOT NULL,
    ticker            TEXT    NOT NULL,
    expiry            TEXT    NOT NULL,
    
    iv_30d            REAL,
    iv_60d            REAL,
    hv_20d            REAL,
    hv_60d            REAL,
    iv_rank           INTEGER,
    
    net_delta         REAL,
    atm_gamma         REAL,
    vega_per_1pct     REAL,
    theta_daily       REAL,
    
    call_otm_iv       REAL,
    put_otm_iv        REAL,
    skew_ratio        REAL,
    
    implied_move_pct  REAL,
    
    regime            TEXT,
    raw_json          TEXT,
    
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, expiry)
  );
  CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
    ON option_snapshots(date DESC, ticker, expiry);

  CREATE TABLE IF NOT EXISTS option_projections (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    date                    TEXT    NOT NULL,
    ticker                  TEXT    NOT NULL,
    horizon_days            INTEGER NOT NULL,
    
    prob_distribution       TEXT    NOT NULL,
    key_levels              TEXT    NOT NULL,
    
    regime_classification   TEXT,
    
    created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, horizon_days)
  );
  CREATE INDEX IF NOT EXISTS idx_option_projections_date 
    ON option_projections(date DESC, ticker);

  CREATE TABLE IF NOT EXISTS option_prices (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker            TEXT    NOT NULL,
    strike            REAL    NOT NULL,
    expiry_date       TEXT    NOT NULL,
    option_type       TEXT    NOT NULL DEFAULT 'call',
    timestamp         INTEGER NOT NULL,
    price             REAL    NOT NULL,
    bid               REAL,
    ask               REAL,
    volume            INTEGER,
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
  );
  CREATE INDEX IF NOT EXISTS idx_option_prices_lookup 
    ON option_prices(ticker, strike, expiry_date, option_type, timestamp);
  CREATE INDEX IF NOT EXISTS idx_option_prices_expiry 
    ON option_prices(expiry_date);
`;

// ─── Schema (v3 — adds option snapshots and projections) ──────────────────────

const SCHEMA_V3 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

  CREATE TABLE IF NOT EXISTS option_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT    NOT NULL,
    ticker            TEXT    NOT NULL,
    expiry            TEXT    NOT NULL,
    
    iv_30d            REAL,
    iv_60d            REAL,
    hv_20d            REAL,
    hv_60d            REAL,
    iv_rank           INTEGER,
    
    net_delta         REAL,
    atm_gamma         REAL,
    vega_per_1pct     REAL,
    theta_daily       REAL,
    
    call_otm_iv       REAL,
    put_otm_iv        REAL,
    skew_ratio        REAL,
    
    implied_move_pct  REAL,
    
    regime            TEXT,
    raw_json          TEXT,
    
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, expiry)
  );
  CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
    ON option_snapshots(date DESC, ticker, expiry);

  CREATE TABLE IF NOT EXISTS option_projections (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    date                    TEXT    NOT NULL,
    ticker                  TEXT    NOT NULL,
    horizon_days            INTEGER NOT NULL,
    
    prob_distribution       TEXT    NOT NULL,
    key_levels              TEXT    NOT NULL,
    
    regime_classification   TEXT,
    
    created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, horizon_days)
  );
  CREATE INDEX IF NOT EXISTS idx_option_projections_date 
    ON option_projections(date DESC, ticker);
`;

const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);
`;

export type ReportPeriod = 'morning' | 'midday' | 'eod';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  morning: 'Open',
  midday:  'Midday',
  eod:     'Close',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type VolatilityRegime = 'low' | 'normal' | 'high';

export interface ReportRow {
  id:           number;
  date:         string;
  period:       ReportPeriod;
  generated_at: number;
  ticker_data:  string;   // JSON string
  report_json:  string;   // JSON string (the Analysis object)
  model:        string;
}

export interface OptionSnapshot {
  id:                number;
  date:              string;
  ticker:            string;
  expiry:            string;
  iv_30d:            number | null;
  iv_60d:            number | null;
  hv_20d:            number | null;
  hv_60d:            number | null;
  iv_rank:           number | null;
  net_delta:         number | null;
  atm_gamma:         number | null;
  vega_per_1pct:     number | null;
  theta_daily:       number | null;
  call_otm_iv:       number | null;
  put_otm_iv:        number | null;
  skew_ratio:        number | null;
  implied_move_pct:  number | null;
  regime:            VolatilityRegime | null;
  raw_json:          string;
  created_at:        number;
}

export interface ProbabilityPoint {
  price:       number;
  probability: number;
}

export interface KeyLevel {
  level:       number;
  type:        'mode' | '2sd_low' | '2sd_high' | 'support' | 'resistance';
  probability: number | null;
}

export interface OptionProjection {
  id:                    number;
  date:                  string;
  ticker:                string;
  horizon_days:          number;
  prob_distribution:     ProbabilityPoint[];
  key_levels:            KeyLevel[];
  regime_classification: VolatilityRegime | null;
  created_at:            number;
}

export interface OptionPrice {
  id:         number;
  ticker:     string;
  strike:     number;
  expiry_date: string;
  option_type: 'call' | 'put';
  timestamp:  number;
  price:      number;
  bid:        number | null;
  ask:        number | null;
  volume:     number | null;
  created_at: number;
}

// ─── Factory (used by tests with ':memory:') ──────────────────────────────────

export interface DbInstance {
  db: Database.Database;
  insertOrReplaceReport(date: string, period: ReportPeriod, tickerData: object, reportJson: object, model: string): ReportRow;
  getLatestReport(): ReportRow | null;
  getReportByDate(date: string, period?: ReportPeriod): ReportRow | null;
  listReports(limit?: number): Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[];
  
  insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot;
  getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null;
  getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null;
  
  insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection;
  getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null;
  
  insertOptionPrice(price: Omit<OptionPrice, 'id' | 'created_at'>): OptionPrice;
  getOptionPrices(ticker: string, strike: number, expiryDate: string, optionType: 'call' | 'put', startTimestamp: number, endTimestamp: number): OptionPrice[];
  getUnderlyingPrices(ticker: string, startTimestamp: number, endTimestamp: number): Array<{ timestamp: number; price: number }>;
}

// ─── Migration: v1 → v2 → v3 → v4 ──────────────────────────────────────────

function migrate(db: Database.Database): void {
  const cols = (db.pragma('table_info(reports)') as { name: string }[]).map(c => c.name);
  const hasOptionSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='option_snapshots'"
  ).get();
  const hasOptionPrices = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='option_prices'"
  ).get();
  
  // Migrate v1 → v2
  if (cols.includes('period')) {
    // v2 already or later
    if (hasOptionSnapshots) {
      if (hasOptionPrices) return; // Already at v4
    }
  } else {
    // v1 table exists but lacks period — rebuild
    db.exec(`
      ALTER TABLE reports RENAME TO reports_v1;

      CREATE TABLE reports (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        date         TEXT    NOT NULL,
        period       TEXT    NOT NULL DEFAULT 'eod',
        generated_at INTEGER NOT NULL,
        ticker_data  TEXT    NOT NULL,
        report_json  TEXT    NOT NULL,
        model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
        UNIQUE(date, period)
      );

      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

      INSERT INTO reports (id, date, period, generated_at, ticker_data, report_json, model)
        SELECT id, date, 'eod', generated_at, ticker_data, report_json, model
        FROM reports_v1;

      DROP TABLE reports_v1;
    `);
  }
  
  // Create v3 option tables if they don't exist
  if (!hasOptionSnapshots) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS option_snapshots (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        date              TEXT    NOT NULL,
        ticker            TEXT    NOT NULL,
        expiry            TEXT    NOT NULL,
        
        iv_30d            REAL,
        iv_60d            REAL,
        hv_20d            REAL,
        hv_60d            REAL,
        iv_rank           INTEGER,
        
        net_delta         REAL,
        atm_gamma         REAL,
        vega_per_1pct     REAL,
        theta_daily       REAL,
        
        call_otm_iv       REAL,
        put_otm_iv        REAL,
        skew_ratio        REAL,
        
        implied_move_pct  REAL,
        
        regime            TEXT,
        raw_json          TEXT,
        
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(date, ticker, expiry)
      );
      CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
        ON option_snapshots(date DESC, ticker, expiry);

      CREATE TABLE IF NOT EXISTS option_projections (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        date                    TEXT    NOT NULL,
        ticker                  TEXT    NOT NULL,
        horizon_days            INTEGER NOT NULL,
        
        prob_distribution       TEXT    NOT NULL,
        key_levels              TEXT    NOT NULL,
        
        regime_classification   TEXT,
        
        created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(date, ticker, horizon_days)
      );
      CREATE INDEX IF NOT EXISTS idx_option_projections_date 
        ON option_projections(date DESC, ticker);
    `);
  }
  
  // Create v4 option_prices table if it doesn't exist
  if (!hasOptionPrices) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS option_prices (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker            TEXT    NOT NULL,
        strike            REAL    NOT NULL,
        expiry_date       TEXT    NOT NULL,
        option_type       TEXT    NOT NULL DEFAULT 'call',
        timestamp         INTEGER NOT NULL,
        price             REAL    NOT NULL,
        bid               REAL,
        ask               REAL,
        volume            INTEGER,
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
      );
      CREATE INDEX IF NOT EXISTS idx_option_prices_lookup 
        ON option_prices(ticker, strike, expiry_date, option_type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_option_prices_expiry 
        ON option_prices(expiry_date);
    `);
  }
}

export function createDb(dbPath: string): DbInstance {
  const db = new Database(dbPath);

  // Create table if brand new, then migrate if upgrading
  try {
    db.exec(SCHEMA_V4);
  } catch {
    // Table may already exist with v1, v2, or v3 schema — migrate below
  }
  migrate(db);

  // ─── Report CRUD ────────────────────────────────────────────────────────────

  function insertOrReplaceReport(
    date: string,
    period: ReportPeriod,
    tickerData: object,
    reportJson: object,
    model: string,
  ): ReportRow {
    const generated_at = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO reports (date, period, generated_at, ticker_data, report_json, model)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, period) DO UPDATE SET
        generated_at = excluded.generated_at,
        ticker_data  = excluded.ticker_data,
        report_json  = excluded.report_json,
        model        = excluded.model
    `).run(date, period, generated_at, JSON.stringify(tickerData), JSON.stringify(reportJson), model);

    return db.prepare('SELECT * FROM reports WHERE date = ? AND period = ?').get(date, period) as ReportRow;
  }

  function getLatestReport(): ReportRow | null {
    return (db.prepare(
      'SELECT * FROM reports ORDER BY generated_at DESC, id DESC LIMIT 1'
    ).get() as ReportRow) ?? null;
  }

  function getReportByDate(date: string, period?: ReportPeriod): ReportRow | null {
    if (period) {
      return (db.prepare(
        'SELECT * FROM reports WHERE date = ? AND period = ?'
      ).get(date, period) as ReportRow) ?? null;
    }
    // No period specified — return latest generated for that date
    return (db.prepare(
      'SELECT * FROM reports WHERE date = ? ORDER BY generated_at DESC LIMIT 1'
    ).get(date) as ReportRow) ?? null;
  }

  function listReports(limit = 50): Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[] {
    return db.prepare(
      'SELECT id, date, period, generated_at, model FROM reports ORDER BY generated_at DESC, id DESC LIMIT ?',
    ).all(limit) as Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[];
  }

  // ─── Option Snapshot CRUD ────────────────────────────────────────────────────

  function insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot {
    db.prepare(`
      INSERT INTO option_snapshots (
        date, ticker, expiry, iv_30d, iv_60d, hv_20d, hv_60d, iv_rank,
        net_delta, atm_gamma, vega_per_1pct, theta_daily,
        call_otm_iv, put_otm_iv, skew_ratio, implied_move_pct,
        regime, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, ticker, expiry) DO UPDATE SET
        iv_30d = excluded.iv_30d,
        iv_60d = excluded.iv_60d,
        hv_20d = excluded.hv_20d,
        hv_60d = excluded.hv_60d,
        iv_rank = excluded.iv_rank,
        net_delta = excluded.net_delta,
        atm_gamma = excluded.atm_gamma,
        vega_per_1pct = excluded.vega_per_1pct,
        theta_daily = excluded.theta_daily,
        call_otm_iv = excluded.call_otm_iv,
        put_otm_iv = excluded.put_otm_iv,
        skew_ratio = excluded.skew_ratio,
        implied_move_pct = excluded.implied_move_pct,
        regime = excluded.regime,
        raw_json = excluded.raw_json
    `).run(
      snapshot.date,
      snapshot.ticker,
      snapshot.expiry,
      snapshot.iv_30d ?? null,
      snapshot.iv_60d ?? null,
      snapshot.hv_20d ?? null,
      snapshot.hv_60d ?? null,
      snapshot.iv_rank ?? null,
      snapshot.net_delta ?? null,
      snapshot.atm_gamma ?? null,
      snapshot.vega_per_1pct ?? null,
      snapshot.theta_daily ?? null,
      snapshot.call_otm_iv ?? null,
      snapshot.put_otm_iv ?? null,
      snapshot.skew_ratio ?? null,
      snapshot.implied_move_pct ?? null,
      snapshot.regime ?? null,
      snapshot.raw_json,
    );

    return db.prepare(
      'SELECT * FROM option_snapshots WHERE date = ? AND ticker = ? AND expiry = ?'
    ).get(snapshot.date, snapshot.ticker, snapshot.expiry) as OptionSnapshot;
  }

  function getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null {
    const raw = db.prepare(
      'SELECT * FROM option_snapshots WHERE date = ? AND ticker = ? AND expiry = ?'
    ).get(date, ticker, expiry) as any;
    
    return raw ? parseOptionSnapshot(raw) : null;
  }

  function getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null {
    const raw = db.prepare(
      'SELECT * FROM option_snapshots WHERE ticker = ? AND expiry = ? ORDER BY date DESC LIMIT 1'
    ).get(ticker, expiry) as any;
    
    return raw ? parseOptionSnapshot(raw) : null;
  }

  // ─── Option Projection CRUD ──────────────────────────────────────────────────

  function insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection {
    db.prepare(`
      INSERT INTO option_projections (
        date, ticker, horizon_days, prob_distribution, key_levels, regime_classification
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, ticker, horizon_days) DO UPDATE SET
        prob_distribution = excluded.prob_distribution,
        key_levels = excluded.key_levels,
        regime_classification = excluded.regime_classification
    `).run(
      projection.date,
      projection.ticker,
      projection.horizon_days,
      JSON.stringify(projection.prob_distribution),
      JSON.stringify(projection.key_levels),
      projection.regime_classification ?? null,
    );

    const raw = db.prepare(
      'SELECT * FROM option_projections WHERE date = ? AND ticker = ? AND horizon_days = ?'
    ).get(projection.date, projection.ticker, projection.horizon_days) as any;
    
    return parseOptionProjection(raw);
  }

  function getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null {
    const raw = db.prepare(
      'SELECT * FROM option_projections WHERE date = ? AND ticker = ? AND horizon_days = ?'
    ).get(date, ticker, horizonDays) as any;
    
    return raw ? parseOptionProjection(raw) : null;
  }

  // ─── Option Price CRUD ───────────────────────────────────────────────────────

  function insertOptionPrice(price: Omit<OptionPrice, 'id' | 'created_at'>): OptionPrice {
    db.prepare(`
      INSERT INTO option_prices (
        ticker, strike, expiry_date, option_type, timestamp, price, bid, ask, volume
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ticker, strike, expiry_date, option_type, timestamp) DO UPDATE SET
        price = excluded.price,
        bid = excluded.bid,
        ask = excluded.ask,
        volume = excluded.volume
    `).run(
      price.ticker,
      price.strike,
      price.expiry_date,
      price.option_type,
      price.timestamp,
      price.price,
      price.bid ?? null,
      price.ask ?? null,
      price.volume ?? null,
    );

    return db.prepare(
      'SELECT * FROM option_prices WHERE ticker = ? AND strike = ? AND expiry_date = ? AND option_type = ? AND timestamp = ?'
    ).get(price.ticker, price.strike, price.expiry_date, price.option_type, price.timestamp) as OptionPrice;
  }

  function getOptionPrices(
    ticker: string,
    strike: number,
    expiryDate: string,
    optionType: 'call' | 'put',
    startTimestamp: number,
    endTimestamp: number,
  ): OptionPrice[] {
    return db.prepare(`
      SELECT * FROM option_prices
      WHERE ticker = ? AND strike = ? AND expiry_date = ? AND option_type = ?
        AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(ticker, strike, expiryDate, optionType, startTimestamp, endTimestamp) as OptionPrice[];
  }

  function getUnderlyingPrices(
    ticker: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Array<{ timestamp: number; price: number }> {
    // For now, return empty array as we don't have market_data table in schema
    // This would be populated from market_data if available
    return [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function parseOptionSnapshot(raw: any): OptionSnapshot {
    return {
      ...raw,
      prob_distribution: raw.prob_distribution ? JSON.parse(raw.prob_distribution) : [],
    };
  }

  function parseOptionProjection(raw: any): OptionProjection {
    return {
      ...raw,
      prob_distribution: JSON.parse(raw.prob_distribution),
      key_levels: JSON.parse(raw.key_levels),
    };
  }

  return {
    db,
    insertOrReplaceReport,
    getLatestReport,
    getReportByDate,
    listReports,
    insertOptionSnapshot,
    getOptionSnapshot,
    getLatestOptionSnapshot,
    insertOptionProjection,
    getOptionProjection,
    insertOptionPrice,
    getOptionPrices,
    getUnderlyingPrices,
  };
}

// ─── Module-level singleton (production) ─────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'reports.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const _instance = createDb(DB_PATH);

// Reports
export const insertOrReplaceReport = _instance.insertOrReplaceReport.bind(_instance);
export const getLatestReport       = _instance.getLatestReport.bind(_instance);
export const getReportByDate       = _instance.getReportByDate.bind(_instance);
export const listReports           = _instance.listReports.bind(_instance);

// Options
export const insertOptionSnapshot     = _instance.insertOptionSnapshot.bind(_instance);
export const getOptionSnapshot        = _instance.getOptionSnapshot.bind(_instance);
export const getLatestOptionSnapshot  = _instance.getLatestOptionSnapshot.bind(_instance);
export const insertOptionProjection   = _instance.insertOptionProjection.bind(_instance);
export const getOptionProjection      = _instance.getOptionProjection.bind(_instance);

// Option Prices (for chart overlay)
export const insertOptionPrice     = _instance.insertOptionPrice.bind(_instance);
export const getOptionPrices       = _instance.getOptionPrices.bind(_instance);
export const getUnderlyingPrices   = _instance.getUnderlyingPrices.bind(_instance);

export default _instance.db;
