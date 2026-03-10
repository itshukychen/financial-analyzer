// app/components/reports/ChatInput.tsx
'use client';

import { useState } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled: boolean;
  maxLength: number;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled,
  maxLength
}: ChatInputProps) {
  
  const canSend = value.trim().length > 0 && !isLoading && !disabled;
  const isOverLimit = value.length > maxLength;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isOverLimit) {
        onSend();
      }
    }
  };

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2">
        {/* Input field */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question..."
          disabled={isLoading || disabled}
          className="flex-1 px-3 py-2 rounded-lg border text-sm"
          style={{
            background: 'var(--surface)',
            borderColor: isOverLimit ? '#ef4444' : 'var(--border)',
            color: 'var(--text)'
          }}
          maxLength={maxLength}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!canSend || isOverLimit}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: canSend && !isOverLimit ? '#3b82f6' : 'var(--border)',
            color: canSend && !isOverLimit ? 'white' : 'var(--text-muted)'
          }}
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Send'
          )}
        </button>
      </div>

      {/* Character counter */}
      <div className="flex justify-end mt-1">
        <span
          className="text-xs"
          style={{ color: isOverLimit ? '#ef4444' : 'var(--text-muted)' }}
        >
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
