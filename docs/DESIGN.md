# Design Document: AI-Powered Options Forecast

**Feature:** AI-Powered Options Price Forecast Analysis  
**PRD:** [prd-ai-options-forecast.md](./prd-ai-options-forecast.md)  
**Date:** 2026-03-09  
**Version:** 1.0  

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
│  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │ Option Projection  │  │  Option Projection Widget   │   │
│  │    Report Page     │  │    (Dashboard Component)    │   │
│  │                    │  │                             │   │
│  │ - AI Forecast      │  │ - Confidence Badge          │   │
│  │ - Price Targets    │  │ - Regime Indicator          │   │
│  │ - Trading Levels   │  │ - AI Summary (expandable)   │   │
│  │ - Regime Alert     │  │                             │   │
│  └─────────┬──────────┘  └──────────┬──────────────────┘   │
└────────────┼────────────────────────┼──────────────────────┘
             │                        │
             └────────┬───────────────┘
                      │
             ┌────────▼─────────┐
             │   API Layer      │
             │                  │
             │ /api/options/    │
             │  ai-forecast     │
             └────────┬─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐  ┌────▼────┐  ┌─────▼────┐
   │ Claude  │  │ AI Core │  │ Database │
   │   API   │  │ Library │  │ (SQLite) │
   │         │  │         │  │          │
   │ Sonnet  │  │ Forecast│  │ Snapshots│
   │  4.5    │  │ Logic   │  │ Projects │
   │         │  │         │  │ AI Cache │
   └─────────┘  └────┬────┘  └──────────┘
                     │
              ┌──────▼─────────┐
              │ Existing       │
              │ Analytics Lib  │
              │ (v0.1.0)       │
              └────────────────┘
