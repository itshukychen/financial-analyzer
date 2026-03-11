'use client';

import { useState, lazy, Suspense } from 'react';

const ChatContainer = lazy(() => import('./components/ChatContainer'));

function ChatLoadingSkeleton() {
  return (
    <div
      data-testid="chat-loading"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          height: '48px',
          borderRadius: '8px',
          background: 'var(--border)',
          width: '65%',
          opacity: 0.6,
        }}
      />
      <div
        style={{
          height: '48px',
          borderRadius: '8px',
          background: 'var(--border)',
          width: '50%',
          alignSelf: 'flex-end',
          opacity: 0.6,
        }}
      />
      <div
        style={{
          height: '72px',
          borderRadius: '8px',
          background: 'var(--border)',
          width: '75%',
          opacity: 0.6,
        }}
      />
    </div>
  );
}

export default function ChatPageClient() {
  // Incrementing this key re-mounts ChatContainer, effectively starting a new conversation.
  const [chatKey, setChatKey] = useState(0);

  function createNewConversation() {
    setChatKey((k) => k + 1);
  }

  return (
    <div
      data-testid="chat-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '16px',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            AI Chat
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Ask Claude about your portfolio, options strategies, and market conditions
          </p>
        </div>

        <button
          data-testid="new-chat-btn"
          onClick={createNewConversation}
          aria-label="Start a new conversation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Chat area — fills remaining height */}
      <div
        data-testid="chat-area"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Suspense fallback={<ChatLoadingSkeleton />}>
          <ChatContainer key={chatKey} />
        </Suspense>
      </div>
    </div>
  );
}
