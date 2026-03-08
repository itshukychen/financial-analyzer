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
          meta: { symbol: 'CL=F', currency: 'USD' },
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

describe('GET /api/market/chart/[ticker] — oil tickers', () => {
  it('AC-3: GET /api/market/chart/CL%3DF returns OHLCV array on Yahoo success', async () => {
    const closes = [70.5, 71.0, 71.5, 72.0, 72.5, 73.0, 73.5];
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
    );

    const req = makeRequest('CL=F');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'CL=F' }) });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBeGreaterThanOrEqual(1);
    expect(body.current).toBe(73.5);
    expect(body.symbol).toBe('CL=F');
    for (const p of body.points) {
      expect(p.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof p.value).toBe('number');
    }
  });

  it('AC-4: GET /api/market/chart/BZ%3DF returns OHLCV array on Yahoo success', async () => {
    const closes = [74.0, 74.5, 75.0, 75.5, 76.0, 76.5, 77.0];
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) }),
    );

    const req = makeRequest('BZ=F');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'BZ=F' }) });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBeGreaterThanOrEqual(1);
    expect(body.current).toBe(77.0);
    expect(body.symbol).toBe('BZ=F');
    for (const p of body.points) {
      expect(p.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof p.value).toBe('number');
    }
  });

  it('AC-8: GET /api/market/chart/CL%3DF returns error JSON on Yahoo 500', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 500 }));

    const req = makeRequest('CL=F');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'CL=F' }) });

    expect(res.status).not.toBe(200);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