```

### Component Responsibilities

#### **Frontend Components**

1. **`AIOptionsForecastSection`** (NEW)
   - **Purpose:** Display complete AI analysis with price targets, regime info, trading levels
   - **Location:** `app/components/options/AIOptionsForecastSection.tsx`
   - **Props:**
     ```typescript
     {
       analysis: AIOptionsForecast;
       loading?: boolean;
       error?: string;
     }
     ```
   - **Features:**
     - Executive summary card (2-3 sentence narrative)
     - Price targets grid (conservative/base/aggressive with confidence)
     - Regime classification badge (red/yellow/green)
     - Trading levels chart overlay
     - Confidence score display

2. **`RegimeChangeAlert`** (NEW)
   - **Purpose:** Highlight significant regime shifts (IV percentile jumps)
   - **Location:** `app/components/options/RegimeChangeAlert.tsx`
   - **Props:**
     ```typescript
     {
       regimeChange: {
         from: 'normal' | 'elevated' | 'depressed';
         to: 'normal' | 'elevated' | 'depressed';
         severity: number; // 0-1
         timestamp: string;
       };
       onDismiss?: () => void;
     }
     ```
   - **Features:**
     - Prominent banner at top of report
     - Animation on first view
     - Dismissible (stores in localStorage)
     - Action link to historical regime data

3. **`OptionProjectionWidget`** (ENHANCED)
   - **Purpose:** Dashboard quick-view with AI confidence indicator
   - **Location:** `app/components/options/OptionProjectionWidget.tsx`
   - **Enhancements:**
     - Add confidence badge (🟢/🟡/🔴 based on `confidence.overall`)
     - Add "AI Analysis" expand/collapse section
     - Add regime change indicator (pulse animation if shift detected)
   - **Data Source:** Fetch from `/api/options/ai-forecast`

#### **Backend Services**

4. **`lib/aiOptionsForecast.ts`** (NEW — CORE MODULE)
   - **Purpose:** Orchestrate Claude API calls and structure AI analysis
   - **Key Functions:**
     ```typescript
     export async function generateAIAnalysis(
       context: OptionAnalysisContext
     ): Promise<AIOptionsForecast>
     ```
   - **Responsibilities:**
     - Build Claude prompt from snapshot + projection data
     - Call Claude API with system prompt + context
     - Parse structured JSON response
     - Validate output (sanity checks on price targets, confidence)
     - Handle errors (fallback to cached analysis or generic response)
   - **Dependencies:**
     - Claude API client (Anthropic SDK)
     - Database layer (for caching)
     - Analytics library (for baseline metrics)

5. **`app/api/options/ai-forecast/route.ts`** (NEW)
   - **Purpose:** RESTful endpoint for fetching/generating AI forecasts
   - **Endpoints:**
     - `POST /api/options/ai-forecast`
       - Request: `{ ticker, date, regenerate? }`
       - Response: `{ success, analysis, cached, cacheAge, nextUpdate }`
   - **Logic Flow:**
     1. Validate input (ticker exists, date format valid)
     2. Check cache: if `regenerate=false` and cached entry exists (<4h old), return cached
     3. Otherwise: fetch snapshot + projection from DB
     4. Call `generateAIAnalysis()`
     5. Store result in `ai_forecasts` table
     6. Return analysis with metadata

6. **`lib/db.ts`** (ENHANCED)
   - **New Table Schema:**
     ```sql
     CREATE TABLE ai_forecasts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       ticker TEXT NOT NULL,
       date TEXT NOT NULL,
       snapshot_date TEXT NOT NULL,
       
       -- Summary & Outlook
       summary TEXT,
       outlook TEXT CHECK(outlook IN ('bullish','neutral','bearish')),
       
       -- Price Targets
       pt_conservative REAL,
       pt_base REAL,
       pt_aggressive REAL,
       pt_confidence REAL CHECK(pt_confidence >= 0 AND pt_confidence <= 1),
       
       -- Regime Analysis
       regime_classification TEXT CHECK(regime_classification IN ('elevated','normal','depressed')),
       regime_justification TEXT,
       regime_recommendation TEXT,
       
       -- Trading Levels
       key_support REAL,
       key_resistance REAL,
       profit_targets TEXT, -- JSON array
       stop_loss REAL,
       
       -- Confidence
       overall_confidence REAL CHECK(overall_confidence >= 0 AND overall_confidence <= 1),
       confidence_reasoning TEXT,
       
       -- Metadata
       created_at TEXT DEFAULT (datetime('now')),
       ai_model TEXT DEFAULT 'claude-sonnet-4.5',
       
       UNIQUE(ticker, date, snapshot_date)
     );
     
     CREATE INDEX idx_ai_forecasts_ticker_date ON ai_forecasts(ticker, date);
     ```
   - **New Functions:**
     - `getAIForecast(ticker, date)` → fetch cached analysis or null
     - `saveAIForecast(ticker, date, analysis)` → insert/update forecast
     - `detectRegimeChange(ticker, date)` → compare current vs previous regime

---

## Data Flow

### 1. Daily Forecast Generation (Automated)

```
Backfill Job (runs 16:00 UTC via cron)
  │
  ├─► Fetch latest snapshot & projection for SPWX (date = today)
  │
  ├─► POST /api/options/ai-forecast
  │    ├─ Check cache: none (first run of day)
  │    ├─ Build OptionAnalysisContext from DB
  │    ├─ Call generateAIAnalysis()
  │    │   ├─ Construct Claude prompt
  │    │   ├─ Claude API call (~3-5 sec)
  │    │   ├─ Parse JSON response
  │    │   └─ Validate (price targets, confidence)
  │    └─ Store in ai_forecasts table
  │
  └─► (Optional) Detect regime change
       ├─ Compare current regime vs yesterday
       ├─ If shift >30 IV percentile points → flag alert
       └─ Store in regime_changes table (future enhancement)
