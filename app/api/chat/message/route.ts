import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  validateUserMessage,
  sanitizeMessage,
  generateTitle,
} from '../../../../lib/chat/messageValidator';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

interface MessageHistoryRow {
  role: 'user' | 'assistant';
  content: string;
}

interface OptionSnapshotRow {
  ticker: string;
  date: string;
  iv_30d: number | null;
  iv_rank: number | null;
  regime: string | null;
  implied_move_pct: number | null;
}

interface OptionProjectionRow {
  ticker: string;
  horizon_days: number;
  regime_classification: string | null;
  date: string;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Exported for testing only
export const rateLimitMap: Map<string, number[]> = new Map();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const limit = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR ?? '100', 10);
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const timestamps = (rateLimitMap.get(userId) ?? []).filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const retryAfter = Math.ceil((timestamps[0] + RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return { allowed: true };
}

// ─── Database ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'reports.db');

// Schema for chat tables — added alongside existing schema
const CHAT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT    PRIMARY KEY,
    user_id       TEXT    NOT NULL DEFAULT 'default',
    title         TEXT    NOT NULL DEFAULT 'New Conversation',
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    message_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
    ON conversations(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT    PRIMARY KEY,
    conversation_id TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
    content         TEXT    NOT NULL,
    tokens_used     INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata        TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
    ON chat_messages(conversation_id, created_at ASC);

  CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
    content,
    role,
    conversation_id UNINDEXED,
    content='chat_messages',
    content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS chat_messages_ai
    AFTER INSERT ON chat_messages BEGIN
      INSERT INTO chat_messages_fts(rowid, content, role, conversation_id)
        VALUES (new.rowid, new.content, new.role, new.conversation_id);
    END;

  CREATE TRIGGER IF NOT EXISTS chat_messages_ad
    AFTER DELETE ON chat_messages BEGIN
      INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, role, conversation_id)
        VALUES ('delete', old.rowid, old.content, old.role, old.conversation_id);
    END;

  CREATE TRIGGER IF NOT EXISTS chat_messages_au
    AFTER UPDATE ON chat_messages BEGIN
      INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, role, conversation_id)
        VALUES ('delete', old.rowid, old.content, old.role, old.conversation_id);
      INSERT INTO chat_messages_fts(rowid, content, role, conversation_id)
        VALUES (new.rowid, new.content, new.role, new.conversation_id);
    END;
