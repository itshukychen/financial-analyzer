#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'reports.db');

console.log('Testing database connection...');
console.log('CWD:', process.cwd());
console.log('DB_PATH:', DB_PATH);

const db = new Database(DB_PATH);

// Test 1: Count rows
const countResult = db.prepare('SELECT COUNT(*) as count FROM option_snapshots').get();
console.log('\nTest 1: Total snapshots:', countResult.count);

// Test 2: Query for SPWX/30d
const spwxResult = db.prepare('SELECT COUNT(*) as count FROM option_snapshots WHERE ticker = ? AND expiry = ?').get('SPWX', '30d');
console.log('Test 2: SPWX/30d snapshots:', spwxResult.count);

// Test 3: Get latest
const latest = db.prepare('SELECT * FROM option_snapshots WHERE ticker = ? AND expiry = ? ORDER BY date DESC LIMIT 1').get('SPWX', '30d');
console.log('Test 3: Latest snapshot found:', !!latest);
if (latest) {
  console.log('  - ID:', latest.id);
  console.log('  - Date:', latest.date);
  console.log('  - Ticker:', latest.ticker);
  console.log('  - Expiry:', latest.expiry);
  console.log('  - IV 30D:', latest.iv_30d);
}

db.close();