```

### 2. User Visits Report Page

```
User → /reports/option-projection?ticker=SPWX
  │
  ├─► Load snapshot + projection (existing code)
  │
  ├─► Fetch AI forecast
  │    ├─ GET /api/options/ai-forecast?ticker=SPWX&date=2026-03-09
  │    ├─ Check cache: exists, age = 2h → return cached
  │    └─ Response: { analysis, cached: true, cacheAge: 7200 }
  │
  ├─► Render AIOptionsForecastSection
  │    ├─ Display summary
  │    ├─ Show price targets with confidence bars
  │    ├─ Render regime badge (color-coded)
  │    └─ Overlay trading levels on chart
  │
  └─► Check for regime change
       ├─ If detected (stored in analysis metadata)
       └─ Render RegimeChangeAlert banner
```

### 3. Force Regenerate (Manual)

```
User clicks "Regenerate AI Analysis" button
  │
  └─► POST /api/options/ai-forecast { ticker, date, regenerate: true }
       ├─ Bypass cache
       ├─ Call generateAIAnalysis() fresh
       ├─ Overwrite cached entry
       └─ Return new analysis
```

---

## Claude Integration Design

### System Prompt (Version 1.0)

```
You are an expert volatility analyst specializing in equity options.

Your task: analyze options market data and generate actionable trading insights.

**Input Data:**
- Current implied volatility (IV) and historical percentile
- Option Greeks across strikes (delta, gamma, vega, theta)
- Volatility skew (25-75 delta spread)
- Current regime classification (elevated/normal/depressed)
- Probability distribution for the next 4 weeks
- Historical baseline metrics (20-day SMA IV, percentile ranks)

**Your Analysis Should:**
1. Assess the current IV environment (elevated/normal/depressed vs history)
2. Identify market positioning from skew and Greeks
3. Extract probability-weighted price targets (25th, 50th, 75th percentile)
4. Recommend key trading levels (support, resistance, profit targets, stop loss)
5. Provide a confidence score based on data quality and regime stability

**Output Format:**
Respond ONLY with valid JSON (no markdown, no explanations outside JSON):

{
  "summary": "<2-3 sentence executive summary>",
  "outlook": "<bullish|neutral|bearish>",
  "priceTargets": {
    "conservative": <number>,
    "base": <number>,
    "aggressive": <number>,
    "confidence": <0-1>
  },
  "regimeAnalysis": {
    "classification": "<elevated|normal|depressed>",
    "justification": "<why this classification?>",
    "recommendation": "<short|long|neutral> volatility"
  },
  "tradingLevels": {
    "keySupport": <number>,
    "keyResistance": <number>,
    "profitTargets": [<number>, <number>, <number>],
    "stopLoss": <number>
  },
  "confidence": {
    "overall": <0-1>,
    "reasoning": "<brief explanation of confidence level>"
  }
}

