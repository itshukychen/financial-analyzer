import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/reports/latest/route';
import type { ReportRow } from '@/lib/db';

// ─── Mock lib/db ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  getLatestReport: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ROW: ReportRow = {
  id:           1,
  date:         '2026-02-26',
  generated_at: 1_740_614_700,
  model:        'claude-sonnet-4-5',
  ticker_data:  JSON.stringify({ spx: { current: 5800, changePct: 3.57, points: [] } }),
  report_json:  JSON.stringify({
    headline: 'Markets Rally',
    summary:  'Strong session.',
    sections: {},
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no report exists in DB', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(null);

    const res  = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('No report available yet');
  });

  it('returns 200 with shaped response when report exists', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(MOCK_ROW);

    const res  = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.date).toBe('2026-02-26');
    expect(body.generatedAt).toBe(1_740_614_700);
    expect(body.model).toBe('claude-sonnet-4-5');
  });

  it('parses ticker_data and report_json into objects', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(MOCK_ROW);

    const res  = await GET();
    const body = await res.json();
    expect(body.marketData).toEqual({ spx: { current: 5800, changePct: 3.57, points: [] } });
    expect(body.analysis.headline).toBe('Markets Rally');
  });

  it('returns correct shape — no ticker_data/report_json raw strings', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(MOCK_ROW);

    const res  = await GET();
    const body = await res.json();
    expect(body).not.toHaveProperty('ticker_data');
    expect(body).not.toHaveProperty('report_json');
  });
});
