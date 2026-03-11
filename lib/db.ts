import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Schema (v5 — adds conversations + chat_messages with FTS5) ──────────────
// NOTE: better-sqlite3 is synchronous and single-threaded by design.
// Connection pooling is NOT required — a single shared instance is sufficient.
// The module-level singleton below handles all production access.

const CHAT_SCHEMA_V5 = `
  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT    PRIMARY KEY,
    user_id       TEXT    NOT NULL DEFAULT 'default',
    title         TEXT    NOT NULL DEFAULT 'New Conversation',
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
    ON conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_created
    ON conversations(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT    PRIMARY KEY,
    conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
    content         TEXT    NOT NULL,
    tokens_used     INTEGER,
    metadata        TEXT,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
    ON chat_messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
    ON chat_messages(conversation_id, created_at ASC);

  -- Regular (non-external-content) FTS5 table: stores its own copy of content.
  -- This avoids issues with external content tables and CASCADE deletes not firing triggers.
  CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
    content,
    conversation_id UNINDEXED,
    message_id      UNINDEXED
  );

  CREATE TRIGGER IF NOT EXISTS chat_messages_fts_ai
    AFTER INSERT ON chat_messages
  BEGIN
    INSERT INTO chat_messages_fts(rowid, content, conversation_id, message_id)
    VALUES (new.rowid, new.content, new.conversation_id, new.id);
  END;

  CREATE TRIGGER IF NOT EXISTS chat_messages_fts_ad
    AFTER DELETE ON chat_messages
  BEGIN
    DELETE FROM chat_messages_fts WHERE rowid = old.rowid;
  END;

  CREATE TRIGGER IF NOT EXISTS chat_messages_fts_au
    AFTER UPDATE OF content ON chat_messages
  BEGIN
    DELETE FROM chat_messages_fts WHERE rowid = old.rowid;
    INSERT INTO chat_messages_fts(rowid, content, conversation_id, message_id)
    VALUES (new.rowid, new.content, new.conversation_id, new.id);
  END;
`;

// ─── Schema (v4 — adds option prices for chart overlay) ──────────────────────

const SCHEMA_V4 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

  CREATE TABLE IF NOT EXISTS option_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT    NOT NULL,
    ticker            TEXT    NOT NULL,
    expiry            TEXT    NOT NULL,
    
    iv_30d            REAL,
    iv_60d            REAL,
    hv_20d            REAL,
    hv_60d            REAL,
    iv_rank           INTEGER,
    
    net_delta         REAL,
    atm_gamma         REAL,
    vega_per_1pct     REAL,
    theta_daily       REAL,
    
    call_otm_iv       REAL,
    put_otm_iv        REAL,
    skew_ratio        REAL,
    
    implied_move_pct  REAL,
    
    regime            TEXT,
    raw_json          TEXT,
    
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, expiry)
  );
  CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
    ON option_snapshots(date DESC, ticker, expiry);

  CREATE TABLE IF NOT EXISTS option_projections (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    date                    TEXT    NOT NULL,
    ticker                  TEXT    NOT NULL,
    horizon_days            INTEGER NOT NULL,
    
    prob_distribution       TEXT    NOT NULL,
    key_levels              TEXT    NOT NULL,
    
    regime_classification   TEXT,
    
    created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, horizon_days)
  );
  CREATE INDEX IF NOT EXISTS idx_option_projections_date 
    ON option_projections(date DESC, ticker);

  CREATE TABLE IF NOT EXISTS option_prices (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker            TEXT    NOT NULL,
    strike            REAL    NOT NULL,
    expiry_date       TEXT    NOT NULL,
    option_type       TEXT    NOT NULL DEFAULT 'call',
    timestamp         INTEGER NOT NULL,
    price             REAL    NOT NULL,
    bid               REAL,
    ask               REAL,
    volume            INTEGER,
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
  );
  CREATE INDEX IF NOT EXISTS idx_option_prices_lookup 
    ON option_prices(ticker, strike, expiry_date, option_type, timestamp);
  CREATE INDEX IF NOT EXISTS idx_option_prices_expiry 
    ON option_prices(expiry_date);
