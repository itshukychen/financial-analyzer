/**
 * Tests for POST /api/reports/generate
 * (app/api/reports/generate/route.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/scripts/generate-report', () => ({
  fetchAllMarketData: vi.fn(),
  buildPrompt:        vi.fn(),
  callClaude:         vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  insertOrReplaceReport: vi.fn(),
  getLatestReport:       vi.fn(),
  getReportByDate:       vi.fn(),
  listReports:           vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_MARKET_DATA = {
  spx: {
    current:   5800,
    changePct: 3.57,
    points:    [{ time: '2026-02-26', value: 5800 }],
  },
  vix:      { current: 14, changePct: -30, points: [] },
  dxy:      { current: 107, changePct: 2.88, points: [] },
  yield10y: { current: 4.50, changePct: 7.14, points: [] },
  yield2y:  { current: 4.10, changePct: 7.89, points: [] },
};

const MOCK_ANALYSIS = {
  headline: 'Risk-on melt-up: SPX surges as VIX collapses',
  regime: {
    classification: 'Risk-on melt-up',
    justification: 'SPX +3.57% while VIX collapsed 30%, confirming broad risk appetite.',
  },
  yieldCurve:          'Bear steepener: 10Y rose ~30bp over 7 days vs 2Y +20bp.',
  dollarLogic:         'DXY firmed on rate differential.',
  equityDiagnosis:     'Move is positioning-driven with macro confirmation.',
  volatility:          'VIX collapse signals temporary hedging unwind.',
  crossAssetCheck:     'SPX: Risk-on. VIX: Complacency. DXY: Mixed. 2Y: Stable. 10Y: Bear steepening.',
  forwardScenarios:    'Continuation: bear steepening holds. Reversal: bull flattener. Acceleration: 10Y >4.7%.',
  shortVolRisk:        'FAVORABLE for short gamma. Warning: 2Y spike >15bp.',
  regimeProbabilities: 'Continuation 55% | Reversal 30% | Acceleration 15%',
};

const MOCK_SAVED_ROW = {
  id:           42,
  date:         '2026-02-26',
  generated_at: 1_740_614_700,
  model:        'claude-sonnet-4-5',
  ticker_data:  JSON.stringify(MOCK_MARKET_DATA),
  report_json:  JSON.stringify(MOCK_ANALYSIS),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(opts: { auth?: string; secret?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.auth !== undefined) headers['authorization'] = opts.auth;

  const req = new NextRequest('http://localhost/api/reports/generate', {
    method:  'POST',
    headers,
  });

  // Set env secret
  if (opts.secret !== undefined) {
    process.env.REPORT_SECRET = opts.secret;
  } else {
    delete process.env.REPORT_SECRET;
  }

  return req;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/reports/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REPORT_SECRET;
  });

  it('returns 401 when no authorization header is provided', async () => {
    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ secret: 'test-secret' }); // no auth header
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ auth: 'Bearer wrong-secret', secret: 'correct-secret' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when REPORT_SECRET env var is not set', async () => {
    const { POST } = await import('@/app/api/reports/generate/route');
    const req = new NextRequest('http://localhost/api/reports/generate', {
      method:  'POST',
      headers: { authorization: 'Bearer some-secret' },
    });
    // REPORT_SECRET is deleted by beforeEach
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 201 and calls insertOrReplaceReport on success', async () => {
    // Wire up the mocks
    const { fetchAllMarketData, buildPrompt, callClaude } = await import('@/scripts/generate-report');
    const { insertOrReplaceReport, getLatestReport }       = await import('@/lib/db');

    vi.mocked(fetchAllMarketData).mockResolvedValue(MOCK_MARKET_DATA as never);
    vi.mocked(buildPrompt).mockReturnValue('mock prompt');
    vi.mocked(callClaude).mockResolvedValue(MOCK_ANALYSIS as never);
    vi.mocked(insertOrReplaceReport).mockReturnValue(undefined as never);
    vi.mocked(getLatestReport).mockReturnValue(MOCK_SAVED_ROW as never);

    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ auth: 'Bearer correct-secret', secret: 'correct-secret' });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.date).toBe('2026-02-26');
    expect(body.id).toBe(42);

    expect(vi.mocked(insertOrReplaceReport)).toHaveBeenCalledWith(
      '2026-02-26',
      MOCK_MARKET_DATA,
      MOCK_ANALYSIS,
      'claude-sonnet-4-5',
    );
  });

  it('calls fetchAllMarketData and callClaude with correct args on success', async () => {
    const { fetchAllMarketData, buildPrompt, callClaude } = await import('@/scripts/generate-report');
    const { insertOrReplaceReport, getLatestReport }       = await import('@/lib/db');

    vi.mocked(fetchAllMarketData).mockResolvedValue(MOCK_MARKET_DATA as never);
    vi.mocked(buildPrompt).mockReturnValue('built prompt');
    vi.mocked(callClaude).mockResolvedValue(MOCK_ANALYSIS as never);
    vi.mocked(insertOrReplaceReport).mockReturnValue(undefined as never);
    vi.mocked(getLatestReport).mockReturnValue(MOCK_SAVED_ROW as never);

    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ auth: 'Bearer s', secret: 's' });
    await POST(req);

    expect(vi.mocked(buildPrompt)).toHaveBeenCalledWith(MOCK_MARKET_DATA, '2026-02-26');
    expect(vi.mocked(callClaude)).toHaveBeenCalledWith('built prompt');
  });

  it('returns 500 when fetchAllMarketData throws', async () => {
    const { fetchAllMarketData } = await import('@/scripts/generate-report');
    vi.mocked(fetchAllMarketData).mockRejectedValue(new Error('Network error'));

    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ auth: 'Bearer s', secret: 's' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Network error');
  });

  it('returns 500 when callClaude throws', async () => {
    const { fetchAllMarketData, buildPrompt, callClaude } = await import('@/scripts/generate-report');
    vi.mocked(fetchAllMarketData).mockResolvedValue(MOCK_MARKET_DATA as never);
    vi.mocked(buildPrompt).mockReturnValue('prompt');
    vi.mocked(callClaude).mockRejectedValue(new Error('API quota exceeded'));

    const { POST } = await import('@/app/api/reports/generate/route');
    const req = makeRequest({ auth: 'Bearer s', secret: 's' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('API quota exceeded');
  });
});
