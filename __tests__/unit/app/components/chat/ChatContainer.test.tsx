/**
 * Tests for: app/chat/components/ChatContainer.tsx
 *
 * Coverage:
 * - loadConversations() called on mount
 * - loadMessages() called when conversation selected
 * - sendMessage() optimistic UI, SSE parsing, streaming content, error handling
 * - createNewConversation() resets state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatContainer from '@/app/chat/components/ChatContainer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SSEPayload {
  type: string;
  data: Record<string, unknown>;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_CONVERSATIONS = {
  conversations: [
    {
      id: 'conv-1',
      title: 'SPWX Volatility Discussion',
      messageCount: 3,
      createdAt: '2026-03-10T10:00:00Z',
      updatedAt: '2026-03-10T10:05:00Z',
      preview: 'What is the IV rank for...',
    },
    {
      id: 'conv-2',
      title: 'Portfolio Review',
      messageCount: 5,
      createdAt: '2026-03-09T14:00:00Z',
      updatedAt: '2026-03-09T14:30:00Z',
    },
  ],
};

const MOCK_MESSAGES = {
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'What is the IV rank?',
      createdAt: '2026-03-10T10:00:00Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'The IV rank for SPWX is 55.',
      createdAt: '2026-03-10T10:00:05Z',
      tokensUsed: 42,
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a ReadableStream from SSE events. */
function createSSEStream(events: SSEPayload[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/** Standard SSE events for a successful message exchange. */
const DEFAULT_SSE_EVENTS: SSEPayload[] = [
  { type: 'conversation_created', data: { conversationId: 'conv-new' } },
  { type: 'message_start', data: {} },
  { type: 'content_delta', data: { delta: 'Hello' } },
  { type: 'content_delta', data: { delta: ' world' } },
  { type: 'message_done', data: { messageId: 'msg-new', tokensUsed: 20 } },
];

/** Build a fetch mock that handles conversations list, messages, and SSE POST. */
function buildFetchMock(options?: {
  sseEvents?: SSEPayload[];
  sseHttpError?: boolean;
}) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    const urlStr = String(url);

    // Message API (POST)
    if (urlStr.includes('/api/chat/message') && opts?.method === 'POST') {
      if (options?.sseHttpError) {
        return Promise.resolve({ ok: false, status: 429, body: null });
      }
      return Promise.resolve({
        ok: true,
        body: createSSEStream(options?.sseEvents ?? DEFAULT_SSE_EVENTS),
      });
    }

    // Conversation detail (must check before generic /conversations)
    if (urlStr.match(/\/api\/chat\/conversations\/conv-/)) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_MESSAGES),
      });
    }

    // Conversations list
    if (urlStr.includes('/api/chat/conversations')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_CONVERSATIONS),
      });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', buildFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChatContainer — initial render', () => {
  it('renders the chat-container element', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('chat-container')).toBeInTheDocument();
  });

  it('renders all key structural elements', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-main')).toBeInTheDocument();
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-input-area')).toBeInTheDocument();
  });

  it('renders new-chat-btn, message-textarea, and send-btn', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('new-chat-btn')).toBeInTheDocument();
    expect(screen.getByTestId('message-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('send-btn')).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('send-btn')).toBeDisabled();
  });

  it('shows empty message state on initial render', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('messages-empty')).toBeInTheDocument();
  });
});

describe('ChatContainer — loadConversations on mount', () => {
  it('calls GET /api/chat/conversations on mount', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => String(u));
      expect(urls.some(u => u === '/api/chat/conversations')).toBe(true);
    });
  });

  it('renders conversations in the sidebar after loading', async () => {
    render(<ChatContainer />);
    await waitFor(() => {
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-item-conv-2')).toBeInTheDocument();
    });
    expect(screen.getByText('SPWX Volatility Discussion')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Review')).toBeInTheDocument();
  });

  it('shows conversation preview text when present', async () => {
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('What is the IV rank for...')).toBeInTheDocument();
  });

  it('shows "No conversations yet" when list is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversations: [] }),
      }),
    );
    render(<ChatContainer />);
    await waitFor(() => {
      expect(screen.getByTestId('conversations-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('silently handles fetch failure (no crash)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    expect(() => render(<ChatContainer />)).not.toThrow();
    // conversations-empty should show since list stays empty
    await waitFor(() =>
      expect(screen.getByTestId('conversations-empty')).toBeInTheDocument(),
    );
  });
});

describe('ChatContainer — loadMessages on conversation selection', () => {
  it('calls GET /api/chat/conversations/[id] when conversation is clicked', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => String(u));
      expect(
        urls.some(u => u.includes('/api/chat/conversations/conv-1')),
      ).toBe(true);
    });
  });

  it('displays loaded messages after conversation is selected', async () => {
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));

    await waitFor(() => {
      expect(screen.getByText('What is the IV rank?')).toBeInTheDocument();
      expect(screen.getByText('The IV rank for SPWX is 55.')).toBeInTheDocument();
    });
  });

  it('highlights the active conversation in the sidebar', async () => {
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));

    await waitFor(() => {
      const btn = screen.getByTestId('conversation-item-conv-1');
      expect(btn.style.borderLeft).toContain('var(--accent)');
    });
  });
});

