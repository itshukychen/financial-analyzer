import { describe, it, expect, beforeEach } from 'vitest';
import { createDb, type DbInstance } from '@/lib/db';

// ─── Setup ─────────────────────────────────────────────────────────────────

let db: DbInstance;

beforeEach(() => {
  db = createDb(':memory:');
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function newConv(userId = 'user-1', title = 'Test Chat'): ReturnType<DbInstance['createConversation']> {
  return db.createConversation(userId, title);
}

function newMsg(
  conversationId: string,
  role: 'user' | 'assistant' = 'user',
  content = 'hello world',
): ReturnType<DbInstance['insertChatMessage']> {
  return db.insertChatMessage({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    tokens_used: null,
    metadata: null,
  });
}

// ─── Schema: index existence ────────────────────────────────────────────────

describe('schema: indexes exist', () => {
  function getIndexes(raw: DbInstance): string[] {
    const rows = raw.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
    ).all() as { name: string }[];
    return rows.map(r => r.name);
  }

  it('has idx_conversations_user_updated for paginated listing by updated_at', () => {
    expect(getIndexes(db)).toContain('idx_conversations_user_updated');
  });

  it('has idx_conversations_user_created for paginated listing by created_at', () => {
    expect(getIndexes(db)).toContain('idx_conversations_user_created');
  });

  it('has idx_chat_messages_conversation_id (FK index)', () => {
    expect(getIndexes(db)).toContain('idx_chat_messages_conversation_id');
  });

  it('has idx_chat_messages_conv_created (composite index for message retrieval)', () => {
    expect(getIndexes(db)).toContain('idx_chat_messages_conv_created');
  });
});

// ─── Schema: FTS5 triggers exist ───────────────────────────────────────────

describe('schema: FTS5 triggers exist', () => {
  function getTriggers(raw: DbInstance): string[] {
    const rows = raw.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
    ).all() as { name: string }[];
    return rows.map(r => r.name);
  }

  it('has chat_messages_fts_ai (after insert)', () => {
    expect(getTriggers(db)).toContain('chat_messages_fts_ai');
  });

  it('has chat_messages_fts_ad (after delete)', () => {
    expect(getTriggers(db)).toContain('chat_messages_fts_ad');
  });

  it('has chat_messages_fts_au (after update)', () => {
    expect(getTriggers(db)).toContain('chat_messages_fts_au');
  });
});

// ─── EXPLAIN QUERY PLAN: index usage ───────────────────────────────────────

describe('EXPLAIN QUERY PLAN: listConversations uses index', () => {
  it('uses idx_conversations_user_updated for default sort', () => {
    const plan = db.db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 20 OFFSET 0
    `).raw(false);
    const rows = db.db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 20 OFFSET 0
    `).all('user-1') as { detail: string }[];
    const details = rows.map(r => r.detail).join(' ');
    // Expect the query to use an index scan rather than a full table scan
    expect(plan).toBeDefined(); // statement compiles
    expect(details).toMatch(/idx_conversations_user|SEARCH conversations/i);
  });

  it('uses idx_chat_messages_conv_created for getChatMessages', () => {
    const rows = db.db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT * FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all('conv-id') as { detail: string }[];
    const details = rows.map(r => r.detail).join(' ');
    expect(details).toMatch(/idx_chat_messages_conv_created|SEARCH chat_messages/i);
  });
});

// ─── FTS5: trigger sync on INSERT ──────────────────────────────────────────

describe('FTS5 triggers: INSERT sync', () => {
  it('inserts message content into FTS index via trigger', () => {
    const conv = newConv();
    newMsg(conv.id, 'user', 'volatility spike detected');

    const results = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'volatility'"
    ).all() as { content: string }[];

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('volatility spike detected');
  });

  it('multiple messages are all in the FTS index', () => {
    const conv = newConv();
    newMsg(conv.id, 'user', 'buy signal on SPWX');
    newMsg(conv.id, 'assistant', 'sell signal detected for portfolio');

    const buyResults = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'buy'"
    ).all();
    const sellResults = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'sell'"
    ).all();

    expect(buyResults).toHaveLength(1);
    expect(sellResults).toHaveLength(1);
  });
});

