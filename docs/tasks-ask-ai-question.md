# Implementation Tasks: Ask AI Question on Report

**Feature:** Interactive AI Q&A for market reports  
**Status:** Ready for Engineering  
**Estimated Effort:** 11 hours  
**Story Points:** 13

**Related Documents:**
- [PRD](./prd-ask-ai-question.md)
- [Architecture](./architecture-ask-ai.md)

---

## Task Breakdown

### Phase 1: Backend (Est. 3 hours)

#### Task 1.1: Database Migration - `question_logs` Table
**Priority:** High  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Create database schema for logging Q&A interactions.

**Acceptance Criteria:**
- [ ] Add `question_logs` table to schema in `lib/db.ts`
- [ ] Include columns: `id`, `report_id`, `question`, `answer`, `tokens_input`, `tokens_output`, `created_at`
- [ ] Add foreign key constraint to `reports` table
- [ ] Create indexes on `report_id` and `created_at`
- [ ] Add migration logic to `migrate()` function
- [ ] Test migration with `:memory:` database in unit test

**Files to Modify:**
- `lib/db.ts`

**SQL to Add:**
```sql
CREATE TABLE IF NOT EXISTS question_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     TEXT    NOT NULL,
  question      TEXT    NOT NULL,
  answer        TEXT    NOT NULL,
  tokens_input  INTEGER,
  tokens_output INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_question_logs_report 
  ON question_logs(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_logs_created 
  ON question_logs(created_at DESC);
```

**Testing:**
```bash
# Run after implementation
npm run test lib/db.test.ts
```

---

#### Task 1.2: Database CRUD Functions
**Priority:** High  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Add functions to insert and query question logs.

**Acceptance Criteria:**
- [ ] Add `insertQuestionLog()` function to `lib/db.ts`
- [ ] Add `getQuestionLogs()` function (optional, for analytics)
- [ ] Export functions at module level (like other DB functions)
- [ ] Add TypeScript types for question log rows
- [ ] Write unit tests for both functions

**Files to Modify:**
- `lib/db.ts`

**Function Signatures:**
```typescript
export interface QuestionLogRow {
  id: number;
  report_id: string;
  question: string;
  answer: string;
  tokens_input: number;
  tokens_output: number;
  created_at: number;
}

export function insertQuestionLog(
  reportId: string,
  question: string,
  answer: string,
  tokensInput: number,
  tokensOutput: number
): void;

export function getQuestionLogs(
  reportId: string,
  limit?: number
): QuestionLogRow[];
```

**Testing:**
```typescript
// In lib/db.test.ts
describe('Question Logs', () => {
  it('inserts and retrieves question log', () => {
    const db = createDb(':memory:');
    db.insertOrReplaceReport('2026-03-14', 'morning', {}, {}, 'model');
    
    db.insertQuestionLog(
      '2026-03-14-morning',
      'What is VIX?',
      'VIX is 18.2',
      850,
      150
    );
    
    const logs = db.getQuestionLogs('2026-03-14-morning');
    expect(logs).toHaveLength(1);
    expect(logs[0].question).toBe('What is VIX?');
  });
});
```

---

#### Task 1.3: AI Prompt Builder for Report Q&A
**Priority:** High  
**Estimated Time:** 1 hour  
**Assignee:** Engineer

**Description:**
Create dedicated prompt builder for report Q&A that includes full report context.

**Acceptance Criteria:**
- [ ] Create new file: `lib/ai/report-qa-client.ts`
- [ ] Implement `buildReportQAPrompt()` function
- [ ] Include report date, period, market data, and analysis sections
- [ ] Format as markdown for readability
- [ ] Add instructions to answer concisely and only from report data
- [ ] Write unit tests with mock report data

**Files to Create:**
- `lib/ai/report-qa-client.ts`
- `lib/ai/report-qa-client.test.ts`

**Implementation:**
```typescript
// lib/ai/report-qa-client.ts
import { PERIOD_LABELS, type ReportPeriod } from '@/lib/db';
import type { DailyReport } from '@/scripts/generate-report';

export function buildReportQAPrompt(
  question: string,
  report: DailyReport,
  period: ReportPeriod
): string {
  return `You are a financial market analyst. A user is asking questions about a market report.

