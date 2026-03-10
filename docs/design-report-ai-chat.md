# Technical Design: AI Chat in Daily Report

**Feature:** Report AI Chat Interface  
**PRD Reference:** `/docs/prd-report-ai-chat.md`  
**Status:** Design Complete  
**Last Updated:** 2026-03-10

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Reports Page                             │
│  ┌────────────────────┐  ┌──────────────────────────────┐   │
│  │  Report Content    │  │   ReportChatPanel            │   │
│  │  ─────────────     │  │   ────────────────           │   │
│  │  • Header          │  │   • Message History          │   │
│  │  • Data Snapshot   │  │   • Input Field              │   │
│  │  • 7 Sections      │  │   • Loading States           │   │
│  │  • Regime Footer   │  │                              │   │
│  │                    │  │   [User Message 1]           │   │
│  │                    │  │   [AI Response 1]            │   │
│  │                    │  │   [User Message 2]           │   │
│  │                    │  │   [AI Response 2]            │   │
│  │                    │  │   ┌──────────────────────┐   │   │
│  │                    │  │   │ Type your question...│   │   │
│  │                    │  │   └──────────────────────┘   │   │
│  └────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                    ↓
                          POST /api/reports/chat
                                    ↓
                    ┌───────────────────────────────┐
                    │  Chat API Route Handler       │
                    │  ─────────────────────        │
                    │  1. Validate input            │
                    │  2. Rate limit check          │
                    │  3. Build context             │
                    │  4. Call Anthropic Claude     │
                    │  5. Return response           │
                    └───────────────────────────────┘
                                    ↓
                          Anthropic Claude API
```

### Data Flow

```
1. Page Load
   ├─ Load report data from DB
   ├─ Render ReportChatPanel (empty)
   └─ Initialize sessionStorage (empty conversation)

2. User Asks Question
   ├─ User types in input field
   ├─ Presses Enter or clicks Send
   ├─ Frontend validates (length, empty check)
   ├─ Optimistic UI: Add user message to chat
   ├─ Disable send button (loading state)
   └─ POST to /api/reports/chat

3. API Processing
   ├─ Validate request body
   ├─ Check rate limits (IP + session)
   ├─ Build context payload:
   │  ├─ System prompt
   │  ├─ Report data (market + analysis)
   │  ├─ Conversation history
   │  └─ User question
   ├─ Call Anthropic Claude API
   ├─ Parse response
   └─ Return JSON

4. Frontend Receives Response
   ├─ Add AI message to chat history
   ├─ Save to sessionStorage
   ├─ Enable send button
   ├─ Auto-scroll to latest message
   └─ Ready for next question
```

---

## Component Architecture

### Component Hierarchy

```
app/reports/page.tsx
  └─ ReportChatPanel.tsx (NEW)
       ├─ ChatHeader
       ├─ MessageList
       │    └─ ChatMessage (user | assistant)
       ├─ ChatInput
       └─ ErrorBanner
```

### Component Specifications

#### 1. ReportChatPanel.tsx

**Location:** `app/components/reports/ReportChatPanel.tsx`

**Purpose:** Main container component, manages conversation state and API calls

**Props:**
```typescript
interface ReportChatPanelProps {
  reportDate: string;           // "2026-03-10"
  reportPeriod: ReportPeriod;   // "eod" | "morning" | "midday"
  marketData: MarketData;       // From report (for context)
  analysis: Analysis;           // 7 sections + regime (for context)
}
```

**State:**
```typescript
interface ChatState {
  messages: ChatMessage[];      // Conversation history
  input: string;                // Current input value
  isLoading: boolean;           // Waiting for AI response
  error: string | null;         // Error message (if any)
  sessionId: string;            // Unique session ID (for rate limiting)
}

interface ChatMessage {
  id: string;                   // Unique message ID
  role: 'user' | 'assistant';   // Who sent the message
  content: string;              // Message text (markdown for AI)
  timestamp: string;            // ISO timestamp
}
```

**Key Methods:**
```typescript
// Send user message to API
async handleSendMessage(): Promise<void>

// Update input field
handleInputChange(value: string): void

// Retry failed message
handleRetry(): Promise<void>

// Clear conversation (optional)
handleClearChat(): void

