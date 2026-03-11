import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageInput from '@/app/chat/components/MessageInput';

describe('MessageInput', () => {
  const onSend = vi.fn();

  beforeEach(() => {
    onSend.mockClear();
  });

  it('renders textarea with correct placeholder', () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    expect(
      screen.getByPlaceholderText(
        'Ask about volatility, strategies, or your portfolio...'
      )
    ).toBeInTheDocument();
  });

  it('renders helper text', () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    expect(
      screen.getByTestId('message-input-helper')
    ).toHaveTextContent('Press Enter to send, Shift+Enter for new line');
  });

  it('send button is disabled when input is empty', () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('send button is enabled when input has content', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello');
    expect(screen.getByTestId('send-button')).not.toBeDisabled();
  });

  it('send button is disabled when disabled prop is true even with content', async () => {
    render(<MessageInput onSend={onSend} disabled={true} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('calls onSend with trimmed message on button click', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, '  Hello world  ');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('clears input after send', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(textarea).toHaveValue('');
  });

  it('calls onSend on Enter key press', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does NOT call onSend on Shift+Enter', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, 'Hello');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does NOT call onSend for whitespace-only input', async () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByTestId('message-textarea');
    await userEvent.type(textarea, '   ');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('textarea is disabled when disabled prop is true', () => {
    render(<MessageInput onSend={onSend} disabled={true} />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
  });

  it('renders container with correct data-testid', () => {
    render(<MessageInput onSend={onSend} disabled={false} />);
    expect(screen.getByTestId('message-input-container')).toBeInTheDocument();
  });
});