**Report Details:**
- Date: ${report.date}
- Type: ${PERIOD_LABELS[period]} Report
- Generated: ${report.generatedAt}

**Market Data Snapshot:**
${JSON.stringify(report.marketData, null, 2)}

**Analysis:**
${Object.entries(report.analysis)
  .filter(([key]) => key !== 'regimeProbabilities')
  .map(([key, value]) => `### ${key}\n${value}`)
  .join('\n\n')}

${report.analysis.regimeProbabilities ? `**Regime Probabilities:** ${report.analysis.regimeProbabilities}` : ''}

---

**User Question:** ${question}

**Instructions:**
1. Answer based ONLY on the report content above
2. Be concise (under 200 words unless asked for details)
3. If the report doesn't address the question, say so and offer related insights
4. Do not make up data or external information
5. Use plain language unless technical terms are in the report
6. Format as markdown if including lists or emphasis

**Answer:**`;
}

export async function callClaudeForReportQA(
  question: string,
  report: DailyReport,
  period: ReportPeriod
): Promise<{ answer: string; tokensUsed: { input: number; output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = buildReportQAPrompt(question, report, period);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    return {
      answer: data.content[0].text,
      tokensUsed: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error('[Report Q&A] Claude API call failed:', error);
    throw error;
  }
}
```

**Testing:**
```typescript
// lib/ai/report-qa-client.test.ts
import { buildReportQAPrompt } from './report-qa-client';

describe('buildReportQAPrompt', () => {
  it('includes report date and period', () => {
    const report = {
      date: '2026-03-14',
      generatedAt: '2026-03-14T09:00:00Z',
      marketData: { SPX: 5745 },
      analysis: { equityDiagnosis: 'Bullish' },
    };
    
    const prompt = buildReportQAPrompt('What is SPX?', report, 'morning');
    
    expect(prompt).toContain('2026-03-14');
    expect(prompt).toContain('Open Report');
    expect(prompt).toContain('SPX');
    expect(prompt).toContain('What is SPX?');
  });
});
```

---

#### Task 1.4: API Route - `/api/reports/[reportId]/ask`
**Priority:** High  
**Estimated Time:** 1 hour  
**Assignee:** Engineer

**Description:**
Create API endpoint that accepts questions and returns AI-generated answers.

**Acceptance Criteria:**
- [ ] Create file: `app/api/reports/[reportId]/ask/route.ts`
- [ ] Parse `reportId` from dynamic segment (format: `YYYY-MM-DD-period` or `YYYY-MM-DD`)
- [ ] Validate question length (1-500 chars)
- [ ] Fetch report from database using `getReportByDate()`
- [ ] Call `callClaudeForReportQA()` with question and report
- [ ] Log to `question_logs` table
- [ ] Return JSON: `{ answer, tokensUsed }`
- [ ] Handle errors with appropriate status codes (400, 404, 500, 502)
- [ ] Add timeout handling (10s max)

**Files to Create:**
- `app/api/reports/[reportId]/ask/route.ts`

