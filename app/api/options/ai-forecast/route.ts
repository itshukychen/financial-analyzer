// app/api/options/ai-forecast/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateAIAnalysis } from '@/lib/aiOptionsForecast';
import { getOptionSnapshot, getOptionProjection, getAIForecast, type KeyLevel } from '@/lib/db';
import type { OptionAnalysisContext } from '@/lib/types/aiOptionsForecast';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, date, regenerate = false } = body;

    // Validate inputs
    if (!ticker || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing ticker or date' },
        { status: 400 }
      );
    }

    // Fetch snapshot and projection
    const snapshot = getOptionSnapshot(date, ticker, '2026-04-18'); // Default to monthly
    const projection = getOptionProjection(date, ticker, 28); // 4-week horizon

    if (!snapshot || !projection) {
      return NextResponse.json(
        { success: false, error: `No data available for ${ticker} on ${date}` },
        { status: 400 }
      );
    }

    // Build analysis context
    const context: OptionAnalysisContext = {
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
        keyLevels: projection.key_levels.map((k: KeyLevel) => ({
          price: k.level,
          probability: k.probability || 0.5,
        })),
      },
    };

    // Generate analysis (with caching unless regenerate=true)
    const analysis = await generateAIAnalysis(context, !regenerate);

    // Calculate cache metadata
    const cached = getAIForecast(ticker, date);
    const cacheAge = cached
      ? Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000)
      : 0;

    return NextResponse.json({
      success: true,
      analysis,
      cached: !regenerate && cacheAge > 0,
      cacheAge,
      nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('AI forecast API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
