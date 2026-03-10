import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import type { NextRequest } from 'next/server';

// Type for vitest mocked functions
type VitestMock = {
  mockReturnValue: (value: unknown) => VitestMock;
  mockResolvedValue: (value: unknown) => VitestMock;
};

// Set environment variables before mocking
process.env.ANTHROPIC_API_KEY = 'sk-test-key-for-testing-123456789';

// Mock the database module
vi.mock('@/lib/db', () => ({
  insertOrReplaceAnalysisCache: vi.fn(),
  getAnalysisCache: vi.fn(),
  getOptionSnapshot: vi.fn(),
  getOptionProjection: vi.fn(),
}));

// Mock the Claude client
vi.mock('@/lib/ai/claude-client', () => ({
  callClaudeAPI: vi.fn(async () => 'Mocked Claude response'),
  parseClaudeResponse: vi.fn(() => ({
    success: true,
    sections: [
      {
        id: 'test-section',
        title: 'Test Section',
        icon: '🎯',
        prose: 'Test prose',
        highlights: [],
      },
    ],
    nextDayProjection: {
      targetLow: 100,
      targetHigh: 110,
      mode: 105,
      confidence: 'medium',
      moveProb: 0.65,
      description: 'Test projection',
    },
  })),
}));

// Mock the Claude prompt builder
vi.mock('@/lib/ai/claude-prompt', () => ({
  buildClaudePrompt: vi.fn(() => 'Test prompt'),
}));