**Implementation:**
```typescript
// app/api/reports/[reportId]/ask/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getReportByDate, insertQuestionLog, type ReportPeriod } from '@/lib/db';
import { callClaudeForReportQA } from '@/lib/ai/report-qa-client';
import type { DailyReport } from '@/scripts/generate-report';

function parseReportId(reportId: string): { date: string; period?: ReportPeriod } | null {
  // Format: "2026-03-14-morning" or "2026-03-14"
  const match = reportId.match(/^(\d{4}-\d{2}-\d{2})(?:-(morning|midday|eod))?$/);
  if (!match) return null;
  
  return {
    date: match[1],
    period: match[2] as ReportPeriod | undefined,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await context.params;
    const body = await request.json();
    
    // Validate reportId format
    const parsed = parseReportId(reportId);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid reportId format' },
        { status: 400 }
      );
    }
    
    // Validate question
    const { question } = body;
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    if (question.length < 1) {
      return NextResponse.json(
        { error: 'Question too short' },
        { status: 400 }
      );
    }
    
    if (question.length > 500) {
      return NextResponse.json(
        { error: 'Question too long (max 500 characters)' },
        { status: 400 }
      );
    }
    
    // Fetch report from database
    const reportRow = getReportByDate(parsed.date, parsed.period);
    if (!reportRow) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }
    
    const report: DailyReport = {
      date: reportRow.date,
      generatedAt: new Date(reportRow.generated_at * 1000).toISOString(),
      marketData: JSON.parse(reportRow.ticker_data),
      analysis: JSON.parse(reportRow.report_json),
    };
    
    // Call Claude API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let result;
    try {
      result = await callClaudeForReportQA(question, report, reportRow.period);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Gateway timeout' },
          { status: 502 }
        );
      }
      throw error;
    }
    clearTimeout(timeoutId);
    
    // Log to database
    insertQuestionLog(
      reportId,
      question,
      result.answer,
      result.tokensUsed.input,
      result.tokensUsed.output
    );
    
    // Return response
    return NextResponse.json({
      answer: result.answer,
      tokensUsed: result.tokensUsed,
    });
    
  } catch (error) {
    console.error('[Report Q&A API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 2: Frontend Components (Est. 4 hours)

#### Task 2.1: ChatMessage Component
**Priority:** High  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Create individual message component for user and AI messages.

**Acceptance Criteria:**
- [ ] Create file: `app/components/reports/ChatMessage.tsx`
- [ ] Accept props: `role`, `content`, `timestamp`
- [ ] Style user messages: right-aligned, light background
- [ ] Style AI messages: left-aligned, darker background, "AI" badge
- [ ] Display timestamp in relative format ("Just now", "2m ago")
- [ ] Support markdown rendering in content (using `react-markdown` or similar)
- [ ] Match existing app theme (dark mode compatible)

**Files to Create:**
- `app/components/reports/ChatMessage.tsx`

**Implementation:**
```typescript
// app/components/reports/ChatMessage.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-100 border border-gray-700'
        }`}
      >
        {!isUser && (
          <div className="text-xs font-semibold mb-1 text-blue-400">AI</div>
        )}
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {formatDistanceToNow(timestamp, { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
```

**Dependencies:**
```bash
npm install date-fns
```

---

#### Task 2.2: ChatMessageList Component
**Priority:** High  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Create scrollable message list with auto-scroll behavior.

**Acceptance Criteria:**
- [ ] Create file: `app/components/reports/ChatMessageList.tsx`
- [ ] Accept props: `messages` array
- [ ] Render empty state: "Ask a question about this report to get started."
- [ ] Auto-scroll to bottom when new message added
- [ ] Max height: 400px with scroll
- [ ] Use `useRef` + `scrollIntoView` for auto-scroll
- [ ] Apply smooth scrolling behavior

**Files to Create:**
- `app/components/reports/ChatMessageList.tsx`

**Implementation:**
```typescript
// app/components/reports/ChatMessageList.tsx
'use client';

import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageListProps {
  messages: Message[];
}

export default function ChatMessageList({ messages }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
        📝 Ask a question about this report to get started.
      </div>
    );
  }
  
  return (
    <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role}
          content={msg.content}
          timestamp={msg.timestamp}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

---

#### Task 2.3: ChatInput Component
**Priority:** High  
**Estimated Time:** 45 min  
**Assignee:** Engineer

**Description:**
Create input field with submit and clear buttons.

**Acceptance Criteria:**
- [ ] Create file: `app/components/reports/ChatInput.tsx`
- [ ] Accept props: `onSubmit`, `onClear`, `isLoading`, `disabled`
- [ ] Textarea with 3 rows, auto-resize (optional)
- [ ] Character counter: "0 / 500"
- [ ] Submit button (disabled when empty or loading)
- [ ] Clear History button
- [ ] Keyboard shortcut: Cmd+Enter / Ctrl+Enter to submit
- [ ] Loading spinner during API call

**Files to Create:**
- `app/components/reports/ChatInput.tsx`

**Implementation:**
```typescript
// app/components/reports/ChatInput.tsx
'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSubmit: (question: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function ChatInput({
  onSubmit,
  onClear,
  isLoading,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  
  const handleSubmit = async () => {
    if (!value.trim() || isLoading || disabled) return;
    
    await onSubmit(value.trim());
    setValue('');
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const charCount = value.length;
  const isOverLimit = charCount > 500;
  
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your question here..."
        rows={3}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading || disabled || isOverLimit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Thinking...
              </span>
            ) : (
              'Ask'
            )}
          </button>
          
          <button
            onClick={onClear}
            disabled={disabled || isLoading}
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            Clear History
          </button>
        </div>
        
        <div className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
          {charCount} / 500
        </div>
      </div>
    </div>
  );
}
```

---

#### Task 2.4: ReportChatWidget Main Component
**Priority:** High  
**Estimated Time:** 1.5 hours  
**Assignee:** Engineer

**Description:**
Create main chat widget that orchestrates all sub-components.

**Acceptance Criteria:**
- [ ] Create file: `app/components/reports/ReportChatWidget.tsx`
- [ ] Accept props: `reportId`, `reportDate`, `reportPeriod`
- [ ] Manage state: `messages`, `isLoading`, `error`
- [ ] Implement `handleAskQuestion()` with API call
- [ ] Implement rate limiting (30 questions/session in sessionStorage)
- [ ] Implement `handleClearHistory()`
- [ ] Handle API errors with user-friendly messages
- [ ] Retry logic with exponential backoff
- [ ] Generate unique message IDs (using `crypto.randomUUID()`)

**Files to Create:**
- `app/components/reports/ReportChatWidget.tsx`

**Implementation:**
```typescript
// app/components/reports/ReportChatWidget.tsx
'use client';

