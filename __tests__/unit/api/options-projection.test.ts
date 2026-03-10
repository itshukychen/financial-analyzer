import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/options/projection/route';
import * as db from '@/lib/db';

vi.mock('@/lib/db');

const mockGetOptionProjection = vi.mocked(db.getOptionProjection);
const mockGetLatestOptionSnapshot = vi.mocked(db.getLatestOptionSnapshot);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/options/projection');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  const request = new Request(url) as Request & { nextUrl: { searchParams: URLSearchParams } };
  (request as Record<string, unknown>).nextUrl = { searchParams: url.searchParams };
  return request;
}

describe('GET /api/options/projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no snapshot data available', async () => {
    mockGetLatestOptionSnapshot.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No snapshot data/i);
  });

  it('returns 404 when no projection data available', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No projection data/i);
  });

  it('returns 200 with valid projection data', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 30,
      prob_distribution: [
        { price: 460, probability: 0.05 },
        { price: 475, probability: 0.7 },
        { price: 490, probability: 0.25 },
      ],
      key_levels: [
        { level: 460, type: '2sd_low', probability: 0.05 },
        { level: 475, type: 'mode', probability: 0.7 },
        { level: 490, type: '2sd_high', probability: 0.25 },
      ],
      regime_classification: 'normal',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.ticker).toBe('SPY');
    expect(body.date).toBe('2026-03-09');
    expect(body.expiry_horizon).toBe(30);
    expect(Array.isArray(body.prob_distribution)).toBe(true);
    expect(Array.isArray(body.keyLevels)).toBe(true);
    expect(body.regimeTransition).toBeDefined();
    expect(body.regimeTransition.from).toBe('normal');
    expect(body.regimeTransition.to).toBe('normal');
    expect(body.regimeTransition.confidence).toBe(0.75);
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

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'QQQ',
      horizon_days: 30,
      prob_distribution: [{ price: 400, probability: 1 }],
      key_levels: [],
      regime_classification: 'elevated',
      created_at: now,
    });

    const res = await GET(makeRequest({ ticker: 'QQQ' }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.ticker).toBe('QQQ');
    expect(mockGetLatestOptionSnapshot).toHaveBeenCalledWith('QQQ', '30d');
  });

  it('uses custom horizonDays parameter', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 60,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: now,
    });

    const res = await GET(makeRequest({ horizonDays: '60' }));
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.expiry_horizon).toBe(60);
    expect(mockGetOptionProjection).toHaveBeenCalledWith('2026-03-09', 'SPWX', 60);
  });

  it('defaults to 30 days for horizonDays parameter', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 30,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.expiry_horizon).toBe(30);
  });

  it('handles regime transition from normal to elevated', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 30,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'elevated',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.regimeTransition.from).toBe('normal');
    expect(body.regimeTransition.to).toBe('elevated');
  });

  it('handles regime transition from elevated to normal', async () => {
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
      regime: 'elevated',
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 30,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.regimeTransition.from).toBe('elevated');
    expect(body.regimeTransition.to).toBe('normal');
  });

  it('handles error during fetch', async () => {
    mockGetLatestOptionSnapshot.mockImplementation(() => {
      throw new Error('Database error');
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Internal server error/i);
  });

  it('handles key levels with various types', async () => {
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
      raw_json: '{}',
      created_at: now,
    });

    mockGetOptionProjection.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 30,
      prob_distribution: [
        { price: 460, probability: 0.05 },
        { price: 475, probability: 0.7 },
        { price: 490, probability: 0.25 },
      ],
      key_levels: [
        { level: 450, type: 'support', probability: 0.2 },
        { level: 460, type: '2sd_low', probability: 0.05 },
        { level: 475, type: 'mode', probability: 0.7 },
        { level: 490, type: '2sd_high', probability: 0.25 },
        { level: 510, type: 'resistance', probability: 0.15 },
      ],
      regime_classification: 'normal',
      created_at: now,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.keyLevels.length).toBe(5);
    expect(body.keyLevels.some((kl: any) => kl.type === 'support')).toBe(true);
    expect(body.keyLevels.some((kl: any) => kl.type === 'resistance')).toBe(true);
  });
});