// Load/save conversation from sessionStorage
loadConversation(): ChatMessage[]
saveConversation(messages: ChatMessage[]): void
```

**Layout:**
- Fixed height: 400px on desktop, 300px on mobile
- Scrollable message area
- Sticky input at bottom
- Slide-out animation on mount

---

#### 2. ChatMessage.tsx

**Location:** `app/components/reports/ChatMessage.tsx`

**Purpose:** Individual message bubble (user or AI)

**Props:**
```typescript
interface ChatMessageProps {
  message: ChatMessage;
  isLatest: boolean;            // Auto-scroll target
}
```

**Styling:**
- **User messages:** Right-aligned, blue background, white text
- **AI messages:** Left-aligned, gray background, dark text, markdown rendering
- **Timestamp:** Small, muted, below message
- **Avatar:** Icon or label (You / Report AI)

**Markdown Support (AI messages only):**
- Bold, italic, lists
- Code blocks (inline + fenced)
- Links (if needed for citations)
- No images or custom HTML

---

#### 3. ChatInput.tsx

**Location:** `app/components/reports/ChatInput.tsx`

**Purpose:** Text input field with send button

**Props:**
```typescript
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled: boolean;
  maxLength: number;            // 2000 chars
}
```

**Features:**
- Character counter: `{current} / 2000`
- Enter key sends message (Shift+Enter for newline)
- Send button disabled when:
  - Input is empty
  - isLoading = true
  - Length exceeds maxLength
- Visual loading state (spinner in button)
- Autofocus on component mount

---

#### 4. ErrorBanner.tsx

**Location:** `app/components/reports/ErrorBanner.tsx`

**Purpose:** Display error messages with retry option

**Props:**
```typescript
interface ErrorBannerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}
```

**Error Types:**
1. **Network Error:** "Failed to connect. Please check your internet."
2. **Rate Limited:** "Too many requests. Please wait {seconds}s."
3. **Token Limit:** "Question too long. Please shorten it."
4. **API Error:** "Something went wrong. Please try again."
5. **Validation Error:** "Please enter a valid question."

**Styling:**
- Red/orange background (error severity)
- Icon (⚠️ or ❌)
- Retry button (if retryable)
- Dismiss button (×)

---

## API Design

### Endpoint: POST /api/reports/chat

**File:** `app/api/reports/chat/route.ts`

**Request Body:**
```typescript
interface ChatRequest {
  message: string;                      // User's question (1-2000 chars)
  reportDate: string;                   // "2026-03-10"
  reportPeriod: ReportPeriod;           // "eod" | "morning" | "midday"
  conversationHistory: ChatMessage[];   // Previous messages in session
  contextData: {
    marketData: MarketData;             // From report
    analysis: Analysis;                 // From report
  };
}
```

**Response (Success - 200):**
```typescript
interface ChatResponse {
  id: string;                           // Message ID (uuid)
  role: 'assistant';
  content: string;                      // AI response (markdown)
  timestamp: string;                    // ISO timestamp
  tokensUsed: {
    input: number;
    output: number;
  };
}
```

**Response (Error - 4xx/5xx):**
```typescript
interface ChatError {
  error: string;                        // Error code (rate_limited, validation_failed, etc.)
  message: string;                      // User-friendly message
  retryAfter?: number;                  // Seconds to wait (for 429)
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation failed (empty message, too long, invalid format)
- `429` - Rate limited (too many requests)
- `500` - Internal server error
- `503` - Anthropic API unavailable

---

### API Implementation Details

#### 1. Input Validation

```typescript
function validateChatRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: ChatRequest;
} {
  // Check required fields
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

  // Validate conversationHistory (optional)
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
```

---

#### 2. Rate Limiting

**Strategy:** In-memory rate limiter with IP + session tracking

```typescript
// app/lib/rate-limiter.ts
interface RateLimitConfig {
  perSession: {
    maxRequests: number;    // 1 request per 2 seconds
    windowMs: number;
  };
  perIP: {
    maxRequests: number;    // 100 requests per hour
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

    // Cleanup old entries (memory management)
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

---

#### 3. Context Building

**System Prompt:**
```typescript
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
```

**Context Payload:**
```typescript
function buildContextMessages(
  reportDate: string,
  reportPeriod: ReportPeriod,
  contextData: { marketData: MarketData; analysis: Analysis },
  conversationHistory: ChatMessage[],
  userMessage: string
): Anthropic.MessageParam[] {
  
  // Format market data snapshot
  const marketSnapshot = `
**Market Data (${reportDate} - ${reportPeriod.toUpperCase()})**
- SPX: ${contextData.marketData.spx.close} (${contextData.marketData.spx.percentChange >= 0 ? '+' : ''}${contextData.marketData.spx.percentChange.toFixed(2)}%)
- VIX: ${contextData.marketData.vix.close} (${contextData.marketData.vix.percentChange >= 0 ? '+' : ''}${contextData.marketData.vix.percentChange.toFixed(2)}%)
- DXY: ${contextData.marketData.dxy.close} (${contextData.marketData.dxy.percentChange >= 0 ? '+' : ''}${contextData.marketData.dxy.percentChange.toFixed(2)}%)
- 10Y Yield: ${contextData.marketData.yield10y.close}% (${contextData.marketData.yield10y.percentChange >= 0 ? '+' : ''}${contextData.marketData.yield10y.percentChange.toFixed(2)}bps)
- 2Y Yield: ${contextData.marketData.yield2y.close}% (${contextData.marketData.yield2y.percentChange >= 0 ? '+' : ''}${contextData.marketData.yield2y.percentChange.toFixed(2)}bps)
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

  // Add system context (as first user message, per Anthropic best practices)
  messages.push({
    role: 'user',
    content: SYSTEM_PROMPT + '\n\n' + marketSnapshot + '\n' + analysisSections
  });

  // Add a placeholder assistant acknowledgment (Anthropic requires alternating roles)
  messages.push({
    role: 'assistant',
    content: 'I understand. I will only use information from this report to answer questions.'
  });

  // Add conversation history (if any)
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
```

---

#### 4. Anthropic API Call

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function getAIResponse(
  messages: Anthropic.MessageParam[]
): Promise<{ content: string; tokensUsed: { input: number; output: number } }> {
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,               // Target ~300-400 words
    temperature: 0.7,               // Balanced creativity
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

---

#### 5. Complete API Route Handler

```typescript
// app/api/reports/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimiter } from '../../../lib/rate-limiter';
import { validateChatRequest, buildContextMessages, getAIResponse } from '../../../lib/chat-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request
    const body = await request.json();
    const validation = validateChatRequest(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'validation_failed', message: validation.error! },
        { status: 400 }
      );
    }

    const { message, reportDate, reportPeriod, conversationHistory, contextData } = validation.data!;

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const sessionId = request.headers.get('x-session-id') || uuidv4();

    const rateLimit = rateLimiter.checkLimit(sessionId, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: `Too many requests. Please wait ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
    }

    // 3. Build context and call AI
    const messages = buildContextMessages(
      reportDate,
      reportPeriod,
      contextData,
      conversationHistory,
      message
    );

    const aiResponse = await getAIResponse(messages);

    // 4. Return response
    return NextResponse.json({
      id: uuidv4(),
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      tokensUsed: aiResponse.tokensUsed
    });

  } catch (error: any) {
    console.error('[Chat API Error]', error);

    // Handle specific errors
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

    if (error.status === 503) {
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

---

## Frontend Implementation

### State Management

**Strategy:** React hooks (useState, useEffect) with sessionStorage persistence

```typescript
// app/components/reports/ReportChatPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_STORAGE_KEY = 'report-chat-history';
const SESSION_ID_KEY = 'report-chat-session-id';

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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation from sessionStorage on mount
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

  // Save conversation to sessionStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
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

      const aiMessage: ChatMessage = await response.json();
      setMessages(prev => [...prev, aiMessage]);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      // Restore input
      setInput(userMessage.content);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setError(null);
  };

  return (
    <div className="report-chat-panel">
      {/* Component JSX implementation */}
    </div>
  );
}
```

---

## Styling & Layout

### Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────┐
│                       Reports Page                           │
│                                                              │
│  ┌───────────────────┐                                      │
│  │  Report Header    │                                      │
│  └───────────────────┘                                      │
│                                                              │
│  ┌───────────────────┐                                      │
│  │  Data Snapshot    │                                      │
│  └───────────────────┘                                      │
│                                                              │
│  ┌─────────────────────────────────────────┬──────────────┐ │
│  │  Analysis Sections (3-col grid)        │  Chat Panel  │ │
│  │                                         │  (fixed)     │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐         │  ┌────────┐  │ │
│  │  │ Sec1 │  │ Sec2 │  │ Sec3 │         │  │Messages│  │ │
│  │  └──────┘  └──────┘  └──────┘         │  │        │  │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐         │  │        │  │ │
│  │  │ Sec4 │  │ Sec5 │  │ Sec6 │         │  └────────┘  │ │
│  │  └──────┘  └──────┘  └──────┘         │  ┌────────┐  │ │
│  │  ┌──────┐                              │  │ Input  │  │ │
│  │  │ Sec7 │                              │  └────────┘  │ │
│  │  └──────┘                              │              │ │
│  └─────────────────────────────────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<1024px)

```
┌─────────────────┐
│  Report Header  │
└─────────────────┘
┌─────────────────┐
│  Data Snapshot  │
└─────────────────┘
┌─────────────────┐
│   Section 1     │
└─────────────────┘
┌─────────────────┐
│   Section 2     │
└─────────────────┘
     ...
┌─────────────────┐
│  Chat Panel     │
│  (bottom)       │
│  ┌───────────┐  │
│  │ Messages  │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Input    │  │
│  └───────────┘  │
└─────────────────┘
```

### CSS/Tailwind Classes

```css
/* Chat panel container */
.report-chat-panel {
  @apply rounded-xl border;
  background: var(--surface);
  border-color: var(--border);
  height: 400px;
  display: flex;
  flex-direction: column;
}

/* Header */
.chat-header {
  @apply px-4 py-3 border-b flex items-center justify-between;
  border-color: var(--border);
}

/* Messages area */
.chat-messages {
  @apply flex-1 overflow-y-auto p-4;
  scroll-behavior: smooth;
}

/* User message */
.chat-message-user {
  @apply ml-auto max-w-[80%] mb-3 p-3 rounded-lg;
  background: #3b82f6;
  color: white;
}

/* AI message */
.chat-message-assistant {
  @apply mr-auto max-w-[80%] mb-3 p-3 rounded-lg;
  background: var(--surface-hover);
  color: var(--text);
}

/* Input area */
.chat-input-container {
  @apply border-t p-3;
  border-color: var(--border);
}

/* Mobile adjustments */
@media (max-width: 1023px) {
  .report-chat-panel {
    height: 300px;
  }
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Test Files:**
1. `app/components/reports/__tests__/ReportChatPanel.test.tsx`
2. `app/lib/__tests__/chat-helpers.test.ts`
3. `app/lib/__tests__/rate-limiter.test.ts`

**Coverage:**
- Message validation (empty, too long, special chars)
- Rate limiter logic (per-session, per-IP)
- Context building (correct format, token estimation)
- Error handling (network failures, API errors)
- Markdown rendering (safe HTML output)

**Example Test:**
```typescript
// app/components/reports/__tests__/ReportChatPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReportChatPanel from '../ReportChatPanel';

describe('ReportChatPanel', () => {
  it('renders empty chat on load', () => {
    render(<ReportChatPanel {...mockProps} />);
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument(); // No messages
  });

  it('sends message on Enter key', async () => {
    const { container } = render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i);
    
    fireEvent.change(input, { target: { value: 'Why is VIX low?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Why is VIX low?')).toBeInTheDocument();
    });
  });

  it('displays error on API failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
    
    const { container } = render(<ReportChatPanel {...mockProps} />);
    const input = screen.getByPlaceholderText(/type your question/i);
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
```

---

### E2E Tests (Playwright)

**Test File:** `e2e/reports-chat.spec.ts`

**Scenarios:**
1. **Happy Path:** Load report → ask question → receive answer
2. **Multi-Turn:** Ask follow-up → AI references previous message
3. **Error Handling:** Ask question → API fails → show error → retry → succeed
4. **Rate Limiting:** Ask 2 questions in <2s → 2nd request blocked
5. **Mobile:** Repeat scenario 1 on mobile viewport

**Example Test:**
```typescript
// e2e/reports-chat.spec.ts
import { test, expect } from '@playwright/test';

test('user can ask question and receive AI response', async ({ page }) => {
  // Navigate to reports page
  await page.goto('/reports');

  // Wait for chat panel to load
  await expect(page.locator('.report-chat-panel')).toBeVisible();

  // Type question
  const input = page.locator('input[placeholder*="Type your question"]');
  await input.fill('Why is the dollar strong?');

  // Send message
  await input.press('Enter');

  // Check user message appears
  await expect(page.locator('text=Why is the dollar strong?')).toBeVisible();

  // Wait for AI response
  await expect(page.locator('.chat-message-assistant').first()).toBeVisible({ timeout: 10000 });

  // Verify response contains report data
  const aiMessage = await page.locator('.chat-message-assistant').first().textContent();
  expect(aiMessage).toMatch(/dollar|DXY/i);
});

test('multi-turn conversation maintains context', async ({ page }) => {
  await page.goto('/reports');

  // First question
  await page.fill('input[placeholder*="Type your question"]', 'What is the VIX level?');
  await page.press('input[placeholder*="Type your question"]', 'Enter');
  await expect(page.locator('.chat-message-assistant').first()).toBeVisible({ timeout: 10000 });

  // Second question (follow-up)
  await page.fill('input[placeholder*="Type your question"]', 'Is that high or low?');
  await page.press('input[placeholder*="Type your question"]', 'Enter');
  
  // Wait for second response
  await expect(page.locator('.chat-message-assistant').nth(1)).toBeVisible({ timeout: 10000 });

  // Verify AI references previous context
  const secondResponse = await page.locator('.chat-message-assistant').nth(1).textContent();
  expect(secondResponse).toMatch(/VIX|volatility/i);
});
```

---

## Security Considerations

### 1. Input Sanitization

**XSS Prevention:**
- React automatically escapes user input (no raw HTML rendering)
- Markdown rendering uses sanitized library (e.g., `react-markdown` with `remark-gfm`)
- No `dangerouslySetInnerHTML` usage

**Injection Prevention:**
- Validate all inputs server-side (length, type, format)
- Escape special characters in API requests
- Use parameterized queries (not applicable here, but good practice)

---

### 2. Rate Limiting

**Purpose:** Prevent abuse, DoS attacks, cost overruns

**Implementation:**
- Per-session: 1 request per 2 seconds (prevent spam)
- Per-IP: 100 requests per hour (prevent mass abuse)
- Graceful degradation (show countdown timer, not hard block)

---

### 3. API Key Security

**Best Practices:**
- Store Anthropic API key in environment variable (`.env.local`)
- Never expose API key in client-side code
- Use Next.js API routes (server-side only)
- Rotate API key if compromised

---

### 4. Data Privacy

**GDPR Compliance:**
- No conversation logging (stateless API)
- No user identification in requests (no email, name, etc.)
- sessionStorage only (cleared on browser close)
- No cookies for tracking

**Transparency:**
- Add disclaimer: "Conversations are not stored or analyzed"
- Privacy policy update (confirm no data retention)

---

## Performance Optimization

### 1. Frontend Performance

**Lazy Loading:**
```typescript
// Only load chat panel after report content renders
const ReportChatPanel = dynamic(() => import('./components/reports/ReportChatPanel'), {
  ssr: false,
  loading: () => <div className="chat-skeleton">Loading chat...</div>
});
```

**Debouncing:**
```typescript
// Debounce input changes (prevent excessive re-renders)
const [debouncedInput, setDebouncedInput] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedInput(input), 300);
  return () => clearTimeout(timer);
}, [input]);
```

**Virtualization (if needed for long conversations):**
```typescript
// Use react-window for very long message lists (50+ messages)
import { FixedSizeList } from 'react-window';
```

---

### 2. API Performance

**Token Optimization:**
- Prune conversation history (keep only last 10 messages)
- Compress report context (remove redundant text)
- Target <4000 tokens per request

**Caching (optional):**
```typescript
// Cache identical questions (same message + same report)
const cache = new Map<string, ChatResponse>();

