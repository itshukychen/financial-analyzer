// __tests__/lib/aiOptionsForecast.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OptionAnalysisContext } from '@/lib/types/aiOptionsForecast';

// Mock the database first
vi.mock('@/lib/db', () => ({
  getAIForecast: vi.fn(() => null),
  insertOrReplaceAIForecast: vi.fn(),
}));

// Mock the Claude API
vi.mock('@anthropic-ai/sdk', () => {
  const Anthropic = vi.fn(function () {
    return {
      messages: {
        create: vi.fn(async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'SPWX is trading with elevated IV at 45%, suggesting high volatility expectations.',
                outlook: 'bullish',
                priceTargets: {
                  conservative: 198,
                  base: 205,
                  aggressive: 212,
                  confidence: 0.78,
                },
                regimeAnalysis: {
                  classification: 'elevated',
                  justification: 'Current 45% IV is above the 20-day SMA.',
                  recommendation: 'short volatility',
                },
                tradingLevels: {
                  keySupport: 195,
                  keyResistance: 215,
                  profitTargets: [202, 205, 210],
                  stopLoss: 192,
                },
                confidence: {
                  overall: 0.78,
                  reasoning: 'High confidence due to consistent regime classification.',
                },
              }),
            },
          ],
        })),
      },
    };
  });
  return { default: Anthropic };
});

// Import after mocks
import { generateAIAnalysis } from '@/lib/aiOptionsForecast';
import * as db from '@/lib/db';

describe('generateAIAnalysis', () => {
  let mockContext: OptionAnalysisContext;

  beforeEach(() => {
    mockContext = {
      ticker: 'SPWX',
      date: '2026-03-09',
      snapshotMetrics: {
        iv: 45,
        ivPercentile: 78,
        delta: [0.25, 0.5, 0.75],
        gamma: [0.02, 0.03, 0.02],
        vega: [0.1, 0.12, 0.1],
        theta: [-0.06, -0.08, -0.06],
        skew: 8,
        regimeType: 'elevated',
      },
      projectionData: {
        mean: 205,
        std: 10,
        probDistribution: {},
        keyLevels: [
          { price: 198, probability: 0.25 },
          { price: 205, probability: 0.5 },
          { price: 212, probability: 0.75 },
        ],
      },
    };

    vi.clearAllMocks();
  });

  it('should generate valid forecast from context', async () => {
    const result = await generateAIAnalysis(mockContext, false);

    expect(result.summary).toBeTruthy();
    expect(result.outlook).toMatch(/bullish|neutral|bearish/);
    expect(result.priceTargets.base).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(1);
  });

  it('should validate price targets are within bounds', async () => {
    const result = await generateAIAnalysis(mockContext, false);

    const currentPrice = mockContext.projectionData.mean;
    const maxDeviation = currentPrice * 0.2;

    expect(Math.abs(result.priceTargets.conservative - currentPrice)).toBeLessThanOrEqual(
      maxDeviation
    );
    expect(Math.abs(result.priceTargets.base - currentPrice)).toBeLessThanOrEqual(maxDeviation);
    expect(Math.abs(result.priceTargets.aggressive - currentPrice)).toBeLessThanOrEqual(
      maxDeviation
    );
  });

  it('should validate confidence scores are between 0 and 1', async () => {
    const result = await generateAIAnalysis(mockContext, false);

    expect(result.priceTargets.confidence).toBeGreaterThanOrEqual(0);
    expect(result.priceTargets.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(1);
  });

  it('should save forecast to database', async () => {
    await generateAIAnalysis(mockContext, false);

    expect(db.insertOrReplaceAIForecast).toHaveBeenCalled();
  });

  it('should include snapshot date in forecast', async () => {
    const result = await generateAIAnalysis(mockContext, false);

    expect(result.snapshotDate).toBe(mockContext.date);
  });
});
