// ─── Rate Limiter and Cost Tracker ───────────────────────────────────────────
// In-memory sliding window rate limiter for Claude chat API.
// Tracks message timestamps per user and enforces hourly limits.
// Also aggregates token usage for cost tracking.

const MESSAGE_LIMIT_PER_HOUR = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;
const WEEK_MS = 7  * DAY_MS;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:            boolean;
  remaining:          number;
  retryAfterSeconds?: number;
}

export interface TokenUsageSummary {
  messages:      number;
  inputTokens:   number;
  outputTokens:  number;
  totalTokens:   number;
}

export interface TokenUsageStats {
  daily:  TokenUsageSummary;
  weekly: TokenUsageSummary;
}

interface TokenUsageEntry {
  timestamp:    number;
  inputTokens:  number;
  outputTokens: number;
  totalTokens:  number;
}

// ─── In-memory stores ─────────────────────────────────────────────────────────

const messageTimestamps: Map<string, number[]>           = new Map();
const tokenUsageStore:   Map<string, TokenUsageEntry[]>  = new Map();

// ─── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Checks whether the user is within their hourly message limit.
 * Uses a sliding window algorithm — counts only messages sent in the past hour.
 * Does NOT record a new message; call `recordMessage` after allowing the request.
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const now         = Date.now();
  const windowStart = now - HOUR_MS;

  // Prune entries outside the sliding window
  const raw        = messageTimestamps.get(userId) ?? [];
  const timestamps = raw.filter(ts => ts > windowStart);
  messageTimestamps.set(userId, timestamps);

  if (timestamps.length >= MESSAGE_LIMIT_PER_HOUR) {
    // Oldest timestamp in the window tells us when capacity next frees up
    const oldestInWindow    = Math.min(...timestamps);
    const retryAfterMs      = oldestInWindow + HOUR_MS - now;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed:   true,
    remaining: MESSAGE_LIMIT_PER_HOUR - timestamps.length,
  };
}

/**
 * Records a message timestamp for the user.
 * Call this immediately after confirming `checkRateLimit` returned `allowed: true`.
 */
export function recordMessage(userId: string): void {
  const timestamps = messageTimestamps.get(userId) ?? [];
  timestamps.push(Date.now());
  messageTimestamps.set(userId, timestamps);
}

// ─── Token / cost tracking ────────────────────────────────────────────────────

/**
 * Logs token usage for a single Claude API response.
 * Persists in-memory for the lifetime of the process; writes a structured log line.
 */
export function trackTokenUsage(
  userId:       string,
  inputTokens:  number,
  outputTokens: number,
): void {
  const totalTokens = inputTokens + outputTokens;
  const entry: TokenUsageEntry = {
    timestamp: Date.now(),
    inputTokens,
    outputTokens,
    totalTokens,
  };

  const entries = tokenUsageStore.get(userId) ?? [];
  entries.push(entry);
  tokenUsageStore.set(userId, entries);

  console.log(
    `[chat:tokens] userId=${userId} input=${inputTokens} output=${outputTokens} total=${totalTokens}`,
  );
}

/**
 * Returns aggregated token usage stats for a user over the past day and week.
 */
export function getTokenUsageStats(userId: string): TokenUsageStats {
  const now       = Date.now();
  const dayStart  = now - DAY_MS;
  const weekStart = now - WEEK_MS;

  const entries = tokenUsageStore.get(userId) ?? [];

  return {
    daily:  summarize(entries.filter(e => e.timestamp > dayStart)),
    weekly: summarize(entries.filter(e => e.timestamp > weekStart)),
  };
}

function summarize(entries: TokenUsageEntry[]): TokenUsageSummary {
  return {
    messages:     entries.length,
    inputTokens:  entries.reduce((sum, e) => sum + e.inputTokens,  0),
    outputTokens: entries.reduce((sum, e) => sum + e.outputTokens, 0),
    totalTokens:  entries.reduce((sum, e) => sum + e.totalTokens,  0),
  };
}

// ─── Test helpers (exported for unit tests only) ──────────────────────────────

/** Clears all in-memory state. For use in tests only. */
export function _resetForTesting(): void {
  messageTimestamps.clear();
  tokenUsageStore.clear();
}

/** Returns the raw message timestamps map. For use in tests only. */
export function _getMessageTimestamps(): Map<string, number[]> {
  return messageTimestamps;
}
