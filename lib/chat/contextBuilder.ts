/**
 * Context builder for the Claude AI chat feature.
 * Fetches financial data from the database and formats it into
 * a markdown context string for Claude's system prompt.
 */

import type { Database } from 'better-sqlite3';

// Hardcoded watchlist for MVP — future: user-specific
const WATCHLIST = ['SPWX', 'SPY', 'IWM'] as const;

interface SnapshotRow {
  ticker: string;
  date: string;
  iv_30d: number | null;
  iv_60d: number | null;
  hv_20d: number | null;
  regime: string | null;
  net_delta: number | null;
  atm_gamma: number | null;
  theta_daily: number | null;
  skew_ratio: number | null;
}

interface ProjectionRow {
  ticker: string;
  horizon_days: number;
  prob_distribution: string;
  key_levels: string;
  regime_classification: string | null;
}

interface ForecastRow {
  ticker: string;
  outlook: string | null;
  pt_base: number | null;
  pt_conservative: number | null;
  pt_aggressive: number | null;
  regime_classification: string | null;
  summary: string | null;
}

interface KeyLevelData {
  support?: number;
  resistance?: number;
  [key: string]: number | undefined;
}

/**
 * Queries the latest option snapshots, projections, AI forecasts, and watchlist
 * data from the database and returns a markdown-formatted context string for
 * injection into Claude's system prompt.
 */
export async function buildContext(db: Database): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const placeholders = WATCHLIST.map(() => '?').join(',');

  // Fetch latest option snapshots for watchlist tickers
  const snapshots = db.prepare(`
    SELECT ticker, date, iv_30d, iv_60d, hv_20d, regime, net_delta, atm_gamma, theta_daily, skew_ratio
    FROM option_snapshots
    WHERE ticker IN (${placeholders})
      AND date = (SELECT MAX(date) FROM option_snapshots WHERE ticker = option_snapshots.ticker)
  `).all(...WATCHLIST) as SnapshotRow[];

  // Fetch latest projections for watchlist tickers
  const projections = db.prepare(`
    SELECT ticker, horizon_days, prob_distribution, key_levels, regime_classification
    FROM option_projections
    WHERE ticker IN (${placeholders})
      AND date = (SELECT MAX(date) FROM option_projections WHERE ticker = option_projections.ticker)
  `).all(...WATCHLIST) as ProjectionRow[];

  // Fetch AI forecasts — table may not exist if migration hasn't run
  let forecasts: ForecastRow[] = [];
  try {
    forecasts = db.prepare(`
      SELECT ticker, outlook, pt_base, pt_conservative, pt_aggressive, regime_classification, summary
      FROM ai_forecasts
      WHERE ticker IN (${placeholders})
        AND date = (SELECT MAX(date) FROM ai_forecasts WHERE ticker = ai_forecasts.ticker)
    `).all(...WATCHLIST) as ForecastRow[];
  } catch {
    // ai_forecasts table may not yet exist — silently skip
  }

  // ── Format context as markdown ────────────────────────────────────────────

  let context = `\n\n--- CURRENT MARKET STATE (as of ${today}) ---\n\n`;

  context += `**User's Watchlist:** ${WATCHLIST.join(', ')}\n\n`;

  if (snapshots.length > 0) {
    context += `**Options Snapshot:**\n`;
    for (const s of snapshots) {
      const iv30 = s.iv_30d != null ? `${s.iv_30d.toFixed(1)}%` : 'N/A';
      const hv20 = s.hv_20d != null ? `${s.hv_20d.toFixed(1)}%` : 'N/A';
      const regime = s.regime ?? 'N/A';
      const delta = s.net_delta != null ? s.net_delta.toFixed(3) : 'N/A';
      const gamma = s.atm_gamma != null ? s.atm_gamma.toFixed(4) : 'N/A';
      const skew = s.skew_ratio != null ? s.skew_ratio.toFixed(3) : 'N/A';
      context += `- **${s.ticker}**: IV 30d=${iv30}, HV 20d=${hv20}, Regime=${regime}, Delta=${delta}, Gamma=${gamma}, Skew=${skew}\n`;
    }
    context += `\n`;
  }

  if (forecasts.length > 0) {
    context += `**AI Forecasts:**\n`;
    for (const f of forecasts) {
      const outlook = f.outlook ?? 'N/A';
      const target = f.pt_base != null ? `$${f.pt_base.toFixed(2)}` : 'N/A';
      const regime = f.regime_classification ?? 'N/A';
      context += `- **${f.ticker}**: Outlook=${outlook}, Target=${target}, Regime=${regime}\n`;
      if (f.summary) {
        context += `  Summary: ${f.summary}\n`;
      }
    }
    context += `\n`;
  }

  if (projections.length > 0) {
    context += `**Probability Distributions:**\n`;
    for (const p of projections) {
      let levelsText = '';
      try {
        const levels = JSON.parse(p.key_levels) as KeyLevelData;
        const support = levels.support != null ? `$${levels.support.toFixed(2)}` : 'N/A';
        const resistance = levels.resistance != null ? `$${levels.resistance.toFixed(2)}` : 'N/A';
        levelsText = `Support=${support}, Resistance=${resistance}`;
      } catch {
        levelsText = 'Levels unavailable';
      }

      let distText = '';
      try {
        const dist = JSON.parse(p.prob_distribution) as unknown;
        distText = JSON.stringify(dist);
      } catch {
        distText = 'N/A';
      }

      context += `- **${p.ticker}** (${p.horizon_days}-day): ${levelsText}\n`;
      context += `  Probabilities: ${distText}\n`;
    }
    context += `\n`;
  }

  context += `--- END MARKET STATE ---\n`;

  return context;
}

/**
 * Builds the full system prompt by combining the base guidelines with
 * dynamically fetched market context.
 */
export async function buildSystemPrompt(db: Database): Promise<string> {
  const marketContext = await buildContext(db);
  return BASE_SYSTEM_PROMPT + marketContext;
}

export const BASE_SYSTEM_PROMPT = `You are an expert financial analyst specializing in derivatives and volatility analysis.

You're embedded in a financial analysis app where users manage options positions.

**CRITICAL GUIDELINES:**
1. Always reference specific data from the market state context provided
2. Be precise with numbers; if uncertain, say so explicitly
3. Provide actionable recommendations with clear rationale
4. Include risk assessment for any strategy you suggest
5. Format numbers clearly: use currency symbols ($), percentages (%), and 2 decimal precision
6. Support markdown formatting: **bold**, *italics*, bullet lists, code blocks
7. When discussing probabilities, always cite the source data
8. Disclaimer: You are providing analysis for educational purposes only, not financial advice

**RESPONSE STYLE:**
- Conversational but precise
- Start with direct answer, then explain
- Use bullet points for multi-item responses
- Highlight key metrics in **bold**
- Keep responses under 300 words unless detailed analysis requested
`;
