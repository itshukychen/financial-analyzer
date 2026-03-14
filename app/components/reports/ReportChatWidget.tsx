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

  return (
    <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-100">
        💬 Ask a Question About This Report
      </h3>

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
