import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/fear-greed/route';

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

describe('GET /api/fear-greed — Extended Coverage', () => {
  it('handles non-Error exception types (string throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue('String error message'),
    );

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/String error message/);
  });

  it('handles non-Error exception types (object throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue({ some: 'object' }),
    );

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('handles non-Error exception types (number throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(500),
    );

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('returns 502 when JSON parsing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Invalid JSON')),
    }));

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid JSON/);
  });

  it('rounds all numeric values correctly', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           50.5,
          rating:          'Neutral',
          previous_close:  49.4,
          previous_1_week: 48.6,
          previous_1_month: 47.2,
          previous_1_year: 46.9,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.score).toBe(50 | 51); // Math.round can return either
    expect(body.previousClose).toBe(49);
    expect(body.previous1Week).toBe(49); // Math.round(48.6)
    expect(body.previous1Month).toBe(47);
    expect(body.previous1Year).toBe(47);
  });

  it('handles very high scores (near 100)', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           99.9,
          rating:          'Extreme Greed',
          previous_close:  98.5,
          previous_1_week: 97.1,
          previous_1_month: 96.0,
          previous_1_year: 95.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.score).toBeGreaterThanOrEqual(99);
    expect(body.rating).toBe('Extreme Greed');
  });

  it('handles very low scores (near 0)', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           0.1,
          rating:          'Extreme Fear',
          previous_close:  0.5,
          previous_1_week: 1.1,
          previous_1_month: 2.0,
          previous_1_year: 5.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.score).toBeLessThanOrEqual(1);
    expect(body.rating).toBe('Extreme Fear');
  });

  it('handles "Fear" rating', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           35.0,
          rating:          'Fear',
          previous_close:  40.0,
          previous_1_week: 38.0,
          previous_1_month: 36.0,
          previous_1_year: 50.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.rating).toBe('Fear');
  });

  it('handles "Extreme Fear" rating', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           15.0,
          rating:          'Extreme Fear',
          previous_close:  20.0,
          previous_1_week: 18.0,
          previous_1_month: 16.0,
          previous_1_year: 40.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.rating).toBe('Extreme Fear');
  });

  it('handles "Neutral" rating', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           50.0,
          rating:          'Neutral',
          previous_close:  50.0,
          previous_1_week: 48.0,
          previous_1_month: 52.0,
          previous_1_year: 50.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.rating).toBe('Neutral');
  });

  it('handles "Extreme Greed" rating', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           85.0,
          rating:          'Extreme Greed',
          previous_close:  80.0,
          previous_1_week: 82.0,
          previous_1_month: 84.0,
          previous_1_year: 70.0,
          timestamp:       '2026-02-27T14:35:00Z',
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.rating).toBe('Extreme Greed');
  });

  it('returns 502 on non-ok status 400', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 400 }));

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/400/);
  });

  it('returns 502 on non-ok status 404', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 404 }));

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/404/);
  });

  it('returns 502 on non-ok status 500', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 500 }));

    const res = await GET();
    expect(res.status).toBe(502);

    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/500/);
  });

  it('preserves timestamp from CNN response', async () => {
    const testTimestamp = '2026-03-09T10:15:30Z';
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           75.0,
          rating:          'Greed',
          previous_close:  72.0,
          previous_1_week: 70.0,
          previous_1_month: 60.0,
          previous_1_year: 65.0,
          timestamp:       testTimestamp,
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.timestamp).toBe(testTimestamp);
  });

  it('handles null timestamp', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      json: () => Promise.resolve({
        fear_and_greed: {
          score:           75.0,
          rating:          'Greed',
          previous_close:  72.0,
          previous_1_week: 70.0,
          previous_1_month: 60.0,
          previous_1_year: 65.0,
          timestamp:       null,
        },
      }),
    }));

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.timestamp).toBeNull();
  });
});
