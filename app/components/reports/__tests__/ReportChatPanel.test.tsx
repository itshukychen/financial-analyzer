// app/components/reports/__tests__/ReportChatPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportChatPanel from '../ReportChatPanel';

const mockProps = {
  reportDate: '2026-03-10',
  reportPeriod: 'eod' as const,
  marketData: {
    spx: { close: 5900, percentChange: 0.5 },
    vix: { close: 18.3, percentChange: -0.2 },
    dxy: { close: 104.2, percentChange: 0.3 },
    yield10y: { close: 4.15, percentChange: 8 },
    yield2y: { close: 4.05, percentChange: 5 }
  },
  analysis: {
    regime: { classification: 'Normal', justification: 'Test' },
    yieldCurve: 'Test',
    dollarLogic: 'Test',
    equityDiagnosis: 'Test',
    volatility: 'Test',
    crossAssetCheck: 'Test',
    forwardScenarios: 'Test',
    shortVolRisk: 'Test',
    regimeProbabilities: '50% / 30% / 20%'
  }
};

describe('ReportChatPanel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders empty chat on load', () => {
    render(<ReportChatPanel {...mockProps} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument();
  });

  it('shows header with date and period', () => {
    render(<ReportChatPanel {...mockProps} />);
    expect(screen.getByText('2026-03-10')).toBeInTheDocument();
    expect(screen.getByText('EOD')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ReportChatPanel {...mockProps} />);
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    expect(sendButton).toBeEnabled();
  });

  it('disables send button when input exceeds max length', () => {
    render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    const longText = 'a'.repeat(2001);
    fireEvent.change(input, { target: { value: longText } });
    expect(sendButton).toBeDisabled();
  });

  it('sends message on Enter key', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          role: 'assistant',
          content: 'Test response',
          timestamp: new Date().toISOString(),
          tokensUsed: { input: 100, output: 50 }
        })
      } as Response)
    );

    render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: 'Why is VIX low?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // User message appears immediately (optimistic UI)
    await waitFor(() => {
      expect(screen.getByText('Why is VIX low?')).toBeInTheDocument();
    });

    // AI response appears after API call
    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
  });

  it('displays error on API failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'test_error', message: 'Network error' })
      } as Response)
    );

    render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('clears conversation when clear button clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          role: 'assistant',
          content: 'Response',
          timestamp: new Date().toISOString(),
          tokensUsed: { input: 100, output: 50 }
        })
      } as Response)
    );

    render(<ReportChatPanel {...mockProps} />);
    
    // Send a message first
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    // Messages should be gone
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('persists conversation to sessionStorage', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          role: 'assistant',
          content: 'Response',
          timestamp: new Date().toISOString(),
          tokensUsed: { input: 100, output: 50 }
        })
      } as Response)
    );

    const { unmount } = render(<ReportChatPanel {...mockProps} />);
    
    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Unmount component
    unmount();

    // Re-render component
    render(<ReportChatPanel {...mockProps} />);

    // Messages should be restored from sessionStorage
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });
});
