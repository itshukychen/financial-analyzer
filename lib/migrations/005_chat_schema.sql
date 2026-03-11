-- lib/migrations/005_chat_schema.sql
-- Migration: Add conversations and chat_messages tables with FTS5 and optimized indexes

-- ─── conversations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL DEFAULT 'default',
  title         TEXT    NOT NULL DEFAULT 'New Conversation',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index: list conversations for a user, most recently updated first (Task 6 default sort)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);

-- Index: list conversations for a user, sorted by created date (Task 6 sort=created_at)
CREATE INDEX IF NOT EXISTS idx_conversations_user_created
  ON conversations(user_id, created_at DESC);

-- ─── chat_messages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id              TEXT    PRIMARY KEY,
  conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
  content         TEXT    NOT NULL,
  tokens_used     INTEGER,
  metadata        TEXT,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index: FK index required for ON DELETE CASCADE and JOIN performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
  ON chat_messages(conversation_id);

-- Composite index: fast ordered message retrieval within a conversation (Task 7 primary query)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON chat_messages(conversation_id, created_at ASC);

-- ─── FTS5 full-text search ────────────────────────────────────────────────────
-- External content table: content is stored in chat_messages, FTS5 holds only the index.
-- Triggers below keep the FTS index in sync with the source table.

CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
  content,
  conversation_id UNINDEXED,
  message_id      UNINDEXED,
  content='chat_messages',
  content_rowid='rowid'
);

-- Trigger: sync FTS on INSERT
CREATE TRIGGER IF NOT EXISTS chat_messages_fts_ai
  AFTER INSERT ON chat_messages
BEGIN
  INSERT INTO chat_messages_fts(rowid, content, conversation_id, message_id)
  VALUES (new.rowid, new.content, new.conversation_id, new.id);
END;

-- Trigger: sync FTS on DELETE (external content table uses special 'delete' command)
CREATE TRIGGER IF NOT EXISTS chat_messages_fts_ad
  AFTER DELETE ON chat_messages
BEGIN
  INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, conversation_id, message_id)
  VALUES ('delete', old.rowid, old.content, old.conversation_id, old.id);
END;

-- Trigger: sync FTS on UPDATE (delete old entry, insert new entry)
CREATE TRIGGER IF NOT EXISTS chat_messages_fts_au
  AFTER UPDATE OF content ON chat_messages
BEGIN
  INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, conversation_id, message_id)
  VALUES ('delete', old.rowid, old.content, old.conversation_id, old.id);
  INSERT INTO chat_messages_fts(rowid, content, conversation_id, message_id)
  VALUES (new.rowid, new.content, new.conversation_id, new.id);
END;
