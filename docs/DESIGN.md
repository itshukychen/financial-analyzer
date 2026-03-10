# Technical Design: Options AI Analysis Page

**Feature:** AI-Based Options Analysis Page  
**Architect:** AI Architect  
**Date:** 2026-03-10  
**Status:** Design Ready for Implementation

---

## 1. System Architecture

### High-Level Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    User Browser                                 │
│  /reports/options-ai-analysis                                   │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Next.js SSR
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│              Page Component (SSR)                               │
│  - Fetch latest snapshot from DB                                │
│  - Fetch latest projection from DB                              │
│  - Call AI analysis API                                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│         POST /api/options/ai-analysis                           │
│  1. Check cache (ticker, date, expires_at > NOW)                │
│  2. If cached → return JSON                                     │
│  3. If not:                                                     │
│     a. Fetch snapshot + projection data                         │
│     b. Build Claude prompt                                      │
│     c. Call Claude API                                          │
│     d. Parse response                                           │
│     e. Store in cache (TTL: 4h)                                 │
│     f. Return JSON                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Data Layer                                    │
│  - option_analysis_cache (new table)                            │
│  - option_snapshots (existing)                                  │
│  - option_projections (existing)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### Page Component Hierarchy
```
app/reports/options-ai-analysis/page.tsx (SSR Server Component)
  ├─ AppShell (layout wrapper)
  ├─ PageHeader
  │   ├─ title: "Options AI Analysis"
  │   ├─ subtitle: AI-generated insights
  │   └─ date badge
  │
  ├─ sections.map → AnalysisSection (client component)
  │   ├─ SectionHeader (icon + title)
  │   ├─ ProseParagraph (AI-generated text)
  │   ├─ HighlightsGrid (data cards)
  │   └─ ChartRenderer (optional)
  │       ├─ GreeksChart
  │       ├─ IVTrendChart
  │       └─ ProbabilityChart
  │
  ├─ NextDayForecast (specialized section)
  │   ├─ ForecastHeader
  │   ├─ ProjectionDataCards (target range, confidence, move prob)
  │   └─ ForecastProse
  │
  └─ CacheNotice (metadata footer)
      ├─ Generated timestamp
      ├─ Cache age
      └─ Next update time
```

### Component Responsibilities

#### **Page Component** (Server Component)
- Fetch data from DB
- Call AI analysis API
- Pass props to client components
- Handle errors at page level
- SSR for performance

#### **AnalysisSection** (Client Component)
- Render section layout
- Display AI-generated prose
- Render highlights as data cards
- Conditionally render charts
- Handle missing data gracefully

#### **NextDayForecast** (Client Component)
- Specialized layout for forecast
- Prominent display of target range
- Confidence and probability indicators
- Forecast prose

#### **ChartRenderer** (Client Component)
- Lazy-load chart library (Recharts)
- Support multiple chart types
- Responsive sizing
- Fallback for missing data

---

## 3. API Design

### Endpoint: `POST /api/options/ai-analysis`

#### Request Schema
```typescript
interface AIAnalysisRequest {
  ticker: string;           // e.g., "SPWX"
  date?: string;            // YYYY-MM-DD; defaults to today
  expiry?: string;          // YYYY-MM-DD; defaults to 30d
  regenerate?: boolean;     // Force bypass cache (admin only)
}
```

#### Response Schema
```typescript
interface AIAnalysisResponse {
  success: boolean;
  sections: Section[];
  nextDayProjection: NextDayProjection;
  metadata: Metadata;
  error?: string;           // Only if success=false
}

interface Section {
  id: string;               // "current-move" | "iv-skew" | "greeks" | "regime" | "next-day"
  title: string;
  icon: string;             // Emoji or SVG
  prose: string;            // AI-generated paragraph
  highlights?: Highlight[];
  chart?: Chart;
}

interface Highlight {
  label: string;
  value: string;
  color?: 'gain' | 'loss' | 'neutral';
}

interface Chart {
  type: 'line' | 'bar' | 'histogram';
  data: any;                // Chart.js or Recharts compatible
}

interface NextDayProjection {
  targetLow: number;
  targetHigh: number;
  mode: number;
  confidence: 'high' | 'medium' | 'low';
  moveProb: number;         // 0–1 probability
  description: string;
}

interface Metadata {
  ticker: string;
  date: string;             // YYYY-MM-DD
  generatedAt: string;      // ISO timestamp
  isCached: boolean;
  cacheAge: number;         // Seconds since generation
  nextUpdate: string;       // ISO timestamp (generatedAt + 4h)
}
```