import { useState } from 'react';
import ChatMessageList, { type Message } from './ChatMessageList';
import ChatInput from './ChatInput';

interface ReportChatWidgetProps {
  reportId: string;
  reportDate: string;
  reportPeriod: string;
}

export default function ReportChatWidget({
  reportId,
}: ReportChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const checkRateLimit = (): boolean => {
    const key = `question_count_${reportId}`;
    const count = parseInt(sessionStorage.getItem(key) || '0');
    return count < 30;
  };
  
  const incrementRateLimit = () => {
    const key = `question_count_${reportId}`;
    const count = parseInt(sessionStorage.getItem(key) || '0');
    sessionStorage.setItem(key, String(count + 1));
  };
  
  const handleAskQuestion = async (question: string) => {
    if (!checkRateLimit()) {
      setError('You\'ve reached the question limit for this report. Reload the page to reset.');
      return;
    }
    
    setError(null);
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/reports/${reportId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }
      
      const data = await response.json();
      
      // Add AI response
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      
      incrementRateLimit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };
  
  return (
    <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-100">
        Ask a Question About This Report
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <ChatMessageList messages={messages} />
      
      <div className="mt-4">
        <ChatInput
          onSubmit={handleAskQuestion}
          onClear={handleClearHistory}
          isLoading={isLoading}
          disabled={false}
        />
      </div>
    </div>
  );
}
```

---

#### Task 2.5: Integration into Report Detail Page
**Priority:** High  
**Estimated Time:** 15 min  
**Assignee:** Engineer

**Description:**
Add chat widget to existing report detail page.

**Acceptance Criteria:**
- [ ] Modify `app/reports/[date]/page.tsx`
- [ ] Import `ReportChatWidget`
- [ ] Add widget below regime probabilities section
- [ ] Pass correct props: `reportId`, `reportDate`, `reportPeriod`
- [ ] Verify styling matches existing page

**Files to Modify:**
- `app/reports/[date]/page.tsx`

**Implementation:**
```typescript
// app/reports/[date]/page.tsx (add at bottom of page, before closing fragment)
import ReportChatWidget from '../../components/reports/ReportChatWidget';

// ... existing code ...

{/* Chat widget */}
<ReportChatWidget
  reportId={`${date}-${row.period}`}
  reportDate={date}
  reportPeriod={row.period}
/>
```

---

### Phase 3: Testing (Est. 3 hours)

#### Task 3.1: Unit Tests - API Route
**Priority:** Medium  
**Estimated Time:** 1 hour  
**Assignee:** Engineer

**Description:**
Write comprehensive unit tests for API endpoint.

**Acceptance Criteria:**
- [ ] Create file: `app/api/reports/[reportId]/ask/route.test.ts`
- [ ] Test valid question → 200 response
- [ ] Test invalid reportId format → 400
- [ ] Test report not found → 404
- [ ] Test missing question → 400
- [ ] Test question too long → 400
- [ ] Mock Claude API responses
- [ ] Mock database calls
- [ ] Test error handling

**Files to Create:**
- `app/api/reports/[reportId]/ask/route.test.ts`

**Testing Framework:**
```bash
npm install --save-dev vitest @vitejs/plugin-react
```

**Example Tests:**
```typescript
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  getReportByDate: vi.fn(),
  insertQuestionLog: vi.fn(),
}));

