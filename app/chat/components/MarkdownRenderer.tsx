'use client';

import 'highlight.js/styles/vs2015.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import type { ReactNode } from 'react';

// Extend defaultSchema to allow className on code/pre/span for syntax highlighting.
// rehypeSanitize runs before rehypeHighlight, so we must allow language-* classes
// on <code> elements so rehypeHighlight can read them.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.['code'] ?? []),
      'className',
    ],
    span: [
      ...(defaultSchema.attributes?.['span'] ?? []),
      'className',
    ],
    pre: [
      ...(defaultSchema.attributes?.['pre'] ?? []),
      'className',
    ],
  },
};

// Matches currency ($1,234.56, $1.2M, $500K) and percentages (+12.5%, -0.87%)
const FINANCIAL_PATTERN = /(\$[\d,]+(?:\.\d+)?[MBK]?|[+-]?\d+(?:\.\d+)?%)/g;

/**
 * Format a number as a USD currency string.
 * e.g. 1234.56 → "$1,234.56"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a number as a percentage string with sign.
 * e.g. 1.24 → "+1.24%", -0.87 → "-0.87%"
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Process a raw string, wrapping detected financial patterns in styled spans. */
function highlightFinancialNumbers(text: string, keyPrefix: string | number = ''): ReactNode {
  FINANCIAL_PATTERN.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = FINANCIAL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const value = match[0];
    const isNegative = value.startsWith('-');
    const isPercentage = value.endsWith('%');
    const color = isNegative
      ? 'var(--loss)'
      : isPercentage
      ? 'var(--gain)'
      : 'var(--text-primary)';

    parts.push(
      <span
        key={`${keyPrefix}-fin-${i++}`}
        data-testid="financial-number"
        style={{
          color,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>,
    );
    lastIndex = match.index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
  return <>{parts}</>;
}

/**
 * Recursively process ReactNode children, applying financial number
 * highlighting to any string nodes encountered at the top level.
 */
function processTextChildren(children: ReactNode, keyPrefix: string | number = ''): ReactNode {
  if (typeof children === 'string') {
    return highlightFinancialNumbers(children, keyPrefix);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === 'string' ? (
        <span key={`${keyPrefix}-txt-${i}`}>
          {highlightFinancialNumbers(child, `${keyPrefix}-${i}`)}
        </span>
      ) : (
        child
      ),
    );
  }
  return children;
}

const components: Components = {
  // Inline code — styled to match dark theme
  code({ className, children }) {
    const isBlock = Boolean(className); // block code has a language-* class
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code
        data-testid="inline-code"
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: '0.875em',
          padding: '2px 5px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </code>
    );
  },

  // Fenced code block wrapper
  pre({ children }) {
    return (
      <pre
        data-testid="code-block"
        style={{
          margin: '12px 0',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'auto',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        {children}
      </pre>
    );
  },

  // Paragraphs — with financial number highlighting
  p({ children }) {
    return (
      <p
        style={{
          margin: '0 0 10px',
          lineHeight: '1.65',
          color: 'var(--text-primary)',
        }}
      >
        {processTextChildren(children, 'p')}
      </p>
    );
  },

  // List items — with financial number highlighting
  li({ children }) {
    return (
      <li style={{ margin: '3px 0', lineHeight: '1.65' }}>
        {processTextChildren(children, 'li')}
      </li>
    );
  },

  h1({ children }) {
    return (
      <h1
        style={{
          fontSize: '1.4em',
          fontWeight: 700,
          margin: '16px 0 8px',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '6px',
        }}
      >
        {children}
      </h1>
    );
  },

  h2({ children }) {
    return (
      <h2
        style={{
          fontSize: '1.2em',
          fontWeight: 700,
          margin: '14px 0 6px',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </h2>
    );
  },

  h3({ children }) {
    return (
      <h3
        style={{
          fontSize: '1.05em',
          fontWeight: 600,
          margin: '12px 0 4px',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </h3>
    );
  },

  // Links — always open in new tab; javascript: URLs are blocked by rehypeSanitize
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="markdown-link"
        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
      >
        {children}
      </a>
    );
  },

  ol({ children }) {
    return (
      <ol
        style={{
          margin: '6px 0 10px',
          paddingLeft: '24px',
          listStyleType: 'decimal',
        }}
      >
        {children}
      </ol>
    );
  },

  ul({ children }) {
    return (
      <ul
        style={{
          margin: '6px 0 10px',
          paddingLeft: '24px',
          listStyleType: 'disc',
        }}
      >
        {children}
      </ul>
    );
  },

  hr({ }) {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          margin: '12px 0',
        }}
      />
    );
  },

  blockquote({ children }) {
    return (
      <blockquote
        style={{
          borderLeft: '3px solid var(--accent)',
          paddingLeft: '12px',
          margin: '10px 0',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
        }}
      >
        {children}
      </blockquote>
    );
  },

  // GFM tables
  table({ children }) {
    return (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table
          data-testid="markdown-table"
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '13px',
          }}
        >
          {children}
        </table>
      </div>
    );
  },

  th({ children }) {
    return (
      <th
        style={{
          padding: '6px 12px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          fontWeight: 600,
          textAlign: 'left',
          color: 'var(--text-primary)',
        }}
      >
        {processTextChildren(children, 'th')}
      </th>
    );
  },

  td({ children }) {
    return (
      <td
        style={{
          padding: '6px 12px',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        {processTextChildren(children, 'td')}
      </td>
    );
  },

  strong({ children }) {
    return (
      <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
        {children}
      </strong>
    );
  },

  em({ children }) {
    return (
      <em style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
        {children}
      </em>
    );
  },
};

interface MarkdownRendererProps {
  /** Raw markdown string to render */
  content: string;
  /** Optional extra CSS class on the container div */
  className?: string;
}

/**
 * MarkdownRenderer renders Claude's markdown responses with:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax-highlighted code blocks (VS Code Dark+ / vs2015 theme)
 * - HTML sanitization to prevent XSS (rehype-sanitize with defaultSchema)
 * - Financial number highlighting — currency and percentage values are
 *   coloured using design tokens (--loss / --gain / --text-primary)
 *
 * Future enhancement: add remark-math + rehype-katex for inline math.
 */
export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      data-testid="markdown-renderer"
      className={className}
      style={{
        fontSize: '14px',
        lineHeight: '1.6',
        color: 'var(--text-primary)',
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          [rehypeHighlight, { detect: true }],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
