'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 128;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isEmpty = value.trim().length === 0;
  const isSendDisabled = isEmpty || disabled;

  return (
    <div
      data-testid="message-input-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          data-testid="message-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about volatility, strategies, or your portfolio..."
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '4px 0',
            overflowY: 'hidden',
            fontFamily: 'inherit',
            minHeight: '24px',
          }}
        />
        <button
          data-testid="send-button"
          onClick={handleSubmit}
          disabled={isSendDisabled}
          aria-label="Send message"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            cursor: isSendDisabled ? 'not-allowed' : 'pointer',
            background: isSendDisabled ? 'var(--border)' : 'var(--accent)',
            color: isSendDisabled ? 'var(--text-muted)' : '#fff',
            transition: 'background 0.15s ease, color 0.15s ease',
            flexShrink: 0,
          }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M2 8l12-6-6 12V9L2 8z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <span
        data-testid="message-input-helper"
        style={{ fontSize: '11px', color: 'var(--text-muted)' }}
      >
        Press Enter to send, Shift+Enter for new line
      </span>
    </div>
  );
}
