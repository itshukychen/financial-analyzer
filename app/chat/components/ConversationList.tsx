'use client';

import { useState } from 'react';

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  preview?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationList({
  conversations,
  currentId,
  onSelect,
}: ConversationListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div
        data-testid="conversation-list-empty"
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        No conversations yet
      </div>
    );
  }

  return (
    <div
      data-testid="conversation-list"
      style={{
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px',
      }}
    >
      {conversations.map((conv) => {
        const isActive = conv.id === currentId;
        const isHovered = hoveredId === conv.id;

        return (
          <button
            key={conv.id}
            data-testid={`conversation-item-${conv.id}`}
            onClick={() => onSelect(conv.id)}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            aria-current={isActive ? 'true' : undefined}
            aria-label={`${conv.title}, ${conv.messageCount} ${conv.messageCount === 1 ? 'message' : 'messages'}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              background: isActive
                ? 'rgba(79,142,247,0.08)'
                : isHovered
                  ? 'rgba(255,255,255,0.05)'
                  : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s ease, border-color 0.1s ease',
            }}
          >
            <span
              data-testid={`conversation-title-${conv.id}`}
              style={{
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {conv.title}
            </span>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                data-testid={`conversation-count-${conv.id}`}
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {conv.messageCount} {conv.messageCount === 1 ? 'message' : 'messages'}
              </span>
              <span
                data-testid={`conversation-time-${conv.id}`}
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {formatTimestamp(conv.updatedAt)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
