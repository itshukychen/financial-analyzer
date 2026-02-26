import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL UNIQUE,
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5'
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC);
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportRow {
  id:           number;
  date:         string;
  generated_at: number;
  ticker_data:  string;   // JSON string
  report_json:  string;   // JSON string (the Analysis object)
  model:        string;
}

// ─── Factory (used by tests with ':memory:') ──────────────────────────────────

export interface DbInstance {
  db: Database.Database;
  insertOrReplaceReport(date: string, tickerData: object, reportJson: object, model: string): ReportRow;
  getLatestReport(): ReportRow | null;
  getReportByDate(date: string): ReportRow | null;
  listReports(limit?: number): Pick<ReportRow, 'id' | 'date' | 'generated_at' | 'model'>[];
}

export function createDb(dbPath: string): DbInstance {
  const db = new Database(dbPath);
  db.exec(SCHEMA);

  function insertOrReplaceReport(
    date: string,
    tickerData: object,
    reportJson: object,
    model: string,
  ): ReportRow {
    const generated_at = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO reports (date, generated_at, ticker_data, report_json, model)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        generated_at = excluded.generated_at,
        ticker_data  = excluded.ticker_data,
        report_json  = excluded.report_json,
        model        = excluded.model
    `).run(date, generated_at, JSON.stringify(tickerData), JSON.stringify(reportJson), model);

    return db.prepare('SELECT * FROM reports WHERE date = ?').get(date) as ReportRow;
  }

  function getLatestReport(): ReportRow | null {
    return (db.prepare('SELECT * FROM reports ORDER BY date DESC LIMIT 1').get() as ReportRow) ?? null;
  }

  function getReportByDate(date: string): ReportRow | null {
    return (db.prepare('SELECT * FROM reports WHERE date = ?').get(date) as ReportRow) ?? null;
  }

  function listReports(limit = 50): Pick<ReportRow, 'id' | 'date' | 'generated_at' | 'model'>[] {
    return db.prepare(
      'SELECT id, date, generated_at, model FROM reports ORDER BY date DESC LIMIT ?',
    ).all(limit) as Pick<ReportRow, 'id' | 'date' | 'generated_at' | 'model'>[];
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
