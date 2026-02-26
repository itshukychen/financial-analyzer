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
  headline: 'Risk-on melt-up: SPX surges as VIX collapses and yield curve bear steepens, confirming positioning-driven equity rally',
  regime: {
    classification: 'Risk-on melt-up',
    justification: 'SPX +3.57% while VIX collapsed 30%, confirming broad risk appetite. DXY firmness alongside equities suggests capital rotation rather than risk-off hedging. Yield curve bear steepening indicates growth expectations outpacing Fed repricing.',
  },
  yieldCurve: 'Bear steepener: 10Y rose ~30bp over 7 days vs 2Y +20bp, expanding the spread. Long-end selling outpaced front-end, implying market is pricing growth over inflation. Financial conditions are loosening at the long end. Fed expectations are anchored near-term (2Y stable), with growth premium driving the long end higher.',
  dollarLogic: 'DXY firmed +2.88% on rate differential: 10Y yield rising faster than peers, attracting capital inflows. Dollar strength is NOT liquidity-crisis driven — equities rising alongside DXY confirms capital flow rotation, not safe-haven bid.',
  equityDiagnosis: 'Move is positioning-driven with macro confirmation. SPX +3.57% while VIX -30% suggests short-covering and systematic re-risking. Bonds partially validated: 10Y rising alongside equities is a growth signal, not a risk-off signal. Equity move is NOT contradicted by rates.',
  volatility: 'VIX collapse from 20 to 14 signals temporary hedging unwind, not structural deterioration. The magnitude (-30%) over 7 days implies forced put unwind or dealer gamma flipping long. No structural stress indicator — credit spreads would need to confirm any regime change.',
  crossAssetCheck: 'SPX: Risk-on signal — confirms macro (growth re-acceleration). VIX: Complacency signal — confirms macro (hedges being stripped). DXY: Mixed — rate differential bullish, but dollar strength caps equity upside for multinationals. 2Y: Stable — Fed pricing unchanged, confirms no policy pivot imminent. 10Y: Bear steepening — confirms growth expectations rising. No major divergences. The dollar is the only partial contradiction but is explained by rate differentials.',
  forwardScenarios: 'Continuation: Bonds must continue bear steepening (10Y > 2Y move), DXY holds 106-108 range, VIX stays below 16. Invalidated by: sudden 2Y spike (Fed repricing) or credit event. Reversal: 10Y must rally (bull flattener), DXY must drop, VIX must spike above 20. Invalidated by: continued strong data. Acceleration: 10Y breaks higher >4.7%, DXY surges >108, VIX re-spikes as equities reprice rates. Invalidated by: Fed dovish surprise.',
  shortVolRisk: 'Environment is FAVORABLE for short gamma in the near-term: VIX at 14 with collapsing realized vol, systematic re-risking in progress. Warning signals: any 2Y spike >15bp in a session (Fed repricing), DXY breakdown <105 (risk-off rotation), SPX gap below 5700 (systematic selling trigger). Structural risk: dealer gamma positioning may flip negative below 5650 SPX, creating self-reinforcing selling.',
  regimeProbabilities: 'Continuation 55% | Reversal 30% | Acceleration 15%',
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
