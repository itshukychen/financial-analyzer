# System Architecture: Ask AI Question on Report

**Feature:** Interactive AI Q&A for market reports  
**Version:** 1.0  
**Last Updated:** 2026-03-14  
**Related:** [PRD](./prd-ask-ai-question.md) | [Tasks](./tasks-ask-ai-question.md)

---

## 1. Overview

This document describes the architecture for adding an interactive AI chat interface to the report detail page, allowing users to ask questions about market reports and receive contextual AI responses.

### 1.1 Design Goals

- **Minimal Complexity**: Reuse existing Claude API integration patterns
- **Stateless Backend**: No conversation persistence (session-only state)
- **Performance**: <3 second response times (p95)
- **Security**: Rate limiting, input validation, CSRF protection
- **Extensibility**: Easy to add conversation history later if needed

---

## 2. System Components

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Report Detail Page                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ReportChatWidget (Client Component)                   │  │
│  │  ┌──────────────────┐  ┌────────────────────────────┐  │  │
│  │  │ ChatMessageList  │  │  State:                    │  │  │
│  │  │  - User message  │  │  - messages: Message[]     │  │  │
│  │  │  - AI response   │  │  - isLoading: boolean      │  │  │
│  │  │  - Timestamps    │  │  - error: string | null    │  │  │
│  │  └──────────────────┘  └────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ ChatInput                                         │  │  │
│  │  │  - Textarea + Submit button                      │  │  │
│  │  │  - Clear History button                          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │ fetch()                           │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  POST /api/reports/[reportId]/ask                     │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 1. Validate reportId                             │  │  │
│  │  │ 2. Fetch report from DB                          │  │  │
│  │  │ 3. Build system prompt with context              │  │  │
│  │  │ 4. Call Claude API                               │  │  │
│  │  │ 5. Return answer + token usage                   │  │  │
│  │  │ 6. Log to question_logs table                    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  lib/ai/report-qa-client.ts                           │  │
│  │  - buildReportQAPrompt()                              │  │
│  │  - callClaudeForReport()                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                   │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Claude API (Anthropic)                                │  │
│  │  - Model: claude-3-5-sonnet-20241022                   │  │
│  │  - Temperature: 0.7                                    │  │
│  │  - Max tokens: 500                                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

Database:
┌────────────────────────────────────────────────────────┐
│  reports table                                         │
│  - Fetched for full report context                    │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  question_logs table (NEW)                             │
│  - Logs all Q&A for analytics                          │
│  - Columns: id, reportId, question, answer,            │
│             tokensInput, tokensOutput, createdAt       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 User Asks Question

```
1. User types question in ChatInput textarea
2. User clicks "Ask" button (or presses Cmd+Enter)
3. Frontend validation:
   - Question length: 1-500 characters
   - Check rate limit (max 30 questions in session storage)
4. POST to /api/reports/[reportId]/ask
   Body: { question: "What's the VIX level?", reportId: "2026-03-14-morning" }
5. Backend:
   a. Parse reportId (format: YYYY-MM-DD-period or YYYY-MM-DD)
   b. Query reports table for full report
   c. Build system prompt:
      - Report date, type, content
      - User question
   d. Call Claude API
   e. Extract answer from Claude response
   f. Log to question_logs table
   g. Return: { answer: "...", tokensUsed: {...} }
6. Frontend:
   - Append user message + AI response to messages array
   - Scroll to bottom
   - Clear loading state
```

### 3.2 Conversation Context

**Important:** Each API call is stateless. To provide multi-turn conversation context:

- Frontend maintains `messages: Message[]` in component state
- On each new question, frontend sends **only the current question**
- Backend includes **full report context** in every prompt
- No conversation history sent to API (keeps token costs low)
- For follow-ups, user must rephrase with enough context

**Why not multi-turn?** To avoid token bloat. Reports are already ~800 tokens. Adding 5 turns of conversation would cost 3-4x more per question. If users need multi-turn, they can copy the report and use ChatGPT directly.

