# Implementation Tasks: Options AI Analysis Page

**Feature:** AI-Based Options Analysis Page  
**Assigned To:** Engineer Agent  
**Estimated Time:** 6-8 hours  
**Priority:** High

---

## Task Breakdown

### Phase 1: Database & API Foundation (2-3 hours)

#### Task 1.1: Create Database Migration
**File:** `migrations/YYYY-MM-DD-create-option-analysis-cache.sql`

```sql
-- Create cache table for AI analysis results
CREATE TABLE IF NOT EXISTS option_analysis_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  
  UNIQUE(ticker, date)
);

-- Index for fast lookup
CREATE INDEX idx_cache_lookup ON option_analysis_cache(ticker, date, expires_at);

-- Index for cleanup queries
CREATE INDEX idx_cache_expiry ON option_analysis_cache(expires_at);
```

**Acceptance:**
- [ ] Migration file created
- [ ] Run migration: `npm run db:migrate` (or equivalent)
- [ ] Verify table exists: `sqlite3 database.db ".schema option_analysis_cache"`

---

#### Task 1.2: Create TypeScript Types
**File:** `app/types/options-ai.ts`

```typescript
export interface AIAnalysisRequest {
  ticker: string;
  date?: string;
  expiry?: string;
  regenerate?: boolean;
}

export interface AIAnalysisResponse {
  success: boolean;
  sections: Section[];
  nextDayProjection: NextDayProjection;
  metadata: Metadata;
  error?: string;
}

export interface Section {
  id: string;
  title: string;
  icon: string;
  prose: string;
  highlights?: Highlight[];
  chart?: Chart;
}

export interface Highlight {
  label: string;
  value: string;
  color?: 'gain' | 'loss' | 'neutral';
}

export interface Chart {
  type: 'line' | 'bar' | 'histogram';
  data: any;
}

export interface NextDayProjection {
  targetLow: number;
  targetHigh: number;
  mode: number;
  confidence: 'high' | 'medium' | 'low';
  moveProb: number;
  description: string;
}

export interface Metadata {
  ticker: string;
  date: string;
  generatedAt: string;
  isCached: boolean;
  cacheAge: number;
  nextUpdate: string;
}

export interface Snapshot {
  ticker: string;
  date: string;
  netDelta: number;
  atmGamma: number;
  vega: number;
  theta: number;
  iv30d: number;
  ivRank: number;
  hv20d: number;
  move1w: number;
  regime: string;
  skewRatio: number;
  putIV: number;
  callIV: number;
}

export interface Projection {
  ticker: string;
  date: string;
  mode: number;
  rangeLow: number;
  rangeHigh: number;
}
```

**Acceptance:**
- [ ] File created
- [ ] No TypeScript errors
- [ ] Types exported correctly

---

#### Task 1.3: Create Claude Prompt Builder
**File:** `app/lib/ai/claude-prompt.ts`

```typescript
import type { Snapshot, Projection } from '@/types/options-ai';

export function buildClaudePrompt(snapshot: Snapshot, projection: Projection): string {
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
    "targetLow": ${(projection.rangeLow * 0.98).toFixed(2)},
    "targetHigh": ${(projection.rangeHigh * 1.02).toFixed(2)},
    "mode": ${projection.mode.toFixed(2)},
    "confidence": "high|medium|low",
    "moveProb": 0.65,
    "description": "Brief forecast summary (1-2 sentences)"
  }
}

Return ONLY valid JSON. No markdown, no code blocks.
  `.trim();
}
```

**Acceptance:**
- [ ] Function builds prompt correctly
- [ ] All data points from snapshot/projection included
- [ ] Prompt requests valid JSON structure

---

#### Task 1.4: Create Claude API Client
**File:** `app/lib/ai/claude-client.ts`

```typescript
import type { AIAnalysisResponse } from '@/types/options-ai';

export async function callClaudeAPI(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('[Claude API] Call failed:', error);
    throw error;
  }
}

