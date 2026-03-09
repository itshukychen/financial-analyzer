import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, type OptionSnapshot, type OptionProjection } from '@/lib/db';

describe('Database - Options', () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    // Use in-memory database for tests
    db = createDb(':memory:');
  });

  describe('Option Snapshots', () => {
    const mockSnapshot: Omit<OptionSnapshot, 'id' | 'created_at'> = {
      date: '2026-03-09',
      ticker: 'SPWX',
      expiry: '30d',
      iv_30d: 20,
      iv_60d: 21,
      hv_20d: 18,
      hv_60d: 17,
      iv_rank: 50,
      net_delta: 10,
      atm_gamma: 0.001,
      vega_per_1pct: 400,
      theta_daily: -100,
      call_otm_iv: 19,
      put_otm_iv: 21,
      skew_ratio: 1.1,
      implied_move_pct: 3,
      regime: 'normal',
      raw_json: '{}',
    };

    it('should insert option snapshot', () => {
      const inserted = db.insertOptionSnapshot(mockSnapshot);

      expect(inserted).toHaveProperty('id');
      expect(inserted.ticker).toBe('SPWX');
      expect(inserted.iv_30d).toBe(20);
      expect(inserted.regime).toBe('normal');
    });

    it('should retrieve snapshot by date/ticker/expiry', () => {
      db.insertOptionSnapshot(mockSnapshot);

      const retrieved = db.getOptionSnapshot('2026-03-09', 'SPWX', '30d');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.ticker).toBe('SPWX');
      expect(retrieved?.iv_30d).toBe(20);
    });

    it('should return null for non-existent snapshot', () => {
      const result = db.getOptionSnapshot('2099-01-01', 'FAKE', '30d');
      expect(result).toBeNull();
    });

    it('should get latest snapshot for ticker/expiry', () => {
      // Insert two snapshots
      db.insertOptionSnapshot({
        ...mockSnapshot,
        date: '2026-03-08',
        iv_30d: 18,
      });
      db.insertOptionSnapshot({
        ...mockSnapshot,
        date: '2026-03-09',
        iv_30d: 20,
      });

      const latest = db.getLatestOptionSnapshot('SPWX', '30d');

      expect(latest).not.toBeNull();
      expect(latest?.date).toBe('2026-03-09');
      expect(latest?.iv_30d).toBe(20);
    });

    it('should update existing snapshot on conflict', () => {
      db.insertOptionSnapshot(mockSnapshot);
      
      const updated = db.insertOptionSnapshot({
        ...mockSnapshot,
        iv_30d: 22,
      });

      expect(updated.iv_30d).toBe(22);

      const retrieved = db.getOptionSnapshot('2026-03-09', 'SPWX', '30d');
      expect(retrieved?.iv_30d).toBe(22);
    });
  });

  describe('Option Projections', () => {
    const mockProjection: Omit<OptionProjection, 'id' | 'created_at'> = {
      date: '2026-03-09',
      ticker: 'SPWX',
      horizon_days: 30,
      prob_distribution: [
        { price: 470, probability: 0.1 },
        { price: 475, probability: 0.2 },
        { price: 480, probability: 0.1 },
      ],
      key_levels: [
        { level: 475, type: 'mode', probability: 0.2 },
        { level: 465, type: '2sd_low', probability: null },
        { level: 485, type: '2sd_high', probability: null },
      ],
      regime_classification: 'normal',
    };

    it('should insert option projection', () => {
      const inserted = db.insertOptionProjection(mockProjection);

      expect(inserted).toHaveProperty('id');
      expect(inserted.ticker).toBe('SPWX');
      expect(inserted.horizon_days).toBe(30);
      expect(inserted.prob_distribution).toHaveLength(3);
      expect(inserted.key_levels).toHaveLength(3);
    });

    it('should retrieve projection by date/ticker/horizon', () => {
      db.insertOptionProjection(mockProjection);

      const retrieved = db.getOptionProjection('2026-03-09', 'SPWX', 30);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.ticker).toBe('SPWX');
      expect(retrieved?.horizon_days).toBe(30);
      expect(retrieved?.prob_distribution).toHaveLength(3);
    });

    it('should parse JSON arrays correctly', () => {
      db.insertOptionProjection(mockProjection);

      const retrieved = db.getOptionProjection('2026-03-09', 'SPWX', 30);

      expect(Array.isArray(retrieved?.prob_distribution)).toBe(true);
      expect(Array.isArray(retrieved?.key_levels)).toBe(true);
      expect(retrieved?.prob_distribution?.[0].price).toBe(470);
      expect(retrieved?.key_levels?.[0].level).toBe(475);
    });

    it('should return null for non-existent projection', () => {
      const result = db.getOptionProjection('2099-01-01', 'FAKE', 30);
      expect(result).toBeNull();
    });

    it('should update existing projection on conflict', () => {
      db.insertOptionProjection(mockProjection);
      
      const updated = db.insertOptionProjection({
        ...mockProjection,
        regime_classification: 'high',
      });

      expect(updated.regime_classification).toBe('high');

      const retrieved = db.getOptionProjection('2026-03-09', 'SPWX', 30);
      expect(retrieved?.regime_classification).toBe('high');
    });
  });

  describe('Combined Operations', () => {
    it('should handle both snapshots and projections together', () => {
      const snapshot: Omit<OptionSnapshot, 'id' | 'created_at'> = {
        date: '2026-03-09',
        ticker: 'SPWX',
        expiry: '30d',
        iv_30d: 20,
        iv_60d: 21,
        hv_20d: 18,
        hv_60d: 17,
        iv_rank: 50,
        net_delta: 10,
        atm_gamma: 0.001,
        vega_per_1pct: 400,
        theta_daily: -100,
        call_otm_iv: 19,
        put_otm_iv: 21,
        skew_ratio: 1.1,
        implied_move_pct: 3,
        regime: 'normal',
        raw_json: '{}',
      };

      const projection: Omit<OptionProjection, 'id' | 'created_at'> = {
        date: '2026-03-09',
        ticker: 'SPWX',
        horizon_days: 30,
        prob_distribution: [{ price: 475, probability: 1 }],
        key_levels: [{ level: 475, type: 'mode', probability: null }],
        regime_classification: 'normal',
      };

      const snap = db.insertOptionSnapshot(snapshot);
      const proj = db.insertOptionProjection(projection);

      expect(snap.ticker).toBe('SPWX');
      expect(proj.ticker).toBe('SPWX');

      const retrievedSnap = db.getLatestOptionSnapshot('SPWX', '30d');
      const retrievedProj = db.getOptionProjection('2026-03-09', 'SPWX', 30);

      expect(retrievedSnap?.regime).toBe(retrievedProj?.regime_classification);
    });
  });
});
