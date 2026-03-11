import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationList from '@/app/chat/components/ConversationList';

const now = Date.now();

const mockConversations = [
  {
    id: 'conv-1',
    title: 'Portfolio Review',
    messageCount: 5,
    updatedAt: new Date(now - 30 * 60 * 1000).toISOString(), // 30m ago
  },
  {
    id: 'conv-2',
    title: 'Volatility Analysis',
    messageCount: 1,
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  },
  {
    id: 'conv-3',
    title: 'Options Strategy',
    messageCount: 12,
    updatedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3d ago
  },
];

const noop = () => {};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConversationList — empty state', () => {
  it('renders empty state message when no conversations', () => {
    render(<ConversationList conversations={[]} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('does not render the list container when empty', () => {
    render(<ConversationList conversations={[]} currentId={null} onSelect={noop} />);
    expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
  });
});

describe('ConversationList — populated state', () => {
  it('renders the list container when conversations exist', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-list-empty')).not.toBeInTheDocument();
  });

  it('renders an item for each conversation', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-item-conv-1')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-item-conv-2')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-item-conv-3')).toBeInTheDocument();
  });

  it('renders conversation titles', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-title-conv-1')).toHaveTextContent('Portfolio Review');
    expect(screen.getByTestId('conversation-title-conv-2')).toHaveTextContent('Volatility Analysis');
    expect(screen.getByTestId('conversation-title-conv-3')).toHaveTextContent('Options Strategy');
  });

  it('renders plural message count label', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-count-conv-1')).toHaveTextContent('5 messages');
    expect(screen.getByTestId('conversation-count-conv-3')).toHaveTextContent('12 messages');
  });

  it('renders singular message count label for 1 message', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-count-conv-2')).toHaveTextContent('1 message');
  });

  it('renders each item as a button element', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-item-conv-1').tagName).toBe('BUTTON');
  });
});

describe('ConversationList — timestamps', () => {
  it('formats recent timestamps as "Xm ago"', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-time-conv-1')).toHaveTextContent('30m ago');
  });

  it('formats hour-old timestamps as "Xh ago"', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-time-conv-2')).toHaveTextContent('2h ago');
  });

  it('formats day-old timestamps as "Xd ago"', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-time-conv-3')).toHaveTextContent('3d ago');
  });

  it('shows "Just now" for sub-minute timestamps', () => {
    const justNow = [{ id: 'j1', title: 'Fresh', messageCount: 1, updatedAt: new Date().toISOString() }];
    render(<ConversationList conversations={justNow} currentId={null} onSelect={noop} />);
    expect(screen.getByTestId('conversation-time-j1')).toHaveTextContent('Just now');
  });

  it('formats old timestamps as a short date string', () => {
    const old = [
      {
        id: 'old1',
        title: 'Old Chat',
        messageCount: 3,
        updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10d ago
      },
    ];
    render(<ConversationList conversations={old} currentId={null} onSelect={noop} />);
    // Should not be "Xd ago" for anything ≥7 days — just check it's not empty
    const timeEl = screen.getByTestId('conversation-time-old1');
    expect(timeEl.textContent).not.toBe('');
    expect(timeEl.textContent).not.toMatch(/\d+d ago/);
  });
});

describe('ConversationList — active state', () => {
  it('marks the active conversation with aria-current="true"', () => {
    render(<ConversationList conversations={mockConversations} currentId="conv-1" onSelect={noop} />);
    expect(screen.getByTestId('conversation-item-conv-1')).toHaveAttribute('aria-current', 'true');
  });

  it('does not mark inactive conversations with aria-current', () => {
    render(<ConversationList conversations={mockConversations} currentId="conv-1" onSelect={noop} />);
    expect(screen.getByTestId('conversation-item-conv-2')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('conversation-item-conv-3')).not.toHaveAttribute('aria-current');
  });

  it('no item is marked active when currentId is null', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    for (const conv of mockConversations) {
      expect(screen.getByTestId(`conversation-item-${conv.id}`)).not.toHaveAttribute('aria-current');
    }
  });

  it('switches active item when currentId changes', () => {
    const { rerender } = render(
      <ConversationList conversations={mockConversations} currentId="conv-1" onSelect={noop} />,
    );
    expect(screen.getByTestId('conversation-item-conv-1')).toHaveAttribute('aria-current', 'true');

    rerender(<ConversationList conversations={mockConversations} currentId="conv-2" onSelect={noop} />);
    expect(screen.getByTestId('conversation-item-conv-1')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('conversation-item-conv-2')).toHaveAttribute('aria-current', 'true');
  });
});

describe('ConversationList — interactions', () => {
  it('calls onSelect with the conversation id when clicked', () => {
    const onSelect = vi.fn();
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('conversation-item-conv-1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('conv-1');
  });

  it('calls onSelect with the correct id for each item', () => {
    const onSelect = vi.fn();
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('conversation-item-conv-2'));
    expect(onSelect).toHaveBeenCalledWith('conv-2');
    fireEvent.click(screen.getByTestId('conversation-item-conv-3'));
    expect(onSelect).toHaveBeenCalledWith('conv-3');
  });

  it('applies hover background on mouseenter', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-1');
    fireEvent.mouseEnter(item);
    expect(item.style.background.replace(/,\s+/g, ',')).toContain('rgba(255,255,255,0.05)');
  });

  it('resets background on mouseleave', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-1');
    fireEvent.mouseEnter(item);
    fireEvent.mouseLeave(item);
    expect(item.style.background).toBe('transparent');
  });

  it('active item does not use hover background when not hovered', () => {
    render(<ConversationList conversations={mockConversations} currentId="conv-1" onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-1');
    // Active background should be the accent tint, not hover color
    expect(item.style.background.replace(/,\s+/g, ',')).toContain('rgba(79,142,247,0.08)');
  });
});

describe('ConversationList — accessibility', () => {
  it('each item has a descriptive aria-label with title and message count', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-1');
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('Portfolio Review'));
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('5'));
  });

  it('aria-label uses singular "message" for 1 message', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-2');
    expect(item).toHaveAttribute('aria-label', 'Volatility Analysis, 1 message');
  });

  it('aria-label uses plural "messages" for multiple messages', () => {
    render(<ConversationList conversations={mockConversations} currentId={null} onSelect={noop} />);
    const item = screen.getByTestId('conversation-item-conv-1');
    expect(item).toHaveAttribute('aria-label', 'Portfolio Review, 5 messages');
  });
});
