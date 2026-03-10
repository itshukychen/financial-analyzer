# Implementation Tasks: AI Chat in Daily Report

**Feature:** Report AI Chat Interface  
**PRD:** `/docs/prd-report-ai-chat.md`  
**Design:** `/docs/design-report-ai-chat.md`  
**Status:** Ready for Development  
**Assignee:** Engineer Agent  
**Estimated Effort:** 5-7 days

---

## Task Overview

This document breaks down the AI Chat feature into granular, actionable tasks. Each task includes:
- Clear acceptance criteria
- Implementation guidance
- Testing requirements
- Dependencies

**Implementation Order:** Tasks are ordered by dependency. Complete in sequence unless marked parallel.

---

## Phase 1: Foundation (Day 1)

### Task 1.1: Create Type Definitions

**File:** `types/chat.ts` (new)

**Description:** Define TypeScript interfaces for chat messages, requests, and responses

**Implementation:**
```typescript
// types/chat.ts

export interface ChatMessage {
  id: string;                   // UUID
  role: 'user' | 'assistant';
  content: string;              // Message text (markdown for assistant)
  timestamp: string;            // ISO 8601
}

export interface ChatRequest {
  message: string;              // User's question (1-2000 chars)
  reportDate: string;           // "YYYY-MM-DD"
  reportPeriod: 'eod' | 'morning' | 'midday';
  conversationHistory: ChatMessage[];
  contextData: {
    marketData: any;            // MarketData from report
    analysis: any;              // Analysis from report
  };
}

export interface ChatResponse {
  id: string;                   // Message UUID
  role: 'assistant';
  content: string;              // AI response (markdown)
  timestamp: string;            // ISO 8601
  tokensUsed: {
    input: number;
    output: number;
  };
}

export interface ChatError {
  error: string;                // Error code
  message: string;              // User-friendly message
  retryAfter?: number;          // Seconds to wait (429 only)
}
```

**Acceptance Criteria:**
- [ ] All interfaces export correctly
- [ ] No TypeScript errors in project after adding
- [ ] Types match design spec exactly

**Testing:** Run `npm run build` — no errors

---

### Task 1.2: Install Dependencies

**Description:** Install required packages for chat functionality

**Commands:**
```bash
cd /home/claw/worktrees/financial-analyzer/feature/report-ai-chat
npm install react-markdown remark-gfm
```

**Acceptance Criteria:**
- [ ] `react-markdown` installed (for rendering AI responses)
- [ ] `remark-gfm` installed (GitHub-flavored markdown support)
- [ ] `package.json` updated with new dependencies
- [ ] `package-lock.json` regenerated

**Testing:** Run `npm install` — no errors

---

### Task 1.3: Create Rate Limiter Module

**File:** `app/lib/rate-limiter.ts` (new)

**Description:** Implement in-memory rate limiter for API protection

**Implementation:**
```typescript
// app/lib/rate-limiter.ts

interface RateLimitConfig {
  perSession: {
    maxRequests: number;
    windowMs: number;
  };
  perIP: {
    maxRequests: number;
    windowMs: number;
  };
}

const config: RateLimitConfig = {
  perSession: {
    maxRequests: 1,
    windowMs: 2000,         // 2 seconds
  },
  perIP: {
    maxRequests: 100,
    windowMs: 3600000,      // 1 hour
  },
};

class RateLimiter {
  private sessionRequests = new Map<string, number[]>();
  private ipRequests = new Map<string, number[]>();

  checkLimit(sessionId: string, ip: string): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const now = Date.now();

    // Check session limit
    const sessionTimes = this.sessionRequests.get(sessionId) || [];
    const recentSessionRequests = sessionTimes.filter(
      t => now - t < config.perSession.windowMs
    );

    if (recentSessionRequests.length >= config.perSession.maxRequests) {
      const oldestRequest = Math.min(...recentSessionRequests);
      const retryAfter = Math.ceil((config.perSession.windowMs - (now - oldestRequest)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Check IP limit
    const ipTimes = this.ipRequests.get(ip) || [];
    const recentIPRequests = ipTimes.filter(
      t => now - t < config.perIP.windowMs
    );

    if (recentIPRequests.length >= config.perIP.maxRequests) {
      const oldestRequest = Math.min(...recentIPRequests);
      const retryAfter = Math.ceil((config.perIP.windowMs - (now - oldestRequest)) / 1000);
      return { allowed: false, retryAfter };
    }

    // Allow request and record timestamp
    this.sessionRequests.set(sessionId, [...recentSessionRequests, now]);
    this.ipRequests.set(ip, [...recentIPRequests, now]);

    // Cleanup old entries
    this.cleanup();

    return { allowed: true };
  }

  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(config.perSession.windowMs, config.perIP.windowMs);

    // Clean session requests
    for (const [key, times] of this.sessionRequests.entries()) {
      const recent = times.filter(t => now - t < maxWindow);
      if (recent.length === 0) {
        this.sessionRequests.delete(key);
      } else {
        this.sessionRequests.set(key, recent);
      }
    }

    // Clean IP requests
    for (const [key, times] of this.ipRequests.entries()) {
      const recent = times.filter(t => now - t < maxWindow);
      if (recent.length === 0) {
        this.ipRequests.delete(key);
      } else {
        this.ipRequests.set(key, recent);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
```