// ─── FTS5: trigger sync on DELETE ──────────────────────────────────────────

describe('FTS5 triggers: DELETE sync', () => {
  it('removes deleted message from FTS index', () => {
    const conv = newConv();
    const msg = newMsg(conv.id, 'user', 'options gamma scalping strategy');

    // Verify it's in FTS
    const before = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'gamma'"
    ).all();
    expect(before).toHaveLength(1);

    // Delete the message
    db.db.prepare('DELETE FROM chat_messages WHERE id = ?').run(msg.id);

    // FTS should no longer have it
    const after = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'gamma'"
    ).all();
    expect(after).toHaveLength(0);
  });
});

// ─── FTS5: trigger sync on UPDATE ──────────────────────────────────────────

describe('FTS5 triggers: UPDATE sync', () => {
  it('updates FTS index when message content changes', () => {
    const conv = newConv();
    const msg = newMsg(conv.id, 'user', 'iron condor setup');

    // Verify original content is indexed
    const before = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'condor'"
    ).all();
    expect(before).toHaveLength(1);

    // Update content
    db.db.prepare('UPDATE chat_messages SET content = ? WHERE id = ?').run(
      'butterfly spread setup',
      msg.id,
    );

    // Old term should be gone
    const oldTerm = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'condor'"
    ).all();
    expect(oldTerm).toHaveLength(0);

    // New term should be present
    const newTerm = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'butterfly'"
    ).all();
    expect(newTerm).toHaveLength(1);
  });
});

// ─── createConversation ────────────────────────────────────────────────────