**Rules:**
- All price targets must be within ±20% of current price (sanity check)
- Confidence scores must be between 0 and 1
- Be concise and data-driven; avoid speculation
- If uncertain, reduce confidence score and explain why
- Reference specific metrics in your justifications
```

### Prompt Engineering Strategy

1. **Structured Output**: Use JSON schema enforcement to guarantee parseable responses
2. **Few-Shot Examples**: Include 2-3 example inputs/outputs in prompt to guide format
3. **Chain-of-Thought**: Ask Claude to reason step-by-step before generating final JSON
4. **Validation**: Post-process to ensure:
   - Price targets are within reasonable bounds
   - Confidence scores are calibrated (0-1)
   - No hallucinated data (all metrics grounded in input)
5. **Fallback**: If Claude returns invalid JSON, retry once; if still fails, return cached or generic response

### Cost Optimization

- **Model Choice:** Claude Sonnet 4.5 (fast + cost-effective; ~$0.003 per request)
- **Caching:** Cache for 4 hours → ~6 calls/day per ticker = $0.018/day = $0.54/month for SPWX
- **Batching:** Generate forecasts once daily in background (cron), not on-demand
- **Fallback:** If quota hit, serve cached forecast + warning banner

---

## Database Schema

### New Table: `ai_forecasts`

```sql
CREATE TABLE ai_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,           -- Forecast date (YYYY-MM-DD)
  snapshot_date TEXT NOT NULL,  -- Snapshot used for analysis
  
  -- Summary
  summary TEXT,
  outlook TEXT CHECK(outlook IN ('bullish','neutral','bearish')),
  
  -- Price Targets
  pt_conservative REAL,  -- 25th percentile
  pt_base REAL,          -- 50th percentile (mean)
  pt_aggressive REAL,    -- 75th percentile
  pt_confidence REAL CHECK(pt_confidence >= 0 AND pt_confidence <= 1),
  
  -- Regime Analysis
  regime_classification TEXT CHECK(regime_classification IN ('elevated','normal','depressed')),
  regime_justification TEXT,
  regime_recommendation TEXT,
  
  -- Trading Levels
  key_support REAL,
  key_resistance REAL,
  profit_targets TEXT,   -- JSON: [202, 205, 210]
  stop_loss REAL,
  
  -- Confidence
  overall_confidence REAL CHECK(overall_confidence >= 0 AND overall_confidence <= 1),
  confidence_reasoning TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  ai_model TEXT DEFAULT 'claude-sonnet-4.5',
  
  UNIQUE(ticker, date, snapshot_date)
);

CREATE INDEX idx_ai_forecasts_ticker_date ON ai_forecasts(ticker, date);
CREATE INDEX idx_ai_forecasts_created_at ON ai_forecasts(created_at);
```

### Query Patterns

**Get Latest Forecast:**
```sql
SELECT * FROM ai_forecasts
WHERE ticker = 'SPWX'
  AND date = '2026-03-09'
ORDER BY created_at DESC
LIMIT 1;
```

**Detect Regime Change:**
```sql
SELECT
  today.regime_classification AS current_regime,
  yesterday.regime_classification AS previous_regime,
  (today.overall_confidence + yesterday.overall_confidence) / 2 AS avg_confidence
FROM ai_forecasts today
LEFT JOIN ai_forecasts yesterday
  ON today.ticker = yesterday.ticker
  AND date(today.date, '-1 day') = yesterday.date
WHERE today.ticker = 'SPWX'
  AND today.date = '2026-03-09';
```

**Forecast Accuracy (Post-MVP):**
```sql
-- Compare 4-week-old forecast vs actual close
SELECT
  f.ticker,
  f.date AS forecast_date,
  f.pt_base AS forecasted_price,
  s.close AS actual_price,
  ABS(f.pt_base - s.close) AS error,
  f.pt_confidence
FROM ai_forecasts f
JOIN option_snapshots s
  ON f.ticker = s.ticker
  AND date(f.date, '+28 days') = s.date
