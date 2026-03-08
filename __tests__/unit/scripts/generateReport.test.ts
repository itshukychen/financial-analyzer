import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildPrompt, fetchAllMarketData } from '@/scripts/generate-report';

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

const BASE_MARKET_DATA = {
  spx:      makeInstrument([5600, 5650, 5620, 5700, 5750, 5720, 5800]),
  vix:      makeInstrument([20, 19, 18, 17, 16, 15, 14]),
  dxy:      makeInstrument([104, 104.5, 105, 105.5, 106, 106.5, 107]),
  yield10y: makeInstrument([4.20, 4.25, 4.30, 4.35, 4.40, 4.45, 4.50]),
  yield2y:  makeInstrument([3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10]),
  wti:      makeInstrument([70.0, 70.5, 71.0, 71.5, 72.0, 72.5, 73.0]),
  brent:    makeInstrument([74.0, 74.5, 75.0, 75.5, 76.0, 76.5, 77.0]),
};

// ─── Helpers for mocking fetch ────────────────────────────────────────────────

function yahooResponse(symbol: string, closes: number[]) {
  const baseTimestamp = 1_770_000_000;
  return {
    chart: {
      result: [
        {
          meta: { symbol, currency: 'USD' },
          timestamp: closes.map((_, i) => baseTimestamp + i * 86400),
          indicators: { quote: [{ close: closes }] },
        },
      ],
      error: null,
    },
  };
}

function fredCSV(values: number[]) {
  const rows = values.map((v, i) => {
    const d = new Date('2026-02-17');
    d.setUTCDate(d.getUTCDate() + i);
    return `${d.toISOString().split('T')[0]},${v.toFixed(2)}`;
  });
  return ['DATE,VALUE', ...rows].join('\n');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchAllMarketData — oil instruments', () => {
  it('AC-5/AC-6: fetchAllMarketData returns wti and brent on full success', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      // FRED DGS2
      if (typeof url === 'string' && url.includes('fredgraph')) {
        return Promise.resolve({
          ok: true, status: 200,
          text: () => Promise.resolve(fredCSV([3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10])),
          json: () => Promise.resolve({}),
        });
      }
      // Yahoo CL=F
      if (typeof url === 'string' && url.includes('CL%3DF')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(yahooResponse('CL=F', [70, 71, 72, 73, 74, 75, 76])),
          text: () => Promise.resolve(''),
        });
      }
      // Yahoo BZ=F
      if (typeof url === 'string' && url.includes('BZ%3DF')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(yahooResponse('BZ=F', [74, 75, 76, 77, 78, 79, 80])),
          text: () => Promise.resolve(''),
        });
      }
      // All other Yahoo tickers (^GSPC, ^VIX, DX-Y.NYB, ^TNX)
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(yahooResponse('DEFAULT', [100, 101, 102, 103, 104, 105, 106])),
        text: () => Promise.resolve(''),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchAllMarketData();

    expect(typeof result.wti.current).toBe('number');
    expect(result.wti.current).toBeGreaterThan(0);
    expect(typeof result.brent.current).toBe('number');
    expect(result.brent.current).toBeGreaterThan(0);
  });

  it('AC-8 backend: fetchAllMarketData resolves with wti fallback when CL=F throws', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      // FRED DGS2
      if (typeof url === 'string' && url.includes('fredgraph')) {
        return Promise.resolve({
          ok: true, status: 200,
          text: () => Promise.resolve(fredCSV([3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10])),
          json: () => Promise.resolve({}),
        });
      }
      // CL=F — simulate failure
      if (typeof url === 'string' && url.includes('CL%3DF')) {
        return Promise.resolve({
          ok: false, status: 500,
          json: () => Promise.resolve({ error: 'server error' }),
          text: () => Promise.resolve(''),
        });
      }
      // BZ=F — also return fallback (failure)
      if (typeof url === 'string' && url.includes('BZ%3DF')) {
        return Promise.resolve({
          ok: false, status: 500,
          json: () => Promise.resolve({ error: 'server error' }),
          text: () => Promise.resolve(''),
        });
      }
      // All other Yahoo tickers
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(yahooResponse('DEFAULT', [100, 101, 102, 103, 104, 105, 106])),
        text: () => Promise.resolve(''),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchAllMarketData();

    expect(result.wti.current).toBe(0);
  });
});

describe('buildPrompt — oil instruments', () => {
  it('AC-7: buildPrompt includes CL=F and BZ=F in prompt string', () => {
    const prompt = buildPrompt(BASE_MARKET_DATA);
    expect(prompt).toContain('CL=F');
    expect(prompt).toContain('BZ=F');
  });

  it('AC-8 backend: buildPrompt shows N/A for WTI when wti.current is 0', () => {
    const data = {
      ...BASE_MARKET_DATA,
      wti:   { current: 0, changePct: 0, points: [] },
      brent: { current: 0, changePct: 0, points: [] },
    };
    const prompt = buildPrompt(data);
    expect(prompt).toContain('N/A');
  });
});
