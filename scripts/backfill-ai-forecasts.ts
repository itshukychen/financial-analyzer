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
      iv: (snapshot.iv_30d as number) || 30,
      ivPercentile: (snapshot.iv_rank as number) || 50,
      delta: snapshot.net_delta ? [(snapshot.net_delta as number)] : [0.5],
      gamma: snapshot.atm_gamma ? [(snapshot.atm_gamma as number)] : [0.03],
      vega: snapshot.vega_per_1pct ? [(snapshot.vega_per_1pct as number)] : [0.1],
      theta: snapshot.theta_daily ? [(snapshot.theta_daily as number)] : [-0.05],
      skew: (snapshot.skew_ratio as number) || 0,
      regimeType: (snapshot.regime as 'elevated' | 'normal' | 'depressed') || 'normal',
    },
    projectionData: {
      mean: ((projection.prob_distribution as any)?.[0]?.price as number) || 200,
      std: 10,
      probDistribution: {},
      keyLevels: (projection.key_levels as Array<Record<string, unknown>>).map((k: Record<string, unknown>) => ({
        price: (k.level as number) || (k.price as number) || 200,
        probability: (k.probability as number) || 0.5,
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

    const context = await buildContext(ticker, dateStr, snapshot as unknown as Record<string, unknown>, projection as unknown as Record<string, unknown>);

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
