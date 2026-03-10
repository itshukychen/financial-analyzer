import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/market/options-overlay/route';
import * as db from '@/lib/db';

vi.mock('@/lib/db');

const mockGetOptionPrices = db.getOptionPrices as any;
const mockGetUnderlyingPrices = db.getUnderlyingPrices as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/market/options-overlay');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  // Create a NextRequest-like object
  const request = new Request(url) as any;
  request.nextUrl = { searchParams: url.searchParams };
  return request;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/market/options-overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing parameters', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ticker/i);
  });

  it('returns 400 for missing strike', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/strike/i);
  });

  it('returns 400 for missing expiry', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expiry/i);
  });

  it('returns 400 for invalid ticker', async () => {
    const res = await GET(makeRequest({
      ticker: 'INVALID',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ticker/i);
  });

  it('returns 400 for invalid strike', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '-100',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid expiry format', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026/06/17',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expiry/i);
  });

  it('returns 400 for invalid option type', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      optionType: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid range', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when no option price data exists', async () => {
    mockGetOptionPrices.mockReturnValue([]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 with correct data structure for valid request', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now - 86400, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now - 86400, price: 5910.25 },
      { timestamp: now, price: 5925.50 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
      range: '1M',
    }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticker).toBe('SPX');
    expect(body.strike).toBe(3000);
    expect(body.expiry).toBe('2026-06-17');
    expect(body.optionType).toBe('call');
    expect(body.range).toBe('1M');
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBe(2);
    
    // Check data point structure
    const firstPoint = body.points[0];
    expect(firstPoint).toHaveProperty('time');
    expect(firstPoint).toHaveProperty('underlyingPrice');
    expect(firstPoint).toHaveProperty('optionPrice');
    expect(firstPoint.underlyingPrice).toBe(5910.25);
    expect(firstPoint.optionPrice).toBe(240.50);

    // Check current values
    expect(body.current.underlying).toBe(5925.50);
    expect(body.current.option).toBe(242.10);

    // Check metadata
    expect(body.metadata).toHaveProperty('dataAvailability');
    expect(body.metadata.dataAvailability).toBe('full');
  });

  it('uses synthetic underlying data when not available', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue([]);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.points.length).toBe(1);
    expect(body.points[0].optionPrice).toBe(240.50);
    // Underlying price should be estimated from option price
    expect(typeof body.points[0].underlyingPrice).toBe('number');
    expect(body.points[0].underlyingPrice).toBeGreaterThan(0);
  });

  it('sets correct cache headers for 1D range', async () => {
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
      range: '1D',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=60');
    expect(cacheControl).toContain('stale-while-revalidate=300');
  });

  it('sets correct cache headers for 1M range', async () => {
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
      range: '1M',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=900');
    expect(cacheControl).toContain('stale-while-revalidate=3600');
  });

  it('defaults to call option type', async () => {
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

    const body = await res.json();
    expect(body.optionType).toBe('call');
  });

  it('defaults to 1D range', async () => {
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

    const body = await res.json();
    expect(body.range).toBe('1D');
  });

  it('handles put options', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 2900, expiry_date: '2026-06-17', option_type: 'put', timestamp: now, price: 150.25, bid: 150, ask: 151, volume: 800, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 5910.25 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '2900',
      expiry: '2026-06-17',
      optionType: 'put',
    }));

    const body = await res.json();
    expect(body.optionType).toBe('put');
    expect(body.strike).toBe(2900);
  });

  // ─── Additional Edge Case Tests ────────────────────────────────────────────────

  it('returns 404 when merged points are empty', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Option data at time T, underlying data at time T+1000 (no overlap)
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now + 1000, price: 5910.25 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/matching data points/i);
  });

  it('handles strike price at upper boundary (10000)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 10000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 10.50, bid: 10, ask: 11, volume: 100, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 12000.0 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '10000',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.strike).toBe(10000);
  });

  it('returns 400 for strike price exceeding upper boundary', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '10001',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/strike/i);
  });

  it('handles fractional strike prices', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000.5, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 5910.25 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000.5',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.strike).toBe(3000.5);
  });

  it('validates all ticker options (SPY)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPY', strike: 500, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 50.0, bid: 49.5, ask: 50.5, volume: 500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 550.0 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPY',
      strike: '500',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
  });

  it('validates all ticker options (QQQ)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'QQQ', strike: 450, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 45.0, bid: 44.5, ask: 45.5, volume: 500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 500.0 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'QQQ',
      strike: '450',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
  });

  it('validates all range options (5D)', async () => {
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
      range: '5D',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('5D');
  });

  it('validates all range options (3M)', async () => {
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
      range: '3M',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('3M');
  });

  it('validates all range options (6M)', async () => {
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
      range: '6M',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('6M');
  });

  it('validates all range options (1Y)', async () => {
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
      range: '1Y',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toBe('1Y');
  });

  it('sets correct cache headers for 5D range', async () => {
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
      range: '5D',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=300');
    expect(cacheControl).toContain('stale-while-revalidate=1800');
  });

  it('sets correct cache headers for 3M range', async () => {
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
      range: '3M',
    }));

    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=900');
    expect(cacheControl).toContain('stale-while-revalidate=3600');
  });

  it('returns data availability as full when all option points matched', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now + 3600, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 5910.25 },
      { timestamp: now + 3600, price: 5925.50 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));

    const body = await res.json();
    expect(body.metadata.dataAvailability).toBe('full');
  });

  it('returns data availability as partial when some points lack underlying data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 240.50, bid: 240, ask: 241, volume: 1000, created_at: now },
      { id: 2, ticker: 'SPX', strike: 3000, expiry_date: '2026-06-17', option_type: 'call', timestamp: now + 3600, price: 242.10, bid: 241.5, ask: 242.5, volume: 1500, created_at: now },
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

    const body = await res.json();
    expect(body.metadata.dataAvailability).toBe('partial');
  });

  it('includes earliest timestamp in metadata', async () => {
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

    const body = await res.json();
    expect(body.metadata.earliestTimestamp).toBeDefined();
    expect(typeof body.metadata.earliestTimestamp).toBe('string');
  });

  it('handles catch block when db throws error', async () => {
    mockGetOptionPrices.mockImplementationOnce(() => {
      throw new Error('Database connection failed');
    });

    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('handles parseFloat returning NaN for strike', async () => {
    // parseFloat('abc') returns NaN, and NaN <= 0 is always false
    // so this should fail the validation check
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: 'not-a-number',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/strike/i);
  });

  it('correctly validates dates with invalid format (no dashes)', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '20260617',
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expiry/i);
  });

  it('correctly validates dates with invalid format (slashes)', async () => {
    const res = await GET(makeRequest({
      ticker: 'SPX',
      strike: '3000',
      expiry: '2026/06/17',
    }));

    expect(res.status).toBe(400);
  });

  it('validates IWM ticker', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'IWM', strike: 200, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 20.0, bid: 19.5, ask: 20.5, volume: 500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 220.0 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'IWM',
      strike: '200',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
  });

  it('validates DIA ticker', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockOptionData = [
      { id: 1, ticker: 'DIA', strike: 420, expiry_date: '2026-06-17', option_type: 'call', timestamp: now, price: 42.0, bid: 41.5, ask: 42.5, volume: 500, created_at: now },
    ];
    const mockUnderlyingData = [
      { timestamp: now, price: 460.0 },
    ];

    mockGetOptionPrices.mockReturnValue(mockOptionData);
    mockGetUnderlyingPrices.mockReturnValue(mockUnderlyingData);

    const res = await GET(makeRequest({
      ticker: 'DIA',
      strike: '420',
      expiry: '2026-06-17',
    }));

    expect(res.status).toBe(200);
  });
});
