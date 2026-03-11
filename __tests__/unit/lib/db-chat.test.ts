import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb } from '@/lib/db';
import type { DbInstance } from '@/lib/db';
import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';

// ─── Fresh database tests ─────────────────────────────────────────────────────

describe('v5 migration — fresh database', () => {
  let inst: DbInstance;

  beforeEach(() => {
    inst = createDb(':memory:');
  });

  it('creates the conversations table', () => {
    const row = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'")
      .get();
    expect(row).toBeTruthy();
  });

  it('creates the chat_messages table', () => {
    const row = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'")
      .get();
    expect(row).toBeTruthy();
  });

  it('creates the chat_messages_fts virtual table', () => {
    const row = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages_fts'")
      .get();
    expect(row).toBeTruthy();
  });

  it('creates FTS sync triggers', () => {
    const triggers = (
      inst.db
        .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='chat_messages'")
        .all() as { name: string }[]
    ).map((r) => r.name);

    expect(triggers).toContain('chat_messages_fts_ai');
    expect(triggers).toContain('chat_messages_fts_ad');
    expect(triggers).toContain('chat_messages_fts_au');
  });

  it('preserves existing v4 tables on a fresh database', () => {
    const tables = (
      inst.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[]
    ).map((r) => r.name);

    expect(tables).toContain('reports');
    expect(tables).toContain('option_snapshots');
    expect(tables).toContain('option_projections');
    expect(tables).toContain('option_prices');
  });
});

// ─── Migration from v4 database ───────────────────────────────────────────────

describe('v5 migration — existing v4 database with data', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-test-'));
    dbPath = path.join(tmpDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds v5 tables to a database that only has v4 tables', () => {
    // Simulate a v4 database (no conversations/chat_messages)
    const v4Db = new Database(dbPath);
    v4Db.exec(`
      CREATE TABLE reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'eod',
        generated_at INTEGER NOT NULL,
        ticker_data TEXT NOT NULL,
        report_json TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
        UNIQUE(date, period)
      );
      CREATE TABLE option_snapshots (id INTEGER PRIMARY KEY, date TEXT, ticker TEXT, expiry TEXT, UNIQUE(date, ticker, expiry));
      CREATE TABLE option_projections (id INTEGER PRIMARY KEY, date TEXT, ticker TEXT, horizon_days INTEGER, prob_distribution TEXT, key_levels TEXT, UNIQUE(date, ticker, horizon_days));
      CREATE TABLE option_prices (id INTEGER PRIMARY KEY, ticker TEXT, strike REAL, expiry_date TEXT, option_type TEXT, timestamp INTEGER, price REAL, UNIQUE(ticker, strike, expiry_date, option_type, timestamp));

      INSERT INTO reports (date, period, generated_at, ticker_data, report_json, model)
      VALUES ('2026-01-01', 'eod', 1735689600, '{}', '{}', 'claude-sonnet-4-5');
    `);
    v4Db.close();

    // Now open with createDb — migration should run and add v5 tables
    const inst = createDb(dbPath);

    // v4 data is preserved
    const report = inst.getReportByDate('2026-01-01', 'eod');
    expect(report).not.toBeNull();
    expect(report?.date).toBe('2026-01-01');

    // v5 tables now exist
    const convTable = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'")
      .get();
    expect(convTable).toBeTruthy();

    const msgTable = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'")
      .get();
    expect(msgTable).toBeTruthy();

    const ftsTable = inst.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages_fts'")
      .get();
    expect(ftsTable).toBeTruthy();

    inst.db.close();
  });
});

// ─── Conversation CRUD ────────────────────────────────────────────────────────

