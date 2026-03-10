import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/options/snapshot/route';
import * as db from '@/lib/db';

vi.mock('@/lib/db');

const mockGetLatestOptionSnapshot = vi.mocked(db.getLatestOptionSnapshot);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/options/snapshot');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  const request = new Request(url) as Request & { nextUrl: { searchParams: URLSearchParams } };
  (request as Record<string, unknown>).nextUrl = { searchParams: url.searchParams };
  return request;
}

describe('GET /api/options/snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no data available', async () => {
    mockGetLatestOptionSnapshot.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No data/i);
  });

  it('returns 200 with valid snapshot data', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: JSON.stringify({ spotPrice: 475 }),
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.ticker).toBe('SPY');
    expect(body.expirations).toEqual(['1w', '30d', '60d']);
    expect(body.volatility).toBeDefined();
    expect(body.volatility.iv_30d).toBe(28.5);
    expect(body.volatility.iv_rank).toBe(45);
    expect(body.greeks).toBeDefined();
    expect(body.skew).toBeDefined();
    expect(body.regime).toBe('normal');
  });

  it('extracts spot price from raw_json', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPX',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 50,
      net_delta: 0.3,
      atm_gamma: 0.02,
      vega_per_1pct: 100,
      theta_daily: -0.1,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.2,
      implied_move_pct: 3.0,
      regime: 'elevated',
      raw_json: JSON.stringify({ spotPrice: 5900 }),
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    // implied_move uses spot price from raw_json
    expect(body.implied_move['1w_conf_low']).toBeLessThan(5900);
    expect(body.implied_move['1w_conf_high']).toBeGreaterThan(5900);
  });

  it('falls back to 475 when spot price not in raw_json', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.0,
      regime: 'normal',
      raw_json: JSON.stringify({ someOtherField: true }),
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    // Should use fallback 475
    expect(body.implied_move['1w_conf_low']).toBeLessThan(475);
    expect(body.implied_move['1w_conf_high']).toBeGreaterThan(475);
  });

  it('handles malformed raw_json gracefully', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.0,
      regime: 'normal',
      raw_json: 'not valid json',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    // Should use fallback 475
    expect(body.implied_move['1w_conf_low']).toBeLessThan(475);
  });

  it('calculates iv_percentile correctly', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 75,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.volatility.iv_percentile).toBe(0.75);
  });

  it('determines skew_direction as put_heavy', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 30.0,
      put_otm_iv: 40.0,
      skew_ratio: 1.3, // > 1.05
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.skew.skew_direction).toBe('put_heavy');
  });

  it('determines skew_direction as call_heavy', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 40.0,
      put_otm_iv: 30.0,
      skew_ratio: 0.8, // < 0.95
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.skew.skew_direction).toBe('call_heavy');
  });

  it('determines skew_direction as balanced', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.0, // Between 0.95 and 1.05
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.skew.skew_direction).toBe('balanced');
  });

  it('uses custom ticker parameter', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'QQQ',
      expiry: '30d',
      iv_30d: 30.5,
      iv_60d: 31.0,
      hv_20d: 24.0,
      hv_60d: 25.0,
      iv_rank: 50,
      net_delta: 0.4,
      atm_gamma: 0.025,
      vega_per_1pct: 60,
      theta_daily: -0.08,
      call_otm_iv: 34.0,
      put_otm_iv: 37.0,
      skew_ratio: 1.15,
      implied_move_pct: 2.8,
      regime: 'elevated',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest({ ticker: 'QQQ' }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.ticker).toBe('QQQ');
    expect(mockGetLatestOptionSnapshot).toHaveBeenCalledWith('QQQ', '30d');
  });

  it('uses custom expiry parameter', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '60d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest({ expiry: '60d' }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(mockGetLatestOptionSnapshot).toHaveBeenCalledWith('SPWX', '60d');
  });

  it('handles null iv_percentile when iv_rank is null', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: null,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.volatility.iv_percentile).toBeNull();
  });

  it('handles null implied_move_pct for confidence bands', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetLatestOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '30d',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 50,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: null,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.implied_move['1w_move_pct']).toBeNull();
    expect(body.implied_move['30d_move_pct']).toBeNull();
  });
});
