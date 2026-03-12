/**
 * Tests for: app/api/health/route.ts
 *
 * AC Coverage:
 * AC-1.1 → 'returns 200 with ok: true when health is OK'
 * AC-1.2 → 'returns JSON content type'
 */
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('AC-1.1: returns 200 with ok: true when health is OK', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean };
    expect(json).toEqual({ ok: true });
  });

  it('AC-1.2: returns JSON content type', async () => {
    const response = await GET();
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('response body has ok property as boolean', async () => {
    const response = await GET();
    const json = (await response.json()) as Record<string, unknown>;
    expect(typeof json.ok).toBe('boolean');
    expect(json.ok).toBe(true);
  });
});
