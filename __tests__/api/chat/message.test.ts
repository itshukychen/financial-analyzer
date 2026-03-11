import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

// Use vi.hoisted so these are available inside vi.mock() factory functions,
// which are hoisted to the top of the file before variable declarations.
const { mockStatement, mockDb, mockStream, mockClaudeEvents } = vi.hoisted(() => {
  const mockStatement = {
    run: vi.fn().mockReturnValue({ changes: 1 }),
    get: vi.fn().mockReturnValue(undefined),
    all: vi.fn().mockReturnValue([]),
  };
  const mockDb = {
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue(mockStatement),
  };
  const mockClaudeEvents = [
    { type: 'message_start', message: { usage: { input_tokens: 10 } } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
  ];
  const mockStream = vi.fn();
  return { mockStatement, mockDb, mockStream, mockClaudeEvents };
});

vi.mock('better-sqlite3', () => {
  // Must use a regular function (not arrow) so it can be used as a constructor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockDatabase = function () { return mockDb; } as any;
  return { default: vi.fn().mockImplementation(MockDatabase) };
});

// Mock Anthropic SDK with a streaming async generator
const mockClaudeStream = {
  [Symbol.asyncIterator]: async function* () {
    for (const event of mockClaudeEvents) {
      yield event;
    }
  },
};

vi.mock('@anthropic-ai/sdk', () => {
  // Must use a regular function (not arrow) so it can be used as a constructor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockAnthropic = function () { return { messages: { stream: mockStream } }; } as any;
  return { default: vi.fn().mockImplementation(MockAnthropic) };
});

// Mock fs to avoid actual filesystem operations in tests
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST, rateLimitMap } from '@/app/api/chat/message/route';

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function collectSSEEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .flatMap(line => {
      try {
        return [JSON.parse(line.slice(6)) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat/message', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/chat/message', () => {
  const savedEnv = process.env;

  beforeEach(() => {
    // Reset call records (but keep implementations)
    vi.clearAllMocks();

    // Re-apply return values cleared by clearAllMocks
    mockStatement.run.mockReturnValue({ changes: 1 });
    mockStatement.get.mockReturnValue(undefined);
    mockStatement.all.mockReturnValue([]);
    mockDb.prepare.mockReturnValue(mockStatement);
    mockStream.mockReturnValue(mockClaudeStream);

    // Clear rate limit state between tests
    rateLimitMap.clear();

    // Set required env vars
    process.env = { ...savedEnv, ANTHROPIC_API_KEY: 'test-key-123' };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  // ── Request Validation ──────────────────────────────────────────────────────

  describe('request validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/chat/message', {
        method: 'POST',
        body: 'not-valid-json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json() as Record<string, unknown>;
      expect(data).toHaveProperty('error');
    });

    it('returns 400 for empty message string', async () => {
      const response = await POST(makeRequest({ message: '' }));

      expect(response.status).toBe(400);
      const data = await response.json() as Record<string, unknown>;
      expect(String(data.error)).toContain('empty');
    });

    it('returns 400 for missing message field', async () => {
      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      const data = await response.json() as Record<string, unknown>;
      expect(data).toHaveProperty('error');
    });

    it('returns 400 for message exceeding 5000 characters', async () => {
      const response = await POST(makeRequest({ message: 'x'.repeat(5001) }));

      expect(response.status).toBe(400);
      const data = await response.json() as Record<string, unknown>;
      expect(String(data.error)).toContain('5000');
    });

    it('returns 400 when message is not a string', async () => {
      const response = await POST(makeRequest({ message: 42 }));

      expect(response.status).toBe(400);
      const data = await response.json() as Record<string, unknown>;
      expect(data).toHaveProperty('error');
    });

    it('returns 400 for whitespace-only message', async () => {
      const response = await POST(makeRequest({ message: '   ' }));

      expect(response.status).toBe(400);
    });
  });

  // ── Rate Limiting ───────────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('returns 429 when message count exceeds the hourly limit', async () => {
      // Pre-fill the rate limit map to simulate an exhausted quota
      const now = Date.now();
      const limit = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);
      rateLimitMap.set('default', Array.from({ length: limit }, (_, i) => now - i * 10));

      const response = await POST(makeRequest({ message: 'Hello' }));

      expect(response.status).toBe(429);
      const data = await response.json() as Record<string, unknown>;
      expect(data).toHaveProperty('error');
    });

    it('returns Retry-After header when rate limited', async () => {
      const now = Date.now();
      rateLimitMap.set('default', Array.from({ length: 100 }, () => now - 1000));

      const response = await POST(makeRequest({ message: 'Hello' }));

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).toBeTruthy();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it('allows requests under the limit to proceed', async () => {
      // Rate limit map is empty — should succeed
      const response = await POST(makeRequest({ message: 'Hello' }));

      expect(response.status).toBe(200);
    });
  });

  // ── New Conversation ────────────────────────────────────────────────────────

  describe('new conversation (no conversationId)', () => {
    it('returns 200 with text/event-stream content type', async () => {
      const response = await POST(makeRequest({ message: 'What is the IV for SPWX?' }));

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('sets no-cache headers', async () => {
      const response = await POST(makeRequest({ message: 'Hello' }));

      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('streams conversation_created event first', async () => {
      const response = await POST(makeRequest({ message: 'What is the IV for SPWX?' }));
      const events = await collectSSEEvents(response);

      expect(events[0]).toHaveProperty('type', 'conversation_created');
    });

    it('conversation_created event includes conversationId and title', async () => {
      const response = await POST(makeRequest({ message: 'What is SPWX volatility?' }));
      const events = await collectSSEEvents(response);
      const created = events.find(e => e.type === 'conversation_created');

      expect(created).toBeDefined();
      expect(typeof created?.conversationId).toBe('string');
      expect(typeof created?.title).toBe('string');
      expect(String(created?.title).length).toBeGreaterThan(0);
    });

    it('streams message_start event after conversation_created', async () => {
      const response = await POST(makeRequest({ message: 'Hello assistant' }));
      const events = await collectSSEEvents(response);
      const types = events.map(e => e.type);

      expect(types).toContain('message_start');
      const startIdx = types.indexOf('message_start');
      const createdIdx = types.indexOf('conversation_created');
      expect(startIdx).toBeGreaterThan(createdIdx);
    });

    it('streams content_delta events with text chunks', async () => {
      const response = await POST(makeRequest({ message: 'Tell me about volatility.' }));
      const events = await collectSSEEvents(response);
      const deltas = events.filter(e => e.type === 'content_delta');

      expect(deltas.length).toBeGreaterThan(0);
      for (const d of deltas) {
        expect(typeof d.delta).toBe('string');
      }
    });

    it('streams message_done event as the last event', async () => {
      const response = await POST(makeRequest({ message: 'Explain theta decay.' }));
      const events = await collectSSEEvents(response);
      const lastEvent = events[events.length - 1];

      expect(lastEvent).toHaveProperty('type', 'message_done');
    });

    it('message_done includes conversationId, messageId and isNewConversation=true', async () => {
      const response = await POST(makeRequest({ message: 'Explain theta decay.' }));
      const events = await collectSSEEvents(response);
      const done = events.find(e => e.type === 'message_done');

      expect(done).toBeDefined();
      expect(typeof done?.conversationId).toBe('string');
      expect(typeof done?.messageId).toBe('string');
      expect(done?.isNewConversation).toBe(true);
    });

    it('inserts conversation and messages into the database', async () => {
      await POST(makeRequest({ message: 'What are current risk levels?' }));

      // Should have called prepare for: insert conversation, insert user msg,
      // get history, insert assistant msg, update conversation
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('all events appear in correct order', async () => {
      const response = await POST(makeRequest({ message: 'Quick question' }));
      const events = await collectSSEEvents(response);
      const types = events.map(e => e.type);

      // conversation_created → message_start → content_delta(s) → message_done
      expect(types[0]).toBe('conversation_created');
      expect(types).toContain('message_start');
      expect(types).toContain('content_delta');
      expect(types[types.length - 1]).toBe('message_done');
    });
  });

  // ── Existing Conversation ───────────────────────────────────────────────────

  describe('existing conversation (conversationId provided)', () => {
    const existingConvId = 'conv-abc-123';

    it('skips conversation_created and proceeds with streaming', async () => {
      // Return existing conversation on lookup
      mockStatement.get.mockReturnValueOnce({ id: existingConvId, user_id: 'default' });

      const response = await POST(
        makeRequest({ message: 'Follow-up question', conversationId: existingConvId })
      );
      const events = await collectSSEEvents(response);
      const types = events.map(e => e.type);

      expect(types).not.toContain('conversation_created');
      expect(types).toContain('message_start');
      expect(types).toContain('message_done');
    });

    it('sets isNewConversation=false in message_done', async () => {
      mockStatement.get.mockReturnValueOnce({ id: existingConvId, user_id: 'default' });

      const response = await POST(
        makeRequest({ message: 'Follow-up question', conversationId: existingConvId })
      );
      const events = await collectSSEEvents(response);
      const done = events.find(e => e.type === 'message_done');

      expect(done?.isNewConversation).toBe(false);
    });

    it('sends error event when conversation is not found', async () => {
      // mockStatement.get returns undefined (not found) — default behaviour
      const response = await POST(
        makeRequest({ message: 'Test', conversationId: 'non-existent-id' })
      );

      // SSE stream is still 200, but contains an error event
      expect(response.status).toBe(200);
      const events = await collectSSEEvents(response);
      const error = events.find(e => e.type === 'error');

      expect(error).toBeDefined();
      expect(String(error?.message)).toContain('not found');
    });
  });

  // ── Error Handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('sends error event when ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const response = await POST(makeRequest({ message: 'Hello' }));

      expect(response.status).toBe(200);
      const events = await collectSSEEvents(response);
      const error = events.find(e => e.type === 'error');

      expect(error).toBeDefined();
      expect(String(error?.message)).toContain('ANTHROPIC_API_KEY');
    });

    it('sends error event when Claude API throws', async () => {
      mockStream.mockImplementationOnce(() => {
        throw new Error('Claude API unavailable');
      });

      const response = await POST(makeRequest({ message: 'Hello' }));
      const events = await collectSSEEvents(response);
      const error = events.find(e => e.type === 'error');

      expect(error).toBeDefined();
      expect(String(error?.message)).toContain('Claude API unavailable');
    });

    it('does not include no errors in the happy path', async () => {
      const response = await POST(makeRequest({ message: 'What is IV rank?' }));
      const events = await collectSSEEvents(response);
      const errors = events.filter(e => e.type === 'error');

      expect(errors).toHaveLength(0);
    });
  });
});