**Acceptance Criteria:**
- [ ] Rate limiter enforces session limit (1 req per 2s)
- [ ] Rate limiter enforces IP limit (100 req per hour)
- [ ] Cleanup runs correctly (no memory leaks)
- [ ] Returns correct `retryAfter` value

**Testing:** Unit tests (next task)

---

### Task 1.4: Write Rate Limiter Unit Tests

**File:** `app/lib/__tests__/rate-limiter.test.ts` (new)

**Description:** Comprehensive unit tests for rate limiter logic

**Implementation:**
```typescript
// app/lib/__tests__/rate-limiter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset rate limiter state
    (rateLimiter as any).sessionRequests.clear();
    (rateLimiter as any).ipRequests.clear();
  });

  it('allows first request', () => {
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('blocks second request within 2 seconds', () => {
    rateLimiter.checkLimit('session1', '1.1.1.1');
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(2);
  });

  it('allows request after 2 seconds', async () => {
    vi.useFakeTimers();
    
    rateLimiter.checkLimit('session1', '1.1.1.1');
    
    vi.advanceTimersByTime(2100); // 2.1 seconds
    
    const result = rateLimiter.checkLimit('session1', '1.1.1.1');
    expect(result.allowed).toBe(true);
    
    vi.useRealTimers();
  });

  it('tracks different sessions independently', () => {
    rateLimiter.checkLimit('session1', '1.1.1.1');
    const result = rateLimiter.checkLimit('session2', '1.1.1.1');
    
    expect(result.allowed).toBe(true);
  });

  it('blocks IP after 100 requests', () => {
    for (let i = 0; i < 100; i++) {
      rateLimiter.checkLimit(`session${i}`, '1.1.1.1');
    }
    
    const result = rateLimiter.checkLimit('session101', '1.1.1.1');
    expect(result.allowed).toBe(false);
  });

  it('cleans up old entries', () => {
    vi.useFakeTimers();
    
    rateLimiter.checkLimit('session1', '1.1.1.1');
    
    vi.advanceTimersByTime(3600000 + 1000); // 1 hour + 1 second
    
    // Trigger cleanup by making new request
    rateLimiter.checkLimit('session2', '2.2.2.2');
    
    // Old session should be cleaned up
    const map = (rateLimiter as any).sessionRequests;
    expect(map.has('session1')).toBe(false);
    
    vi.useRealTimers();
  });
});
```

**Acceptance Criteria:**
- [ ] All tests pass (`npm run test`)
- [ ] Coverage ≥90% for rate-limiter.ts
- [ ] Tests cover session limit, IP limit, cleanup

**Testing:** Run `npm run test -- rate-limiter.test.ts`

---

## Phase 2: Backend API (Day 2)

### Task 2.1: Create Chat Helper Functions

**File:** `app/lib/chat-helpers.ts` (new)

**Description:** Utility functions for validation, context building, and AI calls

**Implementation:**

```typescript
// app/lib/chat-helpers.ts
import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, ChatMessage } from '../../types/chat';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a financial analyst assistant for the Daily Market Report. Your role is to answer questions about the current day's market analysis.

**Key Rules:**
1. ONLY use information from the provided report data (market snapshot, analysis sections, regime probabilities)
2. NEVER invent data, predictions, or claims not in the report
3. If the user asks about something not in the report, politely explain what the report does cover
4. Cite specific sections when answering (e.g., "According to the Yield Curve Diagnosis section...")
5. Be concise but thorough (150-400 words per response)
6. Use markdown formatting for clarity (bold, lists, code for numbers)
7. For multi-turn conversations, you may reference previous exchanges

**Report Context Below:**`;

// Validate incoming chat request
export function validateChatRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: ChatRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { message, reportDate, reportPeriod, conversationHistory, contextData } = body as any;

  // Validate message
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }
  if (message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (message.length > 2000) {
    return { valid: false, error: 'Message too long (max 2000 characters)' };
  }

  // Validate reportDate
  if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return { valid: false, error: 'Invalid report date format' };
  }

  // Validate reportPeriod
  if (!['eod', 'morning', 'midday'].includes(reportPeriod)) {
    return { valid: false, error: 'Invalid report period' };
  }

  // Validate conversationHistory
  const history = conversationHistory || [];
  if (!Array.isArray(history)) {
    return { valid: false, error: 'Invalid conversation history' };
  }

  // Validate contextData
  if (!contextData || !contextData.marketData || !contextData.analysis) {
    return { valid: false, error: 'Missing context data' };
  }

  return {
    valid: true,
    data: { message, reportDate, reportPeriod, conversationHistory: history, contextData }
  };
}

