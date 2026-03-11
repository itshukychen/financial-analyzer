import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, logWarning, getUserFriendlyMessage } from '@/lib/errorLogger';

describe('logError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the error message to console.error', () => {
    logError(new Error('boom'));
    expect(console.error).toHaveBeenCalledWith(
      '[FinAnalyzer Error]',
      'boom',
      '',
    );
  });

  it('logs context alongside the message', () => {
    logError(new Error('ctx error'), { route: '/api/chat' });
    expect(console.error).toHaveBeenCalledWith(
      '[FinAnalyzer Error]',
      'ctx error',
      { route: '/api/chat' },
    );
  });

  it('handles non-Error values', () => {
    logError('plain string error');
    expect(console.error).toHaveBeenCalledWith(
      '[FinAnalyzer Error]',
      'plain string error',
      '',
    );
  });
});

describe('logWarning', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs to console.warn', () => {
    logWarning('something suspicious');
    expect(console.warn).toHaveBeenCalledWith(
      '[FinAnalyzer Warning]',
      'something suspicious',
      '',
    );
  });

  it('includes context in the warn output', () => {
    logWarning('rate limit near', { action: 'sendMessage' });
    expect(console.warn).toHaveBeenCalledWith(
      '[FinAnalyzer Warning]',
      'rate limit near',
      { action: 'sendMessage' },
    );
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns cancel message for AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(getUserFriendlyMessage(err)).toBe('Request was cancelled.');
  });

  it('returns rate-limit message for errors mentioning "rate limit"', () => {
    expect(getUserFriendlyMessage(new Error('rate limit exceeded'))).toContain(
      'Too many requests',
    );
  });

  it('returns rate-limit message for errors mentioning "429"', () => {
    expect(getUserFriendlyMessage(new Error('Status 429'))).toContain(
      'Too many requests',
    );
  });

  it('returns rate-limit message for errors mentioning "too many"', () => {
    expect(getUserFriendlyMessage(new Error('too many requests'))).toContain(
      'Too many requests',
    );
  });

  it('returns timeout message for errors mentioning "timeout"', () => {
    expect(getUserFriendlyMessage(new Error('Request timeout'))).toContain(
      'timed out',
    );
  });

  it('returns timeout message for errors mentioning "timed out"', () => {
    expect(getUserFriendlyMessage(new Error('connection timed out'))).toContain(
      'timed out',
    );
  });

  it('returns network message for errors mentioning "fetch"', () => {
    expect(getUserFriendlyMessage(new Error('Failed to fetch'))).toContain(
      'Network error',
    );
  });

  it('returns network message for errors mentioning "network"', () => {
    expect(getUserFriendlyMessage(new Error('network unavailable'))).toContain(
      'Network error',
    );
  });

  it('returns rate-limit for object with status 429', () => {
    expect(getUserFriendlyMessage({ status: 429 })).toContain('Too many requests');
  });

  it('returns timeout for object with status 504', () => {
    expect(getUserFriendlyMessage({ status: 504 })).toContain('timed out');
  });

  it('returns server error for object with status 500', () => {
    expect(getUserFriendlyMessage({ status: 500 })).toContain('temporarily unavailable');
  });

  it('returns generic message for unknown errors', () => {
    expect(getUserFriendlyMessage(new Error('unexpected situation'))).toContain(
      'temporarily unavailable',
    );
  });

  it('handles non-Error non-object gracefully', () => {
    expect(getUserFriendlyMessage(null)).toContain('temporarily unavailable');
    expect(getUserFriendlyMessage(42)).toContain('temporarily unavailable');
  });
});
