// lib/aiOptionsForecast.ts

import Anthropic from '@anthropic-ai/sdk';
import type { OptionAnalysisContext, AIOptionsForecast } from './types/aiOptionsForecast';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert volatility analyst specializing in equity options.

Your task: analyze options market data and generate actionable trading insights.

**Input Data:**
- Current implied volatility (IV) and historical percentile
- Option Greeks across strikes (delta, gamma, vega, theta)
- Volatility skew (25-75 delta spread)
- Current regime classification (elevated/normal/depressed)
- Probability distribution for the next 4 weeks
- Historical baseline metrics (20-day SMA IV, percentile ranks)

**Your Analysis Should:**
1. Assess the current IV environment (elevated/normal/depressed vs history)
2. Identify market positioning from skew and Greeks
3. Extract probability-weighted price targets (25th, 50th, 75th percentile)
4. Recommend key trading levels (support, resistance, profit targets, stop loss)
5. Provide a confidence score based on data quality and regime stability

**Output Format:**
Respond ONLY with valid JSON (no markdown, no explanations outside JSON):

{
  "summary": "<2-3 sentence executive summary>",
  "outlook": "<bullish|neutral|bearish>",
  "priceTargets": {
    "conservative": <number>,
    "base": <number>,
    "aggressive": <number>,
    "confidence": <0-1>
  },
  "regimeAnalysis": {
    "classification": "<elevated|normal|depressed>",
    "justification": "<why this classification?>",
    "recommendation": "<short|long|neutral> volatility"
  },
  "tradingLevels": {
    "keySupport": <number>,
    "keyResistance": <number>,
    "profitTargets": [<number>, <number>, <number>],
    "stopLoss": <number>
  },
  "confidence": {
    "overall": <0-1>,
    "reasoning": "<brief explanation of confidence level>"
  }
}

**Rules:**
- All price targets must be within ±20% of current price
- Confidence scores must be between 0 and 1
- Be concise and data-driven; avoid speculation
- If uncertain, reduce confidence score and explain why
- Reference specific metrics in your justifications`;

export async function generateAIAnalysis(
  context: OptionAnalysisContext,
  useCache = true
): Promise<AIOptionsForecast> {
  // Check cache first
  if (useCache) {
    const cached = getAIForecast(context.ticker, context.date);
    if (cached && isCacheFresh(cached.created_at)) {
      return JSON.parse(cached.forecast_json) as AIOptionsForecast;
    }
  }

  // Build user prompt
  const userPrompt = buildPrompt(context);

  try {
    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const analysis = parseClaudeResponse(content, context);

    // Validate
    validateAnalysis(analysis, context);

    return analysis;
  } catch (error) {
    console.error('Claude API error:', error);
    throw new Error('AI forecast generation failed');
  }
}

function buildPrompt(context: OptionAnalysisContext): string {
  const { snapshotMetrics, projectionData } = context;

  return `Analyze the following options market data for ${context.ticker}:

**Current Metrics:**
- Current IV: ${snapshotMetrics.iv.toFixed(1)}%
- IV Percentile (20d): ${snapshotMetrics.ivPercentile.toFixed(0)}%
- Regime: ${snapshotMetrics.regimeType}
- Skew (25-75 delta): ${snapshotMetrics.skew.toFixed(1)} points

**Greeks (sample across strikes):**
- Delta: ${snapshotMetrics.delta.map(d => d.toFixed(2)).join(', ')}
- Gamma: ${snapshotMetrics.gamma.map(g => g.toFixed(3)).join(', ')}
- Vega: ${snapshotMetrics.vega.map(v => v.toFixed(2)).join(', ')}
- Theta: ${snapshotMetrics.theta.map(t => t.toFixed(3)).join(', ')}

**Probability Distribution (4 weeks):**
- Mean: $${projectionData.mean.toFixed(2)}
- Std Dev: $${projectionData.std.toFixed(2)}
- Key Levels: ${projectionData.keyLevels.map(l => `$${l.price.toFixed(2)} (${(l.probability * 100).toFixed(0)}%)`).join(', ')}

Generate trading analysis following the output format.`;
}

function parseClaudeResponse(content: string, context: OptionAnalysisContext): AIOptionsForecast {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in Claude response');
  }

  const analysis = JSON.parse(jsonMatch[1]);
  analysis.snapshotDate = context.date;

  return analysis;
}

function validateAnalysis(analysis: AIOptionsForecast, context: OptionAnalysisContext) {
  const currentPrice = context.projectionData.mean;
  const maxDeviation = currentPrice * 0.2; // ±20%

  // Validate price targets
  if (Math.abs(analysis.priceTargets.base - currentPrice) > maxDeviation) {
    throw new Error(`Base target $${analysis.priceTargets.base} too far from current $${currentPrice}`);
  }

  // Validate confidence scores
  if (analysis.priceTargets.confidence < 0 || analysis.priceTargets.confidence > 1) {
    throw new Error(`Invalid price target confidence: ${analysis.priceTargets.confidence}`);
  }

  if (analysis.confidence.overall < 0 || analysis.confidence.overall > 1) {
    throw new Error(`Invalid overall confidence: ${analysis.confidence.overall}`);
  }
}

function isCacheFresh(createdAt: string): boolean {
  const cacheAge = Date.now() - new Date(createdAt).getTime();
  const fourHours = 4 * 60 * 60 * 1000;
  return cacheAge < fourHours;
}


