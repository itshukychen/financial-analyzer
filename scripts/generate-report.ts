#!/usr/bin/env npx tsx
/**
 * Daily Market Report Generator
 * Run: npx tsx scripts/generate-report.ts [--dry-run]
 */

import Anthropic from '@anthropic-ai/sdk';
import { insertOrReplaceReport } from '../lib/db';

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
}

interface AnalysisSections {
  equity:      string;
  volatility:  string;
  fixedIncome: string;
  dollar:      string;
  crossAsset:  string;
  outlook:     string;
}

interface Analysis {
  headline: string;
  summary:  string;
  sections: AnalysisSections;
}

export interface DailyReport {
  date:        string;   // YYYY-MM-DD
  generatedAt: string;   // ISO timestamp
  marketData:  MarketData;
  analysis:    Analysis;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior macro analyst at a top-tier investment bank. You write precise, institutional-grade daily market reports. Your analysis is data-driven, concise, and draws clear cross-asset relationships. You avoid vague statements and always ground observations in the specific data provided.`;

const isDryRun = process.argv.includes('--dry-run');

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

  const [spxPts, vixPts, dxyPts, yield10yPts, yield2yPts] = await Promise.all([
    fetchYahoo('^GSPC').then(pts => { console.log('  ✅ ^GSPC'); return pts; }),
    fetchYahoo('^VIX').then(pts => { console.log('  ✅ ^VIX'); return pts; }),
    fetchYahoo('DX-Y.NYB').then(pts => { console.log('  ✅ DX-Y.NYB'); return pts; }),
    fetchYahoo('^TNX').then(pts => { console.log('  ✅ ^TNX'); return pts; }),
    fetchFRED('DGS2').then(pts => { console.log('  ✅ DGS2'); return pts; }),
  ]);

  return {
    spx:      toInstrument(spxPts),
    vix:      toInstrument(vixPts),
    dxy:      toInstrument(dxyPts),
    yield10y: toInstrument(yield10yPts),
    yield2y:  toInstrument(yield2yPts),
  };
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

function formatTable(name: string, ticker: string, data: InstrumentData): string {
  const today = data.points[data.points.length - 1].time;
  const sign  = data.changePct >= 0 ? '+' : '';
  const rows  = data.points
    .map(p => {
      const marker = p.time === today ? ' ← today' : '';
      return `  ${p.time}  ${p.value.toFixed(2)}${marker}`;
    })
    .join('\n');

  return `${name} (${ticker})\nDate        Close\n${rows}\n7-day change: ${sign}${data.changePct.toFixed(2)}%`;
}

export function buildPrompt(marketData: MarketData, today?: string): string {
  const reportDate = today ?? marketData.spx.points[marketData.spx.points.length - 1].time;

  const tables = [
    formatTable('S&P 500',          '^GSPC',     marketData.spx),
    formatTable('VIX',              '^VIX',      marketData.vix),
    formatTable('US Dollar Index',  'DX-Y.NYB',  marketData.dxy),
    formatTable('10Y Treasury Yield','^TNX',     marketData.yield10y),
    formatTable('2Y Treasury Yield','DGS2',       marketData.yield2y),
  ].join('\n\n');

  return `Here is today's end-of-day market data (last 7 trading days) as of ${reportDate}:

${tables}

---

Provide a professional end-of-day macro analysis. Respond with ONLY valid JSON matching this exact schema:

{
  "headline": "string — one sentence capturing the key market theme today",
  "summary": "string — 2-3 sentence executive summary",
  "sections": {
    "equity": "string — SPX analysis: direction, momentum, context (2-3 paragraphs)",
    "volatility": "string — VIX interpretation: fear/complacency reading, implications",
    "fixedIncome": "string — 10Y + 2Y yield analysis, yield curve dynamics, Fed implications",
    "dollar": "string — DXY analysis, implications for risk assets and global capital flows",
    "crossAsset": "string — how these instruments moved together today, key relationships",
    "outlook": "string — what to watch next, key risks and catalysts"
  }
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
  if (!analysis.headline || !analysis.summary || !analysis.sections) {
    throw new Error('Claude response is missing required fields (headline, summary, sections)');
  }

  return analysis;
}

// ─── Save Report ─────────────────────────────────────────────────────────────

function saveReport(report: DailyReport): void {
  insertOrReplaceReport(
    report.date,
    report.marketData,
    report.analysis,
    'claude-sonnet-4-5',
  );
  console.log(`💾 Saved report for ${report.date} to SQLite`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Daily Market Report Generator ${isDryRun ? '(DRY RUN)' : ''}\n`);

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
    saveReport(report);
  } catch (err) {
    console.error(`❌ Failed to save report: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log(`\n✅ Report generated for ${today}`);
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
