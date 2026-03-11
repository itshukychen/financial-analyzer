import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageList from '@/app/chat/components/MessageList';
import { type Message } from '@/app/chat/components/MessageItem';

// scrollIntoView is not implemented in jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
    createdAt: new Date(2026, 2, 11, 10, i).toISOString(),
  }));
}

describe('MessageList — structure', () => {
  it('renders message-list container with correct data-testid', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('renders a bottom anchor element for auto-scroll', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(screen.getByTestId('message-list-bottom')).toBeInTheDocument();
  });

  it('renders nothing extra when messages is empty and not loading', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('streaming-message')).not.toBeInTheDocument();
  });
});

describe('MessageList — messages rendering', () => {
  it('renders a MessageItem for each message', () => {
    const messages = makeMessages(3);
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />);
    expect(screen.getByTestId('message-item-msg-0')).toBeInTheDocument();
    expect(screen.getByTestId('message-item-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-item-msg-2')).toBeInTheDocument();
  });

  it('renders message content text', () => {
    const messages: Message[] = [
      { id: 'm1', role: 'user', content: 'Hello there', createdAt: new Date().toISOString() },
    ];
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders multiple messages in order', () => {
    const messages: Message[] = [
      { id: 'm1', role: 'user', content: 'First', createdAt: new Date().toISOString() },
      { id: 'm2', role: 'assistant', content: 'Second', createdAt: new Date().toISOString() },
    ];
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />);
    const items = screen.getAllByText(/First|Second/);
    expect(items).toHaveLength(2);
  });
});

describe('MessageList — streaming content', () => {
  it('shows StreamingMessage when streamingContent is non-empty', () => {
    render(<MessageList messages={[]} streamingContent="Streaming..." isLoading={false} />);
    expect(screen.getByTestId('streaming-message')).toBeInTheDocument();
  });

  it('renders streaming content text', () => {
    render(<MessageList messages={[]} streamingContent="IV rank is..." isLoading={false} />);
    expect(screen.getByText(/IV rank is/)).toBeInTheDocument();
  });

  it('does NOT show StreamingMessage when streamingContent is empty string', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(screen.queryByTestId('streaming-message')).not.toBeInTheDocument();
  });
});

describe('MessageList — loading state', () => {
  it('shows loading indicator when isLoading is true and no streaming content', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={true} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows "Claude is thinking..." text when loading', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={true} />);
    expect(screen.getByText('Claude is thinking...')).toBeInTheDocument();
  });

  it('does NOT show loading indicator when isLoading is false', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('does NOT show loading indicator when streaming content is present (streaming takes precedence)', () => {
    render(<MessageList messages={[]} streamingContent="partial..." isLoading={true} />);
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('shows streaming message instead of loading indicator when both are active', () => {
    render(<MessageList messages={[]} streamingContent="token..." isLoading={true} />);
    expect(screen.getByTestId('streaming-message')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });
});

describe('MessageList — auto-scroll behavior', () => {
  it('calls scrollIntoView on mount', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