// Build context messages for Anthropic API
export function buildContextMessages(
  reportDate: string,
  reportPeriod: string,
  contextData: { marketData: any; analysis: any },
  conversationHistory: ChatMessage[],
  userMessage: string
): Anthropic.MessageParam[] {
  
  // Format market data snapshot
  const marketSnapshot = `
**Market Data (${reportDate} - ${reportPeriod.toUpperCase()})**
- SPX: ${contextData.marketData.spx.close.toFixed(2)} (${contextData.marketData.spx.percentChange >= 0 ? '+' : ''}${contextData.marketData.spx.percentChange.toFixed(2)}%)
- VIX: ${contextData.marketData.vix.close.toFixed(2)} (${contextData.marketData.vix.percentChange >= 0 ? '+' : ''}${contextData.marketData.vix.percentChange.toFixed(2)}%)
- DXY: ${contextData.marketData.dxy.close.toFixed(2)} (${contextData.marketData.dxy.percentChange >= 0 ? '+' : ''}${contextData.marketData.dxy.percentChange.toFixed(2)}%)
- 10Y Yield: ${contextData.marketData.yield10y.close.toFixed(2)}% (${contextData.marketData.yield10y.percentChange >= 0 ? '+' : ''}${contextData.marketData.yield10y.percentChange.toFixed(2)}bps)
- 2Y Yield: ${contextData.marketData.yield2y.close.toFixed(2)}% (${contextData.marketData.yield2y.percentChange >= 0 ? '+' : ''}${contextData.marketData.yield2y.percentChange.toFixed(2)}bps)
`;

  // Format analysis sections
  const analysisSections = `
**Analysis Sections:**

**Regime Classification:** ${contextData.analysis.regime.classification}
${contextData.analysis.regime.justification}

**Yield Curve Diagnosis:**
${contextData.analysis.yieldCurve}

**Dollar Logic:**
${contextData.analysis.dollarLogic}

**Equity Move Diagnosis:**
${contextData.analysis.equityDiagnosis}

**Volatility Interpretation:**
${contextData.analysis.volatility}

**Cross-Asset Consistency:**
${contextData.analysis.crossAssetCheck}

**Forward Scenarios (1-2 Weeks):**
${contextData.analysis.forwardScenarios}

**Short Vol / 1DTE Risk:**
${contextData.analysis.shortVolRisk}

**Regime Probabilities:**
${contextData.analysis.regimeProbabilities}
`;

  // Build message array
  const messages: Anthropic.MessageParam[] = [];

  // Add system context (as first user message)
  messages.push({
    role: 'user',
    content: SYSTEM_PROMPT + '\n\n' + marketSnapshot + '\n' + analysisSections
  });

  // Add placeholder assistant acknowledgment
  messages.push({
    role: 'assistant',
    content: 'I understand. I will only use information from this report to answer questions.'
  });

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

// Call Anthropic API and get response
export async function getAIResponse(
  messages: Anthropic.MessageParam[]
): Promise<{ content: string; tokensUsed: { input: number; output: number } }> {
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    temperature: 0.7,
    messages: messages,
  });

  const content = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';

  return {
    content,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    }
  };
}
```

**Acceptance Criteria:**
- [ ] Validation function rejects invalid inputs
- [ ] Context building formats report data correctly
- [ ] AI response function calls Anthropic successfully
- [ ] Token usage is tracked

**Testing:** Unit tests (next task)

---

### Task 2.2: Write Chat Helper Unit Tests

**File:** `app/lib/__tests__/chat-helpers.test.ts` (new)

**Description:** Unit tests for validation and context building

**Implementation:**
```typescript
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
    const result = validateChatRequest({ ...validBody, message: '' });
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
```

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Coverage ≥90% for chat-helpers.ts
- [ ] Tests cover validation, context building, edge cases

**Testing:** Run `npm run test -- chat-helpers.test.ts`

---

### Task 2.3: Create Chat API Route

**File:** `app/api/reports/chat/route.ts` (new)

**Description:** Next.js API route handler for chat requests

**Implementation:**
```typescript
// app/api/reports/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimiter } from '../../../lib/rate-limiter';
import { validateChatRequest, buildContextMessages, getAIResponse } from '../../../lib/chat-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse request body
    const body = await request.json();
    
    // 2. Validate input
    const validation = validateChatRequest(body);
    
    if (!validation.valid) {
      console.warn('[Chat API] Validation failed:', validation.error);
      return NextResponse.json(
        { error: 'validation_failed', message: validation.error! },
        { status: 400 }
      );
    }

    const { message, reportDate, reportPeriod, conversationHistory, contextData } = validation.data!;

    // 3. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const sessionId = request.headers.get('x-session-id') || uuidv4();

    const rateLimit = rateLimiter.checkLimit(sessionId, ip);
    if (!rateLimit.allowed) {
      console.warn('[Chat API] Rate limited:', { sessionId: sessionId.substring(0, 8), ip: ip.substring(0, 8) });
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: `Too many requests. Please wait ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
    }

    // 4. Log request
    console.log('[Chat API Request]', {
      timestamp: new Date().toISOString(),
      reportDate,
      reportPeriod,
      messageLength: message.length,
      conversationLength: conversationHistory.length,
      sessionId: sessionId.substring(0, 8) + '***',
      ip: ip.substring(0, 8) + '***'
    });

    // 5. Build context and call AI
    const messages = buildContextMessages(
      reportDate,
      reportPeriod,
      contextData,
      conversationHistory,
      message
    );

    const aiResponse = await getAIResponse(messages);

    // 6. Log response
    const latency = Date.now() - startTime;
    console.log('[Chat API Response]', {
      timestamp: new Date().toISOString(),
      latency,
      tokensUsed: aiResponse.tokensUsed,
      responseLength: aiResponse.content.length
    });

    // 7. Return response
    return NextResponse.json({
      id: uuidv4(),
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      tokensUsed: aiResponse.tokensUsed
    });

  } catch (error: any) {
    console.error('[Chat API Error]', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });

    // Handle specific Anthropic errors
    if (error.status === 429) {
      return NextResponse.json(
        {
          error: 'api_rate_limited',
          message: 'AI service is temporarily overwhelmed. Please try again in a minute.',
          retryAfter: 60
        },
        { status: 429 }
      );
    }

    if (error.status === 503 || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'service_unavailable',
          message: 'AI service is temporarily unavailable. Please try again later.'
        },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Something went wrong. Please try again.'
      },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria:**
- [ ] API route handles POST requests
- [ ] Returns 200 with valid response on success
- [ ] Returns 400 for validation errors
- [ ] Returns 429 for rate limiting
- [ ] Returns 500/503 for API errors
- [ ] Logs all requests/responses

**Testing:** Manual test with curl (next task)

---

### Task 2.4: Manual API Testing

**Description:** Test API endpoint with curl to verify functionality

**Commands:**
```bash
# Test valid request
curl -X POST http://localhost:3002/api/reports/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test-session-1" \
  -d '{
    "message": "Why is VIX low?",
    "reportDate": "2026-03-10",
    "reportPeriod": "eod",
    "conversationHistory": [],
    "contextData": {
      "marketData": {
        "spx": {"close": 5900, "percentChange": 0.5},
        "vix": {"close": 18.3, "percentChange": -0.2},
        "dxy": {"close": 104.2, "percentChange": 0.3},
        "yield10y": {"close": 4.15, "percentChange": 8},
        "yield2y": {"close": 4.05, "percentChange": 5}
      },
      "analysis": {
        "regime": {"classification": "Normal", "justification": "Test"},
        "yieldCurve": "Test",
        "dollarLogic": "Test",
        "equityDiagnosis": "Test",
        "volatility": "VIX at 18.3 shows low volatility",
        "crossAssetCheck": "Test",
        "forwardScenarios": "Test",
        "shortVolRisk": "Test",
        "regimeProbabilities": "50% / 30% / 20%"
      }
    }
  }'

