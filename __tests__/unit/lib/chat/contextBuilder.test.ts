/**
 * Tests for: lib/chat/contextBuilder.ts
 *
 * Coverage:
 * - buildContext returns markdown string with correct structure
 * - Includes all watchlist tickers (SPWX, SPY, IWM)
 * - Formats option snapshots correctly (IV, regime, delta, gamma, skew)
 * - Formats AI forecasts correctly (outlook, target, regime, summary)
 * - Formats projections with key levels and probabilities
 * - Handles empty database gracefully (no crash)
 * - Handles null numeric fields with N/A
 * - Silently skips ai_forecasts table if query throws
 * - Handles malformed JSON in key_levels/prob_distribution
 * - buildSystemPrompt includes BASE_SYSTEM_PROMPT + market context
 * - BASE_SYSTEM_PROMPT is a non-empty string with key guidelines
 */
import { describe, it, expect, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { buildContext, buildSystemPrompt, BASE_SYSTEM_PROMPT } from '@/lib/chat/contextBuilder';

// ── Test helpers ──────────────────────────────────────────────────────────

interface MockDbOptions {
  snapshots?: object[];
  projections?: object[];
  forecasts?: object[] | 'throw';
}

function makeDb({ snapshots = [], projections = [], forecasts = [] }: MockDbOptions = {}): Database {
  const normalStatement = {
    all: vi.fn()
      .mockReturnValueOnce(snapshots)
      .mockReturnValueOnce(projections),
  };

  if (forecasts === 'throw') {
    const throwingStatement = { all: vi.fn().mockImplementation(() => { throw new Error('no such table: ai_forecasts'); }) };
    let callCount = 0;
    return {
      prepare: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount <= 2 ? normalStatement : throwingStatement;
      }),
    } as unknown as Database;
  }

  normalStatement.all.mockReturnValueOnce(forecasts);
  return {
    prepare: vi.fn().mockReturnValue(normalStatement),
  } as unknown as Database;
}

const SAMPLE_SNAPSHOT = {
  ticker: 'SPWX',
  date: '2026-03-10',
  iv_30d: 25.5,
  iv_60d: 27.0,
  hv_20d: 22.3,
  regime: 'elevated',
  net_delta: -0.125,
  atm_gamma: 0.0032,
  theta_daily: -15.5,
  skew_ratio: 1.05,
};

const SAMPLE_PROJECTION = {
  ticker: 'SPWX',
  horizon_days: 30,
  prob_distribution: JSON.stringify({ up: 0.45, down: 0.35, flat: 0.20 }),
  key_levels: JSON.stringify({ support: 540.0, resistance: 560.0 }),
  regime_classification: 'elevated',
};

const SAMPLE_FORECAST = {
  ticker: 'SPWX',
  outlook: 'bullish',
  pt_base: 555.0,
  pt_conservative: 545.0,
  pt_aggressive: 570.0,
  regime_classification: 'elevated',
  summary: 'Strong momentum with elevated IV.',
};

// ── buildContext ─────────────────────────────────────────────────────────