describe('ChatContainer — createNewConversation', () => {
  it('clicking new-chat-btn clears messages and shows empty state', async () => {
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    // Load a conversation
    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));
    await waitFor(() =>
      expect(screen.getByText('What is the IV rank?')).toBeInTheDocument(),
    );

    // Click New Chat
    fireEvent.click(screen.getByTestId('new-chat-btn'));

    await waitFor(() => {
      expect(screen.queryByText('What is the IV rank?')).not.toBeInTheDocument();
      expect(screen.getByTestId('messages-empty')).toBeInTheDocument();
    });
  });

  it('clicking new-chat-btn deselects the active conversation', async () => {
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));
    await waitFor(() =>
      expect(
        screen.getByTestId('conversation-item-conv-1').style.borderLeft,
      ).toContain('var(--accent)'),
    );

    fireEvent.click(screen.getByTestId('new-chat-btn'));

    await waitFor(() => {
      const btn = screen.getByTestId('conversation-item-conv-1');
      expect(btn.style.borderLeft).not.toContain('var(--accent)');
    });
  });
});

describe('ChatContainer — message input', () => {
  it('send button becomes enabled when text is entered', () => {
    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByTestId('send-btn')).not.toBeDisabled();
  });

  it('send button stays disabled for whitespace-only input', () => {
    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(screen.getByTestId('send-btn')).toBeDisabled();
  });

  it('clears the textarea after clicking send', async () => {
    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(textarea.value).toBe('');
  });

  it('sending via Enter key shows optimistic message and clears input', () => {
    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Tell me about volatility' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(screen.getByText('Tell me about volatility')).toBeInTheDocument();
    expect(textarea.value).toBe('');
  });

  it('Shift+Enter does NOT submit the message', () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Multi-line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    const postCalls = fetchMock.mock.calls.filter(
      ([url, opts]) =>
        String(url).includes('/api/chat/message') &&
        (opts as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCalls.length).toBe(0);
  });
});

describe('ChatContainer — sendMessage optimistic UI', () => {
  it('immediately shows user message before API responds', async () => {
    // Use a never-resolving fetch for POST to keep the request in-flight
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (
          String(url).includes('/api/chat/message') &&
          (opts as RequestInit | undefined)?.method === 'POST'
        ) {
          return new Promise(() => {}); // never resolves
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_CONVERSATIONS),
        });
      }),
    );

    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'What is SPWX IV?' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    // Message shows immediately — no await needed
    expect(screen.getByText('What is SPWX IV?')).toBeInTheDocument();
  });

  it('shows thinking indicator while loading (before streaming starts)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (
          String(url).includes('/api/chat/message') &&
          (opts as RequestInit | undefined)?.method === 'POST'
        ) {
          return new Promise(() => {});
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_CONVERSATIONS),
        });
      }),
    );

    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument();
  });
});

describe('ChatContainer — SSE streaming and message completion', () => {
  it('POSTs to /api/chat/message with content and conversationId', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'What is IV rank?' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, opts]) =>
          String(url).includes('/api/chat/message') &&
          (opts as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(
        ((postCall?.[1] as RequestInit | undefined)?.body as string) ?? '{}',
      ) as { content: string };
      expect(body.content).toBe('What is IV rank?');
    });
  });

  it('includes AbortSignal in the POST request', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, opts]) =>
          String(url).includes('/api/chat/message') &&
          (opts as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      expect(
        (postCall?.[1] as RequestInit | undefined)?.signal,
      ).toBeInstanceOf(AbortSignal);
    });
  });

  it('adds assistant message to the list after message_done event', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Tell me about SPWX' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    // Wait until the SSE stream has fully completed (proven by the second
    // loadConversations call that happens at the end of sendMessage)
    await waitFor(() => {
      const convListCalls = fetchMock.mock.calls.filter(
        ([url, opts]) =>
          String(url) === '/api/chat/conversations' &&
          (opts as RequestInit | undefined)?.method !== 'POST',
      );
      expect(convListCalls.length).toBeGreaterThan(1);
    });

    // After the stream is done, the assistant message from message_done should
    // be in the messages list (loadMessages is NOT triggered for SSE-created convs)
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    const assistantItems = screen.getAllByTestId('message-item-assistant');
    expect(assistantItems.length).toBeGreaterThan(0);
  });

  it('refreshes conversation list after stream completes', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<ChatContainer />);

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'New message' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      const convListCalls = fetchMock.mock.calls.filter(
        ([url, opts]) =>
          String(url) === '/api/chat/conversations' &&
          (opts as RequestInit | undefined)?.method !== 'POST',
      );
      // Called on mount + again after stream completes
      expect(convListCalls.length).toBeGreaterThan(1);
    });
  });
});

describe('ChatContainer — error handling', () => {
  it('removes optimistic message when stream returns HTTP error', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ sseHttpError: true }));

    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    // Optimistic message appears immediately
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // After HTTP error, optimistic message is removed
    await waitFor(() => {
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });
  });

  it('removes optimistic message when SSE error event is received', async () => {
    vi.stubGlobal(
      'fetch',
      buildFetchMock({
        sseEvents: [
          { type: 'error', data: { message: 'Rate limit exceeded' } },
        ],
      }),
    );

    render(<ChatContainer />);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument(),
    );

    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Test error' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    expect(screen.getByText('Test error')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
  });

  it('disables send button while request is in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (
          String(url).includes('/api/chat/message') &&
          (opts as RequestInit | undefined)?.method === 'POST'
        ) {
          return new Promise(() => {});
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_CONVERSATIONS),
        });
      }),
    );

    render(<ChatContainer />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('send-btn'));

    // After submission, input is cleared and send btn disabled
    expect((screen.getByTestId('message-textarea') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByTestId('send-btn')).toBeDisabled();
  });
});