`;

// ─── Schema (v3 — adds option snapshots and projections) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SCHEMA_V3 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

  CREATE TABLE IF NOT EXISTS option_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT    NOT NULL,
    ticker            TEXT    NOT NULL,
    expiry            TEXT    NOT NULL,
    
    iv_30d            REAL,
    iv_60d            REAL,
    hv_20d            REAL,
    hv_60d            REAL,
    iv_rank           INTEGER,
    
    net_delta         REAL,
    atm_gamma         REAL,
    vega_per_1pct     REAL,
    theta_daily       REAL,
    
    call_otm_iv       REAL,
    put_otm_iv        REAL,
    skew_ratio        REAL,
    
    implied_move_pct  REAL,
    
    regime            TEXT,
    raw_json          TEXT,
    
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, expiry)
  );
  CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
    ON option_snapshots(date DESC, ticker, expiry);

  CREATE TABLE IF NOT EXISTS option_projections (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    date                    TEXT    NOT NULL,
    ticker                  TEXT    NOT NULL,
    horizon_days            INTEGER NOT NULL,
    
    prob_distribution       TEXT    NOT NULL,
    key_levels              TEXT    NOT NULL,
    
    regime_classification   TEXT,
    
    created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, ticker, horizon_days)
  );
  CREATE INDEX IF NOT EXISTS idx_option_projections_date 
    ON option_projections(date DESC, ticker);
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,
    period       TEXT    NOT NULL DEFAULT 'eod',
    generated_at INTEGER NOT NULL,
    ticker_data  TEXT    NOT NULL,
    report_json  TEXT    NOT NULL,
    model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
    UNIQUE(date, period)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);
`;

export type ReportPeriod = 'morning' | 'midday' | 'eod';

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  morning: 'Open',
  midday:  'Midday',
  eod:     'Close',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type VolatilityRegime = 'low' | 'normal' | 'high';

export interface ReportRow {
  id:           number;
  date:         string;
  period:       ReportPeriod;
  generated_at: number;
  ticker_data:  string;   // JSON string
  report_json:  string;   // JSON string (the Analysis object)
  model:        string;
}

export interface OptionSnapshot {
  id:                number;
  date:              string;
  ticker:            string;
  expiry:            string;
  iv_30d:            number | null;
  iv_60d:            number | null;
  hv_20d:            number | null;
  hv_60d:            number | null;
  iv_rank:           number | null;
  net_delta:         number | null;
  atm_gamma:         number | null;
  vega_per_1pct:     number | null;
  theta_daily:       number | null;
  call_otm_iv:       number | null;
  put_otm_iv:        number | null;
  skew_ratio:        number | null;
  implied_move_pct:  number | null;
  regime:            VolatilityRegime | null;
  raw_json:          string;
  created_at:        number;
}

export interface AIForecastRow {
  id:            number;
  ticker:        string;
  date:          string;
  forecast_json: string;
  created_at:    string;
}

export interface ProbabilityPoint {
  price:       number;
  probability: number;
}

export interface KeyLevel {
  level:       number;
  type:        'mode' | '2sd_low' | '2sd_high' | 'support' | 'resistance';
  probability: number | null;
}

export interface OptionProjection {
  id:                    number;
  date:                  string;
  ticker:                string;
  horizon_days:          number;
  prob_distribution:     ProbabilityPoint[];
  key_levels:            KeyLevel[];
  regime_classification: VolatilityRegime | null;
  created_at:            number;
}

export interface OptionPrice {
  id:         number;
  ticker:     string;
  strike:     number;
  expiry_date: string;
  option_type: 'call' | 'put';
  timestamp:  number;
  price:      number;
  bid:        number | null;
  ask:        number | null;
  volume:     number | null;
  created_at: number;
}

