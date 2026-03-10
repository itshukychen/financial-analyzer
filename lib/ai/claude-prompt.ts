import type { Snapshot, Projection } from '@/lib/types/options-ai';

export function buildClaudePrompt(snapshot: Snapshot, projection: Projection): string {
  return `
You are an expert options analyst. Analyze the following option market data and provide structured insights.

### Current Market State (${snapshot.date})
Ticker: ${snapshot.ticker}

**Greeks Aggregate:**
- Net Delta: ${snapshot.netDelta.toFixed(4)} (${snapshot.netDelta > 0 ? 'bullish' : 'bearish'})
- ATM Gamma: ${snapshot.atmGamma.toFixed(4)}
- Vega (per 1% IV): ${snapshot.vega.toFixed(0)} pts
- Theta (daily decay): ${snapshot.theta.toFixed(2)}

**Volatility Metrics:**
- IV (30d ATM): ${snapshot.iv30d.toFixed(1)}%
- IV Rank: ${snapshot.ivRank}th percentile
- Historical Vol (20d): ${snapshot.hv20d.toFixed(1)}%
- Implied Move (1W): ±${snapshot.move1w.toFixed(1)}%
- Regime: ${snapshot.regime}

**Skew Profile:**
- Skew Ratio: ${snapshot.skewRatio.toFixed(2)} (${snapshot.skewRatio > 1 ? 'put-heavy' : 'call-heavy'})
- Put IV (OTM 25d): ${snapshot.putIV.toFixed(1)}%
- Call IV (OTM 25d): ${snapshot.callIV.toFixed(1)}%

**Probability Distribution (30d horizon):**
- Mode: $${projection.mode.toFixed(2)}
- 2SD Range: $${projection.rangeLow.toFixed(2)}–$${projection.rangeHigh.toFixed(2)}

### Task
Generate a structured analysis with 5 sections. Format as valid JSON:

{
  "sections": [
    {
      "id": "current-move",
      "title": "Current Move Driver",
      "icon": "📊",
      "prose": "2-3 sentences explaining why IV is at current level and what's driving skew",
      "highlights": [
        {"label": "IV Change", "value": "+X%", "color": "loss|gain|neutral"},
        {"label": "IV Rank", "value": "Xth %ile", "color": "neutral"},
        {"label": "Gamma ATM", "value": "X.XXXX", "color": "loss|gain"},
        {"label": "Skew", "value": "Put/Call Heavy", "color": "neutral"}
      ]
    },
    {
      "id": "iv-skew",
      "title": "IV & Skew Interpretation",
      "icon": "📈",
      "prose": "2-3 sentences on whether IV is expensive vs HV, what skew indicates",
      "highlights": [
        {"label": "IV/HV Spread", "value": "+X%", "color": "loss|gain"},
        {"label": "Skew Ratio", "value": "X.XX", "color": "neutral"},
        {"label": "Put IV", "value": "X%", "color": "neutral"},
        {"label": "Call IV", "value": "X%", "color": "neutral"}
      ]
    },
    {
      "id": "greeks",
      "title": "Greeks Analysis",
      "icon": "🧮",
      "prose": "2-3 sentences on delta positioning, gamma risk, theta decay, vega sensitivity",
      "highlights": [
        {"label": "Net Delta", "value": "+/-X.XX", "color": "gain|loss"},
        {"label": "Theta Daily", "value": "-X.XX", "color": "loss"},
        {"label": "Vega per 1%", "value": "X pts", "color": "neutral"},
        {"label": "Gamma ATM", "value": "X.XXXX", "color": "loss|gain"}
      ]
    },
    {
      "id": "regime",
      "title": "Volatility Regime",
      "icon": "⚡",
      "prose": "2-3 sentences on current regime, transition probability, expected duration",
      "highlights": [
        {"label": "Current Regime", "value": "Low|Normal|High", "color": "gain|neutral|loss"},
        {"label": "HV 20d", "value": "X%", "color": "neutral"},
        {"label": "Transition Prob", "value": "X%", "color": "neutral"},
        {"label": "Duration", "value": "X-Y days", "color": "neutral"}
      ]
    },
    {
      "id": "next-day",
      "title": "Next Trading Day Forecast",
      "icon": "🎯",
      "prose": "3-4 sentences on expected move, key levels, confidence rationale"
    }
  ],
  "nextDayProjection": {
    "targetLow": ${(projection.rangeLow * 0.98).toFixed(2)},
    "targetHigh": ${(projection.rangeHigh * 1.02).toFixed(2)},
    "mode": ${projection.mode.toFixed(2)},
    "confidence": "high|medium|low",
    "moveProb": 0.65,
    "description": "Brief forecast summary (1-2 sentences)"
  }
}

Return ONLY valid JSON. No markdown, no code blocks.
  `.trim();
}