describe('buildContext', () => {
  it('returns a string', async () => {
    const context = await buildContext(makeDb());
    expect(typeof context).toBe('string');
  });

  it('includes CURRENT MARKET STATE markers', async () => {
    const context = await buildContext(makeDb());
    expect(context).toContain('CURRENT MARKET STATE');
    expect(context).toContain('END MARKET STATE');
  });

  it('includes all watchlist tickers in header', async () => {
    const context = await buildContext(makeDb());
    expect(context).toContain('SPWX');
    expect(context).toContain('SPY');
    expect(context).toContain('IWM');
  });

  it('handles empty database gracefully without throwing', async () => {
    const db = makeDb();
    await expect(buildContext(db)).resolves.toContain('CURRENT MARKET STATE');
  });

  it('formats option snapshots with IV, HV, regime, delta, gamma, skew', async () => {
    const context = await buildContext(makeDb({ snapshots: [SAMPLE_SNAPSHOT] }));
    expect(context).toContain('Options Snapshot');
    expect(context).toContain('SPWX');
    expect(context).toContain('25.5%');  // iv_30d
    expect(context).toContain('22.3%');  // hv_20d
    expect(context).toContain('elevated'); // regime
    expect(context).toContain('-0.125');   // net_delta
    expect(context).toContain('0.0032');   // atm_gamma
    expect(context).toContain('1.050');    // skew_ratio
  });

  it('shows N/A for null numeric fields in snapshots', async () => {
    const nullSnapshot = { ...SAMPLE_SNAPSHOT, iv_30d: null, hv_20d: null, net_delta: null, atm_gamma: null, skew_ratio: null, regime: null };
    const context = await buildContext(makeDb({ snapshots: [nullSnapshot] }));
    expect(context).toContain('N/A');
  });

  it('formats AI forecasts with outlook, target price, regime and summary', async () => {
    const context = await buildContext(makeDb({ forecasts: [SAMPLE_FORECAST] }));
    expect(context).toContain('AI Forecasts');
    expect(context).toContain('SPWX');
    expect(context).toContain('bullish');           // outlook
    expect(context).toContain('$555.00');           // pt_base
    expect(context).toContain('elevated');           // regime_classification
    expect(context).toContain('Strong momentum');   // summary
  });

  it('skips summary line when forecast summary is null', async () => {
    const noSummary = { ...SAMPLE_FORECAST, summary: null };
    const context = await buildContext(makeDb({ forecasts: [noSummary] }));
    expect(context).toContain('AI Forecasts');
    expect(context).not.toContain('Strong momentum');
  });

  it('shows N/A for null forecast numeric fields', async () => {
    const nullForecast = { ...SAMPLE_FORECAST, pt_base: null, outlook: null, regime_classification: null };
    const context = await buildContext(makeDb({ forecasts: [nullForecast] }));
    expect(context).toContain('N/A');
  });

  it('formats projections with key levels', async () => {
    const context = await buildContext(makeDb({ projections: [SAMPLE_PROJECTION] }));
    expect(context).toContain('Probability Distributions');
    expect(context).toContain('SPWX');
    expect(context).toContain('$540.00');  // support
    expect(context).toContain('$560.00');  // resistance
    expect(context).toContain('30-day');   // horizon_days
  });

  it('includes probability distribution JSON in projection output', async () => {
    const context = await buildContext(makeDb({ projections: [SAMPLE_PROJECTION] }));
    expect(context).toContain('Probabilities');
    expect(context).toContain('0.45');
  });

  it('shows "Levels unavailable" for malformed key_levels JSON', async () => {
    const badLevels = { ...SAMPLE_PROJECTION, key_levels: 'not-valid-json' };
    const context = await buildContext(makeDb({ projections: [badLevels] }));
    expect(context).toContain('Levels unavailable');
  });

  it('handles malformed prob_distribution JSON gracefully', async () => {
    const badDist = { ...SAMPLE_PROJECTION, prob_distribution: '{bad}' };
    const context = await buildContext(makeDb({ projections: [badDist] }));
    // Should render something for distribution, even if N/A
    expect(typeof context).toBe('string');
  });

  it('silently skips ai_forecasts section when table query throws', async () => {
    const db = makeDb({ forecasts: 'throw' });
    const context = await buildContext(db);
    // No error, and no AI Forecasts section
    expect(context).toContain('CURRENT MARKET STATE');
    expect(context).not.toContain('AI Forecasts');
  });

  it('does not include Options Snapshot section when no snapshots', async () => {
    const context = await buildContext(makeDb({ snapshots: [] }));
    expect(context).not.toContain('Options Snapshot');
  });

  it('does not include Probability Distributions section when no projections', async () => {
    const context = await buildContext(makeDb({ projections: [] }));
    expect(context).not.toContain('Probability Distributions');
  });

  it('does not include AI Forecasts section when no forecasts', async () => {
    const context = await buildContext(makeDb({ forecasts: [] }));
    expect(context).not.toContain('AI Forecasts');
  });
});

// ── buildSystemPrompt ────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('returns a string containing the base system prompt', async () => {
    const prompt = await buildSystemPrompt(makeDb());
    expect(prompt).toContain('expert financial analyst');
  });

  it('appends market context to the base system prompt', async () => {
    const prompt = await buildSystemPrompt(makeDb());
    expect(prompt).toContain('CURRENT MARKET STATE');
  });

  it('includes CRITICAL GUIDELINES section', async () => {
    const prompt = await buildSystemPrompt(makeDb());
    expect(prompt).toContain('CRITICAL GUIDELINES');
  });
});

// ── BASE_SYSTEM_PROMPT ───────────────────────────────────────────────────

describe('BASE_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof BASE_SYSTEM_PROMPT).toBe('string');
    expect(BASE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('contains CRITICAL GUIDELINES section', () => {
    expect(BASE_SYSTEM_PROMPT).toContain('CRITICAL GUIDELINES');
  });

  it('contains RESPONSE STYLE section', () => {
    expect(BASE_SYSTEM_PROMPT).toContain('RESPONSE STYLE');
  });

  it('includes disclaimer about educational purposes', () => {
    expect(BASE_SYSTEM_PROMPT).toContain('educational purposes');
  });
});
