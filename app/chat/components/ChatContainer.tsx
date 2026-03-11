'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  preview?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tokensUsed?: number;
}

interface SSEPayload {
  type: string;
  data: Record<string, unknown>;
}

function parseSSELine(line: string): SSEPayload | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as SSEPayload;
  } catch {
    return null;
  }
}

export default function ChatContainer() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [inputValue, setInputValue] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  // Prevents loadMessages from running while sendMessage manages the message list
  const sendingRef = useRef(false);
  // Tracks conversation IDs created via SSE to prevent immediate loadMessages reload
  const sseCreatedIdRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      if (!res.ok) return;
      const data = (await res.json()) as { conversations?: Conversation[] };
      setConversations(data.conversations ?? []);
    } catch {
      // non-critical — sidebar still functional without conversation list
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: Message[] };
      setMessages(data.messages ?? []);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Load messages when conversation changes (user selection only, not SSE-driven changes)
  useEffect(() => {
    if (currentConversationId && !sendingRef.current && currentConversationId !== sseCreatedIdRef.current) {
      void loadMessages(currentConversationId);
    } else if (!currentConversationId) {
      setMessages([]);
    }
  }, [currentConversationId, loadMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      // Optimistic UI: immediately show user message before API responds
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setStreamingContent('');
      setLoading(true);
      sendingRef.current = true; // block loadMessages while SSE is active

      // Abort any previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let assistantContent = '';
      try {
        const res = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: trimmed,
            conversationId: currentConversationId,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            const payload = parseSSELine(trimmedLine);
            if (!payload) continue;

            switch (payload.type) {
              case 'conversation_created': {
                const newId = payload.data.conversationId as string | undefined;
                if (newId) {
                  sseCreatedIdRef.current = newId;
                  setCurrentConversationId(newId);
                }
                break;
              }
              case 'content_delta': {
                const delta = payload.data.delta as string | undefined;
                if (delta) {
                  assistantContent += delta;
                  setStreamingContent(assistantContent);
                }
                break;
              }
              case 'message_done': {
                const messageId = payload.data.messageId as string | undefined;
                const tokensUsed = payload.data.tokensUsed as number | undefined;
                // Capture value before reset — React defers functional updaters,
                // so `assistantContent` may already be '' by the time the updater runs.
                const doneContent = assistantContent;
                setMessages(prev => [
                  ...prev,
                  {
                    id: messageId ?? `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: doneContent,
                    createdAt: new Date().toISOString(),
                    tokensUsed,
                  },
                ]);
                setStreamingContent('');
                assistantContent = '';
                break;
              }
              case 'error': {
                throw new Error(
                  (payload.data.message as string | undefined) ?? 'Stream error',
                );
              }
            }
          }
        }

        // Refresh conversation list after successful message send
        void loadConversations();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Remove optimistic message on error so UI reflects actual state
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setStreamingContent('');
      } finally {
        sendingRef.current = false;
        setLoading(false);
      }
    },
    [currentConversationId, loadConversations],
  );

  const createNewConversation = useCallback(() => {
    abortRef.current?.abort();
    sseCreatedIdRef.current = null;
    setCurrentConversationId(null);
    setMessages([]);
    setStreamingContent('');
    setLoading(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || loading) return;
    const content = inputValue;
    setInputValue('');
    void sendMessage(content);
  }, [inputValue, loading, sendMessage]);

  return (
    <div
      data-testid="chat-container"
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Conversation list sidebar */}
      <div
        data-testid="chat-sidebar"
        style={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
        >
          <button
            data-testid="new-chat-btn"
            onClick={createNewConversation}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            + New Chat
          </button>
        </div>

        <div
          data-testid="conversation-list"
          style={{ flex: 1, overflowY: 'auto' }}
        >
          {conversations.length === 0 && (
            <div
              data-testid="conversations-empty"
              style={{
                padding: '16px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              No conversations yet
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              data-testid={`conversation-item-${conv.id}`}
              onClick={() => {
                sseCreatedIdRef.current = null;
                setCurrentConversationId(conv.id);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                border: 'none',
                borderLeft:
                  conv.id === currentConversationId
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                background:
                  conv.id === currentConversationId
                    ? 'rgba(99,102,241,0.1)'
                    : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '2px',
                }}
              >
                {conv.title}
              </div>
              {conv.preview && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {conv.preview}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div
        data-testid="chat-main"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Message list */}
        <div
          data-testid="message-list"
          style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
        >
          {messages.length === 0 && !streamingContent && !loading && (
            <div
              data-testid="messages-empty"
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '32px',
              }}
            >
              Start a conversation by typing a message below.
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              data-testid={`message-item-${msg.role}`}
              style={{
                marginBottom: '12px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background:
                    msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                  color:
                    msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  border:
                    msg.role === 'assistant'
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div
              data-testid="streaming-message"
              style={{
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                {streamingContent}
              </div>
            </div>
          )}

          {loading && !streamingContent && (
            <div
              data-testid="thinking-indicator"
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                padding: '8px 0',
              }}
            >
              Claude is thinking...
            </div>
          )}
        </div>

        {/* Message input */}
        <div
          data-testid="message-input-area"
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              data-testid="message-textarea"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
              placeholder="Ask about volatility, strategies, or your portfolio..."
              style={{
                flex: 1,
                resize: 'none',
                minHeight: '44px',
                maxHeight: '128px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
              rows={1}
            />
            <button
              data-testid="send-btn"
              onClick={handleSubmit}
              disabled={loading || !inputValue.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background:
                  loading || !inputValue.trim()
                    ? 'var(--border)'
                    : 'var(--accent)',
                color:
                  loading || !inputValue.trim()
                    ? 'var(--text-muted)'
                    : '#fff',
                cursor:
                  loading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              Send
            </button>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