// ─── Chat types (v5) ─────────────────────────────────────────────────────────

export interface ConversationRow {
  id:            string;
  user_id:       string;
  title:         string;
  message_count: number;
  created_at:    number;
  updated_at:    number;
}

export interface ChatMessageRow {
  id:              string;
  conversation_id: string;
  role:            'user' | 'assistant';
  content:         string;
  tokens_used:     number | null;
  metadata:        string | null;
  created_at:      number;
}

export interface ChatMessageSearchResult {
  message_id:         string;
  conversation_id:    string;
  conversation_title: string;
  role:               string;
  snippet:            string;
  created_at:         number;
}

export interface ConversationListOptions {
  limit?:  number;
  offset?: number;
  sort?:   'created_at' | 'updated_at';
}

export interface PaginatedResult<T> {
  rows:    T[];
  total:   number;
  hasMore: boolean;
}

// ─── Factory (used by tests with ':memory:') ──────────────────────────────────

export interface DbInstance {
  db: Database.Database;
  insertOrReplaceReport(date: string, period: ReportPeriod, tickerData: object, reportJson: object, model: string): ReportRow;
  getLatestReport(): ReportRow | null;
  getReportByDate(date: string, period?: ReportPeriod): ReportRow | null;
  listReports(limit?: number): Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[];
  
  insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot;
  getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null;
  getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null;
  
  insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection;
  getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null;
  
  insertOptionPrice(price: Omit<OptionPrice, 'id' | 'created_at'>): OptionPrice;
  getOptionPrices(ticker: string, strike: number, expiryDate: string, optionType: 'call' | 'put', startTimestamp: number, endTimestamp: number): OptionPrice[];
  getUnderlyingPrices(ticker: string, startTimestamp: number, endTimestamp: number): Array<{ timestamp: number; price: number }>;

  // Chat (v5)
  createConversation(userId?: string, title?: string): ConversationRow;
  getConversation(id: string): ConversationRow | null;
  listConversations(userId: string, options?: ConversationListOptions): PaginatedResult<ConversationRow>;
  updateConversation(id: string, updates: { title?: string }): void;
  deleteConversation(id: string): void;
  incrementMessageCount(conversationId: string): void;
  insertChatMessage(msg: Omit<ChatMessageRow, 'created_at'>): ChatMessageRow;
  getChatMessages(conversationId: string): ChatMessageRow[];
  searchChatMessages(
    query: string,
    options?: { limit?: number; offset?: number; conversationId?: string },
  ): PaginatedResult<ChatMessageSearchResult> & { executionTimeMs: number };

  // AI Forecasts (v6)
  getAIForecast(ticker: string, date: string): AIForecastRow | null;
  insertOrReplaceAIForecast(ticker: string, date: string, analysis: object): void;
}

// ─── Migration: v1 → v2 → v3 → v4 ──────────────────────────────────────────

