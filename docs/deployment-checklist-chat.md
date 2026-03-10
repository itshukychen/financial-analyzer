# Deployment Checklist: AI Chat Feature

**Feature**: Report AI Chat Interface  
**Status**: Ready for Deployment  
**Date**: March 10, 2026

---

## Pre-Deployment Verification

### Code Quality

- [ ] All unit tests passing (`npm run test`)
  ```bash
  npm run test -- --run
  ```
  Expected: **All tests pass** (15+ tests)

- [ ] All E2E tests passing (`npm run test:e2e`)
  ```bash
  npm run test:e2e
  ```
  Expected: **All tests pass** (9+ tests)

- [ ] Code coverage ≥80% (`npm run test:coverage`)
  ```bash
  npm run test:coverage
  ```
  Expected: **chat-helpers.ts, rate-limiter.ts, ReportChatPanel.tsx** all ≥80%

- [ ] No TypeScript errors (`npm run build`)
  ```bash
  npm run build 2>&1 | grep -i "error"
  ```
  Expected: **No errors** (warnings OK)

- [ ] No ESLint warnings in chat code (`npm run lint`)
  ```bash
  npm run lint | grep -E "(ChatMessage|ChatInput|ReportChatPanel|rate-limiter|chat-helpers)"
  ```
  Expected: **No new warnings**

### Environment Configuration

- [ ] `.env.local` has `ANTHROPIC_API_KEY` set
  ```bash
  grep ANTHROPIC_API_KEY .env.local
  ```
  Expected: `ANTHROPIC_API_KEY=sk-ant-api03-...`

- [ ] API key is valid (not expired)
  ```bash
  curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.anthropic.com/
  ```
  Expected: **200 or 401** (not 403)

- [ ] No sensitive data in git history
  ```bash
  git log --all --source --remotes -- ".env*" 2>/dev/null
  ```
  Expected: **No output** (no env files committed)

### Functionality Testing

#### API Endpoint

- [ ] Chat API accepts valid requests
  ```bash
  curl -X POST http://localhost:3002/api/reports/chat \
    -H "Content-Type: application/json" \
    -H "X-Session-Id: test-session-1" \
    -d '{
      "message": "What is the VIX level?",
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
          "volatility": "VIX at 18.3",
          "crossAssetCheck": "Test",
          "forwardScenarios": "Test",
          "shortVolRisk": "Test",
          "regimeProbabilities": "50% / 30% / 20%"
        }
      }
    }'
  ```
  Expected: **200 response** with `id`, `content`, `tokensUsed`

- [ ] Chat API rejects invalid requests (400)
  ```bash
  curl -X POST http://localhost:3002/api/reports/chat \
    -H "Content-Type: application/json" \
    -d '{"message": ""}'
  ```
  Expected: **400 error** with `error: "validation_failed"`

- [ ] Rate limiting works (429)
  ```bash
  # Send 2 requests in <2s with same session
  SESSION_ID="test-$(date +%s)"
  for i in 1 2; do
    curl -X POST http://localhost:3002/api/reports/chat \
      -H "Content-Type: application/json" \
      -H "X-Session-Id: $SESSION_ID" \
      -d '{"message":"Test","reportDate":"2026-03-10","reportPeriod":"eod","contextData":{}}'
  done
  ```
  Expected: **First 200, Second 429**

#### Frontend UI

- [ ] Chat panel renders on reports page
  - Visit http://localhost:3002/reports
  - Expected: Chat panel visible on right (desktop) or bottom (mobile)

- [ ] Chat panel header displays
  - Title: "Ask about this report"
  - Date and period shown correctly
  - Expected: "2026-03-10 • EOD" (or appropriate date/period)

- [ ] Chat input functional
  - Type text in input field
  - Character counter updates
  - Expected: "N / 2000" counter visible

- [ ] Send button states
  - Empty input: **disabled** (grayed out)
  - Valid input: **enabled** (blue)
  - Over 2000 chars: **disabled** (red counter)

- [ ] Error handling
  - Input invalid request → error banner appears
  - Error banner has "Retry" button
  - Clicking "Retry" resubmits the message

#### Accessibility

- [ ] Keyboard navigation
  - Click input field
  - Type message
  - Press **Enter** → message sends
  - Expected: User message appears, then AI response

- [ ] Screen reader support (test with VoiceOver/NVDA)
  - Chat region announces as "AI Chat Assistant"
  - Messages announce as "Your message / AI message at HH:MM"
  - Character counter updates announced
  - Expected: No skipped announcements

- [ ] Color contrast
  - Run axe DevTools or WAVE
  - Check all text meets WCAG AA (4.5:1)
  - Expected: **No contrast errors**

- [ ] Mobile responsive
  - Viewport: 375×667 (iPhone SE)
  - Chat panel visible and usable
  - Input and send button accessible
  - Expected: All buttons clickable without zoom

### Performance

- [ ] Page load time <500ms impact
  - Measure with Chrome DevTools Lighthouse
  - Chat component lazy-loads (no blocking)
  - Expected: **Good (90+)** score

- [ ] Chat response time <5s
  - Ask question and measure time to response
  - Expected: **p95 <5 seconds** (p50 ~3s)

- [ ] No console errors
  - Open DevTools Console (F12)
  - Ask a question
  - Expected: **No red errors** (warnings OK)

### Security

