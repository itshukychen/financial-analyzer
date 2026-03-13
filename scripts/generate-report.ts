#!/usr/bin/env npx tsx
/**
 * Daily Market Report Generator
 * Run: npx tsx scripts/generate-report.ts [--dry-run]
 */

import Anthropic from '@anthropic-ai/sdk';
import { insertOrReplaceReport, type ReportPeriod } from '../lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DataPoint {
  time: string;
  value: number;
}

interface InstrumentData {
  current: number;
  changePct: number;
  points: DataPoint[];
}

interface MarketData {
  spx:      InstrumentData;
  vix:      InstrumentData;
  dxy:      InstrumentData;
  yield10y: InstrumentData;
  yield2y:  InstrumentData;
  wti:      InstrumentData;  // CL=F
  brent:    InstrumentData;  // BZ=F
}

export interface Analysis {
  headline:            string;   // one-line regime + key cross-asset observation (for dashboard widget)
  regime: {
    classification:    string;   // one of the 8 regime types
    justification:     string;   // 2–3 sentences, cross-asset reasoning only
  };
  yieldCurve:          string;   // Step 2 full text
  dollarLogic:         string;   // Step 3 full text
  equityDiagnosis:     string;   // Step 4 full text
  volatility:          string;   // Step 5 full text
  crossAssetCheck:     string;   // Step 6 full text including table
  forwardScenarios:    string;   // Step 7 full text — 3 scenarios
  shortVolRisk:        string;   // Step 8 full text
  regimeProbabilities: string;   // "Continuation X% | Reversal Y% | Acceleration Z%"
}

export interface DailyReport {
  date:        string;   // YYYY-MM-DD
  generatedAt: string;   // ISO timestamp
  marketData:  MarketData;
  analysis:    Analysis;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional global macro trading desk analyst. You analyze cross-asset market data using only relative movements, yield curve logic, liquidity mechanics, and positioning analysis. You never reference headlines or news events. Your analysis is structured, precise, and causally rigorous. Always emphasize deltas not levels, rate spreads and liquidity dynamics over narratives.`;

const isDryRun = process.argv.includes('--dry-run');

// Period: --period morning|midday|eod  OR  REPORT_PERIOD env var  OR  default 'eod'
function parsePeriod(): ReportPeriod {
  const argIdx = process.argv.indexOf('--period');
  const arg    = argIdx !== -1 ? process.argv[argIdx + 1] : undefined;
  const val    = arg ?? process.env.REPORT_PERIOD ?? 'eod';
  if (val !== 'morning' && val !== 'midday' && val !== 'eod') {
    console.warn(`⚠️  Unknown period "${val}", defaulting to "eod"`);
    return 'eod';
  }
  return val;
}

const PERIOD = parsePeriod();

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchYahoo(ticker: string): Promise<DataPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=10d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed for ${ticker}: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart result from Yahoo Finance for ${ticker}`);

  const timestamps = result.timestamp as number[];
  const closes = result.indicators.quote[0].close as (number | null)[];

  const points = timestamps
    .map((ts, i) => ({ time: new Date(ts * 1000).toISOString().split('T')[0], value: closes[i] }))
    .filter((p): p is DataPoint => p.value !== null && p.value !== undefined && !isNaN(p.value as number))
    .slice(-7);

  if (points.length === 0) throw new Error(`No valid data points returned for ${ticker}`);
  return points;
}

async function fetchFRED(seriesId: string): Promise<DataPoint[]> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`);
  if (!res.ok) throw new Error(`FRED fetch failed for ${seriesId}: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n').slice(1); // skip header

  const points = lines
    .map(l => {
      const [date, val] = l.split(',');
      return { time: date?.trim(), value: parseFloat(val?.trim() ?? '') };
    })
    .filter((p): p is DataPoint => !!p.time && !isNaN(p.value))
    .slice(-7);

  if (points.length === 0) throw new Error(`No valid data points returned for ${seriesId}`);
  return points;
}

function toInstrument(points: DataPoint[]): InstrumentData {
  const current   = points[points.length - 1].value;
  const firstVal  = points[0].value;
  const changePct = ((current - firstVal) / firstVal) * 100;
  return { current, changePct, points };
}

