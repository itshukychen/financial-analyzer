import { describe, it, expect } from 'vitest';
import {
  calculateHistoricalVolatility,
  calculateDelta,
  calculateGamma,
  calculateVega,
  calculateTheta,
  calculateGreeks,
  classifyVolatilityRegime,
  calculateIVRank,
  normalCDF,
  normalPDF,
} from '@/lib/optionsAnalytics';

describe('optionsAnalytics', () => {
  describe('Normal Distribution Helpers', () => {
    it('normalCDF should return values between 0 and 1', () => {
      expect(normalCDF(0)).toBeCloseTo(0.5, 2);
      expect(normalCDF(-3)).toBeGreaterThan(0);
      expect(normalCDF(-3)).toBeLessThan(0.1);
      expect(normalCDF(3)).toBeGreaterThan(0.99);
      expect(normalCDF(3)).toBeLessThan(1);
    });

    it('normalPDF should be symmetric around 0', () => {
      expect(normalPDF(-1)).toBeCloseTo(normalPDF(1), 5);
      expect(normalPDF(0)).toBeGreaterThan(normalPDF(1));
    });
  });

  describe('Historical Volatility', () => {
    it('should calculate HV from a price series', () => {
      // 20 prices with small variations
      const prices = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i * 0.5) * 2);
      const hv = calculateHistoricalVolatility(prices, 20);

      expect(hv).toBeGreaterThan(0);
      expect(hv).toBeLessThan(100); // Reasonable bounds
    });

    it('should throw for insufficient data', () => {
      const prices = [100, 101, 102];
      expect(() => calculateHistoricalVolatility(prices, 20)).toThrow();
    });

    it('should return consistent results for flat prices', () => {
      const prices = Array(30).fill(100);
      const hv = calculateHistoricalVolatility(prices, 20);
      expect(hv).toBeLessThan(0.1); // Nearly zero volatility
    });
  });

  describe('Greeks Calculations', () => {
    const params = {
      S: 100, // Spot price
      K: 100, // Strike (ATM)
      T: 0.25, // 3 months to expiry
      v: 0.20, // 20% volatility
      r: 0.05, // 5% risk-free rate
    };

    it('ATM call delta should be approximately 0.5 to 0.6', () => {
      const delta = calculateDelta(params.S, params.K, params.T, params.v, params.r, 'call');
      expect(delta).toBeGreaterThan(0.4);
      expect(delta).toBeLessThan(0.7);
    });

    it('ITM call delta should be closer to 1', () => {
      const delta = calculateDelta(110, 100, params.T, params.v, params.r, 'call');
      expect(delta).toBeGreaterThan(0.65);
      expect(delta).toBeLessThan(1);
    });

    it('OTM call delta should be closer to 0', () => {
      const delta = calculateDelta(90, 100, params.T, params.v, params.r, 'call');
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(0.35);
    });

    it('Put delta should be approximately call delta - 1', () => {
      const callDelta = calculateDelta(params.S, params.K, params.T, params.v, params.r, 'call');
      const putDelta = calculateDelta(params.S, params.K, params.T, params.v, params.r, 'put');

      expect(callDelta - putDelta).toBeCloseTo(1, 1);
    });

    it('Gamma should be positive for both calls and puts', () => {
      const gamma = calculateGamma(params.S, params.K, params.T, params.v, params.r);
      expect(gamma).toBeGreaterThan(0);
    });

    it('ATM gamma should be higher than OTM gamma', () => {
      const atmGamma = calculateGamma(100, 100, params.T, params.v, params.r);
      const otmGamma = calculateGamma(90, 100, params.T, params.v, params.r);

      expect(atmGamma).toBeGreaterThan(otmGamma);
    });

    it('Vega should be positive', () => {
      const vega = calculateVega(params.S, params.K, params.T, params.v, params.r);
      expect(vega).toBeGreaterThan(0);
    });

    it('Call theta should typically be negative at ATM', () => {
      const theta = calculateTheta(params.S, params.K, params.T, params.v, params.r, 'call');
      expect(theta).toBeLessThan(0);
    });

    it('calculateGreeks should return all Greeks', () => {
      const greeks = calculateGreeks(params.S, params.K, params.T, params.v, params.r, 'call');

      expect(greeks).toHaveProperty('delta');
      expect(greeks).toHaveProperty('gamma');
      expect(greeks).toHaveProperty('vega');
      expect(greeks).toHaveProperty('theta');
      expect(greeks).toHaveProperty('rho');

      expect(typeof greeks.delta).toBe('number');
      expect(typeof greeks.gamma).toBe('number');
      expect(typeof greeks.vega).toBe('number');
      expect(typeof greeks.theta).toBe('number');
      expect(typeof greeks.rho).toBe('number');
    });
  });

  describe('Volatility Regime Classification', () => {
    const historicalIVs = [
      10, 12, 14, 16, 18, 20, 22, 24, 26, 28,
    ];

    it('should classify low regime', () => {
      const regime = classifyVolatilityRegime(11, historicalIVs);
      expect(regime).toBe('low');
    });

    it('should classify high regime', () => {
      const regime = classifyVolatilityRegime(27, historicalIVs);
      expect(regime).toBe('high');
    });

    it('should classify normal regime', () => {
      const regime = classifyVolatilityRegime(18, historicalIVs);
      expect(regime).toBe('normal');
    });

    it('calculateIVRank should return 0-100', () => {
      const rank = calculateIVRank(15, historicalIVs);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThanOrEqual(100);
    });

    it('IV at min should have low rank', () => {
      const rank = calculateIVRank(10, historicalIVs);
      expect(rank).toBeLessThan(20);
    });

    it('IV at max should have high rank', () => {
      const rank = calculateIVRank(28, historicalIVs);
      expect(rank).toBeGreaterThan(80);
    });

    it('IV at median should be around 50', () => {
      const rank = calculateIVRank(19, historicalIVs);
      expect(rank).toBeGreaterThan(40);
      expect(rank).toBeLessThan(60);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero time to expiry', () => {
      const delta = calculateDelta(100, 100, 0, 0.2, 0.05, 'call');
      expect(typeof delta).toBe('number');
      expect(delta).toBeGreaterThanOrEqual(0);
      expect(delta).toBeLessThanOrEqual(1);
    });

    it('should handle zero volatility', () => {
      const delta = calculateDelta(100, 100, 0.25, 0, 0.05, 'call');
      expect(typeof delta).toBe('number');
    });

    it('should handle extreme moneyness', () => {
      // Way ITM
      const deepITM = calculateDelta(150, 100, 0.25, 0.2, 0.05, 'call');
      expect(deepITM).toBeCloseTo(1, 1);

      // Way OTM
      const deepOTM = calculateDelta(50, 100, 0.25, 0.2, 0.05, 'call');
      expect(deepOTM).toBeCloseTo(0, 1);
    });
  });
});
