/**
 * Additional unit tests for scripts/generate-report.ts
 * Covers buildPrompt and its output format for the macro trading desk prompt.
 *
 * Note: The existing generate-report.test.ts in __tests__/unit/reports/ covers
 * the main prompt assertions. This file adds edge-case and regression coverage.
 */
import { describe, it, expect } from 'vitest';
import { buildPrompt } from '@/scripts/generate-report';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePoints(values: number[], startDate = '2026-01-01') {
  return values.map((value, i) => {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    return { time: d.toISOString().split('T')[0], value };
  });
}

function makeInstrument(values: number[], startDate = '2026-01-01') {
  const points    = makePoints(values, startDate);
  const current   = points[points.length - 1].value;
  const firstVal  = points[0].value;
  const changePct = ((current - firstVal) / firstVal) * 100;
  return { current, changePct, points };
}

const MOCK_DATA = {
  spx:      makeInstrument([5500, 5550, 5600, 5650, 5700, 5750, 5800]),
  vix:      makeInstrument([18, 17, 16, 15, 14, 13, 12]),
  dxy:      makeInstrument([103, 104, 105, 106, 107, 108, 109]),
  yield10y: makeInstrument([4.10, 4.15, 4.20, 4.25, 4.30, 4.35, 4.40]),
  yield2y:  makeInstrument([3.70, 3.75, 3.80, 3.85, 3.90, 3.95, 4.00]),
};

// ─── buildPrompt — ticker and label presence ─────────────────────────────────

describe('buildPrompt — ticker and label presence', () => {
  it('contains S&P 500 (SPX)', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('S&P 500');
    expect(p).toContain('SPX');
  });

  it('contains VIX', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('VIX');
  });

  it('contains DXY (US Dollar Index)', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('DXY');
    expect(p).toContain('Dollar Index');
  });

  it('contains 10Y Treasury Yield', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('10Y Treasury Yield');
  });

  it('contains 2Y Treasury Yield', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('2Y Treasury Yield');
  });
});

// ─── buildPrompt — date handling ─────────────────────────────────────────────

describe('buildPrompt — date handling', () => {
  it('uses the provided today parameter when supplied', () => {
    const p = buildPrompt(MOCK_DATA, '2026-02-26');
    expect(p).toContain('2026-02-26');
  });

  it('falls back to last SPX data point date when today is omitted', () => {
    const p       = buildPrompt(MOCK_DATA);
    const lastDate = MOCK_DATA.spx.points[MOCK_DATA.spx.points.length - 1].time;
    expect(p).toContain(lastDate);
  });
});

// ─── buildPrompt — macro desk format ─────────────────────────────────────────

describe('buildPrompt — macro desk format', () => {
  it('contains MARKET DATA header', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('MARKET DATA');
  });

  it('contains 2Y/10Y Spread section', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('2Y/10Y Spread');
  });

  it('contains bp for yield changes', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('bp');
  });

  it('contains 7-day labels for all instruments', () => {
    const p = buildPrompt(MOCK_DATA);
    const matches = (p.match(/7-day/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(5);
  });

  it('contains all 8 analysis step headers', () => {
    const p = buildPrompt(MOCK_DATA);
    for (let i = 1; i <= 8; i++) {
      expect(p).toContain(`Step ${i}`);
    }
  });

  it('contains all new JSON schema fields', () => {
    const p = buildPrompt(MOCK_DATA);
    for (const field of [
      '"headline"', '"regime"', '"yieldCurve"', '"dollarLogic"',
      '"equityDiagnosis"', '"volatility"', '"crossAssetCheck"',
      '"forwardScenarios"', '"shortVolRisk"', '"regimeProbabilities"',
    ]) {
      expect(p).toContain(field);
    }
  });

  it('contains instruction to respond with valid JSON', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('valid JSON');
  });

  it('shows spread direction label (inverted or normal)', () => {
    const p = buildPrompt(MOCK_DATA);
    // Spread = (4.40 - 4.00) * 100 = 40bp → normal
    expect(p).toMatch(/inverted|normal/);
  });

  it('shows spread trend label (steepening or flattening)', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toMatch(/steepening|flattening/);
  });

  it('shows current yield values with % sign', () => {
    const p = buildPrompt(MOCK_DATA);
    // yield2y current = 4.0, yield10y current = 4.4
    expect(p).toContain('4%');
  });

  it('shows pts label for VIX absolute changes', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('pts');
  });
});

// ─── buildPrompt — computed values ───────────────────────────────────────────

describe('buildPrompt — computed values', () => {
  it('shows SPX 7-day start and current values', () => {
    const p = buildPrompt(MOCK_DATA);
    // spx: 5500 → 5800
    expect(p).toContain('5500');
    expect(p).toContain('5800');
  });

  it('shows VIX 7-day start and current values', () => {
    const p = buildPrompt(MOCK_DATA);
    // vix: 18 → 12
    expect(p).toContain('18');
    expect(p).toContain('12');
  });

  it('shows positive sign for upward moves', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('+');
  });

  it('shows negative sign for downward moves (VIX)', () => {
    const p = buildPrompt(MOCK_DATA);
    // VIX dropped: -6.0 pts
    expect(p).toContain('-6');
  });
});

// ─── buildPrompt — edge cases ─────────────────────────────────────────────────

describe('buildPrompt — edge cases', () => {
  it('handles zero-change instruments', () => {
    const flat = makeInstrument([100, 100, 100, 100, 100, 100, 100]);
    const data = { ...MOCK_DATA, vix: flat };
    const p    = buildPrompt(data);
    expect(p).toContain('+0');
  });

  it('handles single data point gracefully', () => {
    const single = {
      current:   5800,
      changePct: 0,
      points:    [{ time: '2026-02-26', value: 5800 }],
    };
    const data = { ...MOCK_DATA, spx: single };
    const p    = buildPrompt(data, '2026-02-26');
    expect(p).toContain('2026-02-26');
    expect(p).toContain('5800');
  });

  it('shows inverted spread when 2Y > 10Y', () => {
    // Create inverted curve: 2Y yield > 10Y yield
    const invertedYield2y  = makeInstrument([5.00, 5.01, 5.02, 5.03, 5.04, 5.05, 5.10]);
    const invertedYield10y = makeInstrument([4.50, 4.51, 4.52, 4.53, 4.54, 4.55, 4.60]);
    const data = { ...MOCK_DATA, yield2y: invertedYield2y, yield10y: invertedYield10y };
    const p = buildPrompt(data);
    expect(p).toContain('inverted');
  });
});