export async function fetchAllMarketData(): Promise<MarketData> {
  console.log('📡 Fetching market data...');

  const fallbackInstrument: InstrumentData = { current: 0, changePct: 0, points: [] };

  const [spxPts, vixPts, dxyPts, yield10yPts, yield2yPts, wtiPts, brentPts] = await Promise.all([
    fetchYahoo('^GSPC').then(pts => { console.log('  ✅ ^GSPC'); return pts; }),
    fetchYahoo('^VIX').then(pts => { console.log('  ✅ ^VIX'); return pts; }),
    fetchYahoo('DX-Y.NYB').then(pts => { console.log('  ✅ DX-Y.NYB'); return pts; }),
    fetchYahoo('^TNX').then(pts => { console.log('  ✅ ^TNX'); return pts; }),
    fetchFRED('DGS2').then(pts => { console.log('  ✅ DGS2'); return pts; }).catch(err => {
      console.warn(`  ⚠️  DGS2 fetch failed: ${err instanceof Error ? err.message : err} — using fallback`);
      return [] as DataPoint[];
    }),
    fetchYahoo('CL=F').then(pts => { console.log('  ✅ CL=F'); return pts; }).catch(err => {
      console.warn(`  ⚠️  CL=F fetch failed: ${err instanceof Error ? err.message : err} — using fallback`);
      return [] as DataPoint[];
    }),
    fetchYahoo('BZ=F').then(pts => { console.log('  ✅ BZ=F'); return pts; }).catch(err => {
      console.warn(`  ⚠️  BZ=F fetch failed: ${err instanceof Error ? err.message : err} — using fallback`);
      return [] as DataPoint[];
    }),
  ]);

  return {
    spx:      toInstrument(spxPts),
    vix:      toInstrument(vixPts),
    dxy:      toInstrument(dxyPts),
    yield10y: toInstrument(yield10yPts),
    yield2y:  yield2yPts.length > 0 ? toInstrument(yield2yPts) : fallbackInstrument,
    wti:      wtiPts.length > 0 ? toInstrument(wtiPts) : fallbackInstrument,
    brent:    brentPts.length > 0 ? toInstrument(brentPts) : fallbackInstrument,
  };
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

export function buildPrompt(marketData: MarketData, today?: string): string {
  const { spx, vix, dxy, yield10y, yield2y, wti, brent } = marketData;
  const reportDate = today ?? spx.points[spx.points.length - 1].time;

  // Helper: round to 1 decimal place
  const r1 = (n: number): number => Math.round(n * 10) / 10;
  // Helper: round to nearest integer (for bp values)
  const ri = (n: number): number => Math.round(n);
  // Helper: sign prefix ("+" for positive, "" for negative — negative numbers already have "-")
  const sign = (n: number): string => n >= 0 ? '+' : '';

  // ── SPX ──────────────────────────────────────────────────────────────────
  const spxCur     = r1(spx.current);
  const spx7dStart = r1(spx.points[0].value);
  const spx7dPct   = r1(((spx.current - spx.points[0].value) / spx.points[0].value) * 100);

  // ── VIX ──────────────────────────────────────────────────────────────────
  const vixCur       = r1(vix.current);
  const vixPrevClose = vix.current / (1 + vix.changePct / 100);
  const vix1dAbs     = r1(vix.current - vixPrevClose);
  const vix7dStart   = r1(vix.points[0].value);
  const vix7dAbs     = r1(vix.current - vix.points[0].value);

  // ── DXY ──────────────────────────────────────────────────────────────────
  const dxyCur     = r1(dxy.current);
  const dxy7dStart = r1(dxy.points[0].value);
  const dxy7dPct   = r1(((dxy.current - dxy.points[0].value) / dxy.points[0].value) * 100);

  // ── 2Y Treasury Yield ────────────────────────────────────────────────────
  const y2Avail     = yield2y.current > 0;
  const y2Cur       = r1(yield2y.current);
  const y2PrevClose = yield2y.current > 0 ? yield2y.current / (1 + yield2y.changePct / 100) : 0;
  const y2_1dBp     = ri((yield2y.current - y2PrevClose) * 100);
  const y2_7dStart  = r1(yield2y.points[0]?.value ?? 0);
  const y2_7dBp     = ri((yield2y.current - (yield2y.points[0]?.value ?? 0)) * 100);

  // ── 10Y Treasury Yield ───────────────────────────────────────────────────
  const y10Cur       = r1(yield10y.current);
  const y10PrevClose = yield10y.current / (1 + yield10y.changePct / 100);
  const y10_1dBp     = ri((yield10y.current - y10PrevClose) * 100);
  const y10_7dStart  = r1(yield10y.points[0].value);
  const y10_7dBp     = ri((yield10y.current - yield10y.points[0].value) * 100);

  // ── 2Y/10Y Spread ────────────────────────────────────────────────────────
  const spreadBp         = y2Avail ? ri((yield10y.current - yield2y.current) * 100) : NaN;
  const spread7dStartBp  = y2Avail ? ri((yield10y.points[0].value - (yield2y.points[0]?.value ?? 0)) * 100) : NaN;
  const spread7dChangeBp = y2Avail ? ri(spreadBp - spread7dStartBp) : NaN;
  const spreadDirection  = y2Avail && spreadBp < 0 ? 'inverted' : 'normal';
  const spreadTrend      = y2Avail && spread7dChangeBp >= 0 ? 'steepening' : 'flattening';

  // ── WTI Crude ────────────────────────────────────────────────────────────
  const wtiCur       = r1(wti.current);
  const wtiPrevClose = wti.current > 0 ? wti.current / (1 + wti.changePct / 100) : 0;
  const wti1dAbs     = r1(wti.current - wtiPrevClose);
  const wti1dPct     = r1(wti.changePct);
  const wtiAvail     = wti.current > 0;

  // ── Brent Crude ──────────────────────────────────────────────────────────
  const brentCur       = r1(brent.current);
  const brentPrevClose = brent.current > 0 ? brent.current / (1 + brent.changePct / 100) : 0;
  const brent1dAbs     = r1(brent.current - brentPrevClose);
  const brent1dPct     = r1(brent.changePct);
  const brentAvail     = brent.current > 0;

  return `You are acting as a professional global macro trading desk. Analyze the following market data (7-day history + today's opening session) using ONLY cross-asset relationships, yield curve logic, liquidity mechanics, and positioning analysis. Do NOT use any headlines or news events.

MARKET DATA — ${reportDate}
────────────────────────────────────────────
S&P 500 (SPX)
  Current:      ${spxCur}
  1-day:        ${sign(spx.changePct)}${r1(spx.changePct)}%
  7-day:        ${spx7dStart} → ${spxCur}  (${sign(spx7dPct)}${spx7dPct}%)

VIX
  Current:      ${vixCur}
  1-day:        ${sign(vix1dAbs)}${vix1dAbs} pts
  7-day:        ${vix7dStart} → ${vixCur}  (${sign(vix7dAbs)}${vix7dAbs} pts)

DXY (US Dollar Index)
  Current:      ${dxyCur}
  1-day:        ${sign(dxy.changePct)}${r1(dxy.changePct)}%
  7-day:        ${dxy7dStart} → ${dxyCur}  (${sign(dxy7dPct)}${dxy7dPct}%)

2Y Treasury Yield
  Current:      ${y2Avail ? y2Cur + '%' : 'N/A'}
  1-day:        ${y2Avail ? sign(y2_1dBp) + y2_1dBp + 'bp' : 'N/A'}
  7-day:        ${y2Avail ? y2_7dStart + '% → ' + y2Cur + '%  (' + sign(y2_7dBp) + y2_7dBp + 'bp)' : 'N/A'}

10Y Treasury Yield
  Current:      ${y10Cur}%
  1-day:        ${sign(y10_1dBp)}${y10_1dBp}bp
  7-day:        ${y10_7dStart}% → ${y10Cur}%  (${sign(y10_7dBp)}${y10_7dBp}bp)

2Y/10Y Spread
  Current:      ${y2Avail ? spreadBp + 'bp  (' + spreadDirection + ')' : 'N/A'}
  7-day change: ${y2Avail ? sign(spread7dChangeBp) + spread7dChangeBp + 'bp  (' + spreadTrend + ')' : 'N/A'}

WTI Crude (CL=F)
  Current:      ${wtiAvail ? '$' + wtiCur : 'N/A'}
  1-day:        ${wtiAvail ? sign(wti1dAbs) + wti1dAbs + ' (' + sign(wti1dPct) + wti1dPct + '%)' : 'N/A'}

Brent Crude (BZ=F)
  Current:      ${brentAvail ? '$' + brentCur : 'N/A'}
  1-day:        ${brentAvail ? sign(brent1dAbs) + brent1dAbs + ' (' + sign(brent1dPct) + brent1dPct + '%)' : 'N/A'}
────────────────────────────────────────────

Follow these 8 analysis steps. Respond ONLY with valid JSON matching the exact schema below.

REQUIRED ANALYSIS STEPS:

Step 1 — Regime Classification
Classify into ONE of: Growth scare | Inflation scare | Liquidity crisis | Soft landing / reflation | Policy pivot | Positioning unwind | Risk-on melt-up | Risk-off tightening
Justify using cross-asset behavior only.

Step 2 — Yield Curve Diagnosis
Compare 2Y vs 10Y bp change. Classify: Bull steepener / Bear steepener / Bull flattener / Bear flattener.
Interpret Fed expectations, growth expectations, inflation expectations, financial conditions.
Focus on CHANGE not absolute levels.

Step 3 — Dollar Logic
Explain DXY move relative to yields, equities, and volatility.
Classify driver: Rate differential | Liquidity preference | Political risk premium | Capital flow rotation | Positioning unwind

Step 4 — Equity Move Diagnosis
Classify move: Macro-confirmed | Positioning-driven | Gamma/volatility mechanics | Liquidity squeeze | Earnings repricing
State whether bonds validated or rejected the equity move.

Step 5 — Volatility Interpretation
Explain why VIX moved, whether it signals structural stress or temporary hedging, whether vol expansion matches macro deterioration.

Step 6 — Cross-Asset Consistency Check
For each of SPX, VIX, DXY, 2Y, 10Y: state the signal and whether it confirms the macro thesis.
If markets are diverging, identify which market is likely right and why.

Step 7 — Forward Scenarios (Next 1–2 Weeks)
Scenario 1 — Continuation: bonds must do X, dollar must do Y, vol must do Z, invalidated by W.
Scenario 2 — Reversal: same structure.
Scenario 3 — Acceleration: same structure.

Step 8 — Risk for Short Vol / 1DTE Strategies
Is this environment favorable for short gamma?
What cross-asset signals warn of vol expansion?
What structural risk exists?

RESPOND ONLY WITH THIS JSON (no markdown fences, no extra text):
{
  "headline": "one sentence: regime classification + single most important cross-asset observation",
  "regime": {
    "classification": "exact regime name from the list above",
    "justification": "2–3 sentences using only cross-asset evidence"
  },
  "yieldCurve": "full Step 2 analysis — bp changes, curve type, Fed/growth/inflation/financial conditions implications",
  "dollarLogic": "full Step 3 analysis — why DXY moved, driver type identified",
  "equityDiagnosis": "full Step 4 analysis — move classification, whether bonds validated or rejected",
  "volatility": "full Step 5 analysis — why VIX moved, structural vs temporary",
  "crossAssetCheck": "full Step 6 — each asset: signal + confirms macro? Include any divergences.",
  "forwardScenarios": "full Step 7 — all 3 scenarios with bonds/dollar/vol requirements and invalidation triggers",
  "shortVolRisk": "full Step 8 — short gamma assessment, warning signals, structural risk",
  "regimeProbabilities": "Continuation X% | Reversal Y% | Acceleration Z%"
}`;
}

// ─── Claude API ───────────────────────────────────────────────────────────────

export async function callClaude(prompt: string): Promise<Analysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const client = new Anthropic({ apiKey });

  console.log('🤖 Calling Claude claude-sonnet-4-5...');
  const message = await client.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  // Strip markdown code fences if present
  const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

  let analysis: Analysis;
  try {
    analysis = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON.\nRaw response:\n${text}`);
  }

  // Validate required fields
  if (
    !analysis.headline ||
    !analysis.regime?.classification ||
    !analysis.regime?.justification ||
    !analysis.yieldCurve ||
    !analysis.dollarLogic ||
    !analysis.equityDiagnosis ||
    !analysis.volatility ||
    !analysis.crossAssetCheck ||
    !analysis.forwardScenarios ||
    !analysis.shortVolRisk ||
    !analysis.regimeProbabilities
  ) {
    throw new Error('Claude response is missing required fields');
  }

  return analysis;
}

// ─── Save Report ─────────────────────────────────────────────────────────────

function saveReport(report: DailyReport, period: ReportPeriod): void {
  insertOrReplaceReport(
    report.date,
    period,
    report.marketData,
    report.analysis,
    'claude-sonnet-4-5',
  );
  console.log(`💾 Saved report for ${report.date} [${period}] to SQLite`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Daily Market Report Generator [${PERIOD}] ${isDryRun ? '(DRY RUN)' : ''}\n`);

  let marketData: MarketData;
  try {
    marketData = await fetchAllMarketData();
  } catch (err) {
    console.error(`❌ Failed to fetch market data: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const today  = marketData.spx.points[marketData.spx.points.length - 1].time;
  const prompt = buildPrompt(marketData, today);

  if (isDryRun) {
    console.log('\n── PROMPT ──────────────────────────────────────────────────────────────\n');
    console.log(prompt);
    console.log('\n── END PROMPT ──────────────────────────────────────────────────────────\n');
    console.log('✅ Dry run complete. No API call made, no file saved.');
    return;
  }

  let analysis: Analysis;
  try {
    analysis = await callClaude(prompt);
  } catch (err) {
    console.error(`❌ Failed to call Claude API: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const report: DailyReport = {
    date:        today,
    generatedAt: new Date().toISOString(),
    marketData,
    analysis,
  };

  try {
    saveReport(report, PERIOD);
  } catch (err) {
    console.error(`❌ Failed to save report: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log(`\n✅ Report generated for ${today} [${PERIOD}]`);
  console.log(`   Headline: ${analysis.headline}`);
}

// Only run when executed directly (not imported in tests)
// tsx sets the fileUrl to the script being run
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('generate-report.ts') || process.argv[1].endsWith('generate-report.js'));

if (isMain) {
  main();
}