export function parseClaudeResponse(response: string): Omit<AIAnalysisResponse, 'success' | 'metadata'> {
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

    return {
      sections: parsed.sections,
      nextDayProjection: parsed.nextDayProjection,
    };
  } catch (error) {
    console.error('[Claude API] Failed to parse response:', error);
    throw new Error('Claude returned invalid JSON');
  }
}
```

**Acceptance:**
- [ ] Claude API call works
- [ ] Response parsing extracts sections + projection
- [ ] Error handling logs failures
- [ ] Environment variable checked

---

#### Task 1.5: Create API Route
**File:** `app/api/options/ai-analysis/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { callClaudeAPI, parseClaudeResponse } from '@/lib/ai/claude-client';
import { buildClaudePrompt } from '@/lib/ai/claude-prompt';
import type { AIAnalysisRequest, AIAnalysisResponse } from '@/types/options-ai';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: AIAnalysisRequest = await request.json();
    const { ticker, date, regenerate } = body;

    // Default to today if no date provided
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check cache (unless regenerate=true)
    if (!regenerate) {
      const cached = await checkCache(ticker, targetDate);
      if (cached) {
        console.log('[AI Analysis] Cache HIT', { ticker, date: targetDate, age: cached.cacheAge });
        return NextResponse.json(cached);
      }
    }

    console.log('[AI Analysis] Cache MISS - generating', { ticker, date: targetDate });

    // Fetch data
    const snapshot = await getLatestSnapshot(ticker, targetDate);
    const projection = await getLatestProjection(ticker, targetDate);

    if (!snapshot || !projection) {
      throw new Error('Missing snapshot or projection data');
    }

    // Generate analysis with Claude
    const prompt = buildClaudePrompt(snapshot, projection);
    const claudeStart = Date.now();
    const claudeResponse = await callClaudeAPI(prompt);
    const claudeLatency = Date.now() - claudeStart;

    const parsed = parseClaudeResponse(claudeResponse);

    // Build response
    const analysis: AIAnalysisResponse = {
      success: true,
      ...parsed,
      metadata: {
        ticker,
        date: targetDate,
        generatedAt: new Date().toISOString(),
        isCached: false,
        cacheAge: 0,
        nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      },
    };

    // Store in cache
    await storeInCache(ticker, targetDate, analysis);

    const totalLatency = Date.now() - startTime;
    console.log('[AI Analysis] Generated', {
      ticker,
      date: targetDate,
      claudeLatency: `${claudeLatency}ms`,
      totalLatency: `${totalLatency}ms`,
    });

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('[AI Analysis] Error:', error);
    
    // Try to return stale cache as fallback
    const body: AIAnalysisRequest = await request.json();
    const stale = await checkCache(body.ticker, body.date || new Date().toISOString().split('T')[0], true);
    if (stale) {
      console.log('[AI Analysis] Returning stale cache as fallback');
      return NextResponse.json(stale);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate analysis',
      },
      { status: 500 }
    );
  }
}

async function checkCache(ticker: string, date: string, allowStale = false): Promise<AIAnalysisResponse | null> {
  const db = await getDatabase();
  const query = allowStale
    ? `SELECT analysis_json, created_at FROM option_analysis_cache WHERE ticker = ? AND date = ?`
    : `SELECT analysis_json, created_at FROM option_analysis_cache WHERE ticker = ? AND date = ? AND expires_at > datetime('now')`;

  const row = await db.get(query, [ticker, date]);

  if (!row) return null;

  const analysis = JSON.parse(row.analysis_json);
  const cacheAge = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 1000);

  return {
    ...analysis,
    metadata: {
      ...analysis.metadata,
      isCached: true,
      cacheAge,
    },
  };
}

async function storeInCache(ticker: string, date: string, analysis: AIAnalysisResponse): Promise<void> {
  const db = await getDatabase();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await db.run(
    `INSERT OR REPLACE INTO option_analysis_cache (ticker, date, analysis_json, expires_at) VALUES (?, ?, ?, ?)`,
    [ticker, date, JSON.stringify(analysis), expiresAt]
  );
}

async function getLatestSnapshot(ticker: string, date: string) {
  const db = await getDatabase();
  // Adjust query based on your actual schema
  return await db.get(
    `SELECT * FROM option_snapshots WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1`,
    [ticker, date]
  );
}

async function getLatestProjection(ticker: string, date: string) {
  const db = await getDatabase();
  // Adjust query based on your actual schema
  return await db.get(
    `SELECT * FROM option_projections WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1`,
    [ticker, date]
  );
}
```

**Acceptance:**
- [ ] API route responds to POST
- [ ] Cache logic works (hit/miss)
- [ ] Claude integration functional
- [ ] Error handling with fallback
- [ ] Logging in place

---

### Phase 2: Frontend Components (2-3 hours)

#### Task 2.1: Create Reusable Components
**Files:**
- `app/reports/options-ai-analysis/components/AnalysisSection.tsx`
- `app/reports/options-ai-analysis/components/NextDayForecast.tsx`
- `app/reports/options-ai-analysis/components/HighlightsGrid.tsx`
- `app/reports/options-ai-analysis/components/CacheNotice.tsx`

**AnalysisSection.tsx:**
```typescript
'use client';

