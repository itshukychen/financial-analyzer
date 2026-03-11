import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SearchRow {
  messageId: string;
  conversationId: string;
  role: string;
  createdAt: string;
  conversationTitle: string | null;
  conversationUpdatedAt: string;
  snippet: string;
  score: number;
}

interface CountRow {
  total: number;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const { query, limit = 20, offset = 0, conversationId } = raw;

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'query is required and must be at least 2 characters' },
      { status: 400 },
    );
  }

  const sanitizedQuery = query.trim();
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const parsedOffset = Math.max(0, Number(offset) || 0);
  const scopedConversationId =
    typeof conversationId === 'string' && conversationId.length > 0
      ? conversationId
      : null;

  try {
    const searchSql = `
      SELECT
        m.id              AS messageId,
        m.conversation_id AS conversationId,
        m.role,
        m.created_at      AS createdAt,
        c.title           AS conversationTitle,
        c.updated_at      AS conversationUpdatedAt,
        snippet(chat_messages_fts, 0, '**', '**', '...', 15) AS snippet,
        bm25(chat_messages_fts) AS score
      FROM chat_messages_fts
      JOIN chat_messages m ON chat_messages_fts.rowid = m.rowid
      JOIN conversations c ON m.conversation_id = c.id
      WHERE chat_messages_fts MATCH ?
      ${scopedConversationId ? 'AND m.conversation_id = ?' : ''}
      ORDER BY score
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM chat_messages_fts
      JOIN chat_messages m ON chat_messages_fts.rowid = m.rowid
      WHERE chat_messages_fts MATCH ?
      ${scopedConversationId ? 'AND m.conversation_id = ?' : ''}
    `;

    const searchParams: (string | number)[] = [sanitizedQuery];
    const countParams: (string | number)[] = [sanitizedQuery];

    if (scopedConversationId) {
      searchParams.push(scopedConversationId);
      countParams.push(scopedConversationId);
    }

    searchParams.push(parsedLimit, parsedOffset);

    const rows = db.prepare(searchSql).all(...searchParams) as SearchRow[];
    const countRow = db.prepare(countSql).get(...countParams) as CountRow;

    const results = rows.map((row) => ({
      messageId: row.messageId,
      conversationId: row.conversationId,
      conversationTitle: row.conversationTitle,
      role: row.role,
      snippet: row.snippet.slice(0, 150),
      score: row.score,
      createdAt: row.createdAt,
      conversationUpdatedAt: row.conversationUpdatedAt,
    }));

    return NextResponse.json({
      results,
      total: countRow.total,
      query: sanitizedQuery,
      limit: parsedLimit,
      offset: parsedOffset,
      metadata: {
        executionTimeMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[chat/search] error:', err);

    if (error.includes('no such table') || error.includes('no such virtual table')) {
      return NextResponse.json(
        {
          error: 'Search index not available',
          metadata: { executionTimeMs: Date.now() - startTime },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error }, { status: 500 });
  }
}