`;

let _db: Database.Database | null = null;

function getChatDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec(CHAT_SCHEMA);
  return _db;
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(db: Database.Database): string {
  const lines: string[] = [
    'You are a financial analysis assistant specializing in options trading and market analysis.',
    'You have access to real-time portfolio data, options snapshots, and AI forecasts.',
    'Provide conversational, precise, risk-aware responses formatted in markdown.',
    'When referencing specific data, cite the actual numbers from the context provided.',
    'Always consider risk management in your recommendations.',
    '',
  ];

  try {
    const snapshots = db.prepare(`
      SELECT os.ticker, os.date, os.iv_30d, os.iv_rank, os.regime, os.implied_move_pct
      FROM option_snapshots os
      WHERE os.date = (
        SELECT MAX(date) FROM option_snapshots WHERE ticker = os.ticker
      )
      ORDER BY os.ticker
    `).all() as OptionSnapshotRow[];

    if (snapshots.length > 0) {
      lines.push('## Current Options Snapshot');
      for (const s of snapshots) {
        const iv = s.iv_30d != null ? (s.iv_30d * 100).toFixed(1) : 'N/A';
        lines.push(
          `- **${s.ticker}** (${s.date}): IV-30d=${iv}%, ` +
          `IV-Rank=${s.iv_rank ?? 'N/A'}, Regime=${s.regime ?? 'N/A'}, ` +
          `Implied-Move=${s.implied_move_pct?.toFixed(1) ?? 'N/A'}%`
        );
      }
      lines.push('');
    }
  } catch {
    // option_snapshots table may not exist yet
  }

  try {
    const projections = db.prepare(`
      SELECT op.ticker, op.horizon_days, op.regime_classification, op.date
      FROM option_projections op
      WHERE op.date = (
        SELECT MAX(date) FROM option_projections WHERE ticker = op.ticker
      )
      ORDER BY op.ticker, op.horizon_days
    `).all() as OptionProjectionRow[];

    if (projections.length > 0) {
      lines.push('## Probability Projections');
      for (const p of projections) {
        lines.push(
          `- **${p.ticker}** ${p.horizon_days}d horizon: Regime=${p.regime_classification ?? 'N/A'}`
        );
      }
      lines.push('');
    }
  } catch {
    // option_projections table may not exist yet
  }

  return lines.join('\n');
}

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

const _encoder = new TextEncoder();

function encodeSSE(type: string, data: Record<string, unknown>): Uint8Array {
  return _encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Parse body
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawMessage = body.message;
  const rawConvId = typeof body.conversationId === 'string' ? body.conversationId : undefined;
  const userId = 'default';

  // 2. Validate message
  const validation = validateUserMessage(rawMessage);
  if (!validation.valid) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const userMessage = sanitizeMessage(rawMessage as string);

  // 3. Rate limit check
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter ?? 3600) },
      }
    );
  }

  // 4. Build SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: Record<string, unknown>): void {
        try {
          controller.enqueue(encodeSSE(type, data));
        } catch {
          // Controller may already be closed
        }
      }

      const db = getChatDb();

      try {
        // 4a. Get or create conversation
        let conversationId = rawConvId;
        let isNewConversation = false;

        if (conversationId) {
          const existing = db.prepare(
            'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
          ).get(conversationId, userId) as ConversationRow | undefined;

          if (!existing) {
            send('error', { message: 'Conversation not found' });
            controller.close();
            return;
          }
        } else {
          conversationId = crypto.randomUUID();
          const title = generateTitle(userMessage);
          const now = Math.floor(Date.now() / 1000);

          db.prepare(`
            INSERT INTO conversations (id, user_id, title, created_at, updated_at, message_count)
            VALUES (?, ?, ?, ?, ?, 0)
          `).run(conversationId, userId, title, now, now);

          isNewConversation = true;
          send('conversation_created', { conversationId, title });
        }

        // 4b. Save user message
        const userMsgId = crypto.randomUUID();
        const msgAt = Math.floor(Date.now() / 1000);

        db.prepare(`
          INSERT INTO chat_messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, 'user', ?, ?)
        `).run(userMsgId, conversationId, userMessage, msgAt);

        // 4c. Build context and message history
        const systemPrompt = buildSystemPrompt(db);
        const history = db.prepare(`
          SELECT role, content FROM chat_messages
          WHERE conversation_id = ? AND id != ?
          ORDER BY created_at ASC
        `).all(conversationId, userMsgId) as MessageHistoryRow[];

        const messages: Anthropic.MessageParam[] = [
          ...history.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: userMessage },
        ];

        // 4d. Signal stream start
        send('message_start', { conversationId });

        // 4e. Validate API key
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          send('error', { message: 'ANTHROPIC_API_KEY is not configured' });
          controller.close();
          return;
        }

        // 4f. Call Claude with streaming
        const client = new Anthropic({ apiKey });
        let assistantContent = '';
        let inputTokens = 0;
        let outputTokens = 0;

        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const delta = event.delta.text;
            assistantContent += delta;
            send('content_delta', { delta });
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
          }
        }

        // 4g. Save assistant message
        const assistantMsgId = crypto.randomUUID();
        const doneAt = Math.floor(Date.now() / 1000);
        const totalTokens = inputTokens + outputTokens;

        db.prepare(`
          INSERT INTO chat_messages (id, conversation_id, role, content, tokens_used, created_at)
          VALUES (?, ?, 'assistant', ?, ?, ?)
        `).run(assistantMsgId, conversationId, assistantContent, totalTokens || null, doneAt);

        // 4h. Update conversation metadata
        db.prepare(`
          UPDATE conversations
          SET updated_at = ?, message_count = message_count + 2
          WHERE id = ?
        `).run(doneAt, conversationId);

        // 4i. Signal done
        send('message_done', {
          conversationId,
          messageId: assistantMsgId,
          tokensUsed: totalTokens,
          isNewConversation,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[chat/message] stream error:', message);
        send('error', { message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
