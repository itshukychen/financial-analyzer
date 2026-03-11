/**
 * Tests for: lib/chat/claudeClient.ts
 *
 * Coverage:
 * - streamMessage calls onDelta for each text chunk
 * - streamMessage calls onComplete with full text + token counts
 * - streamMessage handles AbortError silently (no onError call)
 * - streamMessage calls onError for AuthenticationError (code: 'auth')
 * - streamMessage calls onError for RateLimitError (code: 'rate_limit', retryAfterMs)
 * - streamMessage calls onError for APIConnectionTimeoutError (code: 'timeout')
 * - streamMessage calls onError for APIConnectionError (code: 'connection')
 * - streamMessage calls onError for APIError (code: 'api')
 * - streamMessage calls onError for generic Error (code: 'unknown')
 * - streamMessage throws chatError when onError is not provided
 * - validateApiKey returns true for successful API call
 * - validateApiKey returns false for AuthenticationError
 * - validateApiKey returns false for APIConnectionError
 * - validateApiKey returns false for APIConnectionTimeoutError
 * - validateApiKey returns true for RateLimitError (key is valid)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (must be before vi.mock calls) ──────────────────────────

const {
  mockStreamFn,
  mockCreateFn,
  MockAuthError,
  MockRateLimitError,
  MockTimeoutError,
  MockConnectionError,
  MockAPIError,
} = vi.hoisted(() => {
  class MockAuthError extends Error {
    constructor() {
      super('Invalid or missing API key');
      this.name = 'AuthenticationError';
    }
  }
  class MockRateLimitError extends Error {
    headers: Record<string, string>;
    constructor(retryAfter = '30') {
      super('Rate limited');
      this.name = 'RateLimitError';
      this.headers = { 'retry-after': retryAfter };
    }
  }
  class MockTimeoutError extends Error {
    constructor() {
      super('Request timed out');
      this.name = 'APIConnectionTimeoutError';
    }
  }
  class MockConnectionError extends Error {
    constructor() {
      super('Connection failed');
      this.name = 'APIConnectionError';
    }
  }
  class MockAPIError extends Error {
    status: number;
    constructor(status = 500) {
      super(`API error: internal server error`);
      this.name = 'APIError';
      this.status = status;
    }
  }

  return {
    mockStreamFn: vi.fn(),
    mockCreateFn: vi.fn(),
    MockAuthError,
    MockRateLimitError,
    MockTimeoutError,
    MockConnectionError,
    MockAPIError,
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = function () {
    return { messages: { stream: mockStreamFn, create: mockCreateFn } };
  } as unknown as typeof import('@anthropic-ai/sdk').default;
  return {
    default: vi.fn().mockImplementation(MockAnthropic),
    AuthenticationError: MockAuthError,
    RateLimitError: MockRateLimitError,
    APIConnectionTimeoutError: MockTimeoutError,
    APIConnectionError: MockConnectionError,
    APIError: MockAPIError,
  };
});

// ── Import after mocks ─────────────────────────────────────────────────────

import { streamMessage, validateApiKey } from '@/lib/chat/claudeClient';
import type { StreamMessageOptions } from '@/lib/chat/claudeClient';

// ── Test helpers ──────────────────────────────────────────────────────────

/**
 * Creates a mock stream object that fires text events when finalMessage() resolves.
 */