WHERE f.date >= date('now', '-30 days');
```

---

## Error Handling

### Claude API Failures

**Scenario:** Claude API is down or rate-limited

**Strategy:**
1. First attempt: retry once after 2 seconds
2. If still fails:
   - Check for cached forecast (<24h old)
   - If cached exists: return with `{ cached: true, warning: "AI service unavailable, showing last forecast" }`
   - If no cache: return generic analysis based on statistical baseline
3. Log error to monitoring system
4. Display warning banner on UI: "⚠️ AI forecast unavailable — showing statistical baseline"

### Invalid Claude Response

**Scenario:** Claude returns malformed JSON or invalid data

**Strategy:**
1. Validate response schema:
   - Check all required fields exist
   - Validate price targets are within ±20% of current price
   - Check confidence scores are 0-1
2. If validation fails:
   - Log raw response for debugging
   - Return cached forecast with warning
   - Increment error metric
3. Alert engineers if error rate >5%

### Missing Snapshot/Projection Data

**Scenario:** No snapshot or projection exists for requested date

**Strategy:**
1. API returns `400 Bad Request` with message: "No data available for SPWX on 2026-03-09"
2. Frontend displays: "Unable to generate forecast — snapshot data missing"
3. User action: try different date or wait for backfill job

---

## Performance Considerations

### Caching Strategy

**Cache Key:** `ticker:date:snapshot_date`  
**Cache Duration:** 4 hours  
**Storage:** SQLite `ai_forecasts` table  

**Benefits:**
- Reduces Claude API calls by ~85% (assuming 6 page views per forecast)
- Improves response time (cached: <100ms, fresh: 3-5s)
- Resilience during API outages

### Query Optimization

**Existing Issue:** Report page might make multiple DB queries for snapshot + projection + AI forecast

**Solution:**
- Fetch all data in single request: `GET /api/options/report?ticker=SPWX&date=2026-03-09`
- Backend combines snapshot + projection + AI forecast in one query
- Response structure:
  ```json
  {
    "snapshot": { ... },
    "projection": { ... },
    "aiForecast": { ... },
    "meta": { cached: true, cacheAge: 3600 }
  }
  ```

### Claude API Call Timeout

**Default Timeout:** 10 seconds  
**Strategy:** If Claude doesn't respond within 10s, fall back to cached forecast  
**User Experience:** Loading spinner max 3s, then show cached with "Generating fresh forecast..." banner  

---

## Testing Strategy

### Unit Tests

**File:** `__tests__/lib/aiOptionsForecast.test.ts`

```typescript
describe('generateAIAnalysis', () => {
  it('should generate valid forecast from snapshot + projection', async () => {
    const context = mockOptionAnalysisContext();
    const result = await generateAIAnalysis(context);
    
    expect(result.priceTargets.base).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(1);
  });

  it('should handle Claude API errors gracefully', async () => {
    mockClaudeAPIFailure();
    const context = mockOptionAnalysisContext();
    
    const result = await generateAIAnalysis(context);
    expect(result.cached).toBe(true);
    expect(result.warning).toContain('AI service unavailable');
  });

  it('should validate price targets are within bounds', async () => {
    const context = mockOptionAnalysisContext({ price: 200 });
    const result = await generateAIAnalysis(context);
    
    expect(result.priceTargets.conservative).toBeGreaterThan(160); // -20%
    expect(result.priceTargets.aggressive).toBeLessThan(240); // +20%
  });
});
```

### API Tests

**File:** `__tests__/api/options/ai-forecast.test.ts`

```typescript
describe('POST /api/options/ai-forecast', () => {
  it('should return cached forecast when available', async () => {
    await seedAIForecast('SPWX', '2026-03-09');
    
    const response = await POST('/api/options/ai-forecast', {
      ticker: 'SPWX',
      date: '2026-03-09'
    });
    
    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(true);
  });

  it('should regenerate forecast when requested', async () => {
    const response = await POST('/api/options/ai-forecast', {
      ticker: 'SPWX',
      date: '2026-03-09',
      regenerate: true
    });
    
    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
  });

  it('should return 400 when snapshot missing', async () => {
    const response = await POST('/api/options/ai-forecast', {
      ticker: 'INVALID',
      date: '2026-03-09'
    });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('No data available');
  });
});
```

### E2E Tests

**File:** `e2e/option-projection-ai.spec.ts`

```typescript
test('displays AI forecast section on report page', async ({ page }) => {
  await page.goto('/reports/option-projection?ticker=SPWX');
  
  // Wait for AI section to load
  await expect(page.locator('[data-testid="ai-forecast-section"]')).toBeVisible();
  
  // Verify price targets displayed
  await expect(page.locator('[data-testid="price-target-base"]')).toContainText('$');
  
  // Verify confidence badge
  await expect(page.locator('[data-testid="confidence-badge"]')).toBeVisible();
  
  // Verify regime classification
  const regimeBadge = page.locator('[data-testid="regime-badge"]');
  await expect(regimeBadge).toHaveText(/elevated|normal|depressed/);
});

