// app/components/reports/ChatMessage.tsx
'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest: boolean;
}

const ChatMessage = memo(function ChatMessage({ message, isLatest }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Format timestamp (HH:MM)
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <div
      ref={isLatest ? (el) => el?.scrollIntoView({ behavior: 'smooth' }) : undefined}
      className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}
      role="article"
      aria-label={`${isUser ? 'Your' : 'AI'} message at ${time}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'border'
        }`}
        style={!isUser ? {
          background: 'var(--surface-hover)',
          borderColor: 'var(--border)',
          color: 'var(--text)'
        } : {}}
      >
        {/* Message content */}
        <div className="mb-1">
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs ${isUser ? 'text-blue-100' : ''}`}
          style={!isUser ? { color: 'var(--text-muted)', opacity: 0.7 } : {}}
        >
          {time}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
