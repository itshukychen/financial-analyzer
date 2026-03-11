/**
 * Tests for:
 *   GET    /api/chat/conversations/[id]  → app/api/chat/conversations/[id]/route.ts
 *   DELETE /api/chat/conversations/[id]  → app/api/chat/conversations/[id]/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_UUID  = '550e8400-e29b-41d4-a716-446655440000';

// ─── Hoisted mocks (must run before vi.mock hoisting) ─────────────────────────

const { mockGet, mockAll, mockRun, mockPrepare } = vi.hoisted(() => {
  const mockGet     = vi.fn();
  const mockAll     = vi.fn();
  const mockRun     = vi.fn();
  const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll, run: mockRun }));
  return { mockGet, mockAll, mockRun, mockPrepare };
});

vi.mock('@/lib/db', () => ({
  default: { prepare: mockPrepare },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CONVERSATION = {
  id:         VALID_UUID,
  user_id:    1,
  title:      'Test Conversation',
  created_at: 1_700_000_000,
  updated_at: 1_700_001_000,
  deleted_at: null,
};

const MOCK_MESSAGES = [
  {
    id:              'msg-001',
    conversation_id: VALID_UUID,
    role:            'user',
    content:         'Hello',
    tokens_used:     null,
    created_at:      1_700_000_100,
  },
  {
    id:              'msg-002',
    conversation_id: VALID_UUID,
    role:            'assistant',
    content:         'Hi there!',
    tokens_used:     42,
    created_at:      1_700_000_200,
  },
];

// ─── GET /api/chat/conversations/[id] ─────────────────────────────────────────

describe('GET /api/chat/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default safe returns so tests without explicit setup don't bleed
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockPrepare.mockImplementation(() => ({ get: mockGet, all: mockAll, run: mockRun }));
  });

  it('returns 400 for an invalid UUID', async () => {
    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request('http://localhost/api/chat/conversations/not-a-uuid'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid conversation ID');
    // No DB calls should have been made
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('returns 404 when conversation does not exist', async () => {
    mockGet.mockReturnValue(undefined);

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Conversation not found');
  });

  it('returns 403 when conversation belongs to a different user', async () => {
    mockGet.mockReturnValue({ ...MOCK_CONVERSATION, user_id: 999 });

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with shaped conversation and messages', async () => {
    mockGet.mockReturnValue(MOCK_CONVERSATION);
    mockAll.mockReturnValue(MOCK_MESSAGES);

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(VALID_UUID);
    expect(body.title).toBe('Test Conversation');
    expect(body.createdAt).toBe(1_700_000_000);
    expect(body.updatedAt).toBe(1_700_001_000);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({
      id:         'msg-001',
      role:       'user',
      content:    'Hello',
      createdAt:  1_700_000_100,
      tokensUsed: null,
    });
    expect(body.messages[1]).toEqual({
      id:         'msg-002',
      role:       'assistant',
      content:    'Hi there!',
      createdAt:  1_700_000_200,
      tokensUsed: 42,
    });
  });

  it('returns empty messages array when conversation has no messages', async () => {
    mockGet.mockReturnValue(MOCK_CONVERSATION);
    mockAll.mockReturnValue([]);

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual([]);
  });

  it('does not expose raw database columns (user_id, deleted_at)', async () => {
    mockGet.mockReturnValue(MOCK_CONVERSATION);
    mockAll.mockReturnValue([]);

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    const body = await res.json();
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('deleted_at');
  });

  it('returns 500 when database throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('DB unavailable'); });

    const { GET } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await GET(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('DB unavailable');
  });
});

// ─── DELETE /api/chat/conversations/[id] ──────────────────────────────────────

describe('DELETE /api/chat/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockRun.mockReturnValue({ changes: 0 });
    mockPrepare.mockImplementation(() => ({ get: mockGet, all: mockAll, run: mockRun }));
  });

  it('returns 400 for an invalid UUID', async () => {
    const { DELETE } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await DELETE(
      new Request('http://localhost/api/chat/conversations/bad-id'),
      { params: Promise.resolve({ id: 'bad-id' }) },
    );
    expect(res.status).toBe(400);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('returns 404 when conversation does not exist', async () => {
    mockGet.mockReturnValue(undefined);

    const { DELETE } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await DELETE(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Conversation not found');
  });

  it('returns 403 when conversation belongs to a different user', async () => {
    mockGet.mockReturnValue({ ...MOCK_CONVERSATION, user_id: 999 });

    const { DELETE } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await DELETE(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(403);
  });

  it('soft-deletes the conversation and returns success', async () => {
    mockGet.mockReturnValue(MOCK_CONVERSATION);
    mockRun.mockReturnValue({ changes: 1 });

    const { DELETE } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await DELETE(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify the UPDATE was called with the conversation id
    expect(mockRun).toHaveBeenCalledWith(VALID_UUID);
    // Verify the UPDATE SQL uses deleted_at (soft delete, not hard delete)
    const updateCall = mockPrepare.mock.calls.find(
      ([sql]: [string]) => sql.includes('deleted_at') && sql.includes('UPDATE'),
    );
    expect(updateCall).toBeDefined();
  });

  it('returns 500 when database throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('DB unavailable'); });

    const { DELETE } = await import('@/app/api/chat/conversations/[id]/route');
    const res = await DELETE(
      new Request(`http://localhost/api/chat/conversations/${VALID_UUID}`),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(500);
  });
});
