#!/usr/bin/env node
/**
 * Backfill script for option prices
 * Usage: npm run backfill -- --ticker SPX --strike 3000 --expiry 2026-06-17 --type call
 */

import { createDb } from '../lib/db';
import path from 'path';
import fs from 'fs';

interface BackfillOptions {
  ticker: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  dryRun: boolean;
  startDate?: string;
  endDate?: string;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: Partial<BackfillOptions> = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--ticker' && args[i + 1]) {
      options.ticker = args[++i];
    } else if (arg === '--strike' && args[i + 1]) {
      options.strike = parseFloat(args[++i]);
    } else if (arg === '--expiry' && args[i + 1]) {
      options.expiry = args[++i];
    } else if (arg === '--type' && args[i + 1]) {
      options.type = args[++i] as 'call' | 'put';
    } else if (arg === '--start-date' && args[i + 1]) {
      options.startDate = args[++i];
    } else if (arg === '--end-date' && args[i + 1]) {
      options.endDate = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  if (!options.ticker || !options.strike || !options.expiry || !options.type) {
    console.error('Usage: npm run backfill -- --ticker SPX --strike 3000 --expiry 2026-06-17 --type call [--dry-run]');
    process.exit(1);
  }

  return options as BackfillOptions;
}

function generateSyntheticData(
  ticker: string,
  strike: number,
  expiry: string,
  optionType: 'call' | 'put',
  startDate: Date,
  endDate: Date,
): Array<{ timestamp: number; price: number; bid?: number; ask?: number; volume?: number }> {
  const data = [];
  const current = new Date(startDate);
  
  // Generate daily closing prices from start to end date
  let basePrice = 100; // Starting option price
  const dayMs = 24 * 60 * 60 * 1000;
  let volatility = 0;
  
  while (current <= endDate) {
    // Skip weekends
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      // Generate random walk for price movement
      volatility = (Math.random() - 0.5) * 5;
      basePrice = Math.max(basePrice + volatility, 10); // Don't go below 10
      
      const timestamp = Math.floor(current.getTime() / 1000);
      const mid = basePrice;
      const bid = mid - 0.5;
      const ask = mid + 0.5;
      const volume = Math.floor(Math.random() * 10000) + 100;
      
      data.push({
        timestamp,
        price: mid,
        bid,
        ask,
        volume,
      });
    }
    
    current.setTime(current.getTime() + dayMs);
  }
  
  return data;
}

async function main() {
  const options = parseArgs();
  const dataDir = path.join(process.cwd(), 'data');
  const dbPath = path.join(dataDir, 'reports.db');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  console.log(`📊 Backfilling option prices: ${options.ticker} ${options.strike} ${options.type} (expires ${options.expiry})`);
  
  // Determine date range
  const expiryDate = new Date(options.expiry);
  const endDate = new Date(expiryDate);
  endDate.setHours(16, 0, 0, 0); // Market close (4 PM ET)
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30); // Last 30 days
  
  if (options.startDate) {
    startDate.setTime(new Date(options.startDate).getTime());
  }
  if (options.endDate) {
    endDate.setTime(new Date(options.endDate).getTime());
  }
  
  console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  // Generate synthetic data
  const data = generateSyntheticData(
    options.ticker,
    options.strike,
    options.expiry,
    options.type,
    startDate,
    endDate,
  );
  
  console.log(`📈 Generated ${data.length} data points`);
  
  if (options.dryRun) {
    console.log('🧪 DRY RUN — no database writes');
    console.log('First 5 points:');
    data.slice(0, 5).forEach(p => {
      const date = new Date(p.timestamp * 1000);
      console.log(`  ${date.toISOString()}: $${p.price.toFixed(2)}`);
    });
    return;
  }
  
  // Initialize database
  const db = createDb(dbPath);
  
  // Insert data
  let inserted = 0;
  let errors = 0;
  
  for (const point of data) {
    try {
      const result = db.insertOptionPrice({
        ticker: options.ticker,
        strike: options.strike,
        expiry_date: options.expiry,
        option_type: options.type,
        timestamp: point.timestamp,
        price: point.price,
        bid: point.bid,
        ask: point.ask,
        volume: point.volume,
      });
      inserted++;
      
      if (inserted % 10 === 0) {
        process.stdout.write(`\r✅ Inserted ${inserted}/${data.length}`);
      }
    } catch (e: any) {
      // Ignore duplicate key errors
      if (!e.message.includes('UNIQUE')) {
        console.error(`\n❌ Error inserting data point:`, e.message);
        errors++;
      }
    }
  }
  
  console.log(`\n✅ Backfill complete: ${inserted} rows inserted, ${errors} errors`);
  
  // Verify
  const sample = db.getOptionPrices(
    options.ticker,
    options.strike,
    options.expiry,
    options.type,
    Math.floor(startDate.getTime() / 1000),
    Math.floor(endDate.getTime() / 1000),
  );
  
  console.log(`\n📊 Verification: Found ${sample.length} records in database`);
  if (sample.length > 0) {
    console.log(`  First: ${new Date(sample[0].timestamp * 1000).toISOString()} — $${sample[0].price.toFixed(2)}`);
    console.log(`  Last: ${new Date(sample[sample.length - 1].timestamp * 1000).toISOString()} — $${sample[sample.length - 1].price.toFixed(2)}`);
  }
}

main().catch(console.error);