# Expected: 200 response with AI answer about VIX

# Test validation error (empty message)
curl -X POST http://localhost:3002/api/reports/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "", "reportDate": "2026-03-10", "reportPeriod": "eod"}'

# Expected: 400 error "Message cannot be empty"

# Test rate limiting (2 requests in <2s)
curl -X POST http://localhost:3002/api/reports/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test-session-2" \
  -d '{"message": "Test 1", "reportDate": "2026-03-10", "reportPeriod": "eod", "contextData": {...}}'

curl -X POST http://localhost:3002/api/reports/chat \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: test-session-2" \
  -d '{"message": "Test 2", "reportDate": "2026-03-10", "reportPeriod": "eod", "contextData": {...}}'

# Expected: Second request returns 429 "Too many requests"
```

**Acceptance Criteria:**
- [ ] Valid request returns 200 with AI response
- [ ] Invalid request returns 400 with error message
- [ ] Rate limiting works (429 on rapid requests)
- [ ] Logs appear in console

**Testing:** Run dev server (`npm run dev`) and test with curl

---

## Phase 3: Frontend Components (Day 3-4)

### Task 3.1: Create ChatMessage Component

**File:** `app/components/reports/ChatMessage.tsx` (new)

**Description:** Individual message bubble for user/AI messages

**Implementation:**
```typescript
// app/components/reports/ChatMessage.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest: boolean;
}

export default function ChatMessage({ message, isLatest }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Format timestamp (HH:MM)
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return (
    <div
      ref={isLatest ? (el) => el?.scrollIntoView({ behavior: 'smooth' }) : undefined}
      className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'border'
        }`}
        style={!isUser ? {
          background: 'var(--surface-hover)',
          borderColor: 'var(--border)',
          color: 'var(--text)'
        } : {}}
      >
        {/* Message content */}
        <div className="mb-1">
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs ${isUser ? 'text-blue-100' : ''}`}
          style={!isUser ? { color: 'var(--text-muted)', opacity: 0.7 } : {}}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] User messages right-aligned, blue background