function migrate(db: Database.Database): void {
  const cols = (db.pragma('table_info(reports)') as { name: string }[]).map(c => c.name);
  const hasOptionSnapshots = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='option_snapshots'"
  ).get();
  const hasOptionPrices = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='option_prices'"
  ).get();
  const hasConversations = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'"
  ).get();

  // Migrate v1 → v2
  if (cols.includes('period')) {
    // v2 already or later
    if (hasOptionSnapshots) {
      if (hasOptionPrices && hasConversations) return; // Already at v5
    }
  } else {
    // v1 table exists but lacks period — rebuild
    db.exec(`
      ALTER TABLE reports RENAME TO reports_v1;

      CREATE TABLE reports (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        date         TEXT    NOT NULL,
        period       TEXT    NOT NULL DEFAULT 'eod',
        generated_at INTEGER NOT NULL,
        ticker_data  TEXT    NOT NULL,
        report_json  TEXT    NOT NULL,
        model        TEXT    NOT NULL DEFAULT 'claude-sonnet-4-5',
        UNIQUE(date, period)
      );

      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC, period ASC);

      INSERT INTO reports (id, date, period, generated_at, ticker_data, report_json, model)
        SELECT id, date, 'eod', generated_at, ticker_data, report_json, model
        FROM reports_v1;

      DROP TABLE reports_v1;
    `);
  }
  
  // Create v3 option tables if they don't exist
  if (!hasOptionSnapshots) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS option_snapshots (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        date              TEXT    NOT NULL,
        ticker            TEXT    NOT NULL,
        expiry            TEXT    NOT NULL,
        
        iv_30d            REAL,
        iv_60d            REAL,
        hv_20d            REAL,
        hv_60d            REAL,
        iv_rank           INTEGER,
        
        net_delta         REAL,
        atm_gamma         REAL,
        vega_per_1pct     REAL,
        theta_daily       REAL,
        
        call_otm_iv       REAL,
        put_otm_iv        REAL,
        skew_ratio        REAL,
        
        implied_move_pct  REAL,
        
        regime            TEXT,
        raw_json          TEXT,
        
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(date, ticker, expiry)
      );
      CREATE INDEX IF NOT EXISTS idx_option_snapshots_date 
        ON option_snapshots(date DESC, ticker, expiry);

      CREATE TABLE IF NOT EXISTS option_projections (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        date                    TEXT    NOT NULL,
        ticker                  TEXT    NOT NULL,
        horizon_days            INTEGER NOT NULL,
        
        prob_distribution       TEXT    NOT NULL,
        key_levels              TEXT    NOT NULL,
        
        regime_classification   TEXT,
        
        created_at              INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(date, ticker, horizon_days)
      );
      CREATE INDEX IF NOT EXISTS idx_option_projections_date 
        ON option_projections(date DESC, ticker);
    `);
  }
  
  // Create v4 option_prices table if it doesn't exist
  if (!hasOptionPrices) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS option_prices (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker            TEXT    NOT NULL,
        strike            REAL    NOT NULL,
        expiry_date       TEXT    NOT NULL,
        option_type       TEXT    NOT NULL DEFAULT 'call',
        timestamp         INTEGER NOT NULL,
        price             REAL    NOT NULL,
        bid               REAL,
        ask               REAL,
        volume            INTEGER,
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

        UNIQUE(ticker, strike, expiry_date, option_type, timestamp)
      );
      CREATE INDEX IF NOT EXISTS idx_option_prices_lookup
        ON option_prices(ticker, strike, expiry_date, option_type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_option_prices_expiry
        ON option_prices(expiry_date);
    `);
  }

  // Create v5 chat tables + FTS5 if they don't exist
  if (!hasConversations) {
    db.exec(CHAT_SCHEMA_V5);
  }

  // Create v6 AI forecasts table (idempotent — always safe to run)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_forecasts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker        TEXT    NOT NULL,
      date          TEXT    NOT NULL,
      forecast_json TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(ticker, date)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_forecasts_ticker_date
      ON ai_forecasts(ticker, date DESC);
  `);
}

export function createDb(dbPath: string): DbInstance {
  const db = new Database(dbPath);

  // Enable foreign key enforcement (required for ON DELETE CASCADE on chat_messages)
  db.pragma('foreign_keys = ON');

  // Create table if brand new, then migrate if upgrading
  try {
    db.exec(SCHEMA_V4);
  } catch {
    // Table may already exist with v1, v2, or v3 schema — migrate below
  }
  migrate(db);

  // ─── Report CRUD ────────────────────────────────────────────────────────────

  function insertOrReplaceReport(
    date: string,
    period: ReportPeriod,
    tickerData: object,
    reportJson: object,
    model: string,
  ): ReportRow {
    const generated_at = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO reports (date, period, generated_at, ticker_data, report_json, model)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, period) DO UPDATE SET
        generated_at = excluded.generated_at,
        ticker_data  = excluded.ticker_data,
        report_json  = excluded.report_json,
        model        = excluded.model
    `).run(date, period, generated_at, JSON.stringify(tickerData), JSON.stringify(reportJson), model);

    return db.prepare('SELECT * FROM reports WHERE date = ? AND period = ?').get(date, period) as ReportRow;
  }

  function getLatestReport(): ReportRow | null {
    return (db.prepare(
      'SELECT * FROM reports ORDER BY generated_at DESC, id DESC LIMIT 1'
    ).get() as ReportRow) ?? null;
  }

  function getReportByDate(date: string, period?: ReportPeriod): ReportRow | null {
    if (period) {
      return (db.prepare(
        'SELECT * FROM reports WHERE date = ? AND period = ?'
      ).get(date, period) as ReportRow) ?? null;
    }
    // No period specified — return latest generated for that date
    return (db.prepare(
      'SELECT * FROM reports WHERE date = ? ORDER BY generated_at DESC LIMIT 1'
    ).get(date) as ReportRow) ?? null;
  }

  function listReports(limit = 50): Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[] {
    return db.prepare(
      'SELECT id, date, period, generated_at, model FROM reports ORDER BY generated_at DESC, id DESC LIMIT ?',
    ).all(limit) as Pick<ReportRow, 'id' | 'date' | 'period' | 'generated_at' | 'model'>[];
  }

  // ─── Option Snapshot CRUD ────────────────────────────────────────────────────

  function insertOptionSnapshot(snapshot: Omit<OptionSnapshot, 'id' | 'created_at'>): OptionSnapshot {
    db.prepare(`
      INSERT INTO option_snapshots (
        date, ticker, expiry, iv_30d, iv_60d, hv_20d, hv_60d, iv_rank,
        net_delta, atm_gamma, vega_per_1pct, theta_daily,
        call_otm_iv, put_otm_iv, skew_ratio, implied_move_pct,
        regime, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, ticker, expiry) DO UPDATE SET
        iv_30d = excluded.iv_30d,
        iv_60d = excluded.iv_60d,
        hv_20d = excluded.hv_20d,
        hv_60d = excluded.hv_60d,
        iv_rank = excluded.iv_rank,
        net_delta = excluded.net_delta,
        atm_gamma = excluded.atm_gamma,
        vega_per_1pct = excluded.vega_per_1pct,
        theta_daily = excluded.theta_daily,
        call_otm_iv = excluded.call_otm_iv,
        put_otm_iv = excluded.put_otm_iv,
        skew_ratio = excluded.skew_ratio,
        implied_move_pct = excluded.implied_move_pct,
        regime = excluded.regime,
        raw_json = excluded.raw_json
    `).run(
      snapshot.date,
      snapshot.ticker,
      snapshot.expiry,
      snapshot.iv_30d ?? null,
      snapshot.iv_60d ?? null,
      snapshot.hv_20d ?? null,
      snapshot.hv_60d ?? null,
      snapshot.iv_rank ?? null,
      snapshot.net_delta ?? null,
      snapshot.atm_gamma ?? null,
      snapshot.vega_per_1pct ?? null,
      snapshot.theta_daily ?? null,
      snapshot.call_otm_iv ?? null,
      snapshot.put_otm_iv ?? null,
      snapshot.skew_ratio ?? null,
      snapshot.implied_move_pct ?? null,
      snapshot.regime ?? null,
      snapshot.raw_json,
    );

    return db.prepare(
      'SELECT * FROM option_snapshots WHERE date = ? AND ticker = ? AND expiry = ?'
    ).get(snapshot.date, snapshot.ticker, snapshot.expiry) as OptionSnapshot;
  }

  function getOptionSnapshot(date: string, ticker: string, expiry: string): OptionSnapshot | null {
    const raw = db.prepare(
      'SELECT * FROM option_snapshots WHERE date = ? AND ticker = ? AND expiry = ?'
    ).get(date, ticker, expiry) as Record<string, unknown>;
    
    return raw ? parseOptionSnapshot(raw) : null;
  }

  function getLatestOptionSnapshot(ticker: string, expiry: string): OptionSnapshot | null {
    const raw = db.prepare(
      'SELECT * FROM option_snapshots WHERE ticker = ? AND expiry = ? ORDER BY date DESC LIMIT 1'
    ).get(ticker, expiry) as Record<string, unknown>;
    
    return raw ? parseOptionSnapshot(raw) : null;
  }

  // ─── Option Projection CRUD ──────────────────────────────────────────────────

  function insertOptionProjection(projection: Omit<OptionProjection, 'id' | 'created_at'>): OptionProjection {
    db.prepare(`
      INSERT INTO option_projections (
        date, ticker, horizon_days, prob_distribution, key_levels, regime_classification
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, ticker, horizon_days) DO UPDATE SET
        prob_distribution = excluded.prob_distribution,
        key_levels = excluded.key_levels,
        regime_classification = excluded.regime_classification
    `).run(
      projection.date,
      projection.ticker,
      projection.horizon_days,
      JSON.stringify(projection.prob_distribution),
      JSON.stringify(projection.key_levels),
      projection.regime_classification ?? null,
    );

    const raw = db.prepare(
      'SELECT * FROM option_projections WHERE date = ? AND ticker = ? AND horizon_days = ?'
    ).get(projection.date, projection.ticker, projection.horizon_days) as Record<string, unknown>;
    
    return parseOptionProjection(raw);
  }

  function getOptionProjection(date: string, ticker: string, horizonDays: number): OptionProjection | null {
    const raw = db.prepare(
      'SELECT * FROM option_projections WHERE date = ? AND ticker = ? AND horizon_days = ?'
    ).get(date, ticker, horizonDays) as Record<string, unknown>;
    
    return raw ? parseOptionProjection(raw) : null;
  }

  // ─── Option Price CRUD ───────────────────────────────────────────────────────

  function insertOptionPrice(price: Omit<OptionPrice, 'id' | 'created_at'>): OptionPrice {
    db.prepare(`
      INSERT INTO option_prices (
        ticker, strike, expiry_date, option_type, timestamp, price, bid, ask, volume
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ticker, strike, expiry_date, option_type, timestamp) DO UPDATE SET
        price = excluded.price,
        bid = excluded.bid,
        ask = excluded.ask,
        volume = excluded.volume
    `).run(
      price.ticker,
      price.strike,
      price.expiry_date,
      price.option_type,
      price.timestamp,
      price.price,
      price.bid ?? null,
      price.ask ?? null,
      price.volume ?? null,
    );

    return db.prepare(
      'SELECT * FROM option_prices WHERE ticker = ? AND strike = ? AND expiry_date = ? AND option_type = ? AND timestamp = ?'
    ).get(price.ticker, price.strike, price.expiry_date, price.option_type, price.timestamp) as OptionPrice;
  }

  function getOptionPrices(
    ticker: string,
    strike: number,
    expiryDate: string,
    optionType: 'call' | 'put',
    startTimestamp: number,
    endTimestamp: number,
  ): OptionPrice[] {
    return db.prepare(`
      SELECT * FROM option_prices
      WHERE ticker = ? AND strike = ? AND expiry_date = ? AND option_type = ?
        AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `).all(ticker, strike, expiryDate, optionType, startTimestamp, endTimestamp) as OptionPrice[];
  }

  function getUnderlyingPrices(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ticker: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startTimestamp: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    endTimestamp: number,
  ): Array<{ timestamp: number; price: number }> {
    // For now, return empty array as we don't have market_data table in schema
    // This would be populated from market_data if available
    return [];
  }

  // ─── Chat CRUD (v5) ──────────────────────────────────────────────────────────

  function createConversation(userId = 'default', title = 'New Conversation'): ConversationRow {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO conversations (id, user_id, title, message_count, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(id, userId, title, now, now);
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow;
  }

  function getConversation(id: string): ConversationRow | null {
    return (db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow) ?? null;
  }

  function listConversations(userId: string, options: ConversationListOptions = {}): PaginatedResult<ConversationRow> {
    const limit  = Math.min(options.limit  ?? 20, 100);
    const offset = options.offset ?? 0;
    const sort   = options.sort === 'created_at' ? 'created_at' : 'updated_at';

    const total = (db.prepare(
      'SELECT COUNT(*) as cnt FROM conversations WHERE user_id = ?'
    ).get(userId) as { cnt: number }).cnt;

    const rows = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY ${sort} DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as ConversationRow[];

    return { rows, total, hasMore: offset + rows.length < total };
  }

  function updateConversation(id: string, updates: { title?: string }): void {
    const now = Math.floor(Date.now() / 1000);
    if (updates.title !== undefined) {
      db.prepare(
        'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?'
      ).run(updates.title, now, id);
    } else {
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);
    }
  }

  function deleteConversation(id: string): void {
    // Delete messages first so the FTS triggers fire (SQLite CASCADE does not fire triggers).
    db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(id);
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  function incrementMessageCount(conversationId: string): void {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE conversations
      SET message_count = message_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, conversationId);
  }

  function insertChatMessage(msg: Omit<ChatMessageRow, 'created_at'>): ChatMessageRow {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, tokens_used, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.conversation_id,
      msg.role,
      msg.content,
      msg.tokens_used ?? null,
      msg.metadata ?? null,
      now,
    );
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msg.id) as ChatMessageRow;
  }

  function getChatMessages(conversationId: string): ChatMessageRow[] {
    // Uses composite index idx_chat_messages_conv_created
    return db.prepare(`
      SELECT * FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId) as ChatMessageRow[];
  }

  function searchChatMessages(
    query: string,
    options: { limit?: number; offset?: number; conversationId?: string } = {},
  ): PaginatedResult<ChatMessageSearchResult> & { executionTimeMs: number } {
    const limit  = Math.min(options.limit  ?? 20, 100);
    const offset = options.offset ?? 0;
    const start  = Date.now();

    // Normalize the query: strip FTS5 special chars so user input doesn't break the parser.
    // Hyphens, quotes, +, *, ^ and column-specifier : are all treated as word separators.
    const normalizedQuery = query
      .replace(/["\-+*^:]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .join(' ');

    if (!normalizedQuery) {
      return { rows: [], total: 0, hasMore: false, executionTimeMs: Date.now() - start };
    }

    const baseWhere = options.conversationId
      ? 'AND m.conversation_id = ?'
      : '';
    const params: (string | number)[] = options.conversationId
      ? [normalizedQuery, options.conversationId, limit, offset]
      : [normalizedQuery, limit, offset];
    const countParams: (string | number)[] = options.conversationId
      ? [normalizedQuery, options.conversationId]
      : [normalizedQuery];

    const total = (db.prepare(`
      SELECT COUNT(*) as cnt
      FROM chat_messages_fts fts
      JOIN chat_messages m ON m.rowid = fts.rowid
      WHERE chat_messages_fts MATCH ? ${baseWhere}
    `).get(...countParams) as { cnt: number }).cnt;

    const rows = db.prepare(`
      SELECT
        m.id         AS message_id,
        m.conversation_id,
        c.title      AS conversation_title,
        m.role,
        SUBSTR(m.content, 1, 150) AS snippet,
        m.created_at
      FROM chat_messages_fts fts
      JOIN chat_messages  m ON m.rowid = fts.rowid
      JOIN conversations  c ON c.id    = m.conversation_id
      WHERE chat_messages_fts MATCH ? ${baseWhere}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(...params) as ChatMessageSearchResult[];

    return {
      rows,
      total,
      hasMore:         offset + rows.length < total,
      executionTimeMs: Date.now() - start,
    };
  }

  // ─── AI Forecast CRUD ────────────────────────────────────────────────────────

  function getAIForecast(ticker: string, date: string): AIForecastRow | null {
    return db.prepare(
      'SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?'
    ).get(ticker, date) as AIForecastRow | null;
  }

  function insertOrReplaceAIForecast(ticker: string, date: string, analysis: object): void {
    db.prepare(`
      INSERT INTO ai_forecasts (ticker, date, forecast_json)
      VALUES (?, ?, ?)
      ON CONFLICT(ticker, date) DO UPDATE SET
        forecast_json = excluded.forecast_json,
        created_at    = datetime('now')
    `).run(ticker, date, JSON.stringify(analysis));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function parseOptionSnapshot(raw: Record<string, unknown>): OptionSnapshot {
    return {
      ...raw,
      prob_distribution: raw.prob_distribution ? JSON.parse(raw.prob_distribution as string) : [],
    } as unknown as OptionSnapshot;
  }

  function parseOptionProjection(raw: Record<string, unknown>): OptionProjection {
    return {
      ...raw,
      prob_distribution: JSON.parse(raw.prob_distribution as string),
      key_levels: JSON.parse(raw.key_levels as string),
    } as unknown as OptionProjection;
  }

  return {
    db,
    insertOrReplaceReport,
    getLatestReport,
    getReportByDate,
    listReports,
    insertOptionSnapshot,
    getOptionSnapshot,
    getLatestOptionSnapshot,
    insertOptionProjection,
    getOptionProjection,
    insertOptionPrice,
    getOptionPrices,
    getUnderlyingPrices,
    // Chat (v5)
    createConversation,
    getConversation,
    listConversations,
    updateConversation,
    deleteConversation,
    incrementMessageCount,
    insertChatMessage,
    getChatMessages,
    searchChatMessages,
    // AI Forecasts (v6)
    getAIForecast,
    insertOrReplaceAIForecast,
  };
}

// ─── Module-level singleton (production) ─────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'reports.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const _instance = createDb(DB_PATH);

// Reports
export const insertOrReplaceReport = _instance.insertOrReplaceReport.bind(_instance);
export const getLatestReport       = _instance.getLatestReport.bind(_instance);
export const getReportByDate       = _instance.getReportByDate.bind(_instance);
export const listReports           = _instance.listReports.bind(_instance);

// Options
export const insertOptionSnapshot     = _instance.insertOptionSnapshot.bind(_instance);
export const getOptionSnapshot        = _instance.getOptionSnapshot.bind(_instance);
export const getLatestOptionSnapshot  = _instance.getLatestOptionSnapshot.bind(_instance);
export const insertOptionProjection   = _instance.insertOptionProjection.bind(_instance);
export const getOptionProjection      = _instance.getOptionProjection.bind(_instance);

// Option Prices (for chart overlay)
export const insertOptionPrice     = _instance.insertOptionPrice.bind(_instance);
export const getOptionPrices       = _instance.getOptionPrices.bind(_instance);
export const getUnderlyingPrices   = _instance.getUnderlyingPrices.bind(_instance);

// Chat (v5)
export const createConversation    = _instance.createConversation.bind(_instance);
export const getConversation       = _instance.getConversation.bind(_instance);
export const listConversations     = _instance.listConversations.bind(_instance);
export const updateConversation    = _instance.updateConversation.bind(_instance);
export const deleteConversation    = _instance.deleteConversation.bind(_instance);
export const incrementMessageCount = _instance.incrementMessageCount.bind(_instance);
export const insertChatMessage     = _instance.insertChatMessage.bind(_instance);
export const getChatMessages       = _instance.getChatMessages.bind(_instance);
export const searchChatMessages    = _instance.searchChatMessages.bind(_instance);

// AI Forecasts (v6)
export const getAIForecast            = _instance.getAIForecast.bind(_instance);
export const insertOrReplaceAIForecast = _instance.insertOrReplaceAIForecast.bind(_instance);

export default _instance.db;
