import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Schema (v2 — adds period column) ────────────────────────────────────────

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

export interface ReportRow {
  id:           number;
  date:         string;
  period:       ReportPeriod;
  generated_at: number;
  ticker_data:  string;   // JSON string
  report_json:  string;   // JSON string (the Analysis object)
  model:        string;
}

// ─── Factory (used by tests with ':memory:') ──────────────────────────────────

export interface DbInstance {
  db: Database.Database;
  insertOrReplaceReport(date: string, period: ReportPeriod, tickerData: object, reportJson: object, model: string): ReportRow;
  getLatestReport(): ReportRow | null;
  getReportByDate(date: string, period?: ReportPeriod): ReportRow | null;
  listReports(limit?: number): Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[];
}

// ─── Migration: v1 (date UNIQUE, no period) → v2 (date+period UNIQUE) ────────

function migrate(db: Database.Database): void {
  const cols = (db.pragma('table_info(reports)') as { name: string }[]).map(c => c.name);
  if (cols.includes('period')) return; // already migrated

  // v1 table exists but lacks period — rebuild with migration
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

export function createDb(dbPath: string): DbInstance {
  const db = new Database(dbPath);

  // Create table if brand new, then migrate if upgrading from v1
  try {
    db.exec(SCHEMA_V2);
  } catch {
    // Table may already exist with v1 schema — migrate below
  }
  migrate(db);

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

  return { db, insertOrReplaceReport, getLatestReport, getReportByDate, listReports };
}

// ─── Module-level singleton (production) ─────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'reports.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const _instance = createDb(DB_PATH);

export const insertOrReplaceReport = _instance.insertOrReplaceReport.bind(_instance);
export const getLatestReport       = _instance.getLatestReport.bind(_instance);
export const getReportByDate       = _instance.getReportByDate.bind(_instance);
export const listReports           = _instance.listReports.bind(_instance);

export default _instance.db;