describe('POST /api/options/ai-analysis', () => {
  const mockRequest = (body: Record<string, unknown>): Partial<NextRequest> => ({
    json: async () => body,
  });

  const mockSnapshotData = {
    net_delta: 0.5,
    atm_gamma: 0.02,
    vega_per_1pct: 100,
    theta_daily: -50,
    iv_30d: 28.5,
    iv_rank: 55,
    hv_20d: 20,
    implied_move_pct: 2.5,
    regime: 'normal',
    skew_ratio: 1.1,
    put_otm_iv: 25,
    call_otm_iv: 25,
  };

  const mockProjectionData = {
    prob_distribution: JSON.stringify([
      { price: 100, probability: 0.15 },
      { price: 105, probability: 0.35 },
      { price: 110, probability: 0.25 },
    ]),
    key_levels: JSON.stringify([
      { type: '2sd_low', level: 95 },
      { type: 'mode', level: 105 },
      { type: '2sd_high', level: 115 },
    ]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cache Management', () => {
    it('should return cached result when cache is valid', async () => {
      const { getAnalysisCache } = await import('@/lib/db');
      const mockCachedData = {
        success: true,
        sections: [],
        nextDayProjection: { targetLow: 100, targetHigh: 110, mode: 105, confidence: 'high', moveProb: 0.75, description: 'Cached' },
        metadata: {
          ticker: 'SPWX',
          date: '2026-03-10',
          generatedAt: new Date().toISOString(),
          isCached: true,
          cacheAge: 300,
          nextUpdate: new Date(Date.now() + 3600000).toISOString(),
        },
      };

      (getAnalysisCache as unknown as VitestMock).mockReturnValue({
        analysis_json: JSON.stringify(mockCachedData),
        created_at: new Date(Date.now() - 300000).toISOString(),
      });

      const request = mockRequest({ ticker: 'SPWX', date: '2026-03-10' }) as NextRequest;
      const response = await POST(request);
      const data = await response.json();

      expect(getAnalysisCache).toHaveBeenCalledWith('SPWX', '2026-03-10');
      expect(data.metadata.isCached).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should skip cache when regenerate=true', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockResolvedValue('test response');

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
        regenerate: true,
      }) as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(getAnalysisCache).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.metadata.isCached).toBe(false);
    });

    it('should generate new analysis on cache miss', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection, insertOrReplaceAnalysisCache } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockResolvedValue('test response');
      (insertOrReplaceAnalysisCache as unknown as VitestMock).mockReturnValue(undefined);

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(getAnalysisCache).toHaveBeenCalled();
      expect(callClaudeAPI).toHaveBeenCalled();
      expect(insertOrReplaceAnalysisCache).toHaveBeenCalled();
      expect(data.metadata.isCached).toBe(false);
      expect(response.status).toBe(200);
    });

    it('should store generated analysis in cache', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection, insertOrReplaceAnalysisCache } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockResolvedValue('test response');
      (insertOrReplaceAnalysisCache as unknown as VitestMock).mockReturnValue(undefined);

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      await POST(request);

      expect(insertOrReplaceAnalysisCache).toHaveBeenCalledWith(
        'SPWX',
        '2026-03-10',
        expect.any(String),
        expect.any(String)
      );

      const callArgs = (insertOrReplaceAnalysisCache as unknown as VitestMock).mock.calls[0];
      expect(callArgs[2]).toContain('success');
    });
  });

  describe('Claude API Integration', () => {
    it('should call Claude API with correct prompt', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');
      const { buildClaudePrompt } = await import('@/lib/ai/claude-prompt');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockResolvedValue('test response');

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      await POST(request);

      expect(buildClaudePrompt).toHaveBeenCalled();
      expect(callClaudeAPI).toHaveBeenCalled();
    });

    it('should handle Claude API errors gracefully', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockRejectedValue(new Error('API Error'));

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('API Error');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 error when snapshot data is missing', async () => {
      const { getAnalysisCache, getOptionSnapshot } = await import('@/lib/db');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(null);

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing snapshot');
    });

    it('should return 500 error when projection data is missing', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(null);

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing snapshot or projection');
    });

    it('should attempt stale cache fallback on API failure', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');
      const { callClaudeAPI } = await import('@/lib/ai/claude-client');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);
      (callClaudeAPI as unknown as VitestMock).mockRejectedValue(new Error('API timeout'));

      const request = mockRequest({
        ticker: 'SPWX',
        date: '2026-03-10',
      }) as NextRequest;

      const response = await POST(request);

      // When all attempts fail, should return error response
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Request Handling', () => {
    it('should use current date when no date is provided', async () => {
      const { getAnalysisCache, getOptionSnapshot, getOptionProjection } = await import('@/lib/db');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue(null);
      (getOptionSnapshot as unknown as VitestMock).mockReturnValue(mockSnapshotData);
      (getOptionProjection as unknown as VitestMock).mockReturnValue(mockProjectionData);

      const request = mockRequest({ ticker: 'SPWX' }) as NextRequest;

      await POST(request);

      const today = new Date().toISOString().split('T')[0];
      expect(getAnalysisCache).toHaveBeenCalledWith('SPWX', today);
    });

    it('should parse request body correctly', async () => {
      const { getAnalysisCache } = await import('@/lib/db');

      (getAnalysisCache as unknown as VitestMock).mockReturnValue({
        analysis_json: JSON.stringify({
          success: true,
          sections: [],
          nextDayProjection: { targetLow: 100, targetHigh: 110, mode: 105, confidence: 'high', moveProb: 0.75, description: 'Test' },
          metadata: {
            ticker: 'AAPL',
            date: '2026-03-10',
            generatedAt: new Date().toISOString(),
            isCached: true,
            cacheAge: 0,
            nextUpdate: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
        created_at: new Date().toISOString(),
      });

      const request = mockRequest({
        ticker: 'AAPL',
        date: '2026-03-10',
        regenerate: false,
      }) as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(data.metadata.ticker).toBe('AAPL');
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const { getAnalysisCache } = await import('@/lib/db');

      const cachedData = {
        success: true,
        sections: [{ id: 'test', title: 'Test', icon: '🎯', prose: 'Test', highlights: [] }],
        nextDayProjection: { targetLow: 100, targetHigh: 110, mode: 105, confidence: 'high', moveProb: 0.75, description: 'Test' },
        metadata: {
          ticker: 'SPWX',
          date: '2026-03-10',
          generatedAt: new Date().toISOString(),
          isCached: true,
          cacheAge: 300,
          nextUpdate: new Date(Date.now() + 3600000).toISOString(),
        },
      };

      (getAnalysisCache as unknown as VitestMock).mockReturnValue({
        analysis_json: JSON.stringify(cachedData),
        created_at: new Date(Date.now() - 300000).toISOString(),
      });

      const request = mockRequest({ ticker: 'SPWX' }) as NextRequest;
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('sections');
      expect(data).toHaveProperty('nextDayProjection');
      expect(data).toHaveProperty('metadata');
      expect(Array.isArray(data.sections)).toBe(true);
    });

    it('should include cache metadata in response', async () => {
      const { getAnalysisCache } = await import('@/lib/db');

      const cachedData = {
        success: true,
        sections: [],
        nextDayProjection: { targetLow: 100, targetHigh: 110, mode: 105, confidence: 'high', moveProb: 0.75, description: 'Test' },
        metadata: {
          ticker: 'SPWX',
          date: '2026-03-10',
          generatedAt: new Date().toISOString(),
          isCached: true,
          cacheAge: 300,
          nextUpdate: new Date(Date.now() + 3600000).toISOString(),
        },
      };

      (getAnalysisCache as unknown as VitestMock).mockReturnValue({
        analysis_json: JSON.stringify(cachedData),
        created_at: new Date(Date.now() - 300000).toISOString(),
      });

      const request = mockRequest({ ticker: 'SPWX' }) as NextRequest;
      const response = await POST(request);
      const data = await response.json();

      expect(data.metadata.isCached).toBe(true);
      expect(data.metadata.cacheAge).toBeGreaterThan(0);
    });
  });
});