vi.mock('@/lib/ai/report-qa-client', () => ({
  callClaudeForReportQA: vi.fn(),
}));

describe('POST /api/reports/[reportId]/ask', () => {
  it('returns answer for valid question', async () => {
    // Setup mocks
    // Call API
    // Assert response
  });
  
  it('returns 400 for invalid reportId', async () => {
    // Test with "invalid-format"
  });
  
  // ... more tests
});
```

---

#### Task 3.2: Component Tests - ReportChatWidget
**Priority:** Medium  
**Estimated Time:** 1 hour  
**Assignee:** Engineer

**Description:**
Write React component tests using Testing Library.

**Acceptance Criteria:**
- [ ] Create file: `app/components/reports/ReportChatWidget.test.tsx`
- [ ] Test renders empty state
- [ ] Test submits question → shows loading spinner
- [ ] Test receives answer → displays in chat
- [ ] Test clear history → empties messages
- [ ] Test rate limit → shows error after 30 questions
- [ ] Mock `fetch()` API calls

**Files to Create:**
- `app/components/reports/ReportChatWidget.test.tsx`

**Testing Framework:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**Example Tests:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportChatWidget from './ReportChatWidget';

describe('ReportChatWidget', () => {
  it('renders empty state', () => {
    render(<ReportChatWidget reportId="2026-03-14-morning" reportDate="2026-03-14" reportPeriod="morning" />);
    expect(screen.getByText(/Ask a question/i)).toBeInTheDocument();
  });
  
  it('submits question and displays answer', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ answer: 'VIX is 18.2' }),
      })
    );
    
    render(<ReportChatWidget reportId="2026-03-14-morning" reportDate="2026-03-14" reportPeriod="morning" />);
    
    const input = screen.getByPlaceholderText(/Type your question/i);
    fireEvent.change(input, { target: { value: 'What is VIX?' } });
    
    const submitButton = screen.getByText('Ask');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('VIX is 18.2')).toBeInTheDocument();
    });
  });
  
  // ... more tests
});
```

---

#### Task 3.3: End-to-End Tests
**Priority:** Low  
**Estimated Time:** 1 hour  
**Assignee:** Engineer

**Description:**
Write Playwright E2E tests for full user flow.

**Acceptance Criteria:**
- [ ] Create file: `tests/e2e/report-chat.spec.ts`
- [ ] Test: Navigate to report → ask question → verify answer appears
- [ ] Test: Ask multiple questions → verify chat history
- [ ] Test: Clear history → verify chat empties
- [ ] Test: Hit rate limit → verify error message
- [ ] Run tests in CI pipeline

**Files to Create:**
- `tests/e2e/report-chat.spec.ts`

**Testing Framework:**
```bash
npm install --save-dev @playwright/test
```

**Example Tests:**
```typescript
import { test, expect } from '@playwright/test';

test('user can ask question about report', async ({ page }) => {
  await page.goto('/reports/2026-03-14?period=morning');
  
  await page.fill('textarea[placeholder*="question"]', 'What is VIX?');
  await page.click('button:has-text("Ask")');
  
  await expect(page.locator('text=VIX is')).toBeVisible();
});

test('user can clear chat history', async ({ page }) => {
  await page.goto('/reports/2026-03-14?period=morning');
  
  await page.fill('textarea[placeholder*="question"]', 'Test question');
  await page.click('button:has-text("Ask")');
  
  await page.click('button:has-text("Clear History")');
  
  await expect(page.locator('text=Ask a question to get started')).toBeVisible();
});
```

---

### Phase 4: Documentation & Deployment (Est. 1 hour)

#### Task 4.1: Update Documentation
**Priority:** Low  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Update project documentation with new feature.