describe('conversation CRUD', () => {
  let inst: DbInstance;

  beforeEach(() => {
    inst = createDb(':memory:');
  });

  it('createConversation returns a row with generated UUID', () => {
    const conv = inst.createConversation();
    expect(conv.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(conv.user_id).toBe('default');
    expect(conv.title).toBe('New Conversation');
    expect(conv.message_count).toBe(0);
    expect(conv.created_at).toBeGreaterThan(0);
    expect(conv.updated_at).toBeGreaterThan(0);
  });

  it('createConversation accepts custom userId and title', () => {
    const conv = inst.createConversation('user-123', 'My Chat');
    expect(conv.user_id).toBe('user-123');
    expect(conv.title).toBe('My Chat');
  });

  it('getConversation returns null for unknown id', () => {
    expect(inst.getConversation('nonexistent')).toBeNull();
  });

  it('getConversation retrieves the created conversation', () => {
    const created = inst.createConversation('u1', 'Test');
    const fetched = inst.getConversation(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.title).toBe('Test');
  });

  it('updateConversation updates title and updated_at', () => {
    const conv = inst.createConversation();
    const before = conv.updated_at;
    // Small delay to ensure updated_at changes
    const nowPlus = Math.floor(Date.now() / 1000) + 1;
    inst.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(before - 5, conv.id);

    inst.updateConversation(conv.id, { title: 'Renamed' });
    const updated = inst.getConversation(conv.id);
    expect(updated?.title).toBe('Renamed');
    expect(updated?.updated_at).toBeGreaterThanOrEqual(nowPlus - 2);
  });

  it('updateConversation with no title only touches updated_at', () => {
    const conv = inst.createConversation('u', 'Original');
    inst.updateConversation(conv.id, {});
    const updated = inst.getConversation(conv.id);
    expect(updated?.title).toBe('Original');
  });

  it('incrementMessageCount increments message_count and updates updated_at', () => {
    const conv = inst.createConversation();
    expect(conv.message_count).toBe(0);
    inst.incrementMessageCount(conv.id);
    inst.incrementMessageCount(conv.id);
    const updated = inst.getConversation(conv.id);
    expect(updated?.message_count).toBe(2);
  });

  it('deleteConversation removes the conversation', () => {
    const conv = inst.createConversation();
    inst.deleteConversation(conv.id);
    expect(inst.getConversation(conv.id)).toBeNull();
  });

  it('listConversations returns conversations for a user, sorted by updated_at DESC', () => {
    inst.createConversation('alice', 'First');
    inst.createConversation('alice', 'Second');
    inst.createConversation('bob', 'Other');

    const { rows, total, hasMore } = inst.listConversations('alice');
    expect(total).toBe(2);
    expect(rows).toHaveLength(2);
    expect(hasMore).toBe(false);
    expect(rows.every((r) => r.user_id === 'alice')).toBe(true);
  });

  it('listConversations supports pagination', () => {
    for (let i = 0; i < 5; i++) inst.createConversation('u', `Chat ${i}`);

    const page1 = inst.listConversations('u', { limit: 2, offset: 0 });
    expect(page1.rows).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page3 = inst.listConversations('u', { limit: 2, offset: 4 });
    expect(page3.rows).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });

  it('listConversations supports sort by created_at', () => {
    inst.createConversation('u', 'A');
    inst.createConversation('u', 'B');
    const { rows } = inst.listConversations('u', { sort: 'created_at' });
    expect(rows).toHaveLength(2);
  });
});

// ─── Chat message CRUD ────────────────────────────────────────────────────────

describe('chat message CRUD', () => {
  let inst: DbInstance;
  let convId: string;

  beforeEach(() => {
    inst = createDb(':memory:');
    convId = inst.createConversation().id;
  });

  it('insertChatMessage stores and returns the message', () => {
    const msg = inst.insertChatMessage({
      id:              crypto.randomUUID(),
      conversation_id: convId,
      role:            'user',
      content:         'Hello, what is IV rank?',
      tokens_used:     null,
      metadata:        null,
    });
    expect(msg.id).toBeTruthy();
    expect(msg.conversation_id).toBe(convId);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello, what is IV rank?');
    expect(msg.created_at).toBeGreaterThan(0);
  });

  it('insertChatMessage stores tokens_used and metadata', () => {
    const msg = inst.insertChatMessage({
      id:              crypto.randomUUID(),
      conversation_id: convId,
      role:            'assistant',
      content:         'IV rank measures implied volatility relative to its historical range.',
      tokens_used:     42,
      metadata:        JSON.stringify({ pinned: true }),
    });
    expect(msg.tokens_used).toBe(42);
    expect(msg.metadata).toBe(JSON.stringify({ pinned: true }));
  });

  it('getChatMessages returns all messages for a conversation in order', () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    inst.insertChatMessage({ id: ids[0], conversation_id: convId, role: 'user', content: 'Q1', tokens_used: null, metadata: null });
    inst.insertChatMessage({ id: ids[1], conversation_id: convId, role: 'assistant', content: 'A1', tokens_used: 10, metadata: null });

    const messages = inst.getChatMessages(convId);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });

  it('getChatMessages returns empty array for unknown conversation', () => {
    expect(inst.getChatMessages('no-such-conv')).toHaveLength(0);
  });

  it('deleteConversation cascades to chat_messages', () => {
    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'user',
      content: 'Will be deleted', tokens_used: null, metadata: null,
    });
    expect(inst.getChatMessages(convId)).toHaveLength(1);

    inst.deleteConversation(convId);
    expect(inst.getChatMessages(convId)).toHaveLength(0);
  });
});

