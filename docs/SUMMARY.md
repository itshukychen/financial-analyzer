# AI Chat Feature - Architecture Summary

**Feature:** Report AI Chat Interface  
**Status:** Design Complete ✅  
**Ready for Implementation:** Yes  
**Estimated Effort:** 5-7 days (1 engineer)

---

## Overview

This feature adds an interactive AI chat interface to the daily market report, allowing users to ask questions about the current day's market analysis and receive AI-powered responses grounded in the report data.

### Key Components

1. **Backend API** (`/api/reports/chat`)
   - Validates user input
   - Enforces rate limits
   - Builds context from report data
   - Calls Anthropic Claude API
   - Returns AI response

2. **Frontend Components**
   - `ReportChatPanel` - Main container
   - `ChatMessage` - Message bubbles (user/AI)
   - `ChatInput` - Input field with send button
   - `ErrorBanner` - Error display

3. **Supporting Infrastructure**
   - Rate limiter (in-memory)
   - Chat helpers (validation, context building)
   - Type definitions
   - Unit + E2E tests

---

## Documents Created

### 1. Technical Design (`docs/design-report-ai-chat.md`)

**39KB document covering:**
- Architecture overview
- Component specifications
- API design
- Data flow
- Security considerations
- Performance optimizations
- Testing strategy
- Deployment plan

### 2. Task Breakdown (`docs/tasks-report-ai-chat.md`)

**58KB document with 27 granular tasks:**
- Phase 1: Foundation (4 tasks) - Types, dependencies, rate limiter
- Phase 2: Backend API (4 tasks) - Helpers, API route, testing
- Phase 3: Frontend Components (5 tasks) - Chat UI, integration
- Phase 4: Testing & Polish (4 tasks) - Unit/E2E tests, accessibility
- Phase 5: Documentation & Deployment (4 tasks) - Docs, deployment

Each task includes:
- Clear acceptance criteria
- Implementation code
- Testing requirements
- Dependencies

---

## Key Technical Decisions

### 1. No Conversation Persistence
- **Decision:** Use sessionStorage only (no database)
- **Rationale:** Simpler, GDPR-friendly, stateless architecture
- **Trade-off:** Conversations lost on refresh (acceptable for MVP)

### 2. Rate Limiting
- **Per-session:** 1 request per 2 seconds
- **Per-IP:** 100 requests per hour
- **Implementation:** In-memory (no Redis needed)

### 3. Model Choice
- **Claude Sonnet 4-5** (not Opus)
- **Rationale:** Good quality, lower cost (~$0.03-0.05 per conversation)
- **Token budget:** ~4,000 tokens per request (context + history + response)

### 4. UI Layout
- **Desktop:** Chat panel on right side (400px wide)
- **Mobile:** Chat panel below report content
- **Height:** 400px (desktop), 300px (mobile)

---

## Implementation Highlights

### Context Injection

The AI receives:
- System prompt (rules + guidelines)
- Market data snapshot (SPX, VIX, DXY, yields)
- All 7 analysis sections (full text)
- Regime probabilities
- Conversation history (last 10 messages)
- User question

### Error Handling

Comprehensive error handling for:
- Validation errors (empty message, too long)
- Rate limiting (429 with retry timer)
- Network failures (retry button)
- API errors (Anthropic downtime)
- Token limit exceeded

### Accessibility

WCAG AA compliant:
- Keyboard navigation (Tab, Enter)
- Screen reader support (ARIA labels, live regions)
- Color contrast ≥ 4.5:1
- Focus indicators

---

## Testing Coverage

### Unit Tests (Vitest)
- Rate limiter logic
- Input validation
- Context building
- Component state management
- **Target coverage:** ≥80%

### E2E Tests (Playwright)
- User flow: ask question → receive answer
- Multi-turn conversation
- Error handling
- Mobile viewport
- Clear conversation

---

## Deployment Plan

### Pre-Deployment Checklist
- All tests passing
- Code coverage ≥80%
- No TypeScript/ESLint errors
- Environment variables configured
- Accessibility tested
- Performance tested (Lighthouse)

### Deployment Steps
1. Merge to main branch
2. Deploy to production (port 3000)
3. Verify deployment (manual test)
4. Monitor for 24 hours (logs, latency, cost)

### Rollback Plan
- Revert commit if critical issues
- Document post-mortem
- Fix in feature branch, re-deploy

---

## Success Metrics

### Primary Metrics (1 week)
- **Chat adoption:** ≥30% (visitors who ask ≥1 question)
- **Avg questions/session:** ≥2.5
- **Error rate:** <2%
- **API latency (p95):** <4s

### Secondary Metrics
- Time spent on report: +20%
- Return visitor rate: +10%
- Support tickets: -15%

---

## Next Steps for Engineer

1. **Start with Phase 1** (Foundation)
   - Create type definitions
   - Install dependencies
   - Implement rate limiter
   - Write unit tests

2. **Move to Phase 2** (Backend)
   - Create chat helpers
   - Build API route
   - Test with curl

3. **Phase 3** (Frontend)
   - Build components
   - Integrate into reports page
   - Visual testing

4. **Phase 4** (Testing)
   - Write unit tests
   - Write E2E tests
   - Accessibility audit

5. **Phase 5** (Deploy)
   - Update documentation
   - Deploy to worktree (port 3002)
   - Create demo materials

---

## Files Created/Modified

### New Files
- `types/chat.ts` - Type definitions
- `app/lib/rate-limiter.ts` - Rate limiting
- `app/lib/chat-helpers.ts` - Validation, context, AI calls
- `app/api/reports/chat/route.ts` - API endpoint
- `app/components/reports/ReportChatPanel.tsx` - Main component
- `app/components/reports/ChatMessage.tsx` - Message bubble
- `app/components/reports/ChatInput.tsx` - Input field
- `app/components/reports/ErrorBanner.tsx` - Error display
- Unit tests (3 files)
- E2E tests (1 file)

### Modified Files
- `app/reports/page.tsx` - Add chat panel
- `package.json` - New dependencies
- `README.md` - Feature documentation

---

## Dependencies

### New Dependencies
```bash
npm install react-markdown remark-gfm
```

### Existing Dependencies
- `@anthropic-ai/sdk` - Already installed ✅
- `next`, `react`, `react-dom` - Already installed ✅
- `better-sqlite3` - Already installed ✅

---

## Environment Variables

Required:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Cost Estimates

### Per Conversation
- **Tokens:** ~4,000 (input: 3,000, output: 1,000)
- **Cost:** ~$0.03-0.05 (Sonnet pricing)

### Monthly (assuming 100 daily users, 3 questions each)
- **Total questions:** ~9,000/month
- **Total cost:** ~$270-450/month
- **Acceptable:** Yes (within budget)

---

## Risk Mitigation

### Risk: AI Hallucinations
- **Mitigation:** System prompt enforces report-only data, no inventions
- **Monitoring:** Manual QA in first week

### Risk: Token Budget Overrun
- **Mitigation:** Prune conversation history (last 10 messages only)
- **Monitoring:** Log token usage per request

### Risk: Cost Overrun
- **Mitigation:** Rate limiting (100 req/hour), daily cost alerts
- **Monitoring:** Anthropic billing dashboard

### Risk: User Adoption Fails
- **Mitigation:** In-app onboarding, default open, example questions
- **Monitoring:** Analytics (adoption rate, questions/session)

---

## Questions?

Contact:
- **Architect Agent** - Technical design questions
- **Product Manager** - Feature scope, requirements
- **Engineer Agent** - Implementation questions

---

**Status:** Ready for Engineer to begin implementation ✅