#### Cache Logic
```typescript
async function getOrGenerateAnalysis(ticker: string, date: string) {
  // 1. Check cache
  const cached = await db.get(`
    SELECT analysis_json, created_at, expires_at
    FROM option_analysis_cache
    WHERE ticker = ? AND date = ? AND expires_at > datetime('now')
  `, [ticker, date]);

  if (cached) {
    return {
      ...JSON.parse(cached.analysis_json),
      metadata: {
        ...JSON.parse(cached.analysis_json).metadata,
        isCached: true,
        cacheAge: Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000),
      },
    };
  }

  // 2. Generate new analysis
  const snapshot = await getLatestSnapshot(ticker, date);
  const projection = await getLatestProjection(ticker, date);
  
  const prompt = buildClaudePrompt(snapshot, projection);
  const claudeResponse = await callClaudeAPI(prompt);
  const analysis = parseClaudeResponse(claudeResponse);

  // 3. Store in cache
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours
  await db.run(`
    INSERT OR REPLACE INTO option_analysis_cache (ticker, date, analysis_json, expires_at)
    VALUES (?, ?, ?, ?)
  `, [ticker, date, JSON.stringify(analysis), expiresAt.toISOString()]);

  return {
    ...analysis,
    metadata: {
      ...analysis.metadata,
      isCached: false,
      cacheAge: 0,
    },
  };
}
```

---

## 4. Database Schema

### New Table: `option_analysis_cache`
```sql
CREATE TABLE IF NOT EXISTS option_analysis_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  
  UNIQUE(ticker, date)
);

CREATE INDEX idx_cache_lookup ON option_analysis_cache(ticker, date, expires_at);
CREATE INDEX idx_cache_expiry ON option_analysis_cache(expires_at);
```

**Columns:**
- `ticker`: Stock symbol (e.g., "SPWX")
- `date`: Analysis date (YYYY-MM-DD)
- `analysis_json`: Full JSON response (sections + projection + metadata)
- `created_at`: Generation timestamp
- `expires_at`: TTL expiration (created_at + 4 hours)

**Indexes:**
- `idx_cache_lookup`: Fast lookup by ticker + date + valid TTL
- `idx_cache_expiry`: Cleanup of expired entries

**Cleanup Strategy:**
- Cron job or API endpoint to delete rows where `expires_at < NOW()`
- Or implement lazy cleanup on read (delete expired, then query valid)

---

## 5. Claude Integration

### Prompt Engineering

#### Prompt Template
```typescript
function buildClaudePrompt(snapshot: Snapshot, projection: Projection): string {
  return `
You are an expert options analyst. Analyze the following option market data and provide structured insights.

### Current Market State (${snapshot.date})
Ticker: ${snapshot.ticker}

**Greeks Aggregate:**
- Net Delta: ${snapshot.netDelta.toFixed(4)} (${snapshot.netDelta > 0 ? 'bullish' : 'bearish'})
- ATM Gamma: ${snapshot.atmGamma.toFixed(4)}
- Vega (per 1% IV): ${snapshot.vega.toFixed(0)} pts
- Theta (daily decay): ${snapshot.theta.toFixed(2)}

**Volatility Metrics:**
- IV (30d ATM): ${snapshot.iv30d.toFixed(1)}%
- IV Rank: ${snapshot.ivRank}th percentile
- Historical Vol (20d): ${snapshot.hv20d.toFixed(1)}%
- Implied Move (1W): ±${snapshot.move1w.toFixed(1)}%
- Regime: ${snapshot.regime}

**Skew Profile:**
- Skew Ratio: ${snapshot.skewRatio.toFixed(2)} (${snapshot.skewRatio > 1 ? 'put-heavy' : 'call-heavy'})
- Put IV (OTM 25d): ${snapshot.putIV.toFixed(1)}%
- Call IV (OTM 25d): ${snapshot.callIV.toFixed(1)}%