**Acceptance Criteria:**
- [ ] Add API endpoint to `API.md` (if exists)
- [ ] Update `ARCHITECTURE.md` with chat widget
- [ ] Create CHANGELOG entry
- [ ] Update README with feature mention (if applicable)

**Files to Modify:**
- `docs/API.md` (if exists)
- `docs/ARCHITECTURE.md`
- `CHANGELOG.md`
- `README.md` (optional)

---

#### Task 4.2: Pre-Deployment Checklist
**Priority:** High  
**Estimated Time:** 30 min  
**Assignee:** Engineer

**Description:**
Verify all requirements before merging to main.

**Acceptance Criteria:**
- [ ] All tests passing (unit, component, E2E)
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no warnings
- [ ] Database migration tested locally
- [ ] Manual testing completed (see checklist below)
- [ ] Environment variable documented in `.env.example`
- [ ] PR description includes screenshots/demo
- [ ] Code reviewed by at least 1 peer

**Manual Testing Checklist:**
- [ ] Ask simple question → get answer within 3s
- [ ] Ask complex question → get coherent answer
- [ ] Ask off-topic question → get "not addressed" response
- [ ] Ask 31 questions → see rate limit error
- [ ] Submit empty question → see validation error
- [ ] Submit 501-char question → see validation error
- [ ] Clear history → chat empties
- [ ] Reload page → chat resets
- [ ] Test on mobile (responsive layout)

---

## Task Dependencies

```
Phase 1: Backend
├─ Task 1.1 (DB migration) → MUST complete first
├─ Task 1.2 (DB functions) → depends on 1.1
├─ Task 1.3 (AI prompt) → independent
└─ Task 1.4 (API route) → depends on 1.2 and 1.3

Phase 2: Frontend
├─ Task 2.1 (ChatMessage) → independent
├─ Task 2.2 (ChatMessageList) → depends on 2.1
├─ Task 2.3 (ChatInput) → independent
├─ Task 2.4 (ReportChatWidget) → depends on 2.2 and 2.3
└─ Task 2.5 (Integration) → depends on 2.4 and Phase 1 complete

Phase 3: Testing
├─ Task 3.1 (API tests) → depends on Task 1.4
├─ Task 3.2 (Component tests) → depends on Task 2.4
└─ Task 3.3 (E2E tests) → depends on Task 2.5

Phase 4: Deployment
├─ Task 4.1 (Docs) → independent
└─ Task 4.2 (Checklist) → depends on all phases complete
```

---

## Estimated Timeline

| Phase | Tasks | Time | Cumulative |
|-------|-------|------|------------|
| Phase 1 | 1.1 - 1.4 | 3h | 3h |
| Phase 2 | 2.1 - 2.5 | 4h | 7h |
| Phase 3 | 3.1 - 3.3 | 3h | 10h |
| Phase 4 | 4.1 - 4.2 | 1h | **11h** |

**Story Points:** 13 (includes complexity and testing overhead)

---

## Success Criteria

- [ ] Users can ask questions on report detail page
- [ ] AI responses appear within 3 seconds (p95)
- [ ] Rate limiting prevents abuse (30 questions/session)
- [ ] All tests passing (coverage >80%)
- [ ] No console errors in production
- [ ] Chat widget matches existing design system
- [ ] Database migration runs without errors
- [ ] API endpoint handles errors gracefully

---

## Rollback Plan

If critical issues found in production:

1. **Immediate:** Remove `<ReportChatWidget>` from `app/reports/[date]/page.tsx`
2. **Within 1 hour:** Revert API route PR
3. **Within 4 hours:** Run database migration rollback (drop `question_logs` table)

---

## Notes for Engineer

- **Environment:** Ensure `ANTHROPIC_API_KEY` is set in `.env.local`
- **Database:** Run migrations with `npm run db:migrate` (or manual SQL)
- **Testing:** Use `npm run test` for unit tests, `npm run test:e2e` for Playwright
- **Code Style:** Follow existing patterns in `app/api/options/ai-analysis/route.ts`
- **AI Prompts:** Test prompts manually in Claude UI before implementing
- **Rate Limiting:** Consider adding server-side rate limiting if client-side is bypassed
- **Future Work:** Multi-turn conversation support (not in this iteration)

---

**Ready to implement!** 🚀

Assign tasks to yourself or team members and start with Phase 1.