test('displays regime change alert when applicable', async ({ page }) => {
  await seedRegimeChange('SPWX', 'normal', 'elevated');
  await page.goto('/reports/option-projection?ticker=SPWX');
  
  await expect(page.locator('[data-testid="regime-change-alert"]')).toBeVisible();
  await expect(page.locator('[data-testid="regime-change-alert"]')).toContainText('elevated');
});
```

---

## Security Considerations

### API Key Management

**Claude API Key Storage:**
- Store in environment variable: `ANTHROPIC_API_KEY`
- Never commit to git
- Use `.env.local` for local development
- Production: store in secure secrets manager (e.g., Vercel Environment Variables)

### Input Validation

**User Inputs:**
- `ticker`: whitelist allowed tickers (SPWX only in MVP)
- `date`: validate format (YYYY-MM-DD), reject future dates
- `regenerate`: boolean validation

### Rate Limiting

**API Endpoint Protection:**
- Limit: 10 requests/minute per IP
- Strategy: use `express-rate-limit` or Vercel Edge middleware
- Response: `429 Too Many Requests` with `Retry-After` header

### SQL Injection Prevention

**Parameterized Queries:**
```typescript
// ✅ SAFE
db.prepare('SELECT * FROM ai_forecasts WHERE ticker = ? AND date = ?')
  .get(ticker, date);

// ❌ UNSAFE
db.prepare(`SELECT * FROM ai_forecasts WHERE ticker = '${ticker}'`);
```

---

## Deployment Plan

### Phase 1: Development (Days 1-4)
- [ ] Implement `lib/aiOptionsForecast.ts`
- [ ] Create API endpoint `/api/options/ai-forecast`
- [ ] Extend database schema (migration script)
- [ ] Build frontend components
- [ ] Write unit tests

### Phase 2: Integration (Days 4-6)
- [ ] Integrate AI section into report page
- [ ] Enhance dashboard widget
- [ ] Test Claude API integration end-to-end
- [ ] Performance testing (cache hit rates, response times)

### Phase 3: Testing (Days 6-7)
- [ ] E2E tests (Playwright)
- [ ] Error scenario testing (API down, invalid data)
- [ ] Load testing (simulate 100 concurrent requests)
- [ ] Security audit (input validation, API key handling)

### Phase 4: Launch (Day 8)
- [ ] Backfill 30 days of AI forecasts
- [ ] Deploy to staging
- [ ] Final validation
- [ ] Merge to main
- [ ] Deploy to production
- [ ] Monitor error rates and performance

---

## Monitoring & Observability

### Metrics to Track

**Product Metrics:**
- AI forecast generation count (daily)
- Cache hit rate (target: >85%)
- User engagement with AI section (% of report page views)
- Regime change detection count (weekly)

**Technical Metrics:**
- Claude API response time (p50, p95, p99)
- API endpoint response time (cached vs fresh)
- Error rate (Claude failures, validation errors)
- Database query time

**Business Metrics:**
- Claude API cost (monthly spend)
- Cost per forecast
- Forecast accuracy (post-MVP: backtesting)

### Alerts

**Critical:**
- Claude API error rate >10% (5-minute window)
- Database write failures
- Security: abnormal request patterns (potential attack)

**Warning:**
- Claude API response time >10s
- Cache hit rate <70%
- Cost spike (>2x expected daily spend)

---

## Future Enhancements (Post-MVP)

### v0.2.0: Real-Time Updates
- WebSocket integration for live regime change alerts
- Intraday forecast updates (hourly instead of daily)
- Push notifications to mobile

### v0.3.0: Multi-Ticker Support
- Expand to SPY, QQQ, IWM
- Comparative volatility analysis
- Correlation-based recommendations

### v0.4.0: Backtesting & Validation
- Automated forecast accuracy tracking
- Confidence calibration (if confidence = 80%, accuracy should = 80%)
- Performance dashboard showing historical hit rate

### v0.5.0: Advanced Strategies
- Multi-leg recommendation engine (iron condors, spreads)
- Unusual options activity detection
- Earnings announcement impact analysis

---

## Appendix A: Type Definitions

```typescript
// lib/types/aiOptionsForecast.ts

