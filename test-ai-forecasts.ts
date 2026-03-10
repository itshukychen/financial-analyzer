import { getAIForecast, insertOrReplaceAIForecast } from './lib/db';

const testForecast = {
  summary: 'Test forecast',
  outlook: 'neutral' as const,
  priceTargets: { conservative: 195, base: 200, aggressive: 205, confidence: 0.8 },
  regimeAnalysis: { classification: 'normal' as const, justification: 'Test', recommendation: 'neutral' },
  tradingLevels: { keySupport: 190, keyResistance: 210, profitTargets: [202, 205, 208], stopLoss: 188 },
  confidence: { overall: 0.75, reasoning: 'Test data' },
  snapshotDate: '2026-03-10',
};

// Test 1: Insert
const inserted = insertOrReplaceAIForecast('SPY', '2026-03-10', testForecast);
console.log('✅ Inserted:', inserted.id);

// Test 2: Retrieve
const retrieved = getAIForecast('SPY', '2026-03-10');
console.log('✅ Retrieved:', retrieved?.id);

// Test 3: Upsert
const updated = insertOrReplaceAIForecast('SPY', '2026-03-10', { ...testForecast, summary: 'Updated' });
console.log('✅ Updated:', updated.id === inserted.id ? 'Same ID' : 'New ID');

// Test 4: Cache lookup
const cached = getAIForecast('SPY', '2026-03-10');
const forecast = JSON.parse(cached!.forecast_json);
console.log('✅ Cache hit:', forecast.summary === 'Updated');