function getCacheKey(message: string, reportDate: string): string {
  return `${reportDate}:${message.toLowerCase().trim()}`;
}
```

---

### 3. Network Performance

**Request Compression:**
```typescript
// Enable gzip compression in Next.js config
// next.config.js
module.exports = {
  compress: true,
};
```

**Timeout Handling:**
```typescript
// Add timeout to fetch requests (fail fast)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

try {
  const response = await fetch('/api/reports/chat', {
    signal: controller.signal,
    // ... other options
  });
} finally {
  clearTimeout(timeoutId);
}
```

---

## Monitoring & Observability

### Key Metrics

**Frontend Metrics:**
- Chat panel render time (target <200ms)
- Message send latency (user click → message appears)
- Error rate (failed API calls / total calls)
- User engagement (% of visitors who ask ≥1 question)

**Backend Metrics:**
- API response time (p50, p95, p99)
- Anthropic API latency (track separately)
- Rate limit rejections (count, reason)
- Token usage per request (input + output)
- Cost per request (track daily spend)

**Business Metrics:**
- Questions per session (avg, median)
- Conversation length (# turns per session)
- User satisfaction (optional feedback form)
- Return visitor rate (asked question → came back)

---

### Logging Strategy

**Backend Logging:**
```typescript
// app/api/reports/chat/route.ts
console.log('[Chat API Request]', {
  timestamp: new Date().toISOString(),
  reportDate,
  reportPeriod,
  messageLength: message.length,
  conversationLength: conversationHistory.length,
  ip: ip.substring(0, 8) + '***', // Partial IP for privacy
  sessionId: sessionId.substring(0, 8) + '***'
});

