import { describe, it, expect } from 'vitest';
import { buildPrompt } from '@/scripts/generate-report';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePoints(values: number[], startDate = '2026-02-17') {
  return values.map((value, i) => {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    return { time: d.toISOString().split('T')[0], value };
  });
}

function makeInstrument(values: number[], startDate = '2026-02-17') {
  const points    = makePoints(values, startDate);
  const current   = points[points.length - 1].value;
  const firstVal  = points[0].value;
  const changePct = ((current - firstVal) / firstVal) * 100;
  return { current, changePct, points };
}

const MOCK_MARKET_DATA = {
  spx:      makeInstrument([5600, 5650, 5620, 5700, 5750, 5720, 5800]),
  vix:      makeInstrument([20, 19, 18, 17, 16, 15, 14]),
  dxy:      makeInstrument([104, 104.5, 105, 105.5, 106, 106.5, 107]),
  yield10y: makeInstrument([4.20, 4.25, 4.30, 4.35, 4.40, 4.45, 4.50]),
  yield2y:  makeInstrument([3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10]),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  it('produces a non-empty string', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes all 5 instrument names/tickers', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('S&P 500');
    expect(prompt).toContain('^GSPC');
    expect(prompt).toContain('VIX');
    expect(prompt).toContain('Dollar');
    expect(prompt).toContain('10Y Treasury Yield');
    expect(prompt).toContain('2Y Treasury Yield');
    expect(prompt).toContain('DGS2');
  });

  it('includes today\'s date in the prompt header', () => {
    const today  = '2026-02-26';
    const prompt = buildPrompt(MOCK_MARKET_DATA, today);
    expect(prompt).toContain(today);
  });

  it('derives today from last SPX data point when not provided', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    // Last point date is 2026-02-23 (17 + 6 days)
    const lastDate = MOCK_MARKET_DATA.spx.points[MOCK_MARKET_DATA.spx.points.length - 1].time;
    expect(prompt).toContain(lastDate);
  });

  it('includes 7-day change percentages for each instrument', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    // SPX: (5800 - 5600) / 5600 * 100 = +3.57%
    expect(prompt).toContain('7-day change: +3.57%');
    // VIX: (14 - 20) / 20 * 100 = -30.00%
    expect(prompt).toContain('-30.00%');
  });

  it('includes all data point dates in output', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    for (const point of MOCK_MARKET_DATA.spx.points) {
      expect(prompt).toContain(point.time);
    }
  });

  it('includes the JSON schema in the prompt', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('"headline"');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"sections"');
    expect(prompt).toContain('"equity"');
    expect(prompt).toContain('"volatility"');
    expect(prompt).toContain('"fixedIncome"');
    expect(prompt).toContain('"dollar"');
    expect(prompt).toContain('"crossAsset"');
    expect(prompt).toContain('"outlook"');
  });

  it('marks the latest data point with ← today', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('← today');
  });

  it('handles instruments where all values are whole numbers', () => {
    const data = {
      ...MOCK_MARKET_DATA,
      vix: makeInstrument([20, 20, 20, 20, 20, 20, 20]),
    };
    const prompt = buildPrompt(data);
    expect(prompt).toContain('7-day change: +0.00%');
  });
});
