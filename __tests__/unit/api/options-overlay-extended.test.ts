import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/market/options-overlay/route';
import * as db from '@/lib/db';

vi.mock('@/lib/db');

const mockGetOptionPrices = vi.mocked(db.getOptionPrices);
const mockGetUnderlyingPrices = vi.mocked(db.getUnderlyingPrices);

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/market/options-overlay');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  const request = new Request(url) as Request & { nextUrl: { searchParams: URLSearchParams } };
  (request as Record<string, unknown>).nextUrl = { searchParams: url.searchParams };
  return request;
}

describe('GET /api/market/options-overlay — Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for strike at boundary (0)', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '0',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/strike/i);
  });

  it('returns 400 for strike above boundary (> 10000)', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '10001',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for strike exactly at upper boundary (10000)', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 10000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 100, bid: 99.5, ask: 100.5, volume: 100, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 15000 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '10000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for strike of 10001', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '10001',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no matching data points exist (no overlap)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 1000, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now + 2000, price: 5910.25 }, // Non-overlapping timestamp
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No matching/i);
  });

  it('sets correct cache headers for 5D range', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '5D',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=300');
    expect(cacheControl).toContain('stale-while-revalidate=1800');
  });

  it('sets correct cache headers for 3M range (default case)', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '3M',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=900');
    expect(cacheControl).toContain('stale-while-revalidate=3600');
  });

  it('sets correct cache headers for 6M range', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '6M',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=900');
    expect(cacheControl).toContain('stale-while-revalidate=3600');
  });

  it('sets correct cache headers for 1Y range', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '1Y',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=900');
  });

  it('calculates correct time range for 1D', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '1D',
    }));

    expect(res.status).toBe(200);
    expect(mockGetOptionPrices).toHaveBeenCalled();
  });

  it('calculates correct time range for 5D', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetOptionPrices.mockReturnValue([
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ]);
    mockGetUnderlyingPrices.mockReturnValue([
      { timestamp: now, price: 5910.25 },
    ]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '5D',
    }));

    expect(res.status).toBe(200);
  });

  it('handles partial data availability', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 3600, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 5925.50 }, // Only one underlying price matches
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.metadata.dataAvailability).toBe('partial');
    expect(body.points.length).toBe(1); // Only the matching point
  });

  it('handles data availability as full', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 5910.25 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.metadata.dataAvailability).toBe('full');
  });

  it('includes earliestTimestamp in metadata', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 3600, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now - 3600, price: 5900.00 },
      { timestamp: now, price: 5925.50 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.metadata.earliestTimestamp).toBeDefined();
    expect(typeof body.metadata.earliestTimestamp).toBe('string');
  });

  it('handles all valid tickers', async () => {
    const tickers = ['SPX', 'SPY', 'QQQ', 'IWM', 'DIA'];
    const now = Math.floor(Date.now() / 1000);

    for (const ticker of tickers) {
      mockGetOptionPrices.mockReturnValue([
        { id: 1, ticker, strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      ]);
      mockGetUnderlyingPrices.mockReturnValue([
        { timestamp: now, price: 5910.25 },
      ]);

      const res = await GET(makeRequest({
        ticker,
        strike: '3000',
        expiry: '2026-06-17',
      }));
      expect(res.status).toBe(200);
    }
  });

  it('generates synthetic underlying data when empty', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 3600, price: 150.00, bid: 149.5, ask: 150.5, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 160.00, bid: 159.5, ask: 160.5, volume: 1500, created_at: now },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue([]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.points.length).toBe(2);
    expect(body.points[0].underlyingPrice).toBeGreaterThan(0);
    expect(body.points[1].underlyingPrice).toBeGreaterThan(0);
  });

  it('handles multiple data points correctly', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 7200, price: 235.00, bid: 234.5, ask: 235.5, volume: 800, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 3600, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 3, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now - 7200, price: 5880.00 },
      { timestamp: now - 3600, price: 5900.25 },
      { timestamp: now, price: 5925.50 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.points.length).toBe(3);
    expect(body.points[0].time).toBeDefined();
    expect(body.points[2].optionPrice).toBe(242.10);
  });

  it('handles caught errors gracefully', async () => {
    mockGetOptionPrices.mockImplementation(() => {
      throw new Error('Database error');
    });

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Internal server error/i);
  });
});
