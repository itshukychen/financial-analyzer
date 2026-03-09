import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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

export type ReportPeriod = 'morning' | 'midday' | 'eod';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  morning: 'Open',
  midday:  'Midday',
  eod:     'Close',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type VolatilityRegime = 'low' | 'normal' | 'high';

// Raw database row types (before JSON parsing)
export interface OptionSnapshotRow extends Omit<OptionSnapshot, 'raw_json' | 'prob_distribution'> {
  raw_json: string;
  prob_distribution: string; // JSON string from database
}

export interface OptionProjectionRow {
  id: number;
  date: string;
  ticker: string;
  horizon_days: number;
  prob_distribution: string; // JSON string
  key_levels: string; // JSON string
  regime_classification: VolatilityRegime | null;
  created_at: number;
}

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
  prob_distribution: Array<ProbabilityPoint> | null;
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

// ─── Factory (used by tests with ':memory:') ──────────────────────────────────

// ─── AI Forecasts Types ───────────────────────────────────────────────────────

export interface AIForecastRow {
  id: number;
  ticker: string;
  date: string;
  snapshot_date: string;
  summary: string | null;
  outlook: string | null;
  pt_conservative: number | null;
  pt_base: number | null;
  pt_aggressive: number | null;
  pt_confidence: number | null;
  regime_classification: string | null;
  regime_justification: string | null;
  regime_recommendation: string | null;
  key_support: number | null;
  key_resistance: number | null;
  profit_targets: string | null;
  stop_loss: number | null;
  overall_confidence: number | null;
  confidence_reasoning: string | null;
  created_at: string;
  ai_model: string;
}

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
  
  insertOrReplaceAIForecast(ticker: string, date: string, analysis: any): AIForecastRow;
  getAIForecast(ticker: string, date: string): AIForecastRow | null;
  getPreviousAIForecast(ticker: string, date: string): AIForecastRow | null;
}

// ─── Migration: v1 → v2 → v3 ────────────────────────────────────────────────

