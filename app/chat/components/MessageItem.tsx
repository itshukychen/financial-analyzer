'use client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tokensUsed?: number;
}

interface MessageItemProps {
  message: Message;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div
      data-testid={`message-item-${message.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '4px',
      }}
    >
      <div
        data-testid={`message-bubble-${message.role}`}
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? 'var(--accent)' : 'var(--surface)',
          border: isUser ? 'none' : '1px solid var(--border)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          alignItems: 'center',
        }}
      >
        <span data-testid="message-timestamp">
          {formatTimestamp(message.createdAt)}
        </span>
        {!isUser && message.tokensUsed !== undefined && (
          <span data-testid="message-tokens">
            {message.tokensUsed} tokens
          </span>
        )}
      </div>
    </div>
  );
}
