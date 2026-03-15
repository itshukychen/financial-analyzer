'use client';

import { useState } from 'react';
import ChatMessageList, { type Message } from './ChatMessageList';
import ChatInput from './ChatInput';

interface ReportChatWidgetProps {
  reportId: string;
  reportDate: string;
  reportPeriod: string;
}

export default function ReportChatWidget({
  reportId,
}: ReportChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const checkRateLimit = (): boolean => {
    const key = `question_count_${reportId}`;
    const count = parseInt(sessionStorage.getItem(key) || '0');
    return count < 30;
  };

  const incrementRateLimit = () => {
    const key = `question_count_${reportId}`;
    const count = parseInt(sessionStorage.getItem(key) || '0');
    sessionStorage.setItem(key, String(count + 1));
  };

  const handleAskQuestion = async (question: string) => {
    if (!checkRateLimit()) {
      setError(
        "You've reached the question limit for this report (30 per session). Reload the page to reset."
      );
      return;
    }

    setError(null);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);

    try {
      const response = await fetch(`/api/reports/${reportId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const data = (await response.json()) as {
        answer: string;
        tokensUsed?: { input: number; output: number };
      };

      // Add AI response
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      incrementRateLimit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Render fullscreen overlay for mobile
  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-gray-900 flex flex-col md:hidden"
        data-testid="chat-fullscreen-modal"
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={closeFullscreen}
            data-testid="chat-fullscreen-close-button"
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 transition border border-gray-700 text-gray-300"
            aria-label="Close chat"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            💬 Ask a Question About This Report
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <ChatMessageList messages={messages} />
          </div>

          <div className="mt-4">
            <ChatInput
              onSubmit={handleAskQuestion}
              onClear={handleClearHistory}
              isLoading={isLoading}
              disabled={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // Desktop view (not fullscreen)
  return (
    <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          💬 Ask a Question About This Report
        </h3>
        {/* Mobile chat bubble button */}
        <button
          onClick={openFullscreen}
          data-testid="chat-open-fullscreen-button"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white"
          aria-label="Open chat fullscreen"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <ChatMessageList messages={messages} />

      <div className="mt-4">
        <ChatInput
          onSubmit={handleAskQuestion}
          onClear={handleClearHistory}
          isLoading={isLoading}
          disabled={false}
        />
      </div>
    </div>
  );
}
