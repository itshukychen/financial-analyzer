import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageItem, { type Message } from '@/app/chat/components/MessageItem';

const BASE_ISO = '2026-03-11T14:30:00.000Z';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, Claude!',
    createdAt: BASE_ISO,
    ...overrides,
  };
}

describe('MessageItem — user messages', () => {
  it('renders with data-testid containing the message id', () => {
    render(<MessageItem message={makeMessage({ id: 'abc123' })} />);
    expect(screen.getByTestId('message-item-abc123')).toBeInTheDocument();
  });

  it('renders message content', () => {
    render(<MessageItem message={makeMessage({ content: 'What is IV rank?' })} />);
    expect(screen.getByText('What is IV rank?')).toBeInTheDocument();
  });

  it('renders user bubble with data-testid="message-bubble-user"', () => {
    render(<MessageItem message={makeMessage({ role: 'user' })} />);
    expect(screen.getByTestId('message-bubble-user')).toBeInTheDocument();
  });

  it('user bubble uses accent background color', () => {
    render(<MessageItem message={makeMessage({ role: 'user' })} />);
    const bubble = screen.getByTestId('message-bubble-user');
    expect(bubble.style.background).toBe('var(--accent)');
  });

  it('user message is aligned to flex-end', () => {
    render(<MessageItem message={makeMessage({ role: 'user', id: 'u1' })} />);
    const container = screen.getByTestId('message-item-u1');
    expect(container.style.alignItems).toBe('flex-end');
  });

  it('renders timestamp element', () => {
    render(<MessageItem message={makeMessage()} />);
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument();
  });

  it('does NOT render token usage for user messages', () => {
    render(<MessageItem message={makeMessage({ role: 'user', tokensUsed: 50 })} />);
    expect(screen.queryByTestId('message-tokens')).not.toBeInTheDocument();
  });
});

describe('MessageItem — assistant messages', () => {
  it('renders assistant bubble with data-testid="message-bubble-assistant"', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'IV rank is...' })} />);
    expect(screen.getByTestId('message-bubble-assistant')).toBeInTheDocument();
  });

  it('assistant bubble uses surface background color', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant' })} />);
    const bubble = screen.getByTestId('message-bubble-assistant');
    expect(bubble.style.background).toBe('var(--surface)');
  });

  it('assistant message is aligned to flex-start', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', id: 'a1' })} />);
    const container = screen.getByTestId('message-item-a1');
    expect(container.style.alignItems).toBe('flex-start');
  });

  it('renders token usage for assistant messages when tokensUsed is provided', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', tokensUsed: 128 })} />);
    expect(screen.getByTestId('message-tokens')).toBeInTheDocument();
    expect(screen.getByText('128 tokens')).toBeInTheDocument();
  });

  it('does NOT render token usage when tokensUsed is undefined', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant' })} />);
    expect(screen.queryByTestId('message-tokens')).not.toBeInTheDocument();
  });

  it('renders assistant content correctly', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Here is my analysis.' })} />);
    expect(screen.getByText('Here is my analysis.')).toBeInTheDocument();
  });
});

describe('MessageItem — timestamp formatting', () => {
  it('renders a non-empty timestamp string', () => {
    render(<MessageItem message={makeMessage({ createdAt: '2026-03-11T14:30:00.000Z' })} />);
    const ts = screen.getByTestId('message-timestamp');
    expect(ts.textContent?.trim()).not.toBe('');
  });
});
