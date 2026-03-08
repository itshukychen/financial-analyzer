/**
 * Tests for: app/api/market/chart/[ticker]/route.ts
 *
 * AC Coverage:
 * AC-A.1 → 'range=1M → Yahoo called with range=1mo and interval=1d'
 * AC-A.2 → 'no range param → existing no-range behavior unchanged'
 * AC-A.3 → 'range=1D → Yahoo called with range=1d and interval=5m; time has hour component'
 * AC-A.4 → 'range=YTD → Yahoo called with range=ytd'
 * AC-A.5 → 'range=1Y → Yahoo called with range=1y'
 * AC-A.6 → 'range=5D → Yahoo called with range=5d'
 * AC-A.7 → 'range=badvalue → 400 Invalid range'
 * AC-A.8 → 'range=1D + FRED ticker → 200 unsupported response'
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/market/chart/[ticker]/route';

// ─── Request helpers ────────────────────────────────────────────────────────

function makeRequest(ticker: string): NextRequest {
  return new NextRequest(`http://localhost/api/market/chart/${encodeURIComponent(ticker)}`);
}

function makeRangeRequest(ticker: string, range: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/chart/${encodeURIComponent(ticker)}?range=${range}`,
  );
}

// ─── Response builders ───────────────────────────────────────────────────────

/** Build a fake Yahoo Finance daily response. */
function yahooResponse(closes: (number | null)[], baseTimestamp = 1_770_000_000) {
  return {
    chart: {
      result: [
        {
          meta: { symbol: 'CL=F', currency: 'USD' },
          timestamp: closes.map((_, i) => baseTimestamp + i * 86_400),
          indicators: {
            quote: [{ close: closes }],
          },
        },
      ],
      error: null,
    },
  };
}

/** Build a fake Yahoo Finance intraday response (5-minute intervals). */
function yahooIntradayResponse(closes: number[], baseTimestamp = 1_770_000_000) {
  return {
    chart: {
      result: [
        {
          meta: { symbol: '^GSPC' },
          timestamp: closes.map((_, i) => baseTimestamp + i * 300), // 5-min intervals
          indicators: {
            quote: [{ close: closes }],
          },
        },
      ],
      error: null,
    },
  };
}

/** Build a FRED CSV string from an array of { date, value } rows. */
function fredCSV(ticker: string, rows: Array<{ date: string; value: string }>): string {
  const header = `DATE,${ticker}`;
  const body = rows.map((r) => `${r.date},${r.value}`).join('\n');
  return `${header}\n${body}`;
}

/** Generate FRED CSV rows for the last N days (all recent, all past the cutoff). */
function recentFredRows(count: number): Array<{ date: string; value: string }> {
  const rows: Array<{ date: string; value: string }> = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    rows.push({ date: d.toISOString().split('T')[0], value: (4.0 + i * 0.01).toFixed(2) });
  }
  return rows;
}

// ─── Fetch mock factory ──────────────────────────────────────────────────────

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

// ─── Existing tests (AC-3, AC-4, AC-8 from oil-prices feature) ───────────────

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

// ─── Range parameter tests (interactive-charts feature) ─────────────────────

