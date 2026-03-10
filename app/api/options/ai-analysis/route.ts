import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisCache, insertOrReplaceAnalysisCache, getOptionSnapshot, getOptionProjection } from '@/lib/db';
import { callClaudeAPI, parseClaudeResponse } from '@/lib/ai/claude-client';
import { buildClaudePrompt } from '@/lib/ai/claude-prompt';
import type { AIAnalysisRequest, AIAnalysisResponse, Snapshot, Projection } from '@/app/types/options-ai';

// Validate required environment variables
function validateEnvironment(): { valid: boolean; error?: string } {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      valid: false,
      error: 'ANTHROPIC_API_KEY environment variable is not set. Please configure it in .env.local',
    };
  }
  
  if (process.env.ANTHROPIC_API_KEY === 'your_api_key_here' || process.env.ANTHROPIC_API_KEY.length === 0) {
    return {
      valid: false,
      error: 'ANTHROPIC_API_KEY is not properly configured. Please set a valid API key in .env.local',
    };
  }
  
  return { valid: true };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Validate environment on request
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    console.error('[AI Analysis] Environment validation failed:', envValidation.error);
    return NextResponse.json(
      {
        success: false,
        sections: [],
        nextDayProjection: { targetLow: 0, targetHigh: 0, mode: 0, confidence: 'low', moveProb: 0, description: '' },
        metadata: { ticker: '', date: '', generatedAt: '', isCached: false, cacheAge: 0, nextUpdate: '' },
        error: envValidation.error,
      },
      { status: 503 }
    );
  }
  
  try {
    const body: AIAnalysisRequest = await request.json();
    const { ticker, date, regenerate } = body;

    // Default to today if no date provided
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check cache (unless regenerate=true)
    if (!regenerate) {
      const cached = getAnalysisCache(ticker, targetDate);
      if (cached) {
        const analysis = JSON.parse(cached.analysis_json);
        const cacheAge = Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000);
        
        console.log('[AI Analysis] Cache HIT', { ticker, date: targetDate, age: cacheAge });
        return NextResponse.json({
          ...analysis,
          metadata: {
            ...analysis.metadata,
            isCached: true,
            cacheAge,
          },
        });
      }
    }

    console.log('[AI Analysis] Cache MISS - generating', { ticker, date: targetDate });

    // Fetch data from database - using default expiry "2026-04-18"
    const snapshot = getOptionSnapshot(targetDate, ticker, '2026-04-18');
    const projection = getOptionProjection(targetDate, ticker, 30);

    if (!snapshot || !projection) {
      throw new Error(`Missing snapshot or projection data for ${ticker} on ${targetDate}`);
    }

    // Convert database rows to Snapshot/Projection types
    const snapshotData: Snapshot = {
      ticker,
      date: targetDate,
      netDelta: snapshot.net_delta ?? 0,
      atmGamma: snapshot.atm_gamma ?? 0,
      vega: snapshot.vega_per_1pct ?? 0,
      theta: snapshot.theta_daily ?? 0,
      iv30d: snapshot.iv_30d ?? 30,
      ivRank: snapshot.iv_rank ?? 50,
      hv20d: snapshot.hv_20d ?? 20,
      move1w: snapshot.implied_move_pct ?? 2,
      regime: snapshot.regime ?? 'normal',
      skewRatio: snapshot.skew_ratio ?? 1,
      putIV: snapshot.put_otm_iv ?? 25,
      callIV: snapshot.call_otm_iv ?? 25,
    };

    // Extract mode and range from projection
    const probDistribution = Array.isArray(projection.prob_distribution) 
      ? projection.prob_distribution 
      : JSON.parse(projection.prob_distribution as unknown as string);
    
    const keyLevels = Array.isArray(projection.key_levels)
      ? projection.key_levels
      : JSON.parse(projection.key_levels as unknown as string);

    const mode = probDistribution.length > 0 ? probDistribution[0].price : 100;
    const rangeLow = keyLevels.find((k: any) => k.type === '2sd_low')?.level ?? mode * 0.95;
    const rangeHigh = keyLevels.find((k: any) => k.type === '2sd_high')?.level ?? mode * 1.05;

    const projectionData: Projection = {
      ticker,
      date: targetDate,
      mode,
      rangeLow,
      rangeHigh,
    };

    // Generate analysis with Claude
    const prompt = buildClaudePrompt(snapshotData, projectionData);
    const claudeStart = Date.now();
    const claudeResponse = await callClaudeAPI(prompt);
    const claudeLatency = Date.now() - claudeStart;

    const parsed = parseClaudeResponse(claudeResponse);

    // Build response
    const analysis: AIAnalysisResponse = {
      success: true,
      ...parsed,
      metadata: {
        ticker,
        date: targetDate,
        generatedAt: new Date().toISOString(),
        isCached: false,
        cacheAge: 0,
        nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      },
    };

    // Store in cache (4 hour expiry)
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    insertOrReplaceAnalysisCache(ticker, targetDate, JSON.stringify(analysis), expiresAt);

    const totalLatency = Date.now() - startTime;
    console.log('[AI Analysis] Generated', {
      ticker,
      date: targetDate,
      claudeLatency: `${claudeLatency}ms`,
      totalLatency: `${totalLatency}ms`,
    });

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('[AI Analysis] Error:', error);
    
    // Try to return stale cache as fallback
    try {
      const body: AIAnalysisRequest = await request.json();
      const stale = getAnalysisCache(body.ticker, body.date || new Date().toISOString().split('T')[0], true);
      if (stale) {
        const analysis = JSON.parse(stale.analysis_json);
        const cacheAge = Math.floor((Date.now() - new Date(stale.created_at).getTime()) / 1000);
        
        console.log('[AI Analysis] Returning stale cache as fallback');
        return NextResponse.json({
          ...analysis,
          metadata: {
            ...analysis.metadata,
            isCached: true,
            cacheAge,
          },
        });
      }
    } catch (fallbackError) {
      console.error('[AI Analysis] Fallback cache retrieval failed:', fallbackError);
    }

    return NextResponse.json(
      {
        success: false,
        sections: [],
        nextDayProjection: { targetLow: 0, targetHigh: 0, mode: 0, confidence: 'low', moveProb: 0, description: '' },
        metadata: { ticker: '', date: '', generatedAt: '', isCached: false, cacheAge: 0, nextUpdate: '' },
        error: error.message || 'Failed to generate analysis',
      },
      { status: 500 }
    );
  }
}