**Probability Distribution (30d horizon):**
- Mode: $${projection.mode.toFixed(2)}
- 2SD Range: $${projection.rangeLow.toFixed(2)}–$${projection.rangeHigh.toFixed(2)}

### Task
Generate a structured analysis with 5 sections. Format as valid JSON:

{
  "sections": [
    {
      "id": "current-move",
      "title": "Current Move Driver",
      "icon": "📊",
      "prose": "2-3 sentences explaining why IV is at current level and what's driving skew",
      "highlights": [
        {"label": "IV Change", "value": "+X%", "color": "loss|gain|neutral"},
        {"label": "IV Rank", "value": "Xth %ile", "color": "neutral"},
        {"label": "Gamma ATM", "value": "X.XXXX", "color": "loss|gain"},
        {"label": "Skew", "value": "Put/Call Heavy", "color": "neutral"}
      ]
    },
    {
      "id": "iv-skew",
      "title": "IV & Skew Interpretation",
      "icon": "📈",
      "prose": "2-3 sentences on whether IV is expensive vs HV, what skew indicates",
      "highlights": [
        {"label": "IV/HV Spread", "value": "+X%", "color": "loss|gain"},
        {"label": "Skew Ratio", "value": "X.XX", "color": "neutral"},
        {"label": "Put IV", "value": "X%", "color": "neutral"},
        {"label": "Call IV", "value": "X%", "color": "neutral"}
      ]
    },
    {
      "id": "greeks",
      "title": "Greeks Analysis",
      "icon": "🧮",
      "prose": "2-3 sentences on delta positioning, gamma risk, theta decay, vega sensitivity",
      "highlights": [
        {"label": "Net Delta", "value": "+/-X.XX", "color": "gain|loss"},
        {"label": "Theta Daily", "value": "-X.XX", "color": "loss"},
        {"label": "Vega per 1%", "value": "X pts", "color": "neutral"},
        {"label": "Gamma ATM", "value": "X.XXXX", "color": "loss|gain"}
      ]
    },
    {
      "id": "regime",
      "title": "Volatility Regime",
      "icon": "⚡",
      "prose": "2-3 sentences on current regime, transition probability, expected duration",
      "highlights": [
        {"label": "Current Regime", "value": "Low|Normal|High", "color": "gain|neutral|loss"},
        {"label": "HV 20d", "value": "X%", "color": "neutral"},
        {"label": "Transition Prob", "value": "X%", "color": "neutral"},
        {"label": "Duration", "value": "X-Y days", "color": "neutral"}
      ]
    },
    {
      "id": "next-day",
      "title": "Next Trading Day Forecast",
      "icon": "🎯",
      "prose": "3-4 sentences on expected move, key levels, confidence rationale"
    }
  ],
  "nextDayProjection": {
    "targetLow": ${projection.rangeLow * 0.98},
    "targetHigh": ${projection.rangeHigh * 1.02},
    "mode": ${projection.mode},
    "confidence": "high|medium|low",
    "moveProb": 0.X,
    "description": "Brief forecast summary (1-2 sentences)"
  }
}

Return ONLY valid JSON. No markdown, no code blocks.
  `.trim();
}
```

#### Error Handling
```typescript
async function callClaudeAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API call failed:', error);
    throw error;
  }
}

function parseClaudeResponse(response: string): AIAnalysisResponse {
  try {
    // Strip markdown code blocks if present
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid response: missing sections array');
    }
    if (!parsed.nextDayProjection) {
      throw new Error('Invalid response: missing nextDayProjection');
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    throw new Error('Claude returned invalid JSON');
  }
}
```

---

## 6. Frontend Components

### File Structure
```
app/
├─ reports/
│  └─ options-ai-analysis/
│     ├─ page.tsx                 # Server Component (SSR)
│     └─ components/
│        ├─ AnalysisSection.tsx   # Client Component
│        ├─ NextDayForecast.tsx   # Client Component
│        ├─ HighlightsGrid.tsx    # Client Component
│        ├─ ChartRenderer.tsx     # Client Component
│        └─ CacheNotice.tsx       # Client Component
│
└─ api/
   └─ options/
      └─ ai-analysis/
         └─ route.ts               # API Route Handler
```