- [ ] AI messages left-aligned, gray background
- [ ] Markdown renders correctly in AI messages
- [ ] Timestamp displays correctly
- [ ] Latest message auto-scrolls into view

**Testing:** Visual test in Storybook or browser

---

### Task 3.2: Create ChatInput Component

**File:** `app/components/reports/ChatInput.tsx` (new)

**Description:** Input field with send button and character counter

**Implementation:**
```typescript
// app/components/reports/ChatInput.tsx
'use client';

import { useState } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled: boolean;
  maxLength: number;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled,
  maxLength
}: ChatInputProps) {
  
  const canSend = value.trim().length > 0 && !isLoading && !disabled;
  const isOverLimit = value.length > maxLength;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isOverLimit) {
        onSend();
      }
    }
  };

  return (
    <div
      className="border-t p-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2">
        {/* Input field */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question..."
          disabled={isLoading || disabled}
          className="flex-1 px-3 py-2 rounded-lg border text-sm"
          style={{
            background: 'var(--surface)',
            borderColor: isOverLimit ? '#ef4444' : 'var(--border)',
            color: 'var(--text)'
          }}
          maxLength={maxLength}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!canSend || isOverLimit}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: canSend && !isOverLimit ? '#3b82f6' : 'var(--border)',
            color: canSend && !isOverLimit ? 'white' : 'var(--text-muted)'
          }}
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Send'
          )}
        </button>
      </div>

      {/* Character counter */}
      <div className="flex justify-end mt-1">
        <span
          className="text-xs"
          style={{ color: isOverLimit ? '#ef4444' : 'var(--text-muted)' }}
        >
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Input field accepts text
- [ ] Enter key sends message
- [ ] Send button disabled when input empty
- [ ] Loading spinner shows when isLoading
- [ ] Character counter updates in real-time
- [ ] Red counter when over limit

**Testing:** Visual test + unit test

---

### Task 3.3: Create ErrorBanner Component

**File:** `app/components/reports/ErrorBanner.tsx` (new)

**Description:** Display error messages with retry/dismiss options

**Implementation:**
```typescript
// app/components/reports/ErrorBanner.tsx
'use client';