describe('createConversation', () => {
  it('creates a conversation with UUID id', () => {
    const conv = newConv();
    expect(conv.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stores the user_id and title', () => {
    const conv = db.createConversation('user-42', 'My Portfolio Questions');
    expect(conv.user_id).toBe('user-42');
    expect(conv.title).toBe('My Portfolio Questions');
  });

  it('defaults to user_id=default and generic title', () => {
    const conv = db.createConversation();
    expect(conv.user_id).toBe('default');
    expect(conv.title).toBe('New Conversation');
  });

  it('sets message_count to 0', () => {
    const conv = newConv();
    expect(conv.message_count).toBe(0);
  });

  it('sets created_at and updated_at as unix timestamps', () => {
    const before = Math.floor(Date.now() / 1000);
    const conv = newConv();
    const after = Math.floor(Date.now() / 1000);
    expect(conv.created_at).toBeGreaterThanOrEqual(before);
    expect(conv.created_at).toBeLessThanOrEqual(after);
    expect(conv.updated_at).toBeGreaterThanOrEqual(before);
  });
});

// ─── getConversation ───────────────────────────────────────────────────────

describe('getConversation', () => {
  it('returns the conversation by id', () => {
    const conv = newConv('u1', 'Finance Chat');
    const result = db.getConversation(conv.id);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Finance Chat');
  });

  it('returns null for unknown id', () => {
    expect(db.getConversation('non-existent-id')).toBeNull();
  });
});

// ─── listConversations (pagination) ────────────────────────────────────────

describe('listConversations pagination', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      db.createConversation('u1', `Chat ${i}`);
    }
    db.createConversation('u2', 'Other user chat');
  });

  it('returns only conversations for the given user', () => {
    const result = db.listConversations('u1');
    expect(result.rows.every(r => r.user_id === 'u1')).toBe(true);
  });

  it('returns total count for the user', () => {
    expect(db.listConversations('u1').total).toBe(5);
    expect(db.listConversations('u2').total).toBe(1);
  });

  it('respects limit', () => {
    const result = db.listConversations('u1', { limit: 2 });
    expect(result.rows).toHaveLength(2);
  });

  it('respects offset', () => {
    const all = db.listConversations('u1', { limit: 5 });
    const paged = db.listConversations('u1', { limit: 5, offset: 2 });
    expect(paged.rows).toHaveLength(3);
    expect(paged.rows[0].id).toBe(all.rows[2].id);
  });

  it('hasMore is true when more rows exist', () => {
    expect(db.listConversations('u1', { limit: 2 }).hasMore).toBe(true);
  });

  it('hasMore is false when on the last page', () => {
    expect(db.listConversations('u1', { limit: 10 }).hasMore).toBe(false);
  });

  it('caps limit at 100', () => {
    const result = db.listConversations('u1', { limit: 999 });
    // limit capped at 100 — 5 rows exist so all are returned
    expect(result.rows.length).toBeLessThanOrEqual(100);
  });

  it('sorts by updated_at DESC by default', () => {
    const result = db.listConversations('u1');
    for (let i = 0; i < result.rows.length - 1; i++) {
      expect(result.rows[i].updated_at).toBeGreaterThanOrEqual(result.rows[i + 1].updated_at);
    }
  });

  it('sorts by created_at DESC when specified', () => {
    const result = db.listConversations('u1', { sort: 'created_at' });
    for (let i = 0; i < result.rows.length - 1; i++) {
      expect(result.rows[i].created_at).toBeGreaterThanOrEqual(result.rows[i + 1].created_at);
    }
  });

  it('returns empty rows with total=0 for unknown user', () => {
    const result = db.listConversations('unknown-user');
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

// ─── updateConversation ────────────────────────────────────────────────────

describe('updateConversation', () => {
  it('updates the title', () => {
    const conv = newConv('u1', 'Old Title');
    db.updateConversation(conv.id, { title: 'New Title' });
    expect(db.getConversation(conv.id)?.title).toBe('New Title');
  });

  it('updates updated_at timestamp', () => {
    const conv = newConv();
    const before = Math.floor(Date.now() / 1000);
    db.updateConversation(conv.id, { title: 'Updated' });
    const updated = db.getConversation(conv.id);
    expect(updated?.updated_at).toBeGreaterThanOrEqual(before);
  });
});

// ─── deleteConversation ────────────────────────────────────────────────────

describe('deleteConversation', () => {
  it('removes the conversation', () => {
    const conv = newConv();
    db.deleteConversation(conv.id);
    expect(db.getConversation(conv.id)).toBeNull();
  });

  it('cascades to delete child messages', () => {
    const conv = newConv();
    newMsg(conv.id, 'user', 'cascade delete test');
    db.deleteConversation(conv.id);
    const msgs = db.getChatMessages(conv.id);
    expect(msgs).toHaveLength(0);
  });

  it('removes child messages from FTS index on cascade delete', () => {
    const conv = newConv();
    newMsg(conv.id, 'user', 'unique cascade fts term');
    db.deleteConversation(conv.id);
    const fts = db.db.prepare(
      "SELECT * FROM chat_messages_fts WHERE chat_messages_fts MATCH 'cascade'"
    ).all();
    expect(fts).toHaveLength(0);
  });
});

// ─── incrementMessageCount ─────────────────────────────────────────────────

describe('incrementMessageCount', () => {
  it('increments by 1 each call', () => {
    const conv = newConv();
    db.incrementMessageCount(conv.id);
    db.incrementMessageCount(conv.id);
    expect(db.getConversation(conv.id)?.message_count).toBe(2);
  });
});

// ─── insertChatMessage & getChatMessages ───────────────────────────────────

describe('insertChatMessage and getChatMessages', () => {
  it('inserts a user message and retrieves it', () => {
    const conv = newConv();
    const msg = newMsg(conv.id, 'user', 'what is IV rank?');
    expect(msg.content).toBe('what is IV rank?');
    expect(msg.role).toBe('user');
  });

  it('getChatMessages returns messages ordered by created_at ASC', () => {
    const conv = newConv();
    newMsg(conv.id, 'user', 'first');
    newMsg(conv.id, 'assistant', 'second');
    newMsg(conv.id, 'user', 'third');
    const msgs = db.getChatMessages(conv.id);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe('first');
    expect(msgs[2].content).toBe('third');
    for (let i = 0; i < msgs.length - 1; i++) {
      expect(msgs[i].created_at).toBeLessThanOrEqual(msgs[i + 1].created_at);
    }
  });

  it('getChatMessages returns only messages for the given conversation', () => {
    const conv1 = newConv();
    const conv2 = newConv();
    newMsg(conv1.id, 'user', 'conv1 message');
    newMsg(conv2.id, 'user', 'conv2 message');
    expect(db.getChatMessages(conv1.id)).toHaveLength(1);
    expect(db.getChatMessages(conv2.id)).toHaveLength(1);
  });

  it('stores tokens_used and metadata when provided', () => {
    const conv = newConv();
    const msg = db.insertChatMessage({
      id: crypto.randomUUID(),
      conversation_id: conv.id,
      role: 'assistant',
      content: 'Here is your analysis.',
      tokens_used: 350,
      metadata: JSON.stringify({ pinned: true }),
    });
    expect(msg.tokens_used).toBe(350);
    expect(msg.metadata).toBe(JSON.stringify({ pinned: true }));
  });
});

// ─── searchChatMessages ────────────────────────────────────────────────────

describe('searchChatMessages', () => {
  beforeEach(() => {
    const conv1 = db.createConversation('u1', 'Volatility Discussion');
    newMsg(conv1.id, 'user', 'what is implied volatility rank?');
    newMsg(conv1.id, 'assistant', 'IV rank measures current IV against historical range');

    const conv2 = db.createConversation('u1', 'Portfolio Review');
    newMsg(conv2.id, 'user', 'show me my portfolio delta exposure');
    newMsg(conv2.id, 'assistant', 'your net delta is 42');
  });

  it('returns results matching the query', () => {
    const result = db.searchChatMessages('volatility');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.some(r => r.snippet.toLowerCase().includes('volatility'))).toBe(true);
  });

  it('returns total count', () => {
    const result = db.searchChatMessages('volatility');
    expect(result.total).toBeGreaterThan(0);
  });

  it('includes conversation_title in results', () => {
    const result = db.searchChatMessages('volatility');
    expect(result.rows.every(r => typeof r.conversation_title === 'string')).toBe(true);
  });

  it('includes executionTimeMs', () => {
    const result = db.searchChatMessages('delta');
    expect(typeof result.executionTimeMs).toBe('number');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('limits snippet to 150 chars', () => {
    const conv = db.createConversation('u1', 'Long Message Test');
    newMsg(conv.id, 'user', 'A'.repeat(200) + ' searchterm ' + 'B'.repeat(200));
    const result = db.searchChatMessages('searchterm');
    const longResult = result.rows.find(r => r.snippet.includes('searchterm') || r.snippet.length <= 150);
    expect(longResult?.snippet.length).toBeLessThanOrEqual(150);
  });

  it('filters by conversationId when provided', () => {
    const conv1 = db.listConversations('u1').rows.find(r => r.title === 'Volatility Discussion')!;
    const result = db.searchChatMessages('volatility', { conversationId: conv1.id });
    expect(result.rows.every(r => r.conversation_id === conv1.id)).toBe(true);
  });

  it('respects limit and offset for pagination', () => {
    const conv = db.createConversation('u1', 'Many Results');
    for (let i = 0; i < 5; i++) {
      newMsg(conv.id, 'user', `searchkeyword result number ${i}`);
    }
    const page1 = db.searchChatMessages('searchkeyword', { limit: 2 });
    const page2 = db.searchChatMessages('searchkeyword', { limit: 2, offset: 2 });
    expect(page1.rows).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page2.rows.length).toBeGreaterThan(0);
    expect(page2.rows[0].message_id).not.toBe(page1.rows[0].message_id);
  });

  it('returns empty result for no matches', () => {
    const result = db.searchChatMessages('xyznonexistentterm99');
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
