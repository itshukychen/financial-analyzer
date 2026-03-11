/**
 * Tests for POST /api/chat/search → app/api/chat/search/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state ────────────────────────────────────────────────────────

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ all: mockAll, get: mockGet }));

// ─── Mock lib/db ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  default: { prepare: mockPrepare },
  // named exports present in other routes — not used by search route
  listReports: vi.fn(),
  getLatestReport: vi.fn(),
  getReportByDate: vi.fn(),
  insertOrReplaceReport: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSearchRow(overrides: Partial<{
  messageId: string;
  conversationId: string;
  role: string;
  createdAt: string;
  conversationTitle: string | null;
  conversationUpdatedAt: string;
  snippet: string;
  score: number;
}> = {}) {
  return {
    messageId: 'msg-uuid-1',
    conversationId: 'conv-uuid-1',
    role: 'user',
    createdAt: '2026-03-10T10:00:00.000Z',
    conversationTitle: 'Test Conversation',
    conversationUpdatedAt: '2026-03-10T10:05:00.000Z',
    snippet: 'This is a **test** snippet about volatility',
    score: -1.5,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/chat/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ total: 0 });
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when query is missing', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ limit: 10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('query is required');
  });

  it('returns 400 when query is a single character', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('at least 2 characters');
  });

  it('returns 400 when query is empty string', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is only whitespace', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: '  ' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const req = new Request('http://localhost/api/chat/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  // ── Success cases ────────────────────────────────────────────────────────────

  it('returns 200 with empty results when no matches', async () => {
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ total: 0 });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.query).toBe('volatility');
  });

  it('returns matched results with shaped fields', async () => {
    const row = makeSearchRow();
    mockAll.mockReturnValue([row]);
    mockGet.mockReturnValue({ total: 1 });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'test' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);

    const result = body.results[0];
    expect(result.messageId).toBe('msg-uuid-1');
    expect(result.conversationId).toBe('conv-uuid-1');
    expect(result.conversationTitle).toBe('Test Conversation');
    expect(result.role).toBe('user');
    expect(result.snippet).toBe('This is a **test** snippet about volatility');
    expect(result.score).toBe(-1.5);
    expect(result.createdAt).toBe('2026-03-10T10:00:00.000Z');
    expect(result.conversationUpdatedAt).toBe('2026-03-10T10:05:00.000Z');
  });

  it('truncates snippet to 150 characters', async () => {
    const longSnippet = 'a'.repeat(200);
    const row = makeSearchRow({ snippet: longSnippet });
    mockAll.mockReturnValue([row]);
    mockGet.mockReturnValue({ total: 1 });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'aa' }));

    const body = await res.json();
    expect(body.results[0].snippet.length).toBeLessThanOrEqual(150);
  });

  it('includes execution time in metadata', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    const body = await res.json();
    expect(body.metadata).toBeDefined();
    expect(typeof body.metadata.executionTimeMs).toBe('number');
    expect(body.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('echoes back query, limit, and offset in response', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'options', limit: 5, offset: 10 }));

    const body = await res.json();
    expect(body.query).toBe('options');
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  // ── Defaults ────────────────────────────────────────────────────────────────

  it('applies default limit of 20 when not specified', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    const body = await res.json();
    expect(body.limit).toBe(20);
  });

  it('applies default offset of 0 when not specified', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    const body = await res.json();
    expect(body.offset).toBe(0);
  });

  it('caps limit at 100', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility', limit: 9999 }));

    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it('trims whitespace from query', async () => {
    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: '  volatility  ' }));

    const body = await res.json();
    expect(body.query).toBe('volatility');
  });

  // ── conversationId scoping ───────────────────────────────────────────────────

  it('passes conversationId to prepared statement when provided', async () => {
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ total: 0 });

    const { POST } = await import('@/app/api/chat/search/route');
    await POST(makePostRequest({ query: 'test', conversationId: 'conv-uuid-42' }));

    // The prepare call includes a conversationId filter — verify params include it
    const allCalls = mockAll.mock.calls;
    expect(allCalls.length).toBeGreaterThan(0);
    const searchCallArgs = allCalls[0];
    expect(searchCallArgs).toContain('conv-uuid-42');
  });

  it('does not filter by conversationId when not provided', async () => {
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ total: 0 });

    const { POST } = await import('@/app/api/chat/search/route');
    await POST(makePostRequest({ query: 'test' }));

    const searchCallArgs = mockAll.mock.calls[0];
    // Should only have [sanitizedQuery, limit, offset] — no conversationId
    expect(searchCallArgs).not.toContain(expect.stringMatching(/^conv-/));
    expect(searchCallArgs).toHaveLength(3); // query + limit + offset
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  it('returns 503 when chat tables do not exist', async () => {
    mockAll.mockImplementation(() => {
      throw new Error('no such table: chat_messages_fts');
    });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('Search index not available');
    expect(body.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 503 when virtual table does not exist', async () => {
    mockAll.mockImplementation(() => {
      throw new Error('no such virtual table: chat_messages_fts');
    });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    expect(res.status).toBe(503);
  });

  it('returns 500 for other database errors', async () => {
    mockAll.mockImplementation(() => {
      throw new Error('SQLITE_ERROR: disk I/O error');
    });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'volatility' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('disk I/O error');
  });

  it('returns multiple results with correct total count', async () => {
    const rows = [
      makeSearchRow({ messageId: 'msg-1', snippet: 'First result' }),
      makeSearchRow({ messageId: 'msg-2', snippet: 'Second result' }),
      makeSearchRow({ messageId: 'msg-3', snippet: 'Third result' }),
    ];
    mockAll.mockReturnValue(rows);
    mockGet.mockReturnValue({ total: 42 });

    const { POST } = await import('@/app/api/chat/search/route');
    const res = await POST(makePostRequest({ query: 'result', limit: 3, offset: 0 }));

    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.total).toBe(42);
  });
});
