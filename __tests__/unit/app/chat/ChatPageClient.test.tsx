/**
 * Tests for: app/chat/ChatPageClient.tsx
 *
 * Coverage:
 * - Page container, title, and description render
 * - New Chat button exists and is labelled correctly
 * - Clicking New Chat re-mounts ChatContainer (key increment)
 * - Chat area renders the lazy ChatContainer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Mock ChatContainer before lazy() executes ──────────────────────────────

const mockChatContainer = vi.fn(() => <div data-testid="chat-container" />);

vi.mock('@/app/chat/components/ChatContainer', () => ({
  default: mockChatContainer,
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import ChatPageClient from '@/app/chat/ChatPageClient';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ChatPageClient', () => {
  beforeEach(() => {
    mockChatContainer.mockClear();
  });

  it('renders the page container', async () => {
    render(<ChatPageClient />);
    expect(screen.getByTestId('chat-page')).toBeInTheDocument();
  });

  it('renders the AI Chat heading', async () => {
    render(<ChatPageClient />);
    expect(screen.getByRole('heading', { level: 1, name: 'AI Chat' })).toBeInTheDocument();
  });

  it('renders the page description', async () => {
    render(<ChatPageClient />);
    expect(
      screen.getByText(/Ask Claude about your portfolio/i),
    ).toBeInTheDocument();
  });

  it('renders New Chat button with correct label', async () => {
    render(<ChatPageClient />);
    const btn = screen.getByTestId('new-chat-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('New Chat');
    expect(btn).toHaveAttribute('aria-label', 'Start a new conversation');
  });

  it('renders the chat area', async () => {
    render(<ChatPageClient />);
    expect(screen.getByTestId('chat-area')).toBeInTheDocument();
  });

  it('renders ChatContainer after lazy load resolves', async () => {
    render(<ChatPageClient />);
    await waitFor(() => {
      expect(screen.getByTestId('chat-container')).toBeInTheDocument();
    });
  });

  it('clicking New Chat re-mounts ChatContainer by incrementing key', async () => {
    render(<ChatPageClient />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('chat-container')).toBeInTheDocument();
    });

    const callsBefore = mockChatContainer.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('new-chat-btn'));
    });

    // React remounts the component (new key) — mock is called again
    await waitFor(() => {
      expect(mockChatContainer.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('New Chat button is always enabled (not disabled)', async () => {
    render(<ChatPageClient />);
    const btn = screen.getByTestId('new-chat-btn');
    expect(btn).not.toBeDisabled();
  });
});