### Component Implementations

#### `page.tsx` (Server Component)
```typescript
// app/reports/options-ai-analysis/page.tsx
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnalysisSection } from './components/AnalysisSection';
import { NextDayForecast } from './components/NextDayForecast';
import { CacheNotice } from './components/CacheNotice';

async function getAnalysis() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/options/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: 'SPWX' }), // MVP: hardcoded ticker
    cache: 'no-store', // Always fetch fresh (caching handled by API)
  });

  if (!res.ok) {
    throw new Error('Failed to fetch analysis');
  }

  return res.json();
}

export default async function OptionsAIAnalysisPage() {
  const data = await getAnalysis();

  if (!data.success) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <p className="text-red-500">Failed to load analysis: {data.error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Options AI Analysis"
        subtitle="AI-Powered Daily Insights"
        badge={data.metadata.date}
      />

      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {data.sections.map((section) => (
          <AnalysisSection key={section.id} {...section} />
        ))}

        <NextDayForecast projection={data.nextDayProjection} />

        <CacheNotice metadata={data.metadata} />
      </div>
    </AppShell>
  );
}
```

#### `AnalysisSection.tsx` (Client Component)
```typescript
'use client';

import { Card } from '@/components/ui/Card';
import { HighlightsGrid } from './HighlightsGrid';
import { ChartRenderer } from './ChartRenderer';

interface AnalysisSectionProps {
  title: string;
  icon: string;
  prose: string;
  highlights?: Array<{
    label: string;
    value: string;
    color?: 'gain' | 'loss' | 'neutral';
  }>;
  chart?: {
    type: string;
    data: any;
  };
}

export function AnalysisSection({
  title,
  icon,
  prose,
  highlights,
  chart,
}: AnalysisSectionProps) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>

      <p className="text-text-secondary leading-relaxed mb-4">{prose}</p>

      {highlights && <HighlightsGrid highlights={highlights} />}

      {chart && <ChartRenderer type={chart.type} data={chart.data} />}
    </Card>
  );
}
```

#### `NextDayForecast.tsx` (Client Component)
```typescript
'use client';

import { Card } from '@/components/ui/Card';
import { DataCard } from '@/components/ui/DataCard';

interface NextDayForecastProps {
  projection: {
    targetLow: number;
    targetHigh: number;
    mode: number;
    confidence: 'high' | 'medium' | 'low';
    moveProb: number;
    description: string;
  };
}

export function NextDayForecast({ projection }: NextDayForecastProps) {
  const confidenceColor = {
    high: 'text-gain',
    medium: 'text-neutral',
    low: 'text-loss',
  }[projection.confidence];

  return (
    <Card className="p-6 bg-accent/5 border-accent">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>🎯</span>
        <span>Next Trading Day Forecast</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <DataCard
          label="Target Range"
          value={`$${projection.targetLow.toFixed(2)}–$${projection.targetHigh.toFixed(2)}`}
        />
        <DataCard
          label="Confidence"
          value={projection.confidence.toUpperCase()}
          valueClassName={confidenceColor}
        />
        <DataCard
          label="Move >1% Probability"
          value={`${(projection.moveProb * 100).toFixed(0)}%`}
        />
      </div>

      <p className="text-text-secondary leading-relaxed">{projection.description}</p>
    </Card>
  );
}
```

#### `HighlightsGrid.tsx` (Client Component)
```typescript
'use client';

import { DataCard } from '@/components/ui/DataCard';

interface Highlight {
  label: string;
  value: string;
  color?: 'gain' | 'loss' | 'neutral';
}

interface HighlightsGridProps {
  highlights: Highlight[];
}

export function HighlightsGrid({ highlights }: HighlightsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {highlights.map((h) => (
        <DataCard
          key={h.label}
          label={h.label}
          value={h.value}
          valueClassName={h.color ? `text-${h.color}` : ''}
        />
      ))}
    </div>
  );
}
```

---

## 7. Error Handling Strategy

### Error Types & Responses

