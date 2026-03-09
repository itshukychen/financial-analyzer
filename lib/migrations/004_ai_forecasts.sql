-- lib/migrations/004_ai_forecasts.sql
-- Migration: Add AI forecasts table and indexes

CREATE TABLE IF NOT EXISTS ai_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  
  -- Summary
  summary TEXT,
  outlook TEXT CHECK(outlook IN ('bullish','neutral','bearish')),
  
  -- Price Targets
  pt_conservative REAL,
  pt_base REAL,
  pt_aggressive REAL,
  pt_confidence REAL CHECK(pt_confidence >= 0 AND pt_confidence <= 1),
  
  -- Regime Analysis
  regime_classification TEXT CHECK(regime_classification IN ('elevated','normal','depressed')),
  regime_justification TEXT,
  regime_recommendation TEXT,
  
  -- Trading Levels
  key_support REAL,
  key_resistance REAL,
  profit_targets TEXT,
  stop_loss REAL,
  
  -- Confidence
  overall_confidence REAL CHECK(overall_confidence >= 0 AND overall_confidence <= 1),
  confidence_reasoning TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  ai_model TEXT DEFAULT 'claude-sonnet-4-5',
  
  UNIQUE(ticker, date, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_forecasts_ticker_date ON ai_forecasts(ticker, date);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_created_at ON ai_forecasts(created_at);
