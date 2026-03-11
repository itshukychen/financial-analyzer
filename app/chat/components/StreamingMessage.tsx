'use client';

interface StreamingMessageProps {
  content: string;
}

export default function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div
      data-testid="streaming-message"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: '16px 16px 16px 4px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
        <span
          data-testid="streaming-cursor"
          style={{
            display: 'inline-block',
            width: '2px',
            height: '14px',
            background: 'var(--accent)',
            marginLeft: '2px',
            verticalAlign: 'middle',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
