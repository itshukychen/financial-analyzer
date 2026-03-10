/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Anthropic SDK and db/aiLib before importing the route
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getOptionSnapshot: vi.fn(),
  getOptionProjection: vi.fn(),
  getAIForecast: vi.fn(),
}));

vi.mock('@/lib/aiOptionsForecast', () => ({
  generateAIAnalysis: vi.fn(),
}));

import { POST } from '@/app/api/options/ai-forecast/route';
import * as db from '@/lib/db';
import * as aiLib from '@/lib/aiOptionsForecast';

// Get the mocked db functions
const mockGetOptionSnapshot = vi.mocked(db.getOptionSnapshot);
const mockGetOptionProjection = vi.mocked(db.getOptionProjection);
const mockGetAIForecast = vi.mocked((db as any).getAIForecast);
const mockGenerateAIAnalysis = vi.mocked(aiLib.generateAIAnalysis);

function makeRequest(body: unknown) {
  const url = new URL('http://localhost:3000/api/options/ai-forecast');
  const request = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Request & { json: () => Promise<unknown> };
  return request;
}

describe('POST /api/options/ai-forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when ticker is missing', async () => {
    const req = makeRequest({ date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/ticker|date/i);
  });

  it('returns 400 when date is missing', async () => {
    const req = makeRequest({ ticker: 'SPY' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it('returns 400 when no snapshot data available', async () => {
    mockGetOptionSnapshot.mockReturnValue(null);

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/No data/i);
  });

  it('returns 400 when no projection data available', async () => {
    mockGetOptionSnapshot.mockReturnValue({
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 0.1,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{"spotPrice": 475}',
      created_at: Math.floor(Date.now() / 1000),
    });
    mockGetOptionProjection.mockReturnValue(null);

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it('successfully generates AI analysis for valid inputs', async () => {
    const mockSnapshot = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 0.1,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{"spotPrice": 475}',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockProjection = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 28,
      prob_distribution: [
        { price: 460, probability: 0.05 },
        { price: 475, probability: 0.7 },
        { price: 490, probability: 0.25 },
      ],
      key_levels: [
        { level: 460, type: '2sd_low' as const, probability: 0.05 },
        { level: 490, type: '2sd_high' as const, probability: 0.05 },
      ],
      regime_classification: 'normal',
      created_at: Math.floor(Date.now() / 1000),
    };

    mockGetOptionSnapshot.mockReturnValue(mockSnapshot);
    mockGetOptionProjection.mockReturnValue(mockProjection);
    mockGetAIForecast.mockReturnValue(null);
    mockGenerateAIAnalysis.mockResolvedValue({
      analysis: 'Mock analysis',
      targets: { upside: 490, downside: 460 },
    });

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; analysis: unknown };
    expect(body.success).toBe(true);
    expect(body.analysis).toBeDefined();
  });

  it('respects regenerate parameter to skip cache', async () => {
    const mockSnapshot = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 0.1,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{"spotPrice": 475}',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockProjection = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 28,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: Math.floor(Date.now() / 1000),
    };

    mockGetOptionSnapshot.mockReturnValue(mockSnapshot);
    mockGetOptionProjection.mockReturnValue(mockProjection);
    mockGetAIForecast.mockReturnValue(mockSnapshot as any);
    mockGenerateAIAnalysis.mockResolvedValue({
      analysis: 'Fresh analysis',
    });

    const req = makeRequest({
      ticker: 'SPY',
      date: '2026-03-09',
      regenerate: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // generateAIAnalysis called with useCache=false (false && regenerate=true)
    expect(mockGenerateAIAnalysis).toHaveBeenCalled();
  });

  it('handles missing snapshot fields with defaults', async () => {
    const mockSnapshot = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: null,
      iv_60d: null,
      hv_20d: null,
      hv_60d: null,
      iv_rank: null,
      net_delta: null,
      atm_gamma: null,
      vega_per_1pct: null,
      theta_daily: null,
      call_otm_iv: null,
      put_otm_iv: null,
      skew_ratio: null,
      implied_move_pct: null,
      regime: null,
      raw_json: '{}',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockProjection = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 28,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: null,
      created_at: Math.floor(Date.now() / 1000),
    };

    mockGetOptionSnapshot.mockReturnValue(mockSnapshot);
    mockGetOptionProjection.mockReturnValue(mockProjection);
    mockGetAIForecast.mockReturnValue(null);
    mockGenerateAIAnalysis.mockResolvedValue({ analysis: 'Test' });

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('handles error during analysis generation', async () => {
    const mockSnapshot = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 0.1,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: Math.floor(Date.now() / 1000),
    };

    const mockProjection = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 28,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: Math.floor(Date.now() / 1000),
    };

    mockGetOptionSnapshot.mockReturnValue(mockSnapshot);
    mockGetOptionProjection.mockReturnValue(mockProjection);
    mockGenerateAIAnalysis.mockRejectedValue(new Error('API Error'));

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/API Error/);
  });

  it('includes cache metadata when forecast is cached', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockSnapshot = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      expiry: '2026-04-18',
      iv_30d: 28.5,
      iv_60d: 29.0,
      hv_20d: 22.0,
      hv_60d: 23.0,
      iv_rank: 45,
      net_delta: 0.5,
      atm_gamma: 0.03,
      vega_per_1pct: 0.1,
      theta_daily: -0.05,
      call_otm_iv: 32.0,
      put_otm_iv: 35.0,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: '{}',
      created_at: now,
    };

    const mockProjection = {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPY',
      horizon_days: 28,
      prob_distribution: [{ price: 475, probability: 1 }],
      key_levels: [],
      regime_classification: 'normal',
      created_at: now,
    };

    const mockCachedForecast = {
      ...mockSnapshot,
      created_at: new Date(now * 1000).toISOString(),
    } as any;

    mockGetOptionSnapshot.mockReturnValue(mockSnapshot);
    mockGetOptionProjection.mockReturnValue(mockProjection);
    mockGetAIForecast.mockReturnValue(mockCachedForecast);
    mockGenerateAIAnalysis.mockResolvedValue({ analysis: 'Test' });

    const req = makeRequest({ ticker: 'SPY', date: '2026-03-09' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { cached: boolean; cacheAge: number; nextUpdate: string };
    expect(body.cached).toBeDefined();
    expect(body.cacheAge).toBeDefined();
    expect(body.nextUpdate).toBeDefined();
  });
});
