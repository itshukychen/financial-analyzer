import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { createDb } from '@/lib/db';

// Create in-memory DB for testing
const db = createDb(':memory:');

// Mock the necessary dependencies
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db');
  return {
    ...actual,
    getReportByDate: vi.fn((date, period) => {
      // Return mock report data
      if (date === '2026-03-14') {
        return {
          id: 1,
          date: '2026-03-14',
          period: period || 'eod',
          generated_at: Math.floor(Date.now() / 1000),
          ticker_data: JSON.stringify({ SPX: 5745, VIX: 18.2 }),
          report_json: JSON.stringify({
            equityDiagnosis: 'Bullish',
            equityForecast: '3-5% upside',
            volatility: 'Low',
            regimeProbabilities: 'Low vol 60%',
          }),
          model: 'claude-sonnet',
        };
      }
      return null;
    }),
    insertQuestionLog: vi.fn(() => ({
      id: 1,
      report_id: 'test-id',
      question: 'test',
      answer: 'test answer',
      tokens_input: 100,
      tokens_output: 50,
      created_at: Math.floor(Date.now() / 1000),
    })),
  };
});

vi.mock('@/lib/ai/report-qa-client', () => ({
  callClaudeForReportQA: vi.fn(async () => ({
    answer: 'Test answer from Claude',
    tokensUsed: { input: 150, output: 75 },
  })),
}));

describe('POST /api/reports/[reportId]/ask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns answer for valid question', async () => {
    const mockRequest = new Request('http://localhost/api/reports/2026-03-14-morning/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is VIX?' }),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: '2026-03-14-morning' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.answer).toContain('Test answer');
    expect(data.tokensUsed).toHaveProperty('input');
  });

  it('returns 400 for invalid reportId format', async () => {
    const mockRequest = new Request('http://localhost/api/reports/invalid/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is VIX?' }),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: 'invalid-format' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 for missing question', async () => {
    const mockRequest = new Request('http://localhost/api/reports/2026-03-14/ask', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: '2026-03-14' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('required');
  });

  it('returns 400 for empty question', async () => {
    const mockRequest = new Request('http://localhost/api/reports/2026-03-14/ask', {
      method: 'POST',
      body: JSON.stringify({ question: '   ' }),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: '2026-03-14' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 for question exceeding 500 chars', async () => {
    const longQuestion = 'a'.repeat(501);
    const mockRequest = new Request('http://localhost/api/reports/2026-03-14/ask', {
      method: 'POST',
      body: JSON.stringify({ question: longQuestion }),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: '2026-03-14' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('too long');
  });

  it('returns 404 when report not found', async () => {
    const mockRequest = new Request('http://localhost/api/reports/2025-01-01/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is VIX?' }),
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ reportId: '2025-01-01' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });
});