function makeMockStream(
  chunks: string[],
  tokens: { input: number; output: number } = { input: 10, output: 5 },
) {
  const handlers: Record<string, Array<(text: string) => void>> = {};
  return {
    on: vi.fn((event: string, handler: (text: string) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    finalMessage: vi.fn(async () => {
      // Fire text events before resolving
      for (const chunk of chunks) {
        for (const h of handlers['text'] ?? []) h(chunk);
      }
      return { usage: { input_tokens: tokens.input, output_tokens: tokens.output } };
    }),
  };
}

function makeOptions(overrides: Partial<StreamMessageOptions> = {}): StreamMessageOptions {
  return {
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    onDelta: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('streamMessage', () => {
  const savedEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv, ANTHROPIC_API_KEY: 'test-key-abc' };
    mockStreamFn.mockReturnValue(makeMockStream(['Hello ', 'world!']));
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('calls onDelta for each streamed text chunk', async () => {
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onDelta).toHaveBeenCalledWith('Hello ');
    expect(opts.onDelta).toHaveBeenCalledWith('world!');
    expect(opts.onDelta).toHaveBeenCalledTimes(2);
  });

  it('calls onComplete with full text and token counts', async () => {
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onComplete).toHaveBeenCalledWith('Hello world!', 10, 5);
  });

  it('passes system prompt and messages to Claude stream', async () => {
    const opts = makeOptions({
      systemPrompt: 'Be concise.',
      messages: [{ role: 'user', content: 'What is IV?' }],
    });
    await streamMessage(opts);
    expect(mockStreamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Be concise.',
        messages: [{ role: 'user', content: 'What is IV?' }],
      }),
      expect.anything(),
    );
  });

  it('uses default model and maxTokens when not specified', async () => {
    await streamMessage(makeOptions());
    expect(mockStreamFn).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6', max_tokens: 4096 }),
      expect.anything(),
    );
  });

  it('respects custom model and maxTokens', async () => {
    await streamMessage(makeOptions({ model: 'claude-haiku-4-5-20251001', maxTokens: 1024 }));
    expect(mockStreamFn).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024 }),
      expect.anything(),
    );
  });

  it('handles AbortError silently — does not call onError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockStreamFn.mockImplementationOnce(() => {
      throw abortError;
    });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).not.toHaveBeenCalled();
    expect(opts.onComplete).not.toHaveBeenCalled();
  });

  it('calls onError with code "auth" for AuthenticationError', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockAuthError(); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'auth' }),
    );
  });

  it('calls onError with code "rate_limit" and retryAfterMs for RateLimitError', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockRateLimitError('60'); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'rate_limit', retryAfterMs: 60_000 }),
    );
  });

  it('calls onError with code "timeout" for APIConnectionTimeoutError', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockTimeoutError(); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'timeout' }),
    );
  });

  it('calls onError with code "connection" for APIConnectionError', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockConnectionError(); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'connection' }),
    );
  });

  it('calls onError with code "api" for APIError', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockAPIError(503); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'api', message: expect.stringContaining('503') }),
    );
  });

  it('calls onError with code "unknown" for generic Error', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new Error('Something broke'); });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown', message: 'Something broke' }),
    );
  });

  it('calls onError with code "unknown" for non-Error throws', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw 'string error'; });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown', message: 'string error' }),
    );
  });

  it('throws chatError when onError is not provided', async () => {
    mockStreamFn.mockImplementationOnce(() => { throw new MockAuthError(); });
    const opts = makeOptions({ onError: undefined });
    await expect(streamMessage(opts)).rejects.toMatchObject({ code: 'auth' });
  });

  it('uses default retryAfterMs of 60000 when rate limit header is missing', async () => {
    const err = new MockRateLimitError('');
    // Override headers to be empty
    (err as unknown as { headers: Record<string, string> }).headers = {};
    mockStreamFn.mockImplementationOnce(() => { throw err; });
    const opts = makeOptions();
    await streamMessage(opts);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'rate_limit', retryAfterMs: 60_000 }),
    );
  });
});

// ── validateApiKey ────────────────────────────────────────────────────────

describe('validateApiKey', () => {
  const savedEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv, ANTHROPIC_API_KEY: 'test-key-abc' };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('returns true when API call succeeds', async () => {
    mockCreateFn.mockResolvedValueOnce({ id: 'msg_test' });
    expect(await validateApiKey()).toBe(true);
  });

  it('returns false for AuthenticationError', async () => {
    mockCreateFn.mockRejectedValueOnce(new MockAuthError());
    expect(await validateApiKey()).toBe(false);
  });

  it('returns false for APIConnectionError', async () => {
    mockCreateFn.mockRejectedValueOnce(new MockConnectionError());
    expect(await validateApiKey()).toBe(false);
  });

  it('returns false for APIConnectionTimeoutError', async () => {
    mockCreateFn.mockRejectedValueOnce(new MockTimeoutError());
    expect(await validateApiKey()).toBe(false);
  });

  it('returns true for RateLimitError (key is valid, just rate limited)', async () => {
    mockCreateFn.mockRejectedValueOnce(new MockRateLimitError());
    expect(await validateApiKey()).toBe(true);
  });

  it('returns false for any other error', async () => {
    mockCreateFn.mockRejectedValueOnce(new Error('Unexpected'));
    expect(await validateApiKey()).toBe(false);
  });
});