console.log('[Chat API Response]', {
  timestamp: new Date().toISOString(),
  latency: Date.now() - startTime,
  tokensUsed: aiResponse.tokensUsed,
  responseLength: aiResponse.content.length
});
```

**Error Logging:**
```typescript
console.error('[Chat API Error]', {
  timestamp: new Date().toISOString(),
  error: error.message,
  stack: error.stack,
  reportDate,
  sessionId: sessionId.substring(0, 8) + '***'
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (`npm run test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] Code coverage ≥80% (`npm run test:coverage`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Environment variables configured (`.env.local` has `ANTHROPIC_API_KEY`)
- [ ] Rate limiting tested (manual + automated)
- [ ] Security audit passed (no XSS, no API key exposure)
- [ ] Mobile responsive design tested (Chrome DevTools + real device)
- [ ] Accessibility tested (WCAG AA compliance, keyboard nav, screen reader)

---

### Deployment Steps

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge feature/report-ai-chat
   git push origin main
   ```

2. **Deploy to production (port 3000)**
   ```bash
   cd /home/claw/prod/financial-analyzer
   git pull origin main
   npm install
   npm run build
   pm2 restart financial-analyzer
   ```

3. **Verify deployment**
   - Visit http://dev-center:3000/reports
   - Check chat panel renders
   - Ask test question
   - Verify response appears

4. **Monitor for 24 hours**
   - Watch error logs (`pm2 logs financial-analyzer`)
   - Check API latency (measure response times)
   - Monitor Anthropic API usage (check billing dashboard)

---

### Rollback Plan

**If critical issues arise:**

1. **Identify issue** (check logs, user reports)
2. **Revert to previous commit**
   ```bash
   git revert HEAD
   git push origin main
   cd /home/claw/prod/financial-analyzer
   git pull origin main
   npm run build
   pm2 restart financial-analyzer
   ```
3. **Post-mortem** (document what went wrong, how to fix)

---

## Future Enhancements (Post-MVP)

### Phase 2 Features

1. **Streaming Responses**
   - Use Anthropic streaming API
   - Show text incrementally (typewriter effect)
   - Improve perceived latency

2. **Conversation Persistence**
   - Save conversations to database (optional)
   - User can revisit past chats
   - Export conversation as PDF/JSON

3. **Follow-Up Suggestions**
   - After AI response, show 3 suggested follow-up questions
   - E.g., "Ask about volatility?" → one-click send

4. **Analytics Dashboard**
   - Track popular questions
   - Identify gaps in report coverage
   - Monitor user satisfaction

5. **Multi-Modal Support**
   - Upload images (charts, screenshots)
   - AI can reference visual data

6. **Custom Model Fine-Tuning**
   - Train on historical reports
   - Improve financial domain expertise

---

## Appendix

### A. Type Definitions

```typescript
// types/chat.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  reportDate: string;
  reportPeriod: 'eod' | 'morning' | 'midday';
  conversationHistory: ChatMessage[];
  contextData: {
    marketData: MarketData;
    analysis: Analysis;
  };
}

export interface ChatResponse {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

export interface ChatError {
  error: string;
  message: string;
  retryAfter?: number;
}
```

---

### B. Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

### C. Dependencies

**New Dependencies (to install):**
```bash
npm install react-markdown remark-gfm
```

**Existing Dependencies (already installed):**
- `@anthropic-ai/sdk` - Anthropic API client
- `next` - Framework
- `react` - UI library
- `better-sqlite3` - Database (for report data)

---

## Sign-Off

**Design Status:** Complete ✅  
**Ready for Implementation:** Yes  
**Estimated Effort:** 5-7 days (1 engineer)

**Next Step:** Engineer to begin implementation following task breakdown in `tasks-report-ai-chat.md`

---

**Questions or Clarifications?** Contact Architect Agent
