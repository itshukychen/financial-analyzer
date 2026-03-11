'use client';

// Stub — Task 9 (ChatContainer Component with State Management) will replace this
// with full implementation. This stub exists so app/chat/page.tsx can compile.
export default function ChatContainer() {
  return (
    <div
      data-testid="chat-container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        Chat initializing…
      </div>
    </div>
  );
}
