/**
 * Playwright global setup — seeds SQLite with a fixture report so E2E tests
 * can validate the full reports UI without needing a real LLM API call.
 * Runs before the webServer starts.
 */
import path from 'path';
import fs   from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');

const FIXTURE_DATE = '2026-02-26';

const FIXTURE_ANALYSIS = {
  headline: 'Equities Rally on Cooling Inflation Data',
  summary:  'Strong session across risk assets. Bonds sold off modestly. Dollar index firmed.',
  sections: {
    equity:      'SPX advanced 3.57% over the week.\n\nMomentum remains constructive.',
    volatility:  'VIX dropped sharply to 14.00, signalling complacency.',
    fixedIncome: '10Y yield rose to 4.50%. Curve remains inverted.',
    dollar:      'DXY firmed to 107.00 on strong economic data.',
    crossAsset:  'Risk-on tone dominated. Equities up, VIX down, yields rising.',
    outlook:     'Watch Friday NFP for next catalyst.',
  },
};

const FIXTURE_MARKET_DATA = {
  spx:      { current: 5800, changePct:  3.57, points: [{ time: '2026-02-19', value: 5600 }, { time: FIXTURE_DATE, value: 5800 }] },
  vix:      { current:   14, changePct: -30.0, points: [{ time: '2026-02-19', value:   20 }, { time: FIXTURE_DATE, value:   14 }] },
  dxy:      { current:  107, changePct:  2.88, points: [{ time: '2026-02-19', value:  104 }, { time: FIXTURE_DATE, value:  107 }] },
  yield10y: { current:  4.5, changePct:  7.14, points: [{ time: '2026-02-19', value:  4.2 }, { time: FIXTURE_DATE, value:  4.5 }] },
  yield2y:  { current:  4.1, changePct:  7.89, points: [{ time: '2026-02-19', value:  3.8 }, { time: FIXTURE_DATE, value:  4.1 }] },
};

async function globalSetup() {
  const dataDir = path.join(process.cwd(), 'data');
  const dbPath  = path.join(dataDir, 'reports.db');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT    NOT NULL UNIQUE,
      generated_at INTEGER NOT NULL,
      ticker_data  TEXT    NOT NULL,
      report_json  TEXT    NOT NULL,
      model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5'
    );
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC);
  `);

  db.prepare(`
    INSERT INTO reports (date, generated_at, ticker_data, report_json, model)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      generated_at = excluded.generated_at,
      ticker_data  = excluded.ticker_data,
      report_json  = excluded.report_json,
      model        = excluded.model
  `).run(
    FIXTURE_DATE,
    Math.floor(Date.now() / 1000),
    JSON.stringify(FIXTURE_MARKET_DATA),
    JSON.stringify(FIXTURE_ANALYSIS),
    'claude-sonnet-4-5',
  );

  db.close();
  console.log(`✅ E2E fixture: seeded report for ${FIXTURE_DATE} into ${dbPath}`);
}

export default globalSetup;
