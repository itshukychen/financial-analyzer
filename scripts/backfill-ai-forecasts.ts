// scripts/backfill-ai-forecasts.ts

import { generateAIAnalysis } from '../lib/aiOptionsForecast';
import { getOptionSnapshot, getOptionProjection } from '../lib/db';
import type { OptionAnalysisContext } from '../lib/types/aiOptionsForecast';

async function buildContext(
  ticker: string,
  date: string,
  snapshot: Record<string, unknown>,
  projection: Record<string, unknown>
): Promise<OptionAnalysisContext> {
  return {
    ticker,
    date,
    snapshotMetrics: {
      iv: snapshot.iv_30d || 30,
      ivPercentile: snapshot.iv_rank || 50,
      delta: snapshot.net_delta ? [snapshot.net_delta] : [0.5],
      gamma: snapshot.atm_gamma ? [snapshot.atm_gamma] : [0.03],
      vega: snapshot.vega_per_1pct ? [snapshot.vega_per_1pct] : [0.1],
      theta: snapshot.theta_daily ? [snapshot.theta_daily] : [-0.05],
      skew: snapshot.skew_ratio || 0,
      regimeType: (snapshot.regime as 'elevated' | 'normal' | 'depressed') || 'normal',
    },
    projectionData: {
      mean: projection.prob_distribution[0]?.price || 200,
      std: 10,
      probDistribution: {},
      keyLevels: projection.key_levels.map((k: Record<string, unknown>) => ({
        price: k.level || k.price || 200,
        probability: k.probability || 0.5,
      })),
    },
  };
}

async function backfillAIForecasts() {
  const ticker = 'SPWX';
  const today = new Date();

  console.log(`Starting backfill of AI forecasts for ${ticker}...`);

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    console.log(`Generating forecast for ${ticker} on ${dateStr}...`);

    const snapshot = getOptionSnapshot(dateStr, ticker, '2026-04-18');
    const projection = getOptionProjection(dateStr, ticker, 28);

    if (!snapshot || !projection) {
      console.warn(`  Skipping ${dateStr} — no data`);
      continue;
    }

    const context = await buildContext(ticker, dateStr, snapshot, projection);

    try {
      await generateAIAnalysis(context, false); // Force fresh generation
      console.log(`  ✅ Success`);
    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }

    // Rate limit: 1 request per 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('Backfill complete!');
}

backfillAIForecasts().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
