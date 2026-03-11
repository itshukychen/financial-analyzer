-- lib/migrations/005_chat.sql
-- Migration 005: Add conversations and chat_messages tables with FTS5 full-text search

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

-- Regular (non-external-content) FTS5 virtual table for full-text search.
-- Stores its own copy of indexed content so queries work reliably even after
-- row deletions (SQLite CASCADE does not fire triggers, so the application
-- layer deletes chat_messages explicitly before deleting a conversation).
CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
  content,
  conversation_id UNINDEXED,
  message_id      UNINDEXED
);

-- Triggers to keep the FTS index synchronized with chat_messages

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
