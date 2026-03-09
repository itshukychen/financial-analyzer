// lib/types/aiOptionsForecast.ts

export interface OptionAnalysisContext {
  ticker: string;
  date: string;
  snapshotMetrics: {
    iv: number;
    ivPercentile: number;
    delta: number[];
    gamma: number[];
    vega: number[];
    theta: number[];
    skew: number;
    regimeType: 'elevated' | 'normal' | 'depressed';
  };
  projectionData: {
    mean: number;
    std: number;
    probDistribution: Record<string, number>;
    keyLevels: { price: number; probability: number }[];
  };
}

export interface AIOptionsForecast {
  summary: string;
  outlook: 'bullish' | 'neutral' | 'bearish';
  priceTargets: {
    conservative: number;
    base: number;
    aggressive: number;
    confidence: number;
  };
  regimeAnalysis: {
    classification: 'elevated' | 'normal' | 'depressed';
    justification: string;
    recommendation: string;
  };
  tradingLevels: {
    keySupport: number;
    keyResistance: number;
    profitTargets: number[];
    stopLoss: number;
  };
  confidence: {
    overall: number;
    reasoning: string;
  };
  snapshotDate: string;
}

export interface AIForecastResponse {
  success: boolean;
  analysis?: AIOptionsForecast;
  cached: boolean;
  cacheAge?: number;
  nextUpdate?: string;
  error?: string;
  warning?: string;
}
