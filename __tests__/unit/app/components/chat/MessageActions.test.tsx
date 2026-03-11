/**
 * Tests for: app/chat/components/MessageActions.tsx
 *
 * Coverage:
 * - Copy button: all roles, clipboard write, toast feedback
 * - Pin button: assistant only, toggle state, callback fires
 * - Bookmark button: assistant only, toggle state, callback fires
 * - MessageStatusIndicators: pin/bookmark visual indicators
 * - User messages: copy only (no pin/bookmark)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import MessageActions, { MessageStatusIndicators } from '@/app/chat/components/MessageActions';

// Mock clipboard API
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── Copy button ─────────────────────────────────────────────────────────────

describe('MessageActions — Copy button', () => {
  it('renders copy button for user messages', () => {
    mockClipboard();
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    expect(getByTestId('message-action-copy')).toBeTruthy();
  });

  it('renders copy button for assistant messages', () => {
    mockClipboard();
    const { getByTestId } = render(
      <MessageActions messageId={2} content="Response" role="assistant" />,
    );
    expect(getByTestId('message-action-copy')).toBeTruthy();
  });

  it('calls navigator.clipboard.writeText with the message content', async () => {
    const writeText = mockClipboard();
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Copy me" role="user" />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('message-action-copy'));
    });
    expect(writeText).toHaveBeenCalledWith('Copy me');
  });

  it('shows copy toast after clicking copy', async () => {
    mockClipboard();
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('message-action-copy'));
    });
    expect(getByTestId('copy-toast')).toBeTruthy();
  });

  it('hides copy toast after 2.5 seconds', async () => {
    mockClipboard();
    const { getByTestId, queryByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('message-action-copy'));
    });
    expect(getByTestId('copy-toast')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(queryByTestId('copy-toast')).toBeNull();
  });

  it('copy toast has aria-live="polite" for accessibility', async () => {
    mockClipboard();
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('message-action-copy'));
    });
    expect(getByTestId('copy-toast').getAttribute('aria-live')).toBe('polite');
  });
});

// ─── Pin button ──────────────────────────────────────────────────────────────

describe('MessageActions — Pin button (assistant only)', () => {
  it('renders pin button for assistant messages', () => {
    const { getByTestId } = render(
      <MessageActions messageId={2} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-pin')).toBeTruthy();
  });

  it('does NOT render pin button for user messages', () => {
    const { queryByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    expect(queryByTestId('message-action-pin')).toBeNull();
  });

  it('calls onPin with messageId and true when not pinned', () => {
    const onPin = vi.fn();
    const { getByTestId } = render(
      <MessageActions messageId={42} content="Hello" role="assistant" onPin={onPin} />,
    );
    fireEvent.click(getByTestId('message-action-pin'));
    expect(onPin).toHaveBeenCalledWith(42, true);
  });

  it('calls onPin with messageId and false when already pinned', () => {
    const onPin = vi.fn();
    const { getByTestId } = render(
      <MessageActions
        messageId={42}
        content="Hello"
        role="assistant"
        metadata={{ pinned: true }}
        onPin={onPin}
      />,
    );
    fireEvent.click(getByTestId('message-action-pin'));
    expect(onPin).toHaveBeenCalledWith(42, false);
  });

  it('pin button has aria-pressed=true when pinned', () => {
    const { getByTestId } = render(
      <MessageActions
        messageId={1}
        content="Hello"
        role="assistant"
        metadata={{ pinned: true }}
      />,
    );
    expect(getByTestId('message-action-pin').getAttribute('aria-pressed')).toBe('true');
  });

  it('pin button has aria-pressed=false when not pinned', () => {
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-pin').getAttribute('aria-pressed')).toBe('false');
  });

  it('pin button label says "Unpin message" when pinned', () => {
    const { getByTestId } = render(
      <MessageActions
        messageId={1}
        content="Hello"
        role="assistant"
        metadata={{ pinned: true }}
      />,
    );
    expect(getByTestId('message-action-pin').getAttribute('aria-label')).toBe('Unpin message');
  });

  it('pin button label says "Pin message" when not pinned', () => {
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-pin').getAttribute('aria-label')).toBe('Pin message');
  });
});

// ─── Bookmark button ──────────────────────────────────────────────────────────

describe('MessageActions — Bookmark button (assistant only)', () => {
  it('renders bookmark button for assistant messages', () => {
    const { getByTestId } = render(
      <MessageActions messageId={2} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-bookmark')).toBeTruthy();
  });

  it('does NOT render bookmark button for user messages', () => {
    const { queryByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    expect(queryByTestId('message-action-bookmark')).toBeNull();
  });

  it('calls onBookmark with messageId and true when not bookmarked', () => {
    const onBookmark = vi.fn();
    const { getByTestId } = render(
      <MessageActions messageId={7} content="Hello" role="assistant" onBookmark={onBookmark} />,
    );
    fireEvent.click(getByTestId('message-action-bookmark'));
    expect(onBookmark).toHaveBeenCalledWith(7, true);
  });

  it('calls onBookmark with messageId and false when already bookmarked', () => {
    const onBookmark = vi.fn();
    const { getByTestId } = render(
      <MessageActions
        messageId={7}
        content="Hello"
        role="assistant"
        metadata={{ bookmarked: true }}
        onBookmark={onBookmark}
      />,
    );
    fireEvent.click(getByTestId('message-action-bookmark'));
    expect(onBookmark).toHaveBeenCalledWith(7, false);
  });

  it('bookmark button has aria-pressed=true when bookmarked', () => {
    const { getByTestId } = render(
      <MessageActions
        messageId={1}
        content="Hello"
        role="assistant"
        metadata={{ bookmarked: true }}
      />,
    );
    expect(getByTestId('message-action-bookmark').getAttribute('aria-pressed')).toBe('true');
  });

  it('bookmark button label says "Remove bookmark" when bookmarked', () => {
    const { getByTestId } = render(
      <MessageActions
        messageId={1}
        content="Hello"
        role="assistant"
        metadata={{ bookmarked: true }}
      />,
    );
    expect(getByTestId('message-action-bookmark').getAttribute('aria-label')).toBe('Remove bookmark');
  });

  it('bookmark button label says "Bookmark message" when not bookmarked', () => {
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-bookmark').getAttribute('aria-label')).toBe('Bookmark message');
  });
});

// ─── MessageStatusIndicators ──────────────────────────────────────────────────

describe('MessageStatusIndicators', () => {
  it('renders nothing when no metadata', () => {
    const { queryByTestId } = render(<MessageStatusIndicators />);
    expect(queryByTestId('message-status-indicators')).toBeNull();
  });

  it('renders nothing when neither pinned nor bookmarked', () => {
    const { queryByTestId } = render(
      <MessageStatusIndicators metadata={{ pinned: false, bookmarked: false }} />,
    );
    expect(queryByTestId('message-status-indicators')).toBeNull();
  });

  it('renders pin indicator when message is pinned', () => {
    const { getByTestId } = render(
      <MessageStatusIndicators metadata={{ pinned: true }} />,
    );
    expect(getByTestId('pin-indicator')).toBeTruthy();
  });

  it('renders bookmark indicator when message is bookmarked', () => {
    const { getByTestId } = render(
      <MessageStatusIndicators metadata={{ bookmarked: true }} />,
    );
    expect(getByTestId('bookmark-indicator')).toBeTruthy();
  });

  it('renders both indicators when pinned and bookmarked', () => {
    const { getByTestId } = render(
      <MessageStatusIndicators metadata={{ pinned: true, bookmarked: true }} />,
    );
    expect(getByTestId('pin-indicator')).toBeTruthy();
    expect(getByTestId('bookmark-indicator')).toBeTruthy();
  });

  it('does NOT render bookmark indicator when only pinned', () => {
    const { queryByTestId } = render(
      <MessageStatusIndicators metadata={{ pinned: true }} />,
    );
    expect(queryByTestId('bookmark-indicator')).toBeNull();
  });

  it('does NOT render pin indicator when only bookmarked', () => {
    const { queryByTestId } = render(
      <MessageStatusIndicators metadata={{ bookmarked: true }} />,
    );
    expect(queryByTestId('pin-indicator')).toBeNull();
  });
});

// ─── User messages: copy only ──────────────────────────────────────────────────

describe('MessageActions — user messages get copy only', () => {
  it('user message: only copy button rendered', () => {
    const { getByTestId, queryByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    expect(getByTestId('message-action-copy')).toBeTruthy();
    expect(queryByTestId('message-action-pin')).toBeNull();
    expect(queryByTestId('message-action-bookmark')).toBeNull();
  });

  it('assistant message: copy, pin, and bookmark all rendered', () => {
    const { getByTestId } = render(
      <MessageActions messageId={2} content="Hello" role="assistant" />,
    );
    expect(getByTestId('message-action-copy')).toBeTruthy();
    expect(getByTestId('message-action-pin')).toBeTruthy();
    expect(getByTestId('message-action-bookmark')).toBeTruthy();
  });
});

// ─── Wrapper renders ──────────────────────────────────────────────────────────

describe('MessageActions — data-testid root', () => {
  it('renders with data-testid="message-actions"', () => {
    const { getByTestId } = render(
      <MessageActions messageId={1} content="Hello" role="user" />,
    );
    expect(getByTestId('message-actions')).toBeTruthy();
  });
});
