import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_SORT = ['created_at', 'updated_at'] as const;
type SortField = (typeof VALID_SORT)[number];

interface ConversationRow {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
  message_count: number;
  preview: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    const rawLimit = parseInt(params.get('limit') ?? '20', 10);
    const limit = isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

    const rawOffset = parseInt(params.get('offset') ?? '0', 10);
    const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const sortParam = params.get('sort') ?? 'updated_at';
    const sort: SortField = (VALID_SORT as readonly string[]).includes(sortParam)
      ? (sortParam as SortField)
      : 'updated_at';

    // Single-user app — user_id is always 'default'
    const userId = 'default';

    const { count } = db
      .prepare('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?')
      .get(userId) as { count: number };

    const rows = db
      .prepare(
        `SELECT
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          COUNT(m.id) AS message_count,
          SUBSTR(
            (SELECT content FROM chat_messages
             WHERE conversation_id = c.id
             ORDER BY created_at DESC LIMIT 1),
            1, 50
          ) AS preview
        FROM conversations c
        LEFT JOIN chat_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.${sort} DESC
        LIMIT ? OFFSET ?`,
      )
      .all(userId, limit, offset) as ConversationRow[];

    const conversations = rows.map((row) => ({
      id: row.id,
      title: row.title,
      messageCount: row.message_count,
      createdAt: new Date(row.created_at * 1000).toISOString(),
      updatedAt: new Date(row.updated_at * 1000).toISOString(),
      preview: row.preview,
    }));

    return NextResponse.json({
      conversations,
      total: count,
      hasMore: offset + conversations.length < count,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
