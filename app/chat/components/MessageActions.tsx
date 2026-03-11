'use client';

import { useState, useCallback } from 'react';

export interface MessageMetadata {
  pinned?: boolean;
  bookmarked?: boolean;
}

interface MessageActionsProps {
  messageId: number;
  content: string;
  role: 'user' | 'assistant';
  metadata?: MessageMetadata;
  onPin?: (messageId: number, pinned: boolean) => void;
  onBookmark?: (messageId: number, bookmarked: boolean) => void;
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 8l4 4 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M9.5 2L14 6.5l-3 .5-3.5 4-1-1L10 6.5 9.5 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 9.5L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M3 2h10v12l-5-3-5 3V2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionButton({
  testId,
  label,
  active,
  activeColor,
  onClick,
  children,
}: {
  testId: string;
  label: string;
  active?: boolean;
  activeColor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: hovered ? 'var(--surface-raised, var(--border))' : 'var(--surface)',
        color: active && activeColor ? activeColor : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background 0.12s ease, color 0.12s ease',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function MessageActions({
  messageId,
  content,
  role,
  metadata,
  onPin,
  onBookmark,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const isPinned = metadata?.pinned ?? false;
  const isBookmarked = metadata?.bookmarked ?? false;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setToastVisible(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setToastVisible(false), 2500);
    } catch {
      // clipboard write failed silently
    }
  }, [content]);

  const handlePin = useCallback(() => {
    onPin?.(messageId, !isPinned);
  }, [messageId, isPinned, onPin]);

  const handleBookmark = useCallback(() => {
    onBookmark?.(messageId, !isBookmarked);
  }, [messageId, isBookmarked, onBookmark]);

  const isAssistant = role === 'assistant';

  return (
    <div
      data-testid="message-actions"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
    >
      {/* Copy button — shown for all roles */}
      <ActionButton
        testId="message-action-copy"
        label={copied ? 'Copied!' : 'Copy message'}
        active={copied}
        activeColor="var(--accent)"
        onClick={handleCopy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </ActionButton>

      {/* Pin and Bookmark — assistant messages only */}
      {isAssistant && (
        <>
          <ActionButton
            testId="message-action-pin"
            label={isPinned ? 'Unpin message' : 'Pin message'}
            active={isPinned}
            activeColor="var(--accent)"
            onClick={handlePin}
          >
            <PinIcon filled={isPinned} />
          </ActionButton>

          <ActionButton
            testId="message-action-bookmark"
            label={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
            active={isBookmarked}
            activeColor="#f59e0b"
            onClick={handleBookmark}
          >
            <BookmarkIcon filled={isBookmarked} />
          </ActionButton>
        </>
      )}

      {/* Success toast */}
      {toastVisible && (
        <div
          data-testid="copy-toast"
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: '36px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          Copied!
        </div>
      )}
    </div>
  );
}

/** Indicator icons rendered inline with message content for pinned/bookmarked state */
export function MessageStatusIndicators({ metadata }: { metadata?: MessageMetadata }) {
  if (!metadata?.pinned && !metadata?.bookmarked) return null;

  return (
    <span
      data-testid="message-status-indicators"
      style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: '6px' }}
    >
      {metadata.pinned && (
        <span
          data-testid="pin-indicator"
          title="Pinned"
          style={{ color: 'var(--accent)', display: 'inline-flex' }}
        >
          <PinIcon filled />
        </span>
      )}
      {metadata.bookmarked && (
        <span
          data-testid="bookmark-indicator"
          title="Bookmarked"
          style={{ color: '#f59e0b', display: 'inline-flex' }}
        >
          <BookmarkIcon filled />
        </span>
      )}
    </span>
  );
}
