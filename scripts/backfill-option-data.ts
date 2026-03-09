#!/usr/bin/env npx tsx

import { insertOptionSnapshot, insertOptionProjection } from '../lib/db';
import {
  generateMockOptionSnapshot,
  generateMockProjection,
} from '../lib/mockOptionsData';

function getDateMinusDays(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

const BACKFILL_DAYS = 30;
const TICKER = 'SPWX';
const SPOT_PRICE = 475;

console.log(`🔄 Backfilling ${BACKFILL_DAYS} days of option data for ${TICKER}...`);

try {
  for (let i = 0; i < BACKFILL_DAYS; i++) {
    const date = getDateMinusDays(i);

    // Generate and insert snapshot
    const snapshot = generateMockOptionSnapshot(TICKER, date, SPOT_PRICE);
    const inserted = insertOptionSnapshot(snapshot);

    // Generate and insert projection (30-day horizon)
    const projection = generateMockProjection(
      date,
      TICKER,
      SPOT_PRICE,
      inserted.iv_30d || 20,
      30,
      inserted.regime || 'normal'
    );
    insertOptionProjection(projection);

    if ((i + 1) % 10 === 0) {
      console.log(`  ✓ Backfilled ${i + 1}/${BACKFILL_DAYS} days`);
    }
  }

  console.log(`\n✅ Successfully backfilled ${BACKFILL_DAYS} days of option data`);
  console.log(`   Tables: option_snapshots, option_projections`);
  console.log(`   Ticker: ${TICKER}`);
  console.log(`   Date range: ${getDateMinusDays(BACKFILL_DAYS - 1)} to ${getDateMinusDays(0)}`);
} catch (error) {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
}