**Future enhancement:** Add optional conversation history (last 3 messages) sent to API for continuity. Requires PRD update.

---

## 4. API Design

### 4.1 Endpoint: `POST /api/reports/[reportId]/ask`

#### Route Parameters

- `[reportId]`: Dynamic segment in URL path
  - Format: `YYYY-MM-DD-period` (e.g., `2026-03-14-morning`)
  - Alternative: `YYYY-MM-DD` (defaults to most recent period for that date)

#### Request Body

```typescript
{
  question: string;  // 1-500 chars, required
}
```

#### Response (200 OK)

```typescript
{
  answer: string;           // AI-generated answer (plain text or markdown)
  tokensUsed: {
    input: number;          // Claude input tokens
    output: number;         // Claude output tokens
  }
}
```

#### Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ error: "Invalid reportId format" }` | reportId doesn't match YYYY-MM-DD pattern |
| 404 | `{ error: "Report not found" }` | No report exists for that date/period |
| 400 | `{ error: "Question too short" }` | question.length < 1 |
| 400 | `{ error: "Question too long" }` | question.length > 500 |
| 429 | `{ error: "Rate limit exceeded" }` | More than 30 questions in session (frontend check) |
| 500 | `{ error: "API error: [details]" }` | Claude API failure |
| 502 | `{ error: "Gateway timeout" }` | Claude API timeout (>10s) |

### 4.2 Implementation File

**Location:** `app/api/reports/[reportId]/ask/route.ts`

**Key Functions:**

```typescript
// Parse reportId from URL segment
function parseReportId(reportId: string): { date: string; period?: ReportPeriod } {
  // "2026-03-14-morning" → { date: "2026-03-14", period: "morning" }
  // "2026-03-14" → { date: "2026-03-14", period: undefined }
}

// Main handler
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  // 1. Parse reportId
  // 2. Validate question from request body
  // 3. Fetch report from DB
  // 4. Call Claude API
  // 5. Log to question_logs
  // 6. Return response
}
```

---

## 5. Database Schema

### 5.1 New Table: `question_logs`

```sql
CREATE TABLE IF NOT EXISTS question_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     TEXT    NOT NULL,          -- FK to reports (date-period format)
  question      TEXT    NOT NULL,
  answer        TEXT    NOT NULL,
  tokens_input  INTEGER,
  tokens_output INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE INDEX IF NOT EXISTS idx_question_logs_report 
  ON question_logs(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_logs_created 
  ON question_logs(created_at DESC);
```

**Purpose:** Analytics only. Not used for conversation history.

**Queries:**
- Most asked questions per report
- Average tokens per question
- Total API cost over time
- Popular question patterns (for FAQ)

### 5.2 Database Functions

Add to `lib/db.ts`:

```typescript
export function insertQuestionLog(
  reportId: string,
  question: string,
  answer: string,
  tokensInput: number,
  tokensOutput: number
): void {
  db.prepare(`
    INSERT INTO question_logs (report_id, question, answer, tokens_input, tokens_output)
    VALUES (?, ?, ?, ?, ?)
  `).run(reportId, question, answer, tokensInput, tokensOutput);
}

export function getQuestionLogs(reportId: string, limit = 50): Array<{
  id: number;
  question: string;
  answer: string;
  tokens_input: number;
  tokens_output: number;
  created_at: number;
}> {
  return db.prepare(`
    SELECT * FROM question_logs
    WHERE report_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(reportId, limit);
}
```

---

## 6. AI Prompt Engineering

### 6.1 System Prompt Template

```typescript
function buildReportQAPrompt(
  question: string,
  report: {
    date: string;
    period: ReportPeriod;
    marketData: object;
    analysis: object;
  }
): string {
  return `You are a financial market analyst. A user is asking questions about a market report.

**Report Details:**
- Date: ${report.date}
- Type: ${PERIOD_LABELS[report.period]} Report
- Generated: ${new Date(report.generatedAt).toISOString()}

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
```

### 6.2 Claude API Parameters

- **Model:** `claude-3-5-sonnet-20241022` (same as report generation)
- **Temperature:** `0.7` (consistent with reports)
- **Max Tokens:** `500` (shorter than report generation to keep answers concise)
- **Timeout:** `10 seconds` (frontend shows retry button if exceeded)

---

## 7. Frontend Components

### 7.1 Component Hierarchy

```
app/reports/[date]/page.tsx
  └─ ReportChatWidget (new, client component)
       ├─ ChatMessageList
       │    └─ ChatMessage (user or AI)
       ├─ ChatInput
       │    ├─ Textarea
       │    ├─ Submit Button
       │    └─ Clear History Button
       └─ ErrorBoundary (optional)
```

### 7.2 ReportChatWidget

**Location:** `app/components/reports/ReportChatWidget.tsx`

**Props:**
```typescript
interface ReportChatWidgetProps {
  reportId: string;        // "2026-03-14-morning"
  reportDate: string;      // "2026-03-14"
  reportPeriod: ReportPeriod;
}
```

**State:**
```typescript
interface Message {
  id: string;              // nanoid or Date.now()
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [inputValue, setInputValue] = useState('');
```

**Key Methods:**
```typescript
async function handleAskQuestion(question: string) {
  // 1. Validate question length
  // 2. Check rate limit (session storage)
  // 3. Add user message to messages array
  // 4. Set isLoading = true
  // 5. POST to /api/reports/[reportId]/ask
  // 6. Add AI response to messages array
  // 7. Set isLoading = false
  // 8. Scroll to bottom
}

function handleClearHistory() {
  setMessages([]);
  setError(null);
}

function checkRateLimit(): boolean {
  const key = `question_count_${reportId}`;
  const count = parseInt(sessionStorage.getItem(key) || '0');
  return count < 30;
}

function incrementRateLimit() {
  const key = `question_count_${reportId}`;
  const count = parseInt(sessionStorage.getItem(key) || '0');
  sessionStorage.setItem(key, String(count + 1));
}
```

### 7.3 ChatMessageList

**Location:** `app/components/reports/ChatMessageList.tsx`

**Props:**
```typescript
interface ChatMessageListProps {
  messages: Message[];
}
```

**Rendering:**
- Auto-scroll to bottom when new message added (using `useEffect` + `scrollIntoView`)
- Empty state: "Ask a question about this report to get started."
- User messages: right-aligned, light background
- AI messages: left-aligned, darker background, "AI" badge
- Timestamps: relative format ("Just now", "2 minutes ago")

### 7.4 ChatInput

**Location:** `app/components/reports/ChatInput.tsx`

**Props:**
```typescript
interface ChatInputProps {
  onSubmit: (question: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
  disabled: boolean;
}
```

**Features:**
- Textarea with `rows={3}`, auto-resize (optional)
- Keyboard shortcut: `Cmd+Enter` / `Ctrl+Enter` to submit
- Character count: "0 / 500" below textarea
- Submit button disabled when empty or loading
- Clear History button (confirm dialog optional)

---

## 8. Security & Rate Limiting

### 8.1 Client-Side Rate Limiting

**Storage:** `sessionStorage` (cleared on tab close)

**Key:** `question_count_${reportId}`

**Limit:** 30 questions per report per session

**Behavior:**
- Increment on each successful question
- Reset only when session ends (tab close or browser close)
- Show error: "You've reached the question limit for this report. Reload the page to reset."

**Why not server-side?** Server-side rate limiting by IP is complex (shared IPs, VPNs). Client-side is sufficient for MVP. Add server-side if abuse occurs.

### 8.2 Input Validation

**Frontend:**
- Min length: 1 character
- Max length: 500 characters
- No HTML tags (display as plain text)

**Backend:**
- Same validations as frontend
- Reject if reportId format invalid
- Reject if report not found in DB

### 8.3 CSRF Protection

Next.js API routes are protected by default when using `fetch()` from the same origin. No additional CSRF token needed.

---

## 9. Performance Considerations

### 9.1 Response Time Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Claude API call | <2s (p95) | Server logs |
| Total request time | <3s (p95) | Browser DevTools Network tab |
| Frontend render | <100ms | React DevTools Profiler |

### 9.2 Optimization Strategies

**Backend:**
- Keep prompts concise (avoid redundant report sections)
- Cache report fetch (already in memory for page render)
- Use `max_tokens: 500` (not 2048) to reduce latency

**Frontend:**
- Debounce submit button (prevent double-clicks)
- Optimistic UI: show user message immediately, then AI response
- Virtual scrolling if messages exceed 50 (unlikely in session-only mode)

### 9.3 Token Cost Estimation

**Per Question:**
- Input: ~800 tokens (report) + 50 tokens (question) = 850 tokens
- Output: ~150 tokens (average answer)
- Total: ~1000 tokens/question
- Cost: $0.003/question (Claude Sonnet pricing)

**Monthly Budget (1000 questions):** ~$3

---

## 10. Error Handling

### 10.1 Error States

| Error | User Message | Action |
|-------|--------------|--------|
| Network timeout | "The AI is taking longer than usual. Try again?" | Retry button |
| API 500 error | "Unable to get answer. Please try again later." | Retry button + support link |
| Rate limit hit | "You've asked 30 questions. Reload to reset." | Reload button |
| Report not found | "This report is no longer available." | Back to reports list |
| Invalid question | "Please enter a question (1-500 characters)." | Inline validation |

### 10.2 Retry Logic

**Client-Side:**
- Exponential backoff: 1s, 2s, 4s
- Max 3 retries
- Show "Still trying..." message after 2nd retry
- Give up after 3rd retry, show support link

**Server-Side:**
- No retries (let client handle)
- Log all errors to console with request ID

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Backend (Vitest):**
- `app/api/reports/[reportId]/ask/route.test.ts`
  - Valid question → 200 response
  - Invalid reportId → 404
  - Missing question → 400
  - Question too long → 400
  - Mock Claude API responses

**Frontend (React Testing Library):**
- `app/components/reports/ReportChatWidget.test.tsx`
  - Renders empty state
  - Submits question → shows loading state
  - Receives answer → displays in chat
  - Clear history → empties messages
  - Rate limit → shows error

### 11.2 Integration Tests

**End-to-End (Playwright):**
- Navigate to report detail page
- Type question in chat input
- Submit question
- Verify AI response appears
- Ask follow-up question
- Clear history
- Verify chat is empty

### 11.3 Manual Testing Checklist

- [ ] Ask simple question → get answer within 3 seconds
- [ ] Ask complex question → get coherent answer
- [ ] Ask off-topic question → get "report doesn't address this" response
- [ ] Ask 31 questions → hit rate limit
- [ ] Submit empty question → see validation error
- [ ] Submit 501-char question → see validation error
- [ ] Disconnect network → see timeout error + retry button
- [ ] Clear history → chat empties
- [ ] Reload page → chat resets

---

## 12. Monitoring & Analytics

### 12.1 Metrics to Track

**Usage:**
- Questions per report (avg, median, p95)
- Questions per user session
- Most active report dates
- Peak usage hours

**Performance:**
- API response time (p50, p95, p99)
- Token usage per question
- Error rate (% of failed requests)
- Retry rate

**Cost:**
- Total tokens consumed (input + output)
- Cost per question
- Monthly API spend

### 12.2 Database Queries

```sql
-- Most asked questions (for FAQ)
SELECT question, COUNT(*) as count
FROM question_logs
GROUP BY question
ORDER BY count DESC
LIMIT 20;

-- Average tokens per question
SELECT AVG(tokens_input + tokens_output) as avg_tokens
FROM question_logs;

-- Questions per report
SELECT report_id, COUNT(*) as question_count
FROM question_logs
GROUP BY report_id
ORDER BY question_count DESC;

-- Total cost (assuming $3/million tokens)
SELECT 
  SUM(tokens_input + tokens_output) as total_tokens,
  (SUM(tokens_input + tokens_output) / 1000000.0 * 3) as estimated_cost
FROM question_logs;
```

---

## 13. Future Enhancements

### 13.1 Phase 2 Features

- [ ] **Multi-turn context:** Send last 3 messages to Claude for continuity
- [ ] **Conversation persistence:** Store in DB, load on page return
- [ ] **Follow-up suggestions:** "You might also ask..." based on report content
- [ ] **Export conversation:** Download as PDF or Markdown
- [ ] **Share conversation:** Generate shareable link
- [ ] **Voice input:** Speech-to-text for questions
- [ ] **Voice output:** Text-to-speech for answers

### 13.2 Advanced Features

- [ ] **Multi-report comparison:** "Compare today's report to last week's"
- [ ] **Chart generation:** "Show me VIX trend over last 5 days"
- [ ] **Alert creation:** "Notify me if VIX exceeds 20"
- [ ] **Custom analysis:** "What would happen if SPX drops 3%?"

---

## 14. Deployment Checklist

- [ ] Database migration runs on production
- [ ] Environment variable `ANTHROPIC_API_KEY` set
- [ ] API endpoint tested in staging
- [ ] Frontend components tested in staging
- [ ] Error handling verified (kill Claude API, check error message)
- [ ] Rate limiting verified (ask 31 questions)
- [ ] Performance tested (monitor p95 response time)
- [ ] Analytics queries run (check question_logs table)
- [ ] User documentation updated (if any)
- [ ] Changelog entry created

---

## 15. Rollback Plan

**If critical bug found in production:**

1. **Disable feature:** Remove `<ReportChatWidget>` from report detail page
2. **Revert API route:** Delete `/api/reports/[reportId]/ask/route.ts`
3. **Revert migrations:** Run rollback SQL:
   ```sql
   DROP TABLE IF EXISTS question_logs;
   ```
4. **Redeploy:** Push revert commit, redeploy

**If minor bug found:**
- Hot-fix in feature branch
- Deploy hot-fix without full rollback

---

## Appendix A: File Structure

```
app/
  api/
    reports/
      [reportId]/
        ask/
          route.ts           # NEW: API endpoint
          route.test.ts      # NEW: Unit tests
  components/
    reports/
      ReportChatWidget.tsx   # NEW: Main chat component
      ChatMessageList.tsx    # NEW: Message display
      ChatInput.tsx          # NEW: Input field
  reports/
    [date]/
      page.tsx               # MODIFIED: Add <ReportChatWidget>

lib/
  ai/
    report-qa-client.ts      # NEW: Claude prompt builder
  db.ts                      # MODIFIED: Add question_logs functions

docs/
  architecture-ask-ai.md     # NEW: This document
  prd-ask-ai-question.md     # EXISTING: PRD
  tasks-ask-ai-question.md   # NEW: Implementation tasks
```

---

## Appendix B: Example Prompts & Responses

### Example 1: Simple Question

**User:** What's the VIX level?

**Prompt (abbreviated):**
```
Report Date: 2026-03-14
Market Data: { "VIX": 18.2, ... }

User Question: What's the VIX level?
```

**AI Response:**
> The VIX is at 18.2, which the report classifies as a "normal" volatility regime. This is slightly elevated from recent lows but not yet signaling fear.

### Example 2: Off-Topic Question

**User:** Who won the Super Bowl?

**AI Response:**
> This report doesn't address the Super Bowl. It focuses on market data from March 14, 2026, including SPX levels, VIX, and bond yields. Would you like to know about any of those?

### Example 3: Complex Question

**User:** Based on the cross-asset check, is there a divergence between equities and bonds?

**AI Response:**
> Yes, the report notes a mild divergence. Equities (SPX) rallied +1.2% while the 10Y yield rose 8bps. Typically, rising yields pressure equities, but the rally suggests either strong earnings expectations or a "goldilocks" scenario where growth is accelerating without inflation concerns. The report assigns a 60% probability to the growth-led regime.

---

**End of Architecture Document**
