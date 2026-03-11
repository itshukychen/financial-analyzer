/**
 * Centralized error logging utility.
 *
 * Console-logs all errors for debugging.
 * Includes a Sentry placeholder — swap the stub below with the real SDK
 * once @sentry/nextjs is installed:
 *
 *   import * as Sentry from '@sentry/nextjs';
 */

export interface ErrorContext {
  route?: string;
  action?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Sentry stub — replace with the real import when ready
// ---------------------------------------------------------------------------
const Sentry = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  captureException: (_err: unknown, _ctx?: object): void => { /* noop */ },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  captureMessage: (_msg: string, _ctx?: object): void => { /* noop */ },
};
// ---------------------------------------------------------------------------

/**
 * Log an error to the console and (eventually) Sentry.
 */
export function logError(err: unknown, context?: ErrorContext): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[FinAnalyzer Error]', message, context ?? '');
  // TODO: Remove the stub above and uncomment once Sentry is configured:
  // Sentry.captureException(err, { extra: context });
  Sentry.captureException(err, { extra: context });
}

/**
 * Log a warning (non-fatal) to the console and (eventually) Sentry.
 */
export function logWarning(message: string, context?: ErrorContext): void {
  console.warn('[FinAnalyzer Warning]', message, context ?? '');
  Sentry.captureMessage(message, { extra: context });
}

/**
 * Map a raw error to a user-friendly message string.
 *
 * Rules (applied in order):
 *  - AbortError            → "Request was cancelled."
 *  - 429 / rate-limit      → ask to wait
 *  - timeout               → suggest retry
 *  - network / fetch error → check connection
 *  - anything else         → generic "temporarily unavailable"
 */
export function getUserFriendlyMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Request was cancelled.';
    }
    const msg = err.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'The request timed out. Please try again.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
  }
  // Check for HTTP response objects forwarded as plain Error payloads
  if (typeof err === 'object' && err !== null) {
    const asRecord = err as Record<string, unknown>;
    const status = asRecord['status'];
    if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
    if (status === 504 || status === 408) return 'The request timed out. Please try again.';
    if (typeof status === 'number' && status >= 500) {
      return 'Service temporarily unavailable. Please try again later.';
    }
  }
  return 'Service temporarily unavailable. Please try again.';
}