- [ ] No API key exposure
  ```bash
  grep -r "sk-ant-api" app/components app/api --include="*.tsx" --include="*.ts"
  ```
  Expected: **No output** (API key not in code)

- [ ] Input sanitization
  - Try injecting HTML/script in input
  - Example: `<img src=x onerror="alert('xss')">`
  - Expected: **Renders as text**, no alert

- [ ] XSS prevention
  - React escapes by default
  - Markdown rendering uses sanitized library
  - Expected: **No script execution**

- [ ] Rate limiter prevents abuse
  - Hammer session limit: send 100 requests in 10s
  - Expected: **429 errors** after 1st request per session

---

## Deployment Steps

### 1. Code Integration

```bash
# Update feature branch
git pull origin feature/report-ai-chat

# Verify tests still pass
npm run test -- --run
npm run test:e2e

# Review changes
git diff main...feature/report-ai-chat --stat

# Merge to main
git checkout main
git pull origin main
git merge feature/report-ai-chat --no-ff -m "Merge: AI Chat feature (27 tasks)"

# Push to origin
git push origin main
```

### 2. Production Deployment

```bash
# Navigate to production directory
cd /home/claw/prod/financial-analyzer

# Update code
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Build
npm run build

# Restart service
pm2 restart financial-analyzer

# Verify service is running
pm2 status
```

### 3. Smoke Tests (Production)

```bash
# Check home page loads
curl -s http://dev-center:3000 | grep -q "Daily Market Report"
echo "✓ Home page loads"

# Check reports page loads
curl -s http://dev-center:3000/reports | grep -q "Ask about this report"
echo "✓ Reports page loads"

# Check API endpoint responds
curl -s -X POST http://dev-center:3000/api/reports/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","reportDate":"2026-03-10","reportPeriod":"eod","contextData":{}}' \
  | grep -q "error"
echo "✓ API endpoint responds"

# Check logs for errors
pm2 logs financial-analyzer --lines 20 | grep -i "error" | head -5
```

### 4. Notification

```bash
# Notify team of deployment
message="✅ AI Chat feature deployed to production

• PR merged and deployed
• Chat panel live at http://dev-center:3000/reports
• Rate limits: 1 req/2s per session, 100/hour per IP
• Test: Ask a question about today's market

Questions? Check docs/deployment-checklist-chat.md"

# Send notification (example - adjust as needed)
echo "$message" | mail -s "Feature Deployed: AI Chat" team@example.com
```

---

## Post-Deployment Monitoring (24 Hours)

### Hour 1 (Immediate)

- [ ] Check production logs for errors
  ```bash
  pm2 logs financial-analyzer --lines 100 | grep -i "chat"
  ```

- [ ] Monitor error rate
  - Expected: <2% errors
  - Watch for 500s, 503s

- [ ] Test manually in production
  - Visit http://dev-center:3000/reports
  - Ask 2-3 test questions
  - Verify responses are sensible

### Hours 2-4

- [ ] Monitor API latency
  - Expected: p50 ~3s, p95 <5s
  - Watch for spikes

- [ ] Monitor rate limiter
  - Expected: Few 429 responses (only abusers)
  - High rate = suspicious activity

- [ ] Check Anthropic API status
  - Visit https://status.anthropic.com/
  - Verify no outages

### Hours 5-24

- [ ] Monitor token usage and costs
  - Expected: $X/day (baseline)
  - Alert if 5x increase (potential attack)

- [ ] Gather user feedback
  - Check support tickets
  - Watch for recurring issues

- [ ] Review feature adoption
  - Expected: 5-15% of visitors use chat
  - <1% = engagement issue
  - >50% = too good to be true (recount)

---

## Rollback Plan

**If critical issues arise:**

```bash
# 1. Identify issue (check logs, user reports)

# 2. Revert the deployment
git revert HEAD --no-edit
git push origin main

# 3. Redeploy previous version
cd /home/claw/prod/financial-analyzer
git pull origin main
npm run build
pm2 restart financial-analyzer

# 4. Verify rollback
pm2 logs financial-analyzer --lines 50 | grep "Started"

# 5. Post-mortem
# Document what went wrong and how to fix
```

### Rollback Issues

If rollback fails or introduces new issues, fall back to manual restoration:

```bash
# Checkout specific commit
git checkout <previous-stable-commit>
npm run build
pm2 restart financial-analyzer
```

---

## Success Criteria

Feature deployment is **SUCCESSFUL** when:

- ✅ All tests passing in CI/CD
- ✅ Chat panel visible and interactive on /reports
- ✅ AI responses relevant and based on report data
- ✅ No errors in production logs (24 hours)
- ✅ Error rate <2%
- ✅ API latency p95 <5 seconds
- ✅ No security issues (XSS, injection, etc.)
- ✅ Mobile responsive design works
- ✅ Accessibility tests pass
- ✅ Rate limiting functional

---

## Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineer | _____ | _____ | Implementation complete |
| QA | _____ | _____ | All tests passing |
| DevOps | _____ | _____ | Deployment verified |
| PM | _____ | _____ | Feature approved |

---

**Deployment Timeline**:
- Pre-deployment checks: 30 min
- Merge and build: 10 min
- Deploy to production: 5 min
- Smoke tests: 10 min
- **Total: ~1 hour**

**Estimated downtime**: <1 minute (during pm2 restart)

**Rollback time**: <5 minutes

---

*For questions, contact the engineering team.*
