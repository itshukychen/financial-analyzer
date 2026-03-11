'use client';

import { useEffect, useRef } from 'react';
import MessageItem, { type Message } from './MessageItem';
import StreamingMessage from './StreamingMessage';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isLoading: boolean;
}

export default function MessageList({ messages, streamingContent, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isLoading]);

  return (
    <div
      data-testid="message-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        overflowY: 'auto',
        flex: 1,
      }}
    >
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {streamingContent && (
        <StreamingMessage content={streamingContent} />
      )}

      {isLoading && !streamingContent && (
        <div
          data-testid="loading-indicator"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
            Claude is thinking...
          </span>
        </div>
      )}

      <div ref={bottomRef} data-testid="message-list-bottom" />
    </div>
  );
}
