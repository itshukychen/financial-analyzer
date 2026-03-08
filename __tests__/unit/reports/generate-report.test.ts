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
  wti:      makeInstrument([70.0, 70.5, 71.0, 71.5, 72.0, 72.5, 73.0]),
  brent:    makeInstrument([74.0, 74.5, 75.0, 75.5, 76.0, 76.5, 77.0]),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  it('produces a non-empty string', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes all 5 instrument names', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('S&P 500');
    expect(prompt).toContain('SPX');
    expect(prompt).toContain('VIX');
    expect(prompt).toContain('DXY');
    expect(prompt).toContain('Dollar Index');
    expect(prompt).toContain('10Y Treasury Yield');
    expect(prompt).toContain('2Y Treasury Yield');
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

  it('contains MARKET DATA header', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('MARKET DATA');
  });

  it('contains 2Y/10Y Spread section', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('2Y/10Y Spread');
  });

  it('contains bp labels for yield changes', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('bp');
  });

  it('contains 7-day labels for instruments', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('7-day');
  });

  it('shows SPX start and current values in 7-day range', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    // spx: 5600 → 5800
    expect(prompt).toContain('5600');
    expect(prompt).toContain('5800');
  });

  it('shows VIX drop (negative change)', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    // vix: 20 → 14, -6 pts
    expect(prompt).toContain('-6');
  });

  it('includes the new JSON schema with all required fields', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    for (const field of [
      '"headline"',
      '"regime"',
      '"yieldCurve"',
      '"dollarLogic"',
      '"equityDiagnosis"',
      '"volatility"',
      '"crossAssetCheck"',
      '"forwardScenarios"',
      '"shortVolRisk"',
      '"regimeProbabilities"',
    ]) {
      expect(prompt).toContain(field);
    }
  });

  it('includes all 8 analysis step headers', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    for (let i = 1; i <= 8; i++) {
      expect(prompt).toContain(`Step ${i}`);
    }
  });

  it('includes the instruction to respond with valid JSON', () => {
    const prompt = buildPrompt(MOCK_MARKET_DATA);
    expect(prompt).toContain('valid JSON');
  });

  it('handles instruments where all values are whole numbers', () => {
    const data = {
      ...MOCK_MARKET_DATA,
      vix: makeInstrument([20, 20, 20, 20, 20, 20, 20]),
    };
    const prompt = buildPrompt(data);
    expect(prompt).toContain('+0');
  });
});
