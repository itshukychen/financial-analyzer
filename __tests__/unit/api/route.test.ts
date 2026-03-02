import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/market/chart/[ticker]/route';

function makeRequest(ticker: string): NextRequest {
  return new NextRequest(`http://localhost/api/market/chart/${encodeURIComponent(ticker)}`);
}

// Build a fake Yahoo Finance response
function yahooResponse(closes: (number | null)[], baseTimestamp = 1_770_000_000) {
  return {
    chart: {
      result: [
        {
          meta: { symbol: '^GSPC', currency: 'USD' },
          timestamp: closes.map((_, i) => baseTimestamp + i * 86400),
          indicators: {
            quote: [{ close: closes }],
          },
        },
      ],
      error: null,
    },
  };
}

// Build fake FRED CSV dates dynamically so they always fall within the
// route's 10-calendar-day cutoff window, regardless of when tests run.
function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
const RECENT_FRED_DATES = Array.from({ length: 10 }, (_, i) => recentDate(9 - i));

function fredCSV(points: Array<{ date: string; value: string }>) {
  const header = 'DATE,VALUE';
  const rows = points.map((p) => `${p.date},${p.value}`);
  return [header, ...rows].join('\n');
}

function makeFetchMock(responseInit: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  return vi.fn().mockResolvedValue({
    ok: responseInit.ok ?? true,
    status: responseInit.status ?? 200,
    json: responseInit.json ?? (() => Promise.resolve({})),
    text: responseInit.text ?? (() => Promise.resolve('')),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/market/chart/[ticker]', () => {
  describe('Yahoo Finance tickers', () => {
    it('GET with ^GSPC — returns normalized data', async () => {
      const closes = [100, 102, 101, 103, 105, 104, 106];
      vi.stubGlobal(
        'fetch',
        makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
      );

      const req = makeRequest('^GSPC');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.symbol).toBe('^GSPC');
      expect(body.points.length).toBe(7);
      expect(body.current).toBe(106);
      expect(body.open).toBe(100);
      expect(body.changePct).toBeCloseTo(6, 1);
      for (const p of body.points) {
        expect(p.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof p.value).toBe('number');
      }
    });

    it('GET with ^GSPC — filters null closes', async () => {
      const closes: (number | null)[] = [100, null, 102, null, 104, 105, 106, 107, 108, 109];
      vi.stubGlobal(
        'fetch',
        makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
      );

      const req = makeRequest('^GSPC');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });
      const body = await res.json();

      expect(body.points.every((p: { value: unknown }) => p.value != null)).toBe(true);
      // 10 closes - 2 nulls = 8 valid, slice(-7) → 7 points
      expect(body.points.length).toBe(7);
    });

    it('GET — Yahoo Finance returns non-200', async () => {
      vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 503 }));

      const req = makeRequest('^GSPC');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(typeof body.error).toBe('string');
    });

    it('GET — Yahoo Finance returns empty result array', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMock({
          json: () => Promise.resolve({ chart: { result: [], error: null } }),
        }),
      );

      const req = makeRequest('^GSPC');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

      expect(res.status).toBe(500);
    });

    it('GET — calculates change and changePct correctly', async () => {
      const closes = [200, 202, 204, 206, 208, 209, 210];
      vi.stubGlobal(
        'fetch',
        makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
      );

      const req = makeRequest('^GSPC');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });
      const body = await res.json();

      expect(body.change).toBeCloseTo(10, 1);
      expect(body.changePct).toBeCloseTo(5.0, 1);
    });

    it('GET — ^TNX returns correct name', async () => {
      const closes = [4.2, 4.25, 4.3, 4.35, 4.4, 4.45, 4.5];
      vi.stubGlobal(
        'fetch',
        makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
      );

      const req = makeRequest('^TNX');
      const res = await GET(req, { params: Promise.resolve({ ticker: '^TNX' }) });
      const body = await res.json();

      expect(body.name).toBe('10Y Treasury Yield');
    });
  });

  describe('FRED tickers', () => {
    it('GET with DGS2 — fetches from FRED CSV and returns 7 points', async () => {
      // Use 10 points with recent dates (all within last 10 days) so none get cutoff-filtered
      const points = RECENT_FRED_DATES.map((date, i) => ({
        date,
        value: (3.5 + i * 0.05).toFixed(2),
      }));
      const csv = fredCSV(points);
      vi.stubGlobal('fetch', makeFetchMock({ text: () => Promise.resolve(csv) }));

      const req = makeRequest('DGS2');
      const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.symbol).toBe('DGS2');
      expect(body.name).toBe('2Y Treasury Yield');
      expect(body.points.length).toBe(7);
    });

    it('GET with DGS2 — filters blank FRED values', async () => {
      // 10 recent dates, 2 have blank values ('') → 8 valid → slice(-7) → 7
      const points = RECENT_FRED_DATES.map((date, i) => ({
        date,
        value: i === 1 || i === 3 ? '' : (3.80 + i * 0.05).toFixed(2), // blank indices 1 & 3
      }));
      const csv = fredCSV(points);
      vi.stubGlobal('fetch', makeFetchMock({ text: () => Promise.resolve(csv) }));

      const req = makeRequest('DGS2');
      const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      // All returned points should have numeric values
      expect(body.points.every((p: { value: number }) => typeof p.value === 'number' && !isNaN(p.value))).toBe(true);
      expect(body.points.length).toBe(7);
    });

    it('GET — FRED returns non-200', async () => {
      vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 404 }));

      const req = makeRequest('DGS2');
      const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(typeof body.error).toBe('string');
    });
  });
});
