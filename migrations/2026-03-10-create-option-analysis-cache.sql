-- Create cache table for AI analysis results
CREATE TABLE IF NOT EXISTS option_analysis_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  
  UNIQUE(ticker, date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_cache_lookup ON option_analysis_cache(ticker, date, expires_at);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON option_analysis_cache(expires_at);