// ─── Full-text search ─────────────────────────────────────────────────────────

describe('FTS5 full-text search', () => {
  let inst: DbInstance;
  let convId: string;

  beforeEach(() => {
    inst = createDb(':memory:');
    convId = inst.createConversation('u', 'Portfolio Chat').id;

    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'user',
      content: 'What is the implied volatility for SPWX?',
      tokens_used: null, metadata: null,
    });
    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'assistant',
      content: 'The implied volatility for SPWX is currently 28% on a 30-day basis.',
      tokens_used: 20, metadata: null,
    });
    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'user',
      content: 'How does delta hedging work?',
      tokens_used: null, metadata: null,
    });
  });

  it('finds messages matching a simple query', () => {
    const { rows, total } = inst.searchChatMessages('volatility');
    expect(total).toBeGreaterThanOrEqual(2);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    rows.forEach((r) => {
      expect(r.message_id).toBeTruthy();
      expect(r.conversation_id).toBe(convId);
      expect(r.conversation_title).toBe('Portfolio Chat');
      expect(r.snippet).toBeTruthy();
    });
  });

  it('returns no results for unmatched query', () => {
    const { rows, total } = inst.searchChatMessages('xyzzynotaword');
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it('scopes search to a specific conversation', () => {
    const conv2 = inst.createConversation('u', 'Other Chat').id;
    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: conv2, role: 'user',
      content: 'Tell me about volatility in bonds.',
      tokens_used: null, metadata: null,
    });

    const { rows } = inst.searchChatMessages('volatility', { conversationId: convId });
    rows.forEach((r) => expect(r.conversation_id).toBe(convId));
  });

  it('respects limit and offset for pagination', () => {
    const { rows: page1, total } = inst.searchChatMessages('volatility', { limit: 1, offset: 0 });
    expect(page1).toHaveLength(1);
    expect(total).toBeGreaterThanOrEqual(2);

    const { rows: page2 } = inst.searchChatMessages('volatility', { limit: 1, offset: 1 });
    expect(page2).toHaveLength(1);
    expect(page2[0].message_id).not.toBe(page1[0].message_id);
  });

  it('includes executionTimeMs in search results', () => {
    const result = inst.searchChatMessages('delta');
    expect(typeof result.executionTimeMs).toBe('number');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('FTS index stays in sync after message insert', () => {
    const { total: before } = inst.searchChatMessages('theta');
    expect(before).toBe(0);

    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'user',
      content: 'How does theta decay work on short options?',
      tokens_used: null, metadata: null,
    });

    const { total: after } = inst.searchChatMessages('theta');
    expect(after).toBe(1);
  });

  it('FTS index stays in sync after message delete (via conversation cascade)', () => {
    inst.insertChatMessage({
      id: crypto.randomUUID(), conversation_id: convId, role: 'user',
      content: 'unique-search-term-xyz',
      tokens_used: null, metadata: null,
    });
    const { total: before } = inst.searchChatMessages('unique-search-term-xyz');
    expect(before).toBe(1);

    inst.deleteConversation(convId);
    const { total: after } = inst.searchChatMessages('unique-search-term-xyz');
    expect(after).toBe(0);
  });
});
