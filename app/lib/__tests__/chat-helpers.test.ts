// app/lib/__tests__/chat-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { validateChatRequest, buildContextMessages } from '../chat-helpers';

describe('validateChatRequest', () => {
  const validBody = {
    message: 'Why is VIX low?',
    reportDate: '2026-03-10',
    reportPeriod: 'eod',
    conversationHistory: [],
    contextData: {
      marketData: { spx: { close: 5900, percentChange: 0.5 } },
      analysis: { regime: { classification: 'Normal' } }
    }
  };

  it('validates correct request', () => {
    const result = validateChatRequest(validBody);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('rejects empty message', () => {
    const result = validateChatRequest({ ...validBody, message: '   ' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects message over 2000 chars', () => {
    const longMessage = 'a'.repeat(2001);
    const result = validateChatRequest({ ...validBody, message: longMessage });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('rejects invalid date format', () => {
    const result = validateChatRequest({ ...validBody, reportDate: '2026/03/10' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('date');
  });

  it('rejects invalid period', () => {
    const result = validateChatRequest({ ...validBody, reportPeriod: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('period');
  });

  it('rejects missing context data', () => {
    const result = validateChatRequest({ ...validBody, contextData: null });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('context');
  });
});

describe('buildContextMessages', () => {
  const mockContext = {
    marketData: {
      spx: { close: 5900, percentChange: 0.5 },
      vix: { close: 18.3, percentChange: -0.2 },
      dxy: { close: 104.2, percentChange: 0.3 },
      yield10y: { close: 4.15, percentChange: 8 },
      yield2y: { close: 4.05, percentChange: 5 }
    },
    analysis: {
      regime: { classification: 'Normal', justification: 'Test' },
      yieldCurve: 'Test yield curve',
      dollarLogic: 'Test dollar',
      equityDiagnosis: 'Test equity',
      volatility: 'Test volatility',
      crossAssetCheck: 'Test cross-asset',
      forwardScenarios: 'Test scenarios',
      shortVolRisk: 'Test risk',
      regimeProbabilities: '50% / 30% / 20%'
    }
  };

  it('builds correct message structure', () => {
    const messages = buildContextMessages(
      '2026-03-10',
      'eod',
      mockContext,
      [],
      'Why is VIX low?'
    );

    expect(messages.length).toBe(3); // system + ack + user message
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('Market Data');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toBe('Why is VIX low?');
  });

  it('includes conversation history', () => {
    const history = [
      { id: '1', role: 'user' as const, content: 'First question', timestamp: '' },
      { id: '2', role: 'assistant' as const, content: 'First answer', timestamp: '' }
    ];

    const messages = buildContextMessages(
      '2026-03-10',
      'eod',
      mockContext,
      history,
      'Follow-up question'
    );

    expect(messages.length).toBe(5); // system + ack + history (2) + current
    expect(messages[2].content).toBe('First question');
    expect(messages[3].content).toBe('First answer');
    expect(messages[4].content).toBe('Follow-up question');
  });

  it('formats market data correctly', () => {
    const messages = buildContextMessages(
      '2026-03-10',
      'eod',
      mockContext,
      [],
      'Test'
    );

    const systemMessage = messages[0].content as string;
    expect(systemMessage).toContain('SPX: 5900.00 (+0.50%)');
    expect(systemMessage).toContain('VIX: 18.30 (-0.20%)');
    expect(systemMessage).toContain('DXY: 104.20 (+0.30%)');
  });
});