function migrate(db: Database.Database): void {
  const cols = (db.pragma('table_info(reports)') as { name: string }[]).map(c => c.name);
  const hasOptionSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='option_snapshots'"
  ).get();
  
  // Migrate v1 → v2
  if (cols.includes('period')) {
    // v2 already or later
    if (hasOptionSnapshots) return; // Already at v3
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

  // Create AI forecasts table if it doesn't exist
  const hasAIForecasts = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_forecasts'"
  ).get();

  if (!hasAIForecasts) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_forecasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        date TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        
        summary TEXT,
        outlook TEXT CHECK(outlook IN ('bullish','neutral','bearish')),
        
        pt_conservative REAL,
        pt_base REAL,
        pt_aggressive REAL,
        pt_confidence REAL CHECK(pt_confidence >= 0 AND pt_confidence <= 1),
        
        regime_classification TEXT CHECK(regime_classification IN ('elevated','normal','depressed')),
        regime_justification TEXT,
        regime_recommendation TEXT,
        
        key_support REAL,
        key_resistance REAL,
        profit_targets TEXT,
        stop_loss REAL,
        
        overall_confidence REAL CHECK(overall_confidence >= 0 AND overall_confidence <= 1),
        confidence_reasoning TEXT,
        
        created_at TEXT DEFAULT (datetime('now')),
        ai_model TEXT DEFAULT 'claude-sonnet-4-5',
        
        UNIQUE(ticker, date, snapshot_date)
      );
      
      CREATE INDEX IF NOT EXISTS idx_ai_forecasts_ticker_date ON ai_forecasts(ticker, date);
      CREATE INDEX IF NOT EXISTS idx_ai_forecasts_created_at ON ai_forecasts(created_at);
    `);
  }
}

export function createDb(dbPath: string): DbInstance {
  const db = new Database(dbPath);

  // Create table if brand new, then migrate if upgrading
  try {
    db.exec(SCHEMA_V3);
  } catch {
    // Table may already exist with v1 or v2 schema — migrate below
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
    ).get(date, ticker, expiry) as OptionSnapshotRow | undefined;
    
    return raw ? parseOptionSnapshot(raw) : null;
  }

  function getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null {
    const raw = db.prepare(
      'SELECT * FROM option_snapshots WHERE ticker = ? AND expiry = ? ORDER BY date DESC LIMIT 1'
    ).get(ticker, expiry) as OptionSnapshotRow | undefined;
    
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
    ).get(projection.date, projection.ticker, projection.horizon_days) as OptionProjectionRow;
    
    return parseOptionProjection(raw);
  }

  function getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null {
    const raw = db.prepare(
      'SELECT * FROM option_projections WHERE date = ? AND ticker = ? AND horizon_days = ?'
    ).get(date, ticker, horizonDays) as OptionProjectionRow | undefined;
    
    return raw ? parseOptionProjection(raw) : null;
  }

  // ─── AI Forecast CRUD ───────────────────────────────────────────────────────

  function insertOrReplaceAIForecast(ticker: string, date: string, analysis: any): AIForecastRow {
    const snapshotDate = analysis.snapshotDate || date;
    
    db.prepare(`
      INSERT INTO ai_forecasts (
        ticker, date, snapshot_date,
        summary, outlook,
        pt_conservative, pt_base, pt_aggressive, pt_confidence,
        regime_classification, regime_justification, regime_recommendation,
        key_support, key_resistance, profit_targets, stop_loss,
        overall_confidence, confidence_reasoning
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ticker, date, snapshot_date) DO UPDATE SET
        summary = excluded.summary,
        outlook = excluded.outlook,
        pt_conservative = excluded.pt_conservative,
        pt_base = excluded.pt_base,
        pt_aggressive = excluded.pt_aggressive,
        pt_confidence = excluded.pt_confidence,
        regime_classification = excluded.regime_classification,
        regime_justification = excluded.regime_justification,
        regime_recommendation = excluded.regime_recommendation,
        key_support = excluded.key_support,
        key_resistance = excluded.key_resistance,
        profit_targets = excluded.profit_targets,
        stop_loss = excluded.stop_loss,
        overall_confidence = excluded.overall_confidence,
        confidence_reasoning = excluded.confidence_reasoning
    `).run(
      ticker,
      date,
      snapshotDate,
      analysis.summary,
      analysis.outlook,
      analysis.priceTargets?.conservative ?? null,
      analysis.priceTargets?.base ?? null,
      analysis.priceTargets?.aggressive ?? null,
      analysis.priceTargets?.confidence ?? null,
      analysis.regimeAnalysis?.classification ?? null,
      analysis.regimeAnalysis?.justification ?? null,
      analysis.regimeAnalysis?.recommendation ?? null,
      analysis.tradingLevels?.keySupport ?? null,
      analysis.tradingLevels?.keyResistance ?? null,
      analysis.tradingLevels?.profitTargets ? JSON.stringify(analysis.tradingLevels.profitTargets) : null,
      analysis.tradingLevels?.stopLoss ?? null,
      analysis.confidence?.overall ?? null,
      analysis.confidence?.reasoning ?? null,
    );

    return db.prepare('SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ? ORDER BY created_at DESC LIMIT 1').get(ticker, date) as AIForecastRow;
  }

  function getAIForecast(ticker: string, date: string): AIForecastRow | null {
    return db.prepare('SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ? ORDER BY created_at DESC LIMIT 1').get(ticker, date) as AIForecastRow | null;
  }

  function getPreviousAIForecast(ticker: string, date: string): AIForecastRow | null {
    // Get the forecast from the previous business day
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    return db.prepare('SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ? ORDER BY created_at DESC LIMIT 1').get(ticker, previousDateStr) as AIForecastRow | null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function parseOptionSnapshot(raw: OptionSnapshotRow): OptionSnapshot {
    return {
      ...raw,
      prob_distribution: raw.prob_distribution ? JSON.parse(raw.prob_distribution) : [],
    };
  }

  function parseOptionProjection(raw: OptionProjectionRow): OptionProjection {
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
    insertOrReplaceAIForecast,
    getAIForecast,
    getPreviousAIForecast,
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

// AI Forecasts
export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);
export const getAIForecast             = _instance.getAIForecast.bind(_instance);
export const getPreviousAIForecast     = _instance.getPreviousAIForecast.bind(_instance);

export default _instance.db;
