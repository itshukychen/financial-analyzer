'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSubmit: (question: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function ChatInput({
  onSubmit,
  onClear,
  isLoading,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!value.trim() || isLoading || disabled) return;

    await onSubmit(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = value.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your question here..."
        rows={3}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading || disabled || isOverLimit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Thinking...
              </span>
            ) : (
              'Ask'
            )}
          </button>

          <button
            onClick={onClear}
            disabled={disabled || isLoading}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear History
          </button>
        </div>

        <div className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
          {charCount} / 500
        </div>
      </div>
    </div>
  );
}
