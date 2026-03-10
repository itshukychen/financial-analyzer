// app/lib/rate-limiter.ts

interface RateLimitConfig {
  perSession: {
    maxRequests: number;
    windowMs: number;
  };
  perIP: {
    maxRequests: number;
    windowMs: number;
  };
}

const config: RateLimitConfig = {
  perSession: {
    maxRequests: 1,
    windowMs: 2000,         // 2 seconds
  },
  perIP: {
    maxRequests: 100,
    windowMs: 3600000,      // 1 hour
  },
};

class RateLimiter {
  private sessionRequests = new Map<string, number[]>();
  private ipRequests = new Map<string, number[]>();

  checkLimit(sessionId: string, ip: string): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const now = Date.now();

    // Check session limit
    const sessionTimes = this.sessionRequests.get(sessionId) || [];
    const recentSessionRequests = sessionTimes.filter(
      t => now - t < config.perSession.windowMs
    );

    if (recentSessionRequests.length >= config.perSession.maxRequests) {
      const oldestRequest = Math.min(...recentSessionRequests);
      const retryAfter = Math.ceil((config.perSession.windowMs - (now - oldestRequest)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Check IP limit
    const ipTimes = this.ipRequests.get(ip) || [];
    const recentIPRequests = ipTimes.filter(
      t => now - t < config.perIP.windowMs
    );

    if (recentIPRequests.length >= config.perIP.maxRequests) {
      const oldestRequest = Math.min(...recentIPRequests);
      const retryAfter = Math.ceil((config.perIP.windowMs - (now - oldestRequest)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Allow request and record timestamp
    this.sessionRequests.set(sessionId, [...recentSessionRequests, now]);
    this.ipRequests.set(ip, [...recentIPRequests, now]);

    // Cleanup old entries
    this.cleanup();

    return { allowed: true };
  }

  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(config.perSession.windowMs, config.perIP.windowMs);

    // Clean session requests
    for (const [key, times] of this.sessionRequests.entries()) {
      const recent = times.filter(t => now - t < maxWindow);
      if (recent.length === 0) {
        this.sessionRequests.delete(key);
      } else {
        this.sessionRequests.set(key, recent);
      }
    }

    // Clean IP requests
    for (const [key, times] of this.ipRequests.entries()) {
      const recent = times.filter(t => now - t < maxWindow);
      if (recent.length === 0) {
        this.ipRequests.delete(key);
      } else {
        this.ipRequests.set(key, recent);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
