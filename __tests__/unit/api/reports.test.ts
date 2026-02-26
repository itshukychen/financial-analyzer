/**
 * Tests for:
 *   GET /api/reports            → app/api/reports/route.ts
 *   GET /api/reports/[date]     → app/api/reports/[date]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReportRow } from '@/lib/db';

// ─── Mock lib/db ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  listReports:    vi.fn(),
  getReportByDate: vi.fn(),
  // unused in these tests but needs to be present
  getLatestReport:         vi.fn(),
  insertOrReplaceReport:   vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ROW: ReportRow = {
  id:           1,
  date:         '2026-02-26',
  generated_at: 1_740_614_700,
  model:        'claude-sonnet-4-5',
  ticker_data:  JSON.stringify({ spx: { current: 5800, changePct: 3.57, points: [] } }),
  report_json:  JSON.stringify({ headline: 'Test Headline', summary: 'Summary.', sections: {} }),
};

const MOCK_LIST = [
  { id: 3, date: '2026-02-26', generated_at: 1_740_614_700, model: 'claude-sonnet-4-5' },
  { id: 2, date: '2026-02-25', generated_at: 1_740_528_300, model: 'claude-sonnet-4-5' },
  { id: 1, date: '2026-02-24', generated_at: 1_740_441_900, model: 'claude-sonnet-4-5' },
];

// ─── GET /api/reports ─────────────────────────────────────────────────────────

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an array of reports from DB', async () => {
    const { listReports } = await import('@/lib/db');
    vi.mocked(listReports).mockReturnValue(MOCK_LIST);

    const { GET } = await import('@/app/api/reports/route');
    const res      = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    expect(body[0].date).toBe('2026-02-26');
  });

  it('returns an empty array when no reports exist', async () => {
    const { listReports } = await import('@/lib/db');
    vi.mocked(listReports).mockReturnValue([]);

    const { GET } = await import('@/app/api/reports/route');
    const res      = await GET();
    const body     = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });
});

// ─── GET /api/reports/[date] ──────────────────────────────────────────────────

describe('GET /api/reports/[date]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid date format', async () => {
    const { GET } = await import('@/app/api/reports/[date]/route');
    const res = await GET(
      new Request('http://localhost/api/reports/notadate'),
      { params: Promise.resolve({ date: 'notadate' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid date format');
  });

  it('returns 404 when date not in DB', async () => {
    const { getReportByDate } = await import('@/lib/db');
    vi.mocked(getReportByDate).mockReturnValue(null);

    const { GET } = await import('@/app/api/reports/[date]/route');
    const res = await GET(
      new Request('http://localhost/api/reports/2099-01-01'),
      { params: Promise.resolve({ date: '2099-01-01' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Report not found');
  });

  it('returns 200 with shaped response when date exists', async () => {
    const { getReportByDate } = await import('@/lib/db');
    vi.mocked(getReportByDate).mockReturnValue(MOCK_ROW);

    const { GET } = await import('@/app/api/reports/[date]/route');
    const res = await GET(
      new Request('http://localhost/api/reports/2026-02-26'),
      { params: Promise.resolve({ date: '2026-02-26' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.date).toBe('2026-02-26');
    expect(body.analysis.headline).toBe('Test Headline');
    expect(body.marketData).toEqual({ spx: { current: 5800, changePct: 3.57, points: [] } });
  });

  it('does not expose raw ticker_data/report_json strings', async () => {
    const { getReportByDate } = await import('@/lib/db');
    vi.mocked(getReportByDate).mockReturnValue(MOCK_ROW);

    const { GET } = await import('@/app/api/reports/[date]/route');
    const res = await GET(
      new Request('http://localhost/api/reports/2026-02-26'),
      { params: Promise.resolve({ date: '2026-02-26' }) },
    );
    const body = await res.json();
    expect(body).not.toHaveProperty('ticker_data');
    expect(body).not.toHaveProperty('report_json');
  });

  it('calls getReportByDate with the date from params', async () => {
    const { getReportByDate } = await import('@/lib/db');
    vi.mocked(getReportByDate).mockReturnValue(MOCK_ROW);

    const { GET } = await import('@/app/api/reports/[date]/route');
    await GET(
      new Request('http://localhost/api/reports/2026-02-26'),
      { params: Promise.resolve({ date: '2026-02-26' }) },
    );
    expect(vi.mocked(getReportByDate)).toHaveBeenCalledWith('2026-02-26');
  });
});