describe('GET /api/market/chart/[ticker] — range parameter (AC-A)', () => {
  it('AC-A.7: range=badvalue → 400 { error: "Invalid range" }', async () => {
    // No fetch should be called for invalid range
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', 'badvalue');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid range');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC-A.2: no range param → existing no-range behavior unchanged', async () => {
    const closes = [5700, 5720, 5740, 5760, 5780, 5790, 5800];
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRequest('^GSPC');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe('^GSPC');
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.current).toBe(5800);
    // URL should use the default 10d/1d params (no range param)
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('interval=1d');
    expect(calledUrl).toContain('range=10d');
  });

  it('AC-A.1: range=1M → Yahoo called with range=1mo and interval=1d', async () => {
    const closes = Array.from({ length: 22 }, (_, i) => 5600 + i * 10);
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', '1M');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBeGreaterThanOrEqual(1);

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('range=1mo');
    expect(calledUrl).toContain('interval=1d');

    // Daily range: times should be YYYY-MM-DD format
    for (const p of body.points) {
      expect(p.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('AC-A.3: range=1D → Yahoo called with range=1d and interval=5m; time values have hour component', async () => {
    const closes = [5750, 5760, 5755, 5770, 5780];
    // Use a real-ish Unix timestamp so date construction makes sense
    const baseTimestamp = 1_741_000_000;
    const fetchSpy = makeFetchMock({
      json: () => Promise.resolve(yahooIntradayResponse(closes, baseTimestamp)),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', '1D');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBeGreaterThanOrEqual(1);

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('range=1d');
    expect(calledUrl).toContain('interval=5m');

    // Intraday: time strings should include a 'T' (ISO datetime, not just date)
    for (const p of body.points) {
      expect(p.time).toContain('T');
    }
  });

  it('AC-A.4: range=YTD → Yahoo called with range=ytd', async () => {
    const closes = Array.from({ length: 50 }, (_, i) => 5600 + i * 5);
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', 'YTD');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('range=ytd');
    expect(calledUrl).toContain('interval=1d');
  });

  it('AC-A.5: range=1Y → Yahoo called with range=1y', async () => {
    const closes = Array.from({ length: 252 }, (_, i) => 5000 + i * 2);
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', '1Y');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('range=1y');
    expect(calledUrl).toContain('interval=1d');
  });

  it('AC-A.6: range=5D → Yahoo called with range=5d', async () => {
    const closes = [5760, 5770, 5780, 5790, 5800];
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', '5D');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('range=5d');
    expect(calledUrl).toContain('interval=1d');
  });

  it('AC-A.8: range=1D + ticker=DGS2 → 200 { data: [], unsupported: true }', async () => {
    // FRED does not support intraday data — route should short-circuit
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('DGS2', '1D');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unsupported).toBe(true);
    expect(body.data).toEqual([]);
    // Fetch should NOT have been called
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC-A.8: range=1D + ticker=DGS10 → 200 { data: [], unsupported: true }', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('DGS10', '1D');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS10' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unsupported).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('range=1M + ticker=DGS2 → FRED fetch called; response points ≤ 22', async () => {
    // Create 30 recent rows (all after the 35-day cutoff) — slice(-22) should give 22
    const rows = recentFredRows(30);
    const fetchSpy = makeFetchMock({ text: () => Promise.resolve(fredCSV('DGS2', rows)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('DGS2', '1M');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBe(22); // sliceLast=22 applied

    // Fetch should have called FRED, not Yahoo
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('fred.stlouisfed.org');
    expect(calledUrl).toContain('DGS2');
  });

  it('range=3M + ticker=DGS2 → FRED fetch called; response points ≤ 66', async () => {
    const rows = recentFredRows(80);
    const fetchSpy = makeFetchMock({ text: () => Promise.resolve(fredCSV('DGS2', rows)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('DGS2', '3M');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points.length).toBe(66); // sliceLast=66
  });

  it('range=YTD + ticker=DGS2 → FRED fetch; only current-year rows returned', async () => {
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    // Mix of previous-year and current-year rows
    const rows = [
      { date: `${prevYear}-11-01`, value: '3.90' },
      { date: `${prevYear}-12-01`, value: '3.95' },
      { date: `${prevYear}-12-15`, value: '3.98' },
      { date: `${currentYear}-01-05`, value: '4.00' },
      { date: `${currentYear}-01-12`, value: '4.05' },
      { date: `${currentYear}-02-01`, value: '4.10' },
      { date: `${currentYear}-03-01`, value: '4.15' },
    ];

    const fetchSpy = makeFetchMock({ text: () => Promise.resolve(fredCSV('DGS2', rows)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('DGS2', 'YTD');
    const res = await GET(req, { params: Promise.resolve({ ticker: 'DGS2' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);

    // Only current-year rows should be present
    for (const p of body.points) {
      expect(p.time.startsWith(`${currentYear}`)).toBe(true);
    }
    // Should have exactly the 4 current-year rows
    expect(body.points.length).toBe(4);
  });

  it('upstream Yahoo 500 with range → route returns 500 with error', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 500 }));

    const req = makeRangeRequest('^GSPC', '6M');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toContain('500');
  });

  it('range=3M response includes correct changePct computed from first→last points', async () => {
    // first=5000, last=5500 → changePct = (500/5000)*100 = 10%
    const closes = Array.from({ length: 66 }, (_, i) => 5000 + i * (500 / 65));
    const fetchSpy = makeFetchMock({ json: () => Promise.resolve(yahooResponse(closes)) });
    vi.stubGlobal('fetch', fetchSpy);

    const req = makeRangeRequest('^GSPC', '3M');
    const res = await GET(req, { params: Promise.resolve({ ticker: '^GSPC' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBeCloseTo(5500, 0);
    expect(body.open).toBeCloseTo(5000, 0);
    expect(body.changePct).toBeCloseTo(10, 0);
  });
});
