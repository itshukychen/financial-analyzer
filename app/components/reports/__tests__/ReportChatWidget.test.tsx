import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportChatWidget from '../ReportChatWidget';

// Mock fetch
global.fetch = vi.fn();

describe('ReportChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (global.fetch as any).mockClear();
  });

  it('renders with empty state', () => {
    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    expect(screen.getByText(/Ask a question about this report/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your question/i)).toBeInTheDocument();
  });

  it('submits question and displays answer', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'VIX is 18.2', tokensUsed: { input: 100, output: 50 } }),
    });

    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'What is VIX?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('VIX is 18.2')).toBeInTheDocument();
    });
  });

  it('displays user question in chat', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Test answer', tokensUsed: { input: 100, output: 50 } }),
    });

    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test question?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Test question?')).toBeInTheDocument();
    });
  });

  it('clears history when clear button clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Test answer', tokensUsed: { input: 100, output: 50 } }),
    });

    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test question?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Test question?')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear History');
    fireEvent.click(clearButton);

    expect(screen.getByText(/Ask a question about this report/i)).toBeInTheDocument();
    expect(screen.queryByText('Test question?')).not.toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API error' }),
    });

    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test question?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument();
    });
  });

  it('enforces rate limit of 30 questions per session', async () => {
    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    // Set rate limit to 30
    sessionStorage.setItem('question_count_2026-03-14-morning', '30');

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Another question?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/reached the question limit/i)).toBeInTheDocument();
    });
  });

  it('disables submit button when question is empty', () => {
    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const submitButton = screen.getByText('Ask') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button when question exceeds 500 chars', () => {
    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'a'.repeat(501) } });

    const submitButton = screen.getByText('Ask') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it('shows loading spinner during API call', async () => {
    (global.fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ answer: 'Answer', tokensUsed: { input: 100, output: 50 } }),
              }),
            100
          )
        )
    );

    render(
      <ReportChatWidget
        reportId="2026-03-14-morning"
        reportDate="2026-03-14"
        reportPeriod="morning"
      />
    );

    const input = screen.getByPlaceholderText(/Type your question/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test question?' } });

    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);

    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ask')).toBeInTheDocument();
    });
  });
});
