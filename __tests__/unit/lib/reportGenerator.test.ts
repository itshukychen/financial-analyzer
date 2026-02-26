/**
 * Additional unit tests for scripts/generate-report.ts
 * Covers buildPrompt and its internal formatTable helper via output inspection.
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

// ─── buildPrompt ─────────────────────────────────────────────────────────────

describe('buildPrompt — ticker and label presence', () => {
  it('contains S&P 500 and its ticker ^GSPC', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('S&P 500');
    expect(p).toContain('^GSPC');
  });

  it('contains VIX and its ticker ^VIX', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('VIX');
    expect(p).toContain('^VIX');
  });

  it('contains US Dollar Index and its ticker DX-Y.NYB', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('US Dollar Index');
    expect(p).toContain('DX-Y.NYB');
  });

  it('contains 10Y Treasury Yield and its ticker ^TNX', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('10Y Treasury Yield');
    expect(p).toContain('^TNX');
  });

  it('contains 2Y Treasury Yield and its ticker DGS2', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('2Y Treasury Yield');
    expect(p).toContain('DGS2');
  });
});

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

describe('buildPrompt — formatTable output (inspected via prompt string)', () => {
  it('marks the last data point with "← today"', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('← today');
  });

  it('includes 7-day change percentage for SPX', () => {
    // (5800 - 5500) / 5500 * 100 = +5.45%
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('+5.45%');
  });

  it('includes negative 7-day change for VIX', () => {
    // (12 - 18) / 18 * 100 = -33.33%
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('-33.33%');
  });

  it('includes "7-day change:" label for each instrument', () => {
    const p = buildPrompt(MOCK_DATA);
    const matches = (p.match(/7-day change:/g) ?? []).length;
    expect(matches).toBe(5);
  });

  it('includes all data point dates for SPX', () => {
    const p = buildPrompt(MOCK_DATA);
    for (const point of MOCK_DATA.spx.points) {
      expect(p).toContain(point.time);
    }
  });

  it('formats values to 2 decimal places', () => {
    const p = buildPrompt(MOCK_DATA);
    // SPX values like 5500.00
    expect(p).toContain('5800.00');
  });
});

describe('buildPrompt — JSON schema in prompt', () => {
  it('includes the JSON schema with all required fields', () => {
    const p = buildPrompt(MOCK_DATA);
    for (const field of ['headline', 'summary', 'sections', 'equity', 'volatility', 'fixedIncome', 'dollar', 'crossAsset', 'outlook']) {
      expect(p).toContain(`"${field}"`);
    }
  });

  it('includes the instruction to respond with valid JSON', () => {
    const p = buildPrompt(MOCK_DATA);
    expect(p).toContain('valid JSON');
  });
});

describe('buildPrompt — edge cases', () => {
  it('handles zero-change instruments', () => {
    const flat = makeInstrument([100, 100, 100, 100, 100, 100, 100]);
    const data = { ...MOCK_DATA, vix: flat };
    const p    = buildPrompt(data);
    expect(p).toContain('+0.00%');
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
    expect(p).toContain('5800.00');
  });
});
