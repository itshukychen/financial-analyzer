// app/lib/__tests__/rate-limiter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset rate limiter state by clearing maps
    (rateLimiter as any).sessionRequests.clear();
    (rateLimiter as any).ipRequests.clear();
  });

  it('allows first request', () => {
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('blocks second request within 2 seconds', () => {
    rateLimiter.checkLimit('session1', '1.1.1.1');
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(2);
  });

  it('allows request after 2 seconds', async () => {
    vi.useFakeTimers();
    
    rateLimiter.checkLimit('session1', '1.1.1.1');
    
    vi.advanceTimersByTime(2100); // 2.1 seconds
    
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    expect(result.allowed).toBe(true);
    
    vi.useRealTimers();
  });

  it('tracks different sessions independently', () => {
    rateLimiter.checkLimit('session1', '1.1.1.1');
    const result = rateLimiter.checkLimit('session2', '1.1.1.1');
    
    expect(result.allowed).toBe(true);
  });

  it('blocks IP after 100 requests', () => {
    for (let i = 0; i < 100; i++) {
      rateLimiter.checkLimit(`session${i}`, '1.1.1.1');
    }
    
    const result = rateLimiter.checkLimit('session101', '1.1.1.1');
    expect(result.allowed).toBe(false);
  });

  it('cleans up old entries', () => {
    vi.useFakeTimers();
    
    rateLimiter.checkLimit('session1', '1.1.1.1');
    
    vi.advanceTimersByTime(3600000 + 1000); // 1 hour + 1 second
    
    // Trigger cleanup by making new request
    rateLimiter.checkLimit('session2', '2.2.2.2');
    
    // Old session should be cleaned up
    const map = (rateLimiter as any).sessionRequests;
    expect(map.has('session1')).toBe(false);
    
    vi.useRealTimers();
  });
});