import { Card } from '@/components/ui/Card';
import { HighlightsGrid } from './HighlightsGrid';
import type { Section } from '@/types/options-ai';

export function AnalysisSection({ title, icon, prose, highlights }: Section) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>

      <p className="text-text-secondary leading-relaxed mb-4">{prose}</p>

      {highlights && highlights.length > 0 && <HighlightsGrid highlights={highlights} />}
    </Card>
  );
}
```

**NextDayForecast.tsx:**
```typescript
'use client';

import { Card } from '@/components/ui/Card';
import { DataCard } from '@/components/ui/DataCard';
import type { NextDayProjection } from '@/types/options-ai';

interface NextDayForecastProps {
  projection: NextDayProjection;
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
        <DataCard label="Confidence" value={projection.confidence.toUpperCase()} valueClassName={confidenceColor} />
        <DataCard label="Move >1% Probability" value={`${(projection.moveProb * 100).toFixed(0)}%`} />
      </div>

      <p className="text-text-secondary leading-relaxed">{projection.description}</p>
    </Card>
  );
}
```

**HighlightsGrid.tsx:**
```typescript
'use client';

import { DataCard } from '@/components/ui/DataCard';
import type { Highlight } from '@/types/options-ai';

interface HighlightsGridProps {
  highlights: Highlight[];
}

export function HighlightsGrid({ highlights }: HighlightsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {highlights.map((h) => (
        <DataCard key={h.label} label={h.label} value={h.value} valueClassName={h.color ? `text-${h.color}` : ''} />
      ))}
    </div>
  );
}
```

**CacheNotice.tsx:**
```typescript
'use client';

import type { Metadata } from '@/types/options-ai';

interface CacheNoticeProps {
  metadata: Metadata;
}

