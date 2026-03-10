// app/components/reports/ReportChatPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ErrorBanner from './ErrorBanner';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';

const SESSION_STORAGE_KEY = 'report-chat-history';
const SESSION_ID_KEY = 'report-chat-session-id';
const MAX_MESSAGE_LENGTH = 2000;

interface ReportChatPanelProps {
  reportDate: string;
  reportPeriod: 'eod' | 'morning' | 'midday';
  marketData: any;
  analysis: any;
}

export default function ReportChatPanel({
  reportDate,
  reportPeriod,
  marketData,
  analysis
}: ReportChatPanelProps) {
  
  // Session ID (for rate limiting)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return uuidv4();
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  });

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save conversation to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    // Optimistic UI update
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({
          message: userMessage.content,
          reportDate,
          reportPeriod,
          conversationHistory: messages,
          contextData: { marketData, analysis }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response');
      }

      const aiMessage: ChatMessageType = await response.json();
      setMessages(prev => [...prev, aiMessage]);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      // Restore input
      setInput(userMessage.content);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setError(null);
  };

  // Retry last message
  const handleRetry = () => {
    setError(null);
    handleSendMessage();
  };

  return (
    <div
      className="rounded-xl border flex flex-col"
      role="region"
      aria-label="AI Chat Assistant"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        height: '400px'
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Ask about this report
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {reportDate} • {reportPeriod.toUpperCase()}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            aria-label="Clear conversation"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error banner */}
      <ErrorBanner
        error={error}
        onRetry={handleRetry}
        onDismiss={() => setError(null)}
      />

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              No messages yet
            </p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Ask questions about today's market analysis
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLatest={idx === messages.length - 1}
            />
          ))
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSendMessage}
        isLoading={isLoading}
        disabled={false}
        maxLength={MAX_MESSAGE_LENGTH}
      />
    </div>
  );
}
