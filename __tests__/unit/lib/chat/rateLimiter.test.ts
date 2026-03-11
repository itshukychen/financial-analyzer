import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  recordMessage,
  trackTokenUsage,
  getTokenUsageStats,
  _resetForTesting,
  _getMessageTimestamps,
} from '@/lib/chat/rateLimiter';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows the first message for a new user', () => {
    const result = checkRateLimit('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it('remaining decreases as messages are recorded', () => {
    const before = checkRateLimit('user-1').remaining;
    recordMessage('user-1');
    const after = checkRateLimit('user-1').remaining;
    expect(after).toBe(before - 1);
  });

  it('blocks user after limit is reached', () => {
    const limit = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);
    const timestamps = _getMessageTimestamps();
    // Inject exactly `limit` timestamps within the current sliding window
    const now = Date.now();
    timestamps.set('user-2', Array.from({ length: limit }, (_, i) => now - i * 1000));

    const result = checkRateLimit('user-2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('prunes timestamps older than one hour', () => {
    const limit = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    // Inject limit timestamps that are all >1 hour old (outside the window)
    const oldTimestamps = Array.from({ length: limit }, (_, i) => now - hourMs - 1000 - i);
    _getMessageTimestamps().set('user-3', oldTimestamps);

    // Should be allowed because old timestamps are pruned
    const result = checkRateLimit('user-3');
    expect(result.allowed).toBe(true);
  });

  it('retryAfterSeconds is positive when rate limited', () => {
    const limit = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);
    const now = Date.now();
    // All at exactly 30 minutes ago — still within the window
    const timestamps = Array.from({ length: limit }, () => now - 30 * 60 * 1000);
    _getMessageTimestamps().set('user-4', timestamps);

    const result = checkRateLimit('user-4');
    expect(result.allowed).toBe(false);
    // Retry should be ~30 minutes (1800 seconds) from now
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30 * 60 + 1);
  });
});

// ─── recordMessage ────────────────────────────────────────────────────────────

describe('recordMessage', () => {
  it('adds a timestamp entry for the user', () => {
    recordMessage('user-5');
    const timestamps = _getMessageTimestamps().get('user-5') ?? [];
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]).toBeCloseTo(Date.now(), -2); // within ~100ms
  });

  it('accumulates timestamps on repeated calls', () => {
    recordMessage('user-6');
    recordMessage('user-6');
    recordMessage('user-6');
    expect(_getMessageTimestamps().get('user-6')).toHaveLength(3);
  });

  it('independently tracks separate users', () => {
    recordMessage('user-a');
    recordMessage('user-b');
    recordMessage('user-b');
    expect(_getMessageTimestamps().get('user-a')).toHaveLength(1);
    expect(_getMessageTimestamps().get('user-b')).toHaveLength(2);
  });
});

// ─── trackTokenUsage ──────────────────────────────────────────────────────────

describe('trackTokenUsage', () => {
  it('logs a structured line to console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    trackTokenUsage('user-7', 100, 250);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-7'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('input=100'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('output=250'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('total=350'));
  });

  it('does not throw on zero tokens', () => {
    expect(() => trackTokenUsage('user-8', 0, 0)).not.toThrow();
  });
});

// ─── getTokenUsageStats ───────────────────────────────────────────────────────

describe('getTokenUsageStats', () => {
  it('returns zeroes for a user with no usage', () => {
    const stats = getTokenUsageStats('user-new');
    expect(stats.daily.messages).toBe(0);
    expect(stats.daily.totalTokens).toBe(0);
    expect(stats.weekly.messages).toBe(0);
    expect(stats.weekly.totalTokens).toBe(0);
  });

  it('aggregates tokens correctly for recent messages', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    trackTokenUsage('user-9', 100, 200);
    trackTokenUsage('user-9', 50,  150);

    const stats = getTokenUsageStats('user-9');
    expect(stats.daily.messages).toBe(2);
    expect(stats.daily.inputTokens).toBe(150);
    expect(stats.daily.outputTokens).toBe(350);
    expect(stats.daily.totalTokens).toBe(500);
    // Weekly should include daily entries too
    expect(stats.weekly.messages).toBe(2);
    expect(stats.weekly.totalTokens).toBe(500);
  });

  it('excludes entries older than a day from daily stats', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Directly write an old entry into the store by injecting via recordMessage/track pattern
    // We use the Date.now mock to simulate an old message
    const realDateNow = Date.now;
    const twoDaysAgo = realDateNow() - 2 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(twoDaysAgo);
    trackTokenUsage('user-10', 500, 1000);

    // Restore and add a recent one
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    trackTokenUsage('user-10', 10, 20);

    const stats = getTokenUsageStats('user-10');
    // Daily: only the recent entry
    expect(stats.daily.messages).toBe(1);
    expect(stats.daily.totalTokens).toBe(30);
    // Weekly: both entries (old one was 2 days ago, within 7 days)
    expect(stats.weekly.messages).toBe(2);
    expect(stats.weekly.totalTokens).toBe(1530);
  });

  it('excludes entries older than a week from weekly stats', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const realDateNow = Date.now;
    const eightDaysAgo = realDateNow() - 8 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(eightDaysAgo);
    trackTokenUsage('user-11', 1000, 2000);

    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    trackTokenUsage('user-11', 5, 10);

    const stats = getTokenUsageStats('user-11');
    expect(stats.weekly.messages).toBe(1);
    expect(stats.weekly.totalTokens).toBe(15);
  });
});

// ─── _resetForTesting ─────────────────────────────────────────────────────────

describe('_resetForTesting', () => {
  it('clears all state', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    recordMessage('user-reset');
    trackTokenUsage('user-reset', 10, 20);

    _resetForTesting();

    expect(_getMessageTimestamps().size).toBe(0);
    expect(getTokenUsageStats('user-reset').daily.messages).toBe(0);
  });
});
