import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '@/lib/db';
import type { DbInstance } from '@/lib/db';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TICKER_DATA = { spx: { current: 5800, changePct: 3.57, points: [] } };
const REPORT_JSON = {
  headline: 'Markets Rally on Strong Data',
  summary:  'Equities surged.',
  sections: {
    equity:      'SPX gained 1%.',
    volatility:  'VIX fell.',
    fixedIncome: 'Yields rose.',
    dollar:      'DXY stable.',
    crossAsset:  'Risk-on.',
    outlook:     'Watch NFP.',
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let inst: DbInstance;

beforeEach(() => {
  // Use in-memory DB — isolated per test (new instance each time)
  inst = createDb(':memory:');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createDb factory', () => {
  it('creates a database and returns the four CRUD functions', () => {
    expect(typeof inst.insertOrReplaceReport).toBe('function');
    expect(typeof inst.getLatestReport).toBe('function');
    expect(typeof inst.getReportByDate).toBe('function');
    expect(typeof inst.listReports).toBe('function');
  });

  it('getLatestReport returns null when DB is empty', () => {
    expect(inst.getLatestReport()).toBeNull();
  });

  it('listReports returns empty array when DB is empty', () => {
    expect(inst.listReports()).toEqual([]);
  });
});

describe('insertOrReplaceReport', () => {
  it('inserts a report and returns the saved row', () => {
    const row = inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    expect(row.id).toBeGreaterThan(0);
    expect(row.date).toBe('2026-02-26');
    expect(row.model).toBe('claude-sonnet-4-5');
    expect(JSON.parse(row.ticker_data)).toEqual(TICKER_DATA);
    expect(JSON.parse(row.report_json)).toEqual(REPORT_JSON);
  });

  it('sets generated_at as a unix timestamp (seconds)', () => {
    const before = Math.floor(Date.now() / 1000);
    const row = inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    const after = Math.floor(Date.now() / 1000);
    expect(row.generated_at).toBeGreaterThanOrEqual(before);
    expect(row.generated_at).toBeLessThanOrEqual(after);
  });

  it('upserts — same date overwrites existing report', () => {
    inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');

    const newReport = { ...REPORT_JSON, headline: 'Updated Headline' };
    const row = inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, newReport, 'claude-sonnet-4-5');

    expect(JSON.parse(row.report_json).headline).toBe('Updated Headline');
    // Should still be only 1 row
    expect(inst.listReports()).toHaveLength(1);
  });

  it('allows multiple different dates', () => {
    inst.insertOrReplaceReport('2026-02-24', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-25', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');

    expect(inst.listReports()).toHaveLength(3);
  });
});

describe('getLatestReport', () => {
  it('returns null when no reports exist', () => {
    expect(inst.getLatestReport()).toBeNull();
  });

  it('returns the most recent report by date', () => {
    inst.insertOrReplaceReport('2026-02-24', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-25', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');

    const latest = inst.getLatestReport();
    expect(latest?.date).toBe('2026-02-26');
  });
});

describe('getReportByDate', () => {
  beforeEach(() => {
    inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
  });

  it('returns null for a date that does not exist', () => {
    expect(inst.getReportByDate('2099-01-01')).toBeNull();
  });

  it('returns the correct row for an existing date', () => {
    const row = inst.getReportByDate('2026-02-26');
    expect(row).not.toBeNull();
    expect(row?.date).toBe('2026-02-26');
  });

  it('returns null for a date with different format', () => {
    expect(inst.getReportByDate('20260226')).toBeNull();
  });
});

describe('listReports', () => {
  beforeEach(() => {
    inst.insertOrReplaceReport('2026-02-24', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-26', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
    inst.insertOrReplaceReport('2026-02-25', TICKER_DATA, REPORT_JSON, 'claude-sonnet-4-5');
  });

  it('returns rows ordered by date DESC', () => {
    const rows = inst.listReports();
    expect(rows[0].date).toBe('2026-02-26');
    expect(rows[1].date).toBe('2026-02-25');
    expect(rows[2].date).toBe('2026-02-24');
  });

  it('returns only id, date, generated_at, model columns (no raw JSON)', () => {
    const row = inst.listReports()[0];
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('date');
    expect(row).toHaveProperty('generated_at');
    expect(row).toHaveProperty('model');
    expect(row).not.toHaveProperty('ticker_data');
    expect(row).not.toHaveProperty('report_json');
  });

  it('respects the limit parameter', () => {
    expect(inst.listReports(2)).toHaveLength(2);
    expect(inst.listReports(1)).toHaveLength(1);
  });

  it('defaults to limit 50', () => {
    // 3 rows total, default limit 50 → returns all 3
    expect(inst.listReports()).toHaveLength(3);
  });
});