export interface OptionAnalysisContext {
  ticker: string;
  date: string;
  snapshotMetrics: {
    iv: number;
    ivPercentile: number;
    delta: number[];
    gamma: number[];
    vega: number[];
    theta: number[];
    skew: number;
    regimeType: 'elevated' | 'normal' | 'depressed';
  };
  projectionData: {
    mean: number;
    std: number;
    probDistribution: Record<string, number>;
    keyLevels: { price: number; probability: number }[];
  };
}

export interface AIOptionsForecast {
  summary: string;
  outlook: 'bullish' | 'neutral' | 'bearish';
  priceTargets: {
    conservative: number;
    base: number;
    aggressive: number;
    confidence: number;
  };
  regimeAnalysis: {
    classification: 'elevated' | 'normal' | 'depressed';
    justification: string;
    recommendation: string;
  };
  tradingLevels: {
    keySupport: number;
    keyResistance: number;
    profitTargets: number[];
    stopLoss: number;
  };
  confidence: {
    overall: number;
    reasoning: string;
  };
}

export interface AIForecastResponse {
  success: boolean;
  analysis?: AIOptionsForecast;
  cached: boolean;
  cacheAge?: number; // seconds
  nextUpdate?: string; // ISO timestamp
  error?: string;
  warning?: string;
}
```

---

## Appendix B: Example Claude Conversation

**User Prompt:**
```
Analyze the following options market data for SPWX:

Current IV: 45%
IV Percentile (20d): 78%
IV 20d SMA: 38%
Regime: elevated

Current Price: $200
Greeks (ATM):
- Delta: 0.50
- Gamma: 0.03
- Vega: 0.12
- Theta: -0.08

25-75 Delta Skew: 8 points (bullish)

Probability Distribution (4 weeks):
- Mean: $205
- Std Dev: $10
- 25th percentile: $198
- 50th percentile: $205
- 75th percentile: $212
- >1 std move probability: 15%

Historical Baseline:
- 20d IV SMA: 38%
- 60d IV SMA: 42%
- IV Range (20d): 32-48%

Generate trading analysis.
```

**Claude Response (JSON):**
```json
{
  "summary": "SPWX implied volatility is trading at 45%, elevated at the 78th percentile of the 20-day range. The probability distribution shows a bullish lean with mean reversion expected to $205 over 4 weeks. The 8-point put skew indicates bullish positioning, suggesting downside protection is expensive.",
  "outlook": "bullish",
  "priceTargets": {
    "conservative": 198,
    "base": 205,
    "aggressive": 212,
    "confidence": 0.78
  },
  "regimeAnalysis": {
    "classification": "elevated",
    "justification": "Current 45% IV is 7 points above the 20-day SMA and at the 78th percentile, indicating above-normal volatility. This regime has persisted for 3+ days based on the stable percentile rank.",
    "recommendation": "short volatility — consider selling calls or buying put spreads in this elevated regime"
  },
  "tradingLevels": {
    "keySupport": 195,
    "keyResistance": 215,
    "profitTargets": [202, 205, 210],
    "stopLoss": 192
  },
  "confidence": {
    "overall": 0.78,
    "reasoning": "High confidence due to consistent regime classification (elevated for 3+ days) and stable probability distribution shape. Main uncertainty: potential earnings announcement or macro event not captured in current volatility pricing."
  }
}
```

---

**End of Design Document**

*Ready for implementation. See `TASKS.md` for step-by-step development guide.*