export function CacheNotice({ metadata }: CacheNoticeProps) {
  const minutesAgo = Math.floor(metadata.cacheAge / 60);
  const hoursAgo = Math.floor(minutesAgo / 60);

  const ageText = hoursAgo >= 1 ? `${hoursAgo}h ago` : `${minutesAgo}m ago`;

  return (
    <div className="text-center text-sm text-text-tertiary py-4">
      <p>
        Generated {ageText} • Next update:{' '}
        {new Date(metadata.nextUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
```

**Acceptance:**
- [ ] All components render without errors
- [ ] Props typed correctly
- [ ] Responsive grid layouts
- [ ] Data cards display correctly

---

#### Task 2.2: Create Main Page Component
**File:** `app/reports/options-ai-analysis/page.tsx`

```typescript
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnalysisSection } from './components/AnalysisSection';
import { NextDayForecast } from './components/NextDayForecast';
import { CacheNotice } from './components/CacheNotice';
import type { AIAnalysisResponse } from '@/types/options-ai';

async function getAnalysis(): Promise<AIAnalysisResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  
  const res = await fetch(`${baseUrl}/api/options/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: 'SPWX' }), // MVP: hardcoded ticker
    cache: 'no-store', // Always fetch fresh (API handles caching)
  });

  if (!res.ok) {
    throw new Error('Failed to fetch analysis');
  }

  return res.json();
}

export default async function OptionsAIAnalysisPage() {
  let data: AIAnalysisResponse;

  try {
    data = await getAnalysis();
  } catch (error) {
    console.error('Failed to load analysis:', error);
    return (
      <AppShell>
        <div className="p-8 text-center">
          <p className="text-red-500">Failed to load AI analysis. Please try again later.</p>
        </div>
      </AppShell>
    );
  }

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
      <PageHeader title="Options AI Analysis" subtitle="AI-Powered Daily Insights" badge={data.metadata.date} />

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

**Acceptance:**
- [ ] Page loads without errors
- [ ] SSR works correctly
- [ ] Error states render
- [ ] All sections display
- [ ] Mobile responsive

---

### Phase 3: Testing & Polish (1-2 hours)

#### Task 3.1: Write Unit Tests
**File:** `app/api/options/ai-analysis/route.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('AI Analysis API', () => {
  it('should return cached analysis on cache hit', async () => {
    // Mock database to return cached data
    vi.mock('@/lib/db', () => ({
      getDatabase: vi.fn(() => ({
        get: vi.fn(() => ({
          analysis_json: JSON.stringify({ sections: [], nextDayProjection: {} }),
          created_at: new Date().toISOString(),
        })),
      })),
    }));

    const request = new NextRequest('http://localhost/api/options/ai-analysis', {
      method: 'POST',
      body: JSON.stringify({ ticker: 'SPWX' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.metadata.isCached).toBe(true);
  });

  it('should call Claude on cache miss', async () => {
    // Test Claude integration
    // TODO: Mock Claude API
  });

  it('should handle Claude API errors gracefully', async () => {
    // TODO: Mock Claude failure
  });
});
```

**Acceptance:**
- [ ] Tests written for cache hit/miss
- [ ] Tests written for Claude integration
- [ ] Tests written for error handling
- [ ] All tests pass

---

#### Task 3.2: Manual Testing Checklist
- [ ] Visit `/reports/options-ai-analysis`
- [ ] Verify page loads in <2s
- [ ] Check all 5 sections render
- [ ] Verify forecast section displays
- [ ] Test mobile view (resize browser)
- [ ] Test error state (break API temporarily)
- [ ] Test cache hit (refresh page within 4h)
- [ ] Verify cache notice shows correct age
- [ ] Check console for errors
- [ ] Verify Claude API called only once per 4h

---

#### Task 3.3: Performance Optimization
- [ ] Lazy-load chart components (if charts added later)
- [ ] Optimize image sizes (if any images used)
- [ ] Check Lighthouse score (target: >90)
- [ ] Verify SSR rendering time <500ms
- [ ] Check database query performance

---

### Phase 4: Integration & Deployment (1 hour)

#### Task 4.1: Add Navigation Link
**File:** `app/components/layout/Sidebar.tsx` (or equivalent)

Add link to Options AI Analysis page:
```typescript
<NavLink href="/reports/options-ai-analysis" icon="🤖">
  Options AI Analysis
</NavLink>
```

**Acceptance:**
- [ ] Link appears in sidebar
- [ ] Link navigates correctly
- [ ] Active state works

---

#### Task 4.2: Environment Variables
**File:** `.env.local`

```bash
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_BASE_URL=http://localhost:3002
```

**Acceptance:**
- [ ] Environment variables documented
- [ ] Variables set in production
- [ ] API key secured (not committed)

---

#### Task 4.3: Deploy to Worktree Server
**Commands:**
```bash
cd /home/claw/worktrees/financial-analyzer/feature/options-ai-analysis
npm install
npm run build
pm2 restart financial-analyzer-3002
```

**Acceptance:**
- [ ] Server starts on port 3002
- [ ] Page accessible at http://dev-center:3002/reports/options-ai-analysis
- [ ] No console errors
- [ ] Claude API working
- [ ] Cache functional

---

#### Task 4.4: Create Pull Request
**Checklist:**
- [ ] All code committed
- [ ] Tests passing
- [ ] Linting clean
- [ ] PR description written
- [ ] Screenshots included
- [ ] Linked to PRD

**PR Template:**
```markdown
## Feature: Options AI Analysis Page

### Summary
Implements AI-powered options analysis page with Claude-generated insights.

### Changes
- Created `/api/options/ai-analysis` endpoint
- Built page component at `/reports/options-ai-analysis`
- Added database migration for cache table
- Integrated Claude API for analysis generation
- Implemented 4-hour caching strategy

### Testing
- [x] Unit tests pass
- [x] Manual testing complete
- [x] Mobile responsive
- [x] Error handling verified

### Screenshots
[TODO: Add screenshots]

### Closes
- FEAT-001 (PRD)
```

**Acceptance:**
- [ ] PR created
- [ ] All checks passing
- [ ] Ready for review

---

## Summary Checklist

### Database
- [ ] Migration created
- [ ] Table exists
- [ ] Indexes created

### API
- [ ] Types defined
- [ ] Claude prompt builder
- [ ] Claude API client
- [ ] API route handler
- [ ] Cache logic working
- [ ] Error handling

### Frontend
- [ ] Page component (SSR)
- [ ] AnalysisSection component
- [ ] NextDayForecast component
- [ ] HighlightsGrid component
- [ ] CacheNotice component
- [ ] Navigation link

### Testing
- [ ] Unit tests written
- [ ] Manual testing complete
- [ ] Performance verified

### Deployment
- [ ] Environment variables set
- [ ] Server running on port 3002
- [ ] PR created
- [ ] Ready for review

---

**Estimated Total Time:** 6-8 hours  
**Priority Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4  
**Blockers:** None (all dependencies exist)

**Next Step:** Engineer begins implementation following this task list.
