import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

// Single-user app; all conversations belong to user 1
const CURRENT_USER_ID = 1;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ConversationRow {
  id: string;
  user_id: number;
  title: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  created_at: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL',
    ).get(id) as ConversationRow | undefined;

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== CURRENT_USER_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    ).all(id) as MessageRow[];

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        tokensUsed: m.tokens_used,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL',
    ).get(id) as ConversationRow | undefined;

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== CURRENT_USER_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete — preserves message history and audit trail
    db.prepare(
      "UPDATE conversations SET deleted_at = strftime('%s', 'now') WHERE id = ?",
    ).run(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