interface ErrorBannerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div
      className="mx-3 my-2 p-3 rounded-lg border flex items-start gap-3"
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        borderColor: '#ef4444',
        color: '#ef4444'
      }}
    >
      {/* Error icon */}
      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>

      {/* Error message */}
      <div className="flex-1">
        <p className="text-sm font-medium">{error}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium px-2 py-1 rounded border hover:bg-red-50 transition-colors"
            style={{ borderColor: '#ef4444' }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs font-medium px-2 py-1 hover:bg-red-50 transition-colors rounded"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Error banner displays when error prop is set
- [ ] Retry button calls onRetry when clicked
- [ ] Dismiss button calls onDismiss when clicked
- [ ] Banner hidden when error is null

**Testing:** Visual test

---

### Task 3.4: Create ReportChatPanel Component

**File:** `app/components/reports/ReportChatPanel.tsx` (new)

**Description:** Main chat panel container with state management

**Implementation:**
```typescript
// app/components/reports/ReportChatPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ErrorBanner from './ErrorBanner';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';
import type { ReportPeriod } from '../../../lib/db';

const SESSION_STORAGE_KEY = 'report-chat-history';
const SESSION_ID_KEY = 'report-chat-session-id';
const MAX_MESSAGE_LENGTH = 2000;

interface ReportChatPanelProps {
  reportDate: string;
  reportPeriod: ReportPeriod;
  marketData: any;
  analysis: any;
}

export default function ReportChatPanel({
  reportDate,
  reportPeriod,
  marketData,
  analysis
}: ReportChatPanelProps) {
  
  // Session ID (for rate limiting)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return uuidv4();
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const newId = uuidv4();
    sessionStorage.setItem(SESSION_ID_KEY, newId);
    return newId;
  });

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save conversation to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    // Optimistic UI update
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({
          message: userMessage.content,
          reportDate,
          reportPeriod,
          conversationHistory: messages,
          contextData: { marketData, analysis }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response');
      }

      const aiMessage: ChatMessageType = await response.json();
      setMessages(prev => [...prev, aiMessage]);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      // Restore input
      setInput(userMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setError(null);
  };

  // Retry last message
  const handleRetry = () => {
    setError(null);
    handleSendMessage();
  };

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        height: '400px'
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Ask about this report
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {reportDate} • {reportPeriod.toUpperCase()}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Error banner */}
      <ErrorBanner
        error={error}
        onRetry={handleRetry}
        onDismiss={() => setError(null)}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              No messages yet
            </p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Ask questions about today's market analysis
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLatest={idx === messages.length - 1}
            />
          ))
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSendMessage}
        isLoading={isLoading}
        disabled={false}
        maxLength={MAX_MESSAGE_LENGTH}
      />
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Chat panel renders with header, messages, input
- [ ] Messages load from sessionStorage on mount
- [ ] Messages save to sessionStorage on change
- [ ] Send button triggers API call
- [ ] Loading state shows while waiting for response
- [ ] Error banner shows on failure
- [ ] Clear button resets conversation

**Testing:** E2E test (next phase)

---

### Task 3.5: Integrate Chat Panel into Reports Page

**File:** `app/reports/page.tsx` (modify)

**Description:** Add ReportChatPanel to the reports page

**Implementation:**
```typescript
// Add import at top
import ReportChatPanel from '../components/reports/ReportChatPanel';

// Inside the JSX, after the Analysis sections grid, add:

{/* Chat Panel - Desktop: side-by-side, Mobile: below */}
<div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-4 mb-4">
  <div>
    {/* Analysis sections moved here */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {SECTIONS.map(({ key, title, icon }) => (
        <ReportSection
          key={key}
          title={title}
          icon={icon}
          content={report.analysis[key] as string}
        />
      ))}
    </div>
  </div>

  {/* Chat Panel */}
  <div>
    <ReportChatPanel
      reportDate={report.date}
      reportPeriod={period!}
      marketData={report.marketData}
      analysis={report.analysis}
    />
  </div>
</div>
```

**Acceptance Criteria:**
- [ ] Chat panel appears on reports page
- [ ] Desktop layout: chat on right side
- [ ] Mobile layout: chat below sections
- [ ] No layout shifts or rendering issues

**Testing:** Visual test in browser (desktop + mobile)

---

## Phase 4: Testing & Polish (Day 5)

### Task 4.1: Write Component Unit Tests

**File:** `app/components/reports/__tests__/ReportChatPanel.test.tsx` (new)

**Description:** Unit tests for ReportChatPanel

**Implementation:**
```typescript
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

  it('sends message on Enter key', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          role: 'assistant',
          content: 'VIX is low because...',
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
      expect(screen.getByText(/VIX is low because/i)).toBeInTheDocument();
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
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('clears conversation', async () => {
    render(<ReportChatPanel {...mockProps} />);
    
    // Send a message first
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

    const input = screen.getByPlaceholderText(/type your question/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Click clear button
    const clearButton = screen.getByText('Clear');
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
```

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Coverage ≥80% for ReportChatPanel
- [ ] Tests cover: send message, error handling, clear, persistence

**Testing:** Run `npm run test -- ReportChatPanel.test.tsx`

---

### Task 4.2: Write E2E Tests

**File:** `e2e/reports-chat.spec.ts` (new)

**Description:** End-to-end tests for chat feature

**Implementation:**
```typescript
// e2e/reports-chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Reports Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reports page
    await page.goto('http://localhost:3002/reports');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('user can ask question and receive AI response', async ({ page }) => {
    // Check chat panel is visible
    await expect(page.locator('text=Ask about this report')).toBeVisible();

    // Type question
    const input = page.locator('input[placeholder*="Type your question"]');
    await input.fill('Why is the dollar strong?');

    // Send message
    await input.press('Enter');

    // Check user message appears
    await expect(page.locator('text=Why is the dollar strong?')).toBeVisible();

    // Wait for AI response (10s timeout)
    await expect(page.locator('.chat-message-assistant').first()).toBeVisible({ timeout: 10000 });

    // Verify response contains relevant content
    const aiMessage = await page.locator('.chat-message-assistant').first().textContent();
    expect(aiMessage).toBeTruthy();
  });

  test('multi-turn conversation maintains context', async ({ page }) => {
    // First question
    await page.fill('input[placeholder*="Type your question"]', 'What is the VIX level?');
    await page.press('input[placeholder*="Type your question"]', 'Enter');
    await expect(page.locator('.chat-message-assistant').first()).toBeVisible({ timeout: 10000 });

    // Second question (follow-up)
    await page.fill('input[placeholder*="Type your question"]', 'Is that high or low?');
    await page.press('input[placeholder*="Type your question"]', 'Enter');
    
    // Wait for second response
    await expect(page.locator('.chat-message-assistant').nth(1)).toBeVisible({ timeout: 10000 });

    // Verify conversation has 4 messages (2 user + 2 AI)
    const messageCount = await page.locator('.chat-message-user, .chat-message-assistant').count();
    expect(messageCount).toBe(4);
  });

  test('clear button resets conversation', async ({ page }) => {
    // Send a message
    await page.fill('input[placeholder*="Type your question"]', 'Test question');
    await page.press('input[placeholder*="Type your question"]', 'Enter');
    await expect(page.locator('text=Test question')).toBeVisible();

    // Click clear button
    await page.click('text=Clear');

    // Check messages are gone
    await expect(page.locator('text=No messages yet')).toBeVisible();
    await expect(page.locator('text=Test question')).not.toBeVisible();
  });

  test('error message shows on API failure', async ({ page }) => {
    // Intercept API call and make it fail
    await page.route('**/api/reports/chat', route => route.abort('failed'));

    // Try to send message
    await page.fill('input[placeholder*="Type your question"]', 'Test');
    await page.press('input[placeholder*="Type your question"]', 'Enter');

    // Error banner should appear
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 5000 });
  });

  test('mobile layout works correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Chat panel should still be visible
    await expect(page.locator('text=Ask about this report')).toBeVisible();

    // Input should be usable
    const input = page.locator('input[placeholder*="Type your question"]');
    await input.fill('Test');
    await expect(input).toHaveValue('Test');
  });
});
```

**Acceptance Criteria:**
- [ ] All E2E tests pass
- [ ] Tests run in CI/CD pipeline
- [ ] Mobile viewport test passes

**Testing:** Run `npm run test:e2e`

---

### Task 4.3: Add Accessibility Features

**Description:** Ensure WCAG AA compliance

**Files to modify:**
- `app/components/reports/ReportChatPanel.tsx`
- `app/components/reports/ChatMessage.tsx`
- `app/components/reports/ChatInput.tsx`

**Changes:**

1. **Add ARIA labels:**
```typescript
// ReportChatPanel.tsx
<div
  role="region"
  aria-label="AI Chat Assistant"
  className="rounded-xl border flex flex-col"
  // ...
>
```

2. **Add live region for new messages:**
```typescript
// ReportChatPanel.tsx
<div className="flex-1 overflow-y-auto p-4" aria-live="polite" aria-atomic="false">
```

3. **Add screen reader text:**
```typescript
// ChatMessage.tsx
<div className="sr-only">
  {message.role === 'user' ? 'You said:' : 'AI responded:'}
</div>
```

4. **Keyboard navigation:**
```typescript
// ChatInput.tsx
<input
  aria-label="Chat message input"
  aria-describedby="char-counter"
  // ...
/>
<span id="char-counter" className="sr-only">
  {value.length} of {maxLength} characters used
</span>
```

**Acceptance Criteria:**
- [ ] All interactive elements have labels
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Screen reader announces new messages
- [ ] Color contrast ≥ 4.5:1

**Testing:** Manual test with VoiceOver/NVDA + axe DevTools

---

### Task 4.4: Performance Optimization

**Description:** Optimize rendering and API calls

**Changes:**

1. **Lazy load chat panel:**
```typescript
// app/reports/page.tsx
import dynamic from 'next/dynamic';

const ReportChatPanel = dynamic(() => import('../components/reports/ReportChatPanel'), {
  ssr: false,
  loading: () => <div className="rounded-xl border h-[400px] animate-pulse" style={{ background: 'var(--surface)' }} />
});
```

2. **Debounce character counter:**
```typescript
// ChatInput.tsx
const [debouncedValue, setDebouncedValue] = useState(value);

useEffect(() => {
  const timer = setTimeout(() => setDebouncedValue(value), 300);
  return () => clearTimeout(timer);
}, [value]);
```

3. **Optimize markdown rendering:**
```typescript
// ChatMessage.tsx
import { memo } from 'react';

const ChatMessage = memo(({ message, isLatest }: ChatMessageProps) => {
  // ... component code
});

export default ChatMessage;
```

**Acceptance Criteria:**
- [ ] Page load time <500ms impact
- [ ] Chat panel loads after report content
- [ ] Smooth scrolling (60fps)
- [ ] No unnecessary re-renders

**Testing:** Lighthouse audit + Chrome DevTools Performance

---

## Phase 5: Documentation & Deployment (Day 6-7)

### Task 5.1: Update README

**File:** `README.md` (modify)

**Description:** Add chat feature documentation

**Add section:**
```markdown
## AI Chat Feature

The daily market report includes an interactive AI chat assistant powered by Claude.

### Usage

1. Navigate to `/reports` to view the latest report
2. Type your question in the chat panel (right side on desktop, bottom on mobile)
3. Press Enter or click Send
4. Wait for AI response (typically 2-4 seconds)

### Rate Limits

- 1 question per 2 seconds (per session)
- 100 questions per hour (per IP)

### Privacy

- Conversations are not stored on the server
- Chat history saved in browser sessionStorage (cleared on tab close)
- No user identification in API requests

### API Endpoint

**POST /api/reports/chat**

Request:
```json
{
  "message": "Why is VIX low?",
  "reportDate": "2026-03-10",
  "reportPeriod": "eod",
  "conversationHistory": [],
  "contextData": { "marketData": {...}, "analysis": {...} }
}
```

Response:
```json
{
  "id": "msg-abc123",
  "role": "assistant",
  "content": "VIX is low because...",
  "timestamp": "2026-03-10T16:45:32Z",
  "tokensUsed": { "input": 1250, "output": 520 }
}
```

### Environment Variables

Required:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```
```

**Acceptance Criteria:**
- [ ] README updated with chat feature docs
- [ ] API endpoint documented
- [ ] Rate limits explained
- [ ] Privacy policy mentioned

---

### Task 5.2: Create Deployment Checklist

**File:** `docs/deployment-checklist-chat.md` (new)

**Content:**
```markdown
# Deployment Checklist: AI Chat Feature

## Pre-Deployment

- [ ] All unit tests passing (`npm run test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] Code coverage ≥80% (`npm run test:coverage`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Environment variables configured (`.env.local` has `ANTHROPIC_API_KEY`)
- [ ] Rate limiting tested (manual)
- [ ] Accessibility tested (WCAG AA, keyboard nav, screen reader)
- [ ] Mobile responsive tested (Chrome DevTools + real device)
- [ ] API endpoint tested with curl
- [ ] Performance tested (Lighthouse score ≥90)

## Deployment Steps

1. **Merge feature branch to main:**
   ```bash
   git checkout main
   git merge feature/report-ai-chat
   git push origin main
   ```

2. **Deploy to production:**
   ```bash
   cd /home/claw/prod/financial-analyzer
   git pull origin main
   npm install
   npm run build
   pm2 restart financial-analyzer
   ```

3. **Verify deployment:**
   - Visit http://dev-center:3000/reports
   - Check chat panel renders
   - Ask test question: "What is the VIX level?"
   - Verify response appears and is accurate

4. **Monitor for 24 hours:**
   - Watch error logs: `pm2 logs financial-analyzer | grep "Chat API"`
   - Check API latency (measure response times)
   - Monitor Anthropic API usage (billing dashboard)
   - Track error rate (should be <2%)

## Rollback Plan

If critical issues arise:

1. **Identify issue** (check logs, user reports)
2. **Revert to previous commit:**
   ```bash
   git revert HEAD
   git push origin main
   cd /home/claw/prod/financial-analyzer
   git pull origin main
   npm run build
   pm2 restart financial-analyzer
   ```
3. **Post-mortem** (document what went wrong, how to fix)

## Success Metrics (Check after 1 week)

- [ ] Chat adoption ≥30% (visitors who ask ≥1 question)
- [ ] Avg questions/session ≥2.5
- [ ] Error rate <2%
- [ ] API latency p95 <4s
- [ ] No critical bugs reported
```

**Acceptance Criteria:**
- [ ] Deployment checklist complete
- [ ] All pre-deployment items verified
- [ ] Rollback plan documented

---

### Task 5.3: Deploy to Worktree

**Description:** Deploy feature to worktree on port 3002

**Commands:**
```bash
cd /home/claw/worktrees/financial-analyzer/feature/report-ai-chat

# Install dependencies
npm install

# Build application
npm run build

# Start development server on port 3002
PORT=3002 npm run dev
```

**Acceptance Criteria:**
- [ ] Application runs on http://dev-center:3002
- [ ] Reports page loads successfully
- [ ] Chat panel renders and functions
- [ ] API calls work (check browser network tab)
- [ ] No console errors

**Testing:** Manual verification in browser

---

### Task 5.4: Create Demo Video/Screenshots

**Description:** Document the feature with visuals

**Actions:**

1. **Take screenshots:**
   - Chat panel empty state
   - User asking question
   - AI response received
   - Multi-turn conversation
   - Error state
   - Mobile layout

2. **Create demo video (optional):**
   - Record screen while using chat
   - Show: ask question → receive answer → follow-up
   - Length: 30-60 seconds

3. **Save to docs:**
   ```bash
   mkdir -p docs/screenshots
   # Save screenshots to docs/screenshots/
   ```

**Acceptance Criteria:**
- [ ] At least 5 screenshots saved
- [ ] Screenshots show key feature states
- [ ] Demo video recorded (optional)

---

## Summary

### Total Tasks: 27

**Breakdown:**
- Phase 1 (Foundation): 4 tasks
- Phase 2 (Backend): 4 tasks
- Phase 3 (Frontend): 5 tasks
- Phase 4 (Testing & Polish): 4 tasks
- Phase 5 (Documentation & Deployment): 4 tasks

**Estimated Effort:** 5-7 days (1 engineer)

**Dependencies:**
- Must complete Phase 1 before Phase 2
- Must complete Phase 2 before Phase 3
- Phase 4 can run parallel with late Phase 3
- Phase 5 after all functional work complete

### Completion Criteria

Feature is complete when:
- [ ] All 27 tasks checked off
- [ ] All tests passing (unit + E2E)
- [ ] Deployed to worktree on port 3002
- [ ] QA approved (manual testing)
- [ ] Documentation complete

### Next Steps

1. **Engineer:** Start with Task 1.1 (Create Type Definitions)
2. **QA:** Prepare test plans during development
3. **Product:** Review during Phase 4 (Testing & Polish)
4. **DevOps:** Prepare production deployment during Phase 5

---

**Questions or blockers?** Contact Architect Agent or Product Manager
