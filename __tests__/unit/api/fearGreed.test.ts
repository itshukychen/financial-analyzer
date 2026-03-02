import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/fear-greed/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_CNN_RESPONSE = {
  fear_and_greed: {
    score:           72.3,
    rating:          'Greed',
    previous_close:  70.1,
    previous_1_week: 65.7,
    previous_1_month: 45.2,
    previous_1_year: 60.8,
    timestamp:       '2026-02-27T14:35:00Z',
  },
};

function makeFetchMock(init: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}) {
  return vi.fn().mockResolvedValue({
    ok:     init.ok     ?? true,
    status: init.status ?? 200,
    json:   init.json   ?? (() => Promise.resolve(MOCK_CNN_RESPONSE)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/fear-greed', () => {
  it('returns 200 with correct shape when CNN API succeeds', async () => {
    vi.stubGlobal('fetch', makeFetchMock({}));

    const res  = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.score).toBe(72);           // Math.round(72.3)
    expect(body.rating).toBe('Greed');
    expect(body.previousClose).toBe(70);   // Math.round(70.1)
    expect(body.previous1Week).toBe(66);   // Math.round(65.7)
    expect(body.previous1Month).toBe(45);  // Math.round(45.2)
    expect(body.previous1Year).toBe(61);   // Math.round(60.8)
    expect(body.timestamp).toBe('2026-02-27T14:35:00Z');
    // Confirm no raw CNN field names leak through
    expect(body).not.toHaveProperty('previous_close');
    expect(body).not.toHaveProperty('fear_and_greed');
  });

  it('returns 502 when CNN API returns non-ok status', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 503 }));

    const res  = await GET();
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/503/);
  });

  it('returns 502 when fetch throws (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    );

    const res  = await GET();
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/Network failure/);
  });
});
