'use client';

import { memo } from 'react';
import type { ReactNode, CSSProperties } from 'react';

interface StreamingMessageProps {
  content: string;
  isStreaming?: boolean;
}

const inlineCodeStyle: CSSProperties = {
  background: 'var(--border)',
  padding: '1px 4px',
  borderRadius: '3px',
  fontSize: '0.875em',
  fontFamily: 'monospace',
  color: 'var(--accent)',
};

const codeBlockStyle: CSSProperties = {
  background: 'var(--border)',
  borderRadius: '6px',
  padding: '12px 16px',
  overflowX: 'auto',
  margin: '8px 0',
  fontSize: '0.875em',
  fontFamily: 'monospace',
  color: 'var(--text-primary)',
  lineHeight: 1.5,
  display: 'block',
};

function parseInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (
          part.startsWith('*') &&
          part.endsWith('*') &&
          part.length > 2 &&
          !part.startsWith('**')
        ) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={i} style={inlineCodeStyle}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return part || null;
      })}
    </>
  );
}

function parseContent(content: string): ReactNode[] {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} data-testid="md-code-block" style={codeBlockStyle}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      i++; // skip closing ```
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={key++}
          data-testid="md-h3"
          style={{ fontSize: '1em', fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}
        >
          {parseInline(line.slice(4))}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={key++}
          data-testid="md-h2"
          style={{ fontSize: '1.1em', fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px' }}
        >
          {parseInline(line.slice(3))}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={key++}
          data-testid="md-h1"
          style={{ fontSize: '1.25em', fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 6px' }}
        >
          {parseInline(line.slice(2))}
        </h1>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(
          <li key={`li-${i}`} style={{ marginBottom: '2px' }}>
            {parseInline(lines[i].slice(2))}
          </li>,
        );
        i++;
      }
      elements.push(
        <ul key={key++} data-testid="md-ul" style={{ paddingLeft: '20px', margin: '4px 0' }}>
          {items}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const match = lines[i].match(/^\d+\. (.*)/);
        items.push(
          <li key={`oli-${i}`} style={{ marginBottom: '2px' }}>
            {parseInline(match?.[1] ?? '')}
          </li>,
        );
        i++;
      }
      elements.push(
        <ol key={key++} data-testid="md-ol" style={{ paddingLeft: '20px', margin: '4px 0' }}>
          {items}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={key++} style={{ margin: '4px 0', lineHeight: 1.6 }}>
        {parseInline(line)}
      </p>,
    );
    i++;
  }

  return elements;
}

const StreamingMessage = memo(function StreamingMessage({
  content,
  isStreaming = false,
}: StreamingMessageProps) {
  const nodes = parseContent(content);

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
          wordBreak: 'break-word',
        }}
      >
        {nodes}
        {isStreaming && (
          <span
            data-testid="streaming-cursor"
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              background: 'var(--accent)',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        )}
      </div>
    </div>
  );
});

export default StreamingMessage;
