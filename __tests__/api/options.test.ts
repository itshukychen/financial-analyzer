import { describe, it, expect, beforeEach } from 'vitest';
import { GET as snapshotGET } from '@/app/api/options/snapshot/route';
import { GET as projectionGET } from '@/app/api/options/projection/route';
import { NextRequest } from 'next/server';

/**
 * Integration tests for /api/options/snapshot and /api/options/projection endpoints
 * 
 * NOTE: These tests use the module-level exported functions from lib/db,
 * which means they interact with the actual database file, not an in-memory DB.
 * For proper unit testing of the API behavior, use snapshot/projection response structure.
 */
describe('API - Options Endpoints', () => {
  beforeEach(async () => {
    // Note: Tests run against the actual database or mock data that's been backfilled
    // In a CI environment, the database would be pre-populated with test data
  });

  describe('GET /api/options/snapshot', () => {
    it('should return snapshot for valid ticker/expiry', async () => {
      const url = new URL('http://localhost:3000/api/options/snapshot?ticker=SPWX&expiry=30d');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await snapshotGET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('ticker');
      expect(data.ticker).toBe('SPWX');
      expect(data).toHaveProperty('volatility');
      expect(data).toHaveProperty('greeks');
      expect(data).toHaveProperty('skew');
      expect(data).toHaveProperty('implied_move');
      expect(data).toHaveProperty('regime');
    });

    it('should use defaults for missing query params', async () => {
      const url = new URL('http://localhost:3000/api/options/snapshot');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await snapshotGET(req);
      expect(response.status).toBe(200);
    });

    it('should include confidence bands in response', async () => {
      const url = new URL('http://localhost:3000/api/options/snapshot?ticker=SPWX&expiry=30d');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await snapshotGET(req);
      const data = await response.json();

      // Response should have implied_move structure with confidence band fields
      expect(data.implied_move).toHaveProperty('1w_conf_low');
      expect(data.implied_move).toHaveProperty('1w_conf_high');
      expect(data.implied_move).toHaveProperty('2sd_low');
      expect(data.implied_move).toHaveProperty('2sd_high');

      // If spot price is available, bands should be calculated (numbers)
      // Otherwise they'll be null, which is also valid
      if (data.implied_move['1w_conf_low'] !== null) {
        expect(typeof data.implied_move['1w_conf_low']).toBe('number');
        expect(data.implied_move['1w_conf_low']).toBeGreaterThan(0);
      }
    });

    it('should return 404 for non-existent ticker', async () => {
      const url = new URL('http://localhost:3000/api/options/snapshot?ticker=FAKE&expiry=30d');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await snapshotGET(req);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should have correct skew classification', async () => {
      const url = new URL('http://localhost:3000/api/options/snapshot?ticker=SPWX&expiry=30d');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await snapshotGET(req);
      const data = await response.json();

      // skew_ratio is 1.1 (put_otm_iv 21 / call_otm_iv 19)
      // This is > 1.05, so should be 'put_heavy'
      expect(data.skew.skew_direction).toBe('put_heavy');
    });
  });

  describe('GET /api/options/projection', () => {
    it('should return projection for valid ticker/horizon', async () => {
      const url = new URL('http://localhost:3000/api/options/projection?ticker=SPWX&horizonDays=30');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('ticker');
      expect(data.ticker).toBe('SPWX');
      expect(data).toHaveProperty('date');
      expect(data).toHaveProperty('expiry_horizon');
      expect(data.expiry_horizon).toBe(30);
      expect(data).toHaveProperty('prob_distribution');
      expect(data).toHaveProperty('keyLevels');
      expect(data).toHaveProperty('regimeTransition');
    });

    it('should return probability distribution as array', async () => {
      const url = new URL('http://localhost:3000/api/options/projection?ticker=SPWX&horizonDays=30');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);
      const data = await response.json();

      expect(Array.isArray(data.prob_distribution)).toBe(true);
      expect(data.prob_distribution.length).toBeGreaterThan(0);
      
      // Each point should have price and probability
      for (const point of data.prob_distribution) {
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('probability');
        expect(typeof point.price).toBe('number');
        expect(typeof point.probability).toBe('number');
        expect(point.probability).toBeGreaterThanOrEqual(0);
        expect(point.probability).toBeLessThanOrEqual(1);
      }
    });

    it('should return key levels with correct structure', async () => {
      const url = new URL('http://localhost:3000/api/options/projection?ticker=SPWX&horizonDays=30');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);
      const data = await response.json();

      expect(Array.isArray(data.keyLevels)).toBe(true);
      expect(data.keyLevels[0]).toHaveProperty('level');
      expect(data.keyLevels[0]).toHaveProperty('type');
      expect(['mode', '2sd_low', '2sd_high', 'support', 'resistance']).toContain(data.keyLevels[0].type);
    });

    it('should include regime transition info', async () => {
      const url = new URL('http://localhost:3000/api/options/projection?ticker=SPWX&horizonDays=30');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);
      const data = await response.json();

      expect(data.regimeTransition).toHaveProperty('from');
      expect(data.regimeTransition).toHaveProperty('to');
      expect(data.regimeTransition).toHaveProperty('confidence');
    });

    it('should use defaults for missing query params', async () => {
      const url = new URL('http://localhost:3000/api/options/projection');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent ticker', async () => {
      const url = new URL('http://localhost:3000/api/options/projection?ticker=FAKE&horizonDays=30');
      const req = {
        nextUrl: url,
      } as unknown as NextRequest;

      const response = await projectionGET(req);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});