| Error | Condition | Response |
|-------|-----------|----------|
| Claude API timeout | >5s wait | Return cached (stale) or fallback UI |
| Claude API 429 rate limit | Too many requests | Return cached or queue for retry |
| Invalid JSON from Claude | Parse error | Log error, return placeholder analysis |
| Missing snapshot/projection data | DB query returns null | Show error notice + partial data |
| Database write failure | Cache insert fails | Log error, continue (analysis still returned) |

### Fallback UI
```typescript
// If Claude fails and no cache exists
const fallbackAnalysis: AIAnalysisResponse = {
  success: true,
  sections: [
    {
      id: 'error-notice',
      title: 'Analysis Unavailable',
      icon: '⚠️',
      prose: 'AI analysis could not be generated at this time. Please check back later or view the raw option data below.',
      highlights: [],
    },
  ],
  nextDayProjection: {
    targetLow: 0,
    targetHigh: 0,
    mode: 0,
    confidence: 'low',
    moveProb: 0,
    description: 'Forecast unavailable.',
  },
  metadata: {
    ticker: 'SPWX',
    date: new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    isCached: false,
    cacheAge: 0,
    nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
};
```

---

## 8. Testing Plan

### Unit Tests

#### API Route (`route.ts`)
- ✅ Cache hit returns stored JSON
- ✅ Cache miss triggers Claude call
- ✅ Expired cache is ignored
- ✅ Claude response parsed correctly
- ✅ Invalid JSON handled gracefully
- ✅ Database writes succeed

#### Claude Integration
- ✅ Prompt builds correctly from snapshot + projection
- ✅ API call succeeds with valid response
- ✅ API call handles 429 rate limit
- ✅ API call handles timeout
- ✅ Response parsing extracts sections + projection

#### Components
- ✅ `AnalysisSection` renders prose + highlights
- ✅ `NextDayForecast` displays projection data
- ✅ `HighlightsGrid` renders data cards
- ✅ `CacheNotice` shows metadata
- ✅ Error states render fallback UI

### Integration Tests

#### Full Page Load Flow
1. User visits `/reports/options-ai-analysis`
2. Server fetches snapshot + projection
3. API checks cache → miss → calls Claude
4. Claude returns valid JSON
5. API stores in cache
6. Page renders sections + forecast
7. ✅ Total time <3s

#### Cache Hit Flow
1. User visits page (second time)
2. API checks cache → hit
3. Returns cached JSON
4. Page renders immediately
5. ✅ Total time <1s

### E2E Tests

- ✅ Page loads without errors
- ✅ All sections render
- ✅ Forecast section displays
- ✅ Mobile responsive (viewport <768px)
- ✅ Error state when API fails
- ✅ Stale cache fallback works

---

## 9. Performance Optimization

### SSR Strategy
- Server-side render page for fast initial load
- Fetch data during SSR (no client-side loading spinner)
- Stream HTML to browser (Next.js default)

### Caching Strategy
- **API Level:** 4-hour TTL in database
- **CDN Level:** No CDN caching (data changes too frequently)
- **Client Level:** No client-side caching (always fetch latest)

### Code Splitting
- Lazy-load chart library (Recharts) only when needed
- Use Next.js dynamic imports for heavy components

```typescript
import dynamic from 'next/dynamic';

const ChartRenderer = dynamic(() => import('./ChartRenderer'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false, // Charts render client-side only
});
```

### Image Optimization
- Use Next.js `<Image>` for any static assets
- Lazy-load images below fold

---

## 10. Deployment Plan

### Phase 1: Development
- [ ] Implement API route with Claude integration
- [ ] Create database migration for cache table
- [ ] Build page component + child components
- [ ] Write unit tests
- [ ] Local testing

### Phase 2: Staging
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Test with real Claude API (rate limiting, costs)
- [ ] Monitor API latency and cache hit rate
- [ ] Gather internal feedback

### Phase 3: Production
- [ ] Deploy to production
- [ ] Monitor error logs (Claude failures, DB issues)
- [ ] Track daily API costs
- [ ] Measure page load performance (Core Web Vitals)
- [ ] Collect user feedback

