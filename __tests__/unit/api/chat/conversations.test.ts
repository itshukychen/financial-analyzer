import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock lib/db (default export = raw Database instance) ─────────────────────

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll }));

vi.mock('@/lib/db', () => ({
  default: { prepare: mockPrepare },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(search: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/chat/conversations');
  Object.entries(search).forEach(([k, v]) => url.searchParams.set(k, v));
  const req = new Request(url) as Request & {
    nextUrl: { searchParams: URLSearchParams };
  };
  (req as Record<string, unknown>).nextUrl = { searchParams: url.searchParams };
  return req;
}

const NOW = 1_700_000_000; // unix seconds

const MOCK_ROWS = [
  {
    id: 'conv-1',
    title: 'Portfolio Review',
    created_at: NOW - 200,
    updated_at: NOW,
    message_count: 5,
    preview: 'Hello, how is my portfolio?',
  },
  {
    id: 'conv-2',
    title: null,
    created_at: NOW - 500,
    updated_at: NOW - 100,
    message_count: 1,
    preview: null,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/chat/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: prepare always returns the same mock statement
    mockPrepare.mockReturnValue({ get: mockGet, all: mockAll });
  });

  it('returns conversations with correct shape', async () => {
    mockGet.mockReturnValueOnce({ count: 2 });
    mockAll.mockReturnValueOnce(MOCK_ROWS);

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.conversations).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.hasMore).toBe(false);

    const first = body.conversations[0];
    expect(first.id).toBe('conv-1');
    expect(first.title).toBe('Portfolio Review');
    expect(first.messageCount).toBe(5);
    expect(first.preview).toBe('Hello, how is my portfolio?');
    expect(first.createdAt).toBe(new Date((NOW - 200) * 1000).toISOString());
    expect(first.updatedAt).toBe(new Date(NOW * 1000).toISOString());
  });

  it('handles null title and null preview', async () => {
    mockGet.mockReturnValueOnce({ count: 1 });
    mockAll.mockReturnValueOnce([MOCK_ROWS[1]]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.conversations[0].title).toBeNull();
    expect(body.conversations[0].preview).toBeNull();
  });

  it('uses default limit=20 and offset=0', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest());

    expect(mockAll).toHaveBeenCalledWith('default', 20, 0);
  });

  it('respects limit and offset query params', async () => {
    mockGet.mockReturnValueOnce({ count: 100 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ limit: '10', offset: '30' }));

    expect(mockAll).toHaveBeenCalledWith('default', 10, 30);
  });

  it('caps limit at 100', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ limit: '999' }));

    expect(mockAll).toHaveBeenCalledWith('default', 100, 0);
  });

  it('floors offset to 0 for negative values', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ offset: '-5' }));

    expect(mockAll).toHaveBeenCalledWith('default', 20, 0);
  });

  it('defaults to limit=20 for non-numeric limit', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ limit: 'abc' }));

    expect(mockAll).toHaveBeenCalledWith('default', 20, 0);
  });

  it('uses updated_at sort by default', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest());

    const listCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('ORDER BY'),
    );
    expect(listCall?.[0]).toContain('c.updated_at DESC');
  });

  it('uses created_at sort when specified', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ sort: 'created_at' }));

    const listCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('ORDER BY'),
    );
    expect(listCall?.[0]).toContain('c.created_at DESC');
  });

  it('falls back to updated_at for invalid sort value', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest({ sort: 'invalid_field' }));

    const listCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('ORDER BY'),
    );
    expect(listCall?.[0]).toContain('c.updated_at DESC');
  });

  it('hasMore is true when more results exist beyond current page', async () => {
    mockGet.mockReturnValueOnce({ count: 25 });
    mockAll.mockReturnValueOnce(Array(20).fill(MOCK_ROWS[0]));

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest({ limit: '20', offset: '0' }));
    const body = await res.json();

    expect(body.hasMore).toBe(true);
    expect(body.total).toBe(25);
  });

  it('hasMore is false on last page', async () => {
    mockGet.mockReturnValueOnce({ count: 25 });
    mockAll.mockReturnValueOnce(Array(5).fill(MOCK_ROWS[0]));

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest({ limit: '20', offset: '20' }));
    const body = await res.json();

    expect(body.hasMore).toBe(false);
  });

  it('returns empty conversations array when no conversations exist', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.conversations).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.hasMore).toBe(false);
  });

  it('returns 500 when database throws', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('SQLITE_ERROR: no such table: conversations');
    });

    const { GET } = await import('@/app/api/chat/conversations/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('SQLITE_ERROR');
  });

  it('queries with user_id = default', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);

    const { GET } = await import('@/app/api/chat/conversations/route');
    await GET(makeRequest());

    expect(mockGet).toHaveBeenCalledWith('default');
    expect(mockAll).toHaveBeenCalledWith('default', expect.any(Number), expect.any(Number));
  });
});