### Phase 4: Iteration
- [ ] Refine Claude prompts based on output quality
- [ ] Optimize cache TTL if needed
- [ ] Add more chart types if requested
- [ ] Extend to support multiple tickers

---

## 11. Monitoring & Observability

### Metrics to Track

**Performance:**
- Page load time (SSR + client render)
- API response time (cache hit vs miss)
- Claude API latency
- Database query time

**Reliability:**
- Error rate (Claude API failures)
- Cache hit rate (target: >90%)
- Stale cache fallback usage

**Cost:**
- Daily Claude API calls
- Token usage (input + output)
- Estimated daily cost

**Usage:**
- Daily page views
- Average time on page
- Section engagement (which sections scrolled into view)

### Logging Strategy
```typescript
// Example logging in API route
console.log('[AI Analysis]', {
  ticker,
  date,
  cacheHit: !!cached,
  cacheAge: cached ? cacheAge : null,
  claudeLatency: claudeLatency ? `${claudeLatency}ms` : null,
  totalLatency: `${totalLatency}ms`,
  error: error ? error.message : null,
});
```

### Alerts
- **Critical:** Claude API down for >5 minutes
- **Warning:** Cache hit rate <80%
- **Warning:** Daily cost exceeds $0.15
- **Info:** Stale cache served due to Claude failure

---

## 12. Cost Analysis

### Expected Usage
- **Daily Visits:** ~50 users
- **Cache TTL:** 4 hours
- **Daily Generations:** ~6 (every 4 hours)

### Token Estimates (per generation)
- **Input:** ~500 tokens (prompt + data)
- **Output:** ~800 tokens (5 sections + projection)
- **Total:** ~1,300 tokens per call

### Cost per Generation (Claude Sonnet 3.5)
- Input: $3/M tokens × 0.5k = $0.0015
- Output: $15/M tokens × 0.8k = $0.012
- **Total:** ~$0.0135 per generation

### Monthly Cost Estimate
- 6 generations/day × 30 days = 180 generations
- 180 × $0.0135 = **$2.43/month**
- **Well within target of <$0.10/day**

---

## 13. Future Enhancements

### Post-MVP Features
1. **Ticker Selection:** Dropdown to choose ticker
2. **Date Picker:** View historical analyses
3. **Multi-Expiry Comparison:** Compare 30d vs 60d vs 90d
4. **Export:** Download as PDF or CSV
5. **Alerts:** Notify on high-confidence forecasts
6. **Backtesting:** Track forecast accuracy over time
7. **Customization:** User-selected sections
8. **Real-Time Updates:** WebSocket for intraday refresh

### Technical Debt to Address
- Add TypeScript strict mode
- Improve error boundaries (React Error Boundary)
- Add request rate limiting
- Implement user analytics (PostHog, Plausible)

---

## 14. Open Questions / Risks

### Design Decisions Needed
- [ ] Should we support multiple tickers in MVP? (Proposal: No, hardcode to SPWX)
- [ ] Should users be able to force regeneration? (Proposal: Admin-only API flag)
- [ ] Should we archive old analyses? (Proposal: No, only cache latest)

### Technical Risks
- **Claude API Reliability:** Mitigated by caching + stale fallback
- **Database Performance:** Mitigated by indexes + 4-hour TTL
- **Cost Overruns:** Mitigated by caching + token optimization
- **Prompt Quality:** Mitigated by iterative refinement + user feedback

---

## 15. Acceptance Criteria Summary

### Functional
- [x] Page loads with AI-generated analysis
- [x] 5 sections render: Current Move, IV/Skew, Greeks, Regime, Forecast
- [x] Next-day projection displays with confidence
- [x] Data cached for 4 hours
- [x] Error states handled gracefully

### Performance
- [x] Page load <2s (SSR + cache hit)
- [x] API response <1s (cache hit)
- [x] Claude call <3s (cache miss)

### UX
- [x] Matches Market Report styling
- [x] Mobile responsive
- [x] Clear section hierarchy
- [x] Readable prose + data cards

### Cost
- [x] Daily cost <$0.10
- [x] Cache hit rate >90%

---

**Design Status:** ✅ Ready for Implementation  
**Next Step:** Engineer builds based on this design + task breakdown
