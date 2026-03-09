# Implementation Tasks: AI-Powered Options Forecast

**Feature:** AI-Powered Options Price Forecast Analysis  
**Sprint:** 8 days  
**Assignee:** Engineer (to be assigned)  
**PRD:** [prd-ai-options-forecast.md](./prd-ai-options-forecast.md)  
**Design:** [DESIGN.md](./DESIGN.md)  

---

## Overview

This task breakdown provides a **step-by-step implementation guide** for the AI Options Forecast feature.

**Estimated Total Time:** 6-8 working days  
**Complexity:** Medium (Claude API integration + frontend work)  
**Dependencies:** Existing v0.1.0 analytics library, option snapshots/projections in DB  

---

## Phase 1: Database & Core AI Library (Days 1-2)

### Task 1.1: Database Schema Migration

**Estimated Time:** 1 hour  
**Files:**
- `lib/migrations/003_ai_forecasts.sql` (NEW)
- `lib/db.ts` (ENHANCED)

**Steps:**

1. **Create migration file:**
   ```sql
   -- lib/migrations/003_ai_forecasts.sql
   
   CREATE TABLE IF NOT EXISTS ai_forecasts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     ticker TEXT NOT NULL,
     date TEXT NOT NULL,
     snapshot_date TEXT NOT NULL,
     
     -- Summary
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
     profit_targets TEXT,
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

2. **Add migration runner to `lib/db.ts`:**
   ```typescript
   export function runMigrations() {
     const migrations = [
       fs.readFileSync('lib/migrations/001_init.sql', 'utf8'),
       fs.readFileSync('lib/migrations/002_options.sql', 'utf8'),
       fs.readFileSync('lib/migrations/003_ai_forecasts.sql', 'utf8'),
     ];
     
     migrations.forEach((sql) => db.exec(sql));
   }
   ```

3. **Add DB helper functions:**
   ```typescript
   export function getAIForecast(ticker: string, date: string) {
     return db.prepare(`
       SELECT * FROM ai_forecasts
       WHERE ticker = ? AND date = ?
       ORDER BY created_at DESC
       LIMIT 1
     `).get(ticker, date);
   }
   
   export function saveAIForecast(ticker: string, date: string, analysis: AIOptionsForecast) {
     return db.prepare(`
       INSERT OR REPLACE INTO ai_forecasts (
         ticker, date, snapshot_date,
         summary, outlook,
         pt_conservative, pt_base, pt_aggressive, pt_confidence,
         regime_classification, regime_justification, regime_recommendation,
         key_support, key_resistance, profit_targets, stop_loss,
         overall_confidence, confidence_reasoning
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     `).run(
       ticker, date, analysis.snapshotDate,
       analysis.summary, analysis.outlook,
       analysis.priceTargets.conservative,
       analysis.priceTargets.base,
       analysis.priceTargets.aggressive,
       analysis.priceTargets.confidence,
       analysis.regimeAnalysis.classification,
       analysis.regimeAnalysis.justification,
       analysis.regimeAnalysis.recommendation,
       analysis.tradingLevels.keySupport,
       analysis.tradingLevels.keyResistance,
       JSON.stringify(analysis.tradingLevels.profitTargets),
       analysis.tradingLevels.stopLoss,
       analysis.confidence.overall,
       analysis.confidence.reasoning
     );
   }
   ```

4. **Test migration:**
   ```bash
   npm run db:migrate
   sqlite3 data/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_forecasts';"
   ```

**Acceptance Criteria:**
- ✅ `ai_forecasts` table created successfully
- ✅ Indexes created
- ✅ `getAIForecast()` and `saveAIForecast()` functions work
- ✅ Migration runs without errors on clean database

---

### Task 1.2: Type Definitions

**Estimated Time:** 30 minutes  
**Files:**
- `lib/types/aiOptionsForecast.ts` (NEW)

**Steps:**

1. **Create type definitions:**
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
     snapshotDate: string;
   }
   
   export interface AIForecastResponse {
     success: boolean;
     analysis?: AIOptionsForecast;
     cached: boolean;
     cacheAge?: number;
     nextUpdate?: string;
     error?: string;
     warning?: string;
   }
   ```

2. **Export from `lib/types/index.ts`:**
   ```typescript
   export * from './aiOptionsForecast';
   ```

**Acceptance Criteria:**
- ✅ TypeScript compiles without errors
- ✅ Types imported successfully in other files

---

### Task 1.3: Claude API Integration

**Estimated Time:** 3 hours  
**Files:**
- `lib/aiOptionsForecast.ts` (NEW)
- `.env.local` (add `ANTHROPIC_API_KEY`)

**Steps:**

1. **Install Anthropic SDK:**
   ```bash
   npm install @anthropic-ai/sdk
   ```

2. **Create AI forecast library:**
   ```typescript
   // lib/aiOptionsForecast.ts
   
   import Anthropic from '@anthropic-ai/sdk';
   import type { OptionAnalysisContext, AIOptionsForecast } from './types/aiOptionsForecast';
   import { getAIForecast, saveAIForecast } from './db';
   
   const client = new Anthropic({
     apiKey: process.env.ANTHROPIC_API_KEY,
   });
   
   const SYSTEM_PROMPT = `You are an expert volatility analyst specializing in equity options.

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
- All price targets must be within ±20% of current price
- Confidence scores must be between 0 and 1
- Be concise and data-driven; avoid speculation
- If uncertain, reduce confidence score and explain why
- Reference specific metrics in your justifications`;
   
   export async function generateAIAnalysis(
     context: OptionAnalysisContext,
     useCache = true
   ): Promise<AIOptionsForecast> {
     // Check cache first
     if (useCache) {
       const cached = getAIForecast(context.ticker, context.date);
       if (cached && isCacheFresh(cached.created_at)) {
         return parseForecastFromDB(cached);
       }
     }
     
     // Build user prompt
     const userPrompt = buildPrompt(context);
     
     try {
       // Call Claude API
       const response = await client.messages.create({
         model: 'claude-sonnet-4-5',
         max_tokens: 2048,
         system: SYSTEM_PROMPT,
         messages: [{
           role: 'user',
           content: userPrompt,
         }],
       });
       
       // Parse response
       const content = response.content[0].text;
       const analysis = parseClaudeResponse(content, context);
       
       // Validate
       validateAnalysis(analysis, context);
       
       // Save to DB
       saveAIForecast(context.ticker, context.date, analysis);
       
       return analysis;
       
     } catch (error) {
       console.error('Claude API error:', error);
       
       // Fallback to cached forecast
       const cached = getAIForecast(context.ticker, context.date);
       if (cached) {
         console.warn('Using stale cached forecast due to API error');
         return parseForecastFromDB(cached);
       }
       
       throw new Error('AI forecast generation failed and no cache available');
     }
   }
   
   function buildPrompt(context: OptionAnalysisContext): string {
     const { snapshotMetrics, projectionData } = context;
     
     return `Analyze the following options market data for ${context.ticker}:

**Current Metrics:**
- Current IV: ${snapshotMetrics.iv.toFixed(1)}%
- IV Percentile (20d): ${snapshotMetrics.ivPercentile.toFixed(0)}%
- Regime: ${snapshotMetrics.regimeType}
- Skew (25-75 delta): ${snapshotMetrics.skew.toFixed(1)} points

**Probability Distribution (4 weeks):**
- Mean: $${projectionData.mean.toFixed(2)}
- Std Dev: $${projectionData.std.toFixed(2)}
- Key Levels: ${projectionData.keyLevels.map(l => `$${l.price.toFixed(2)} (${(l.probability * 100).toFixed(0)}%)`).join(', ')}

Generate trading analysis following the output format.`;
   }
   
   function parseClaudeResponse(content: string, context: OptionAnalysisContext): AIOptionsForecast {
     // Extract JSON from response (handle markdown code blocks)
     const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
     if (!jsonMatch) {
       throw new Error('No valid JSON found in Claude response');
     }
     
     const analysis = JSON.parse(jsonMatch[1]);
     analysis.snapshotDate = context.date;
     
     return analysis;
   }
   
   function validateAnalysis(analysis: AIOptionsForecast, context: OptionAnalysisContext) {
     const currentPrice = context.projectionData.mean;
     const maxDeviation = currentPrice * 0.2; // ±20%
     
     // Validate price targets
     if (Math.abs(analysis.priceTargets.base - currentPrice) > maxDeviation) {
       throw new Error(`Base target $${analysis.priceTargets.base} too far from current $${currentPrice}`);
     }
     
     // Validate confidence scores
     if (analysis.priceTargets.confidence < 0 || analysis.priceTargets.confidence > 1) {
       throw new Error(`Invalid price target confidence: ${analysis.priceTargets.confidence}`);
     }
     
     if (analysis.confidence.overall < 0 || analysis.confidence.overall > 1) {
       throw new Error(`Invalid overall confidence: ${analysis.confidence.overall}`);
     }
   }
   
   function isCacheFresh(createdAt: string): boolean {
     const cacheAge = Date.now() - new Date(createdAt).getTime();
     const fourHours = 4 * 60 * 60 * 1000;
     return cacheAge < fourHours;
   }
   
   function parseForecastFromDB(row: any): AIOptionsForecast {
     return {
       summary: row.summary,
       outlook: row.outlook,
       priceTargets: {
         conservative: row.pt_conservative,
         base: row.pt_base,
         aggressive: row.pt_aggressive,
         confidence: row.pt_confidence,
       },
       regimeAnalysis: {
         classification: row.regime_classification,
         justification: row.regime_justification,
         recommendation: row.regime_recommendation,
       },
       tradingLevels: {
         keySupport: row.key_support,
         keyResistance: row.key_resistance,
         profitTargets: JSON.parse(row.profit_targets),
         stopLoss: row.stop_loss,
       },
       confidence: {
         overall: row.overall_confidence,
         reasoning: row.confidence_reasoning,
       },
       snapshotDate: row.snapshot_date,
     };
   }
   ```

3. **Add API key to `.env.local`:**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

4. **Test with sample data:**
   ```typescript
   // __tests__/lib/aiOptionsForecast.test.ts
   
   import { generateAIAnalysis } from '../../lib/aiOptionsForecast';
   
   describe('generateAIAnalysis', () => {
     it('should generate valid forecast', async () => {
       const context = {
         ticker: 'SPWX',
         date: '2026-03-09',
         snapshotMetrics: {
           iv: 45,
           ivPercentile: 78,
           delta: [0.25, 0.50, 0.75],
           gamma: [0.02, 0.03, 0.02],
           vega: [0.10, 0.12, 0.10],
           theta: [-0.06, -0.08, -0.06],
           skew: 8,
           regimeType: 'elevated' as const,
         },
         projectionData: {
           mean: 205,
           std: 10,
           probDistribution: {},
           keyLevels: [
             { price: 198, probability: 0.25 },
             { price: 205, probability: 0.50 },
             { price: 212, probability: 0.75 },
           ],
         },
       };
       
       const result = await generateAIAnalysis(context);
       
       expect(result.summary).toBeTruthy();
       expect(result.priceTargets.base).toBeGreaterThan(0);
       expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
       expect(result.confidence.overall).toBeLessThanOrEqual(1);
     }, 15000);
   });
   ```

**Acceptance Criteria:**
- ✅ Claude API returns valid JSON
- ✅ Response parsed successfully
- ✅ Validation catches invalid price targets
- ✅ Cache retrieval works
- ✅ Test passes

---

## Phase 2: API Endpoint (Day 2)

### Task 2.1: Create API Route

**Estimated Time:** 2 hours  
**Files:**
- `app/api/options/ai-forecast/route.ts` (NEW)

**Steps:**

1. **Create API endpoint:**
   ```typescript
   // app/api/options/ai-forecast/route.ts
   
   import { NextRequest, NextResponse } from 'next/server';
   import { generateAIAnalysis } from '@/lib/aiOptionsForecast';
   import { getOptionSnapshot, getOptionProjection } from '@/lib/db';
   import type { OptionAnalysisContext } from '@/lib/types/aiOptionsForecast';
   
   export async function POST(request: NextRequest) {
     try {
       const { ticker, date, regenerate = false } = await request.json();
       
       // Validate inputs
       if (!ticker || !date) {
         return NextResponse.json(
           { success: false, error: 'Missing ticker or date' },
           { status: 400 }
         );
       }
       
       // Fetch snapshot and projection
       const snapshot = getOptionSnapshot(ticker, date);
       const projection = getOptionProjection(ticker, date);
       
       if (!snapshot || !projection) {
         return NextResponse.json(
           { success: false, error: `No data available for ${ticker} on ${date}` },
           { status: 400 }
         );
       }
       
       // Build analysis context
       const context: OptionAnalysisContext = {
         ticker,
         date,
         snapshotMetrics: {
           iv: snapshot.iv,
           ivPercentile: snapshot.iv_percentile,
           delta: JSON.parse(snapshot.greeks_delta),
           gamma: JSON.parse(snapshot.greeks_gamma),
           vega: JSON.parse(snapshot.greeks_vega),
           theta: JSON.parse(snapshot.greeks_theta),
           skew: snapshot.skew,
           regimeType: snapshot.regime_type,
         },
         projectionData: {
           mean: projection.mean,
           std: projection.std,
           probDistribution: JSON.parse(projection.prob_distribution),
           keyLevels: JSON.parse(projection.key_levels),
         },
       };
       
       // Generate analysis (with caching unless regenerate=true)
       const analysis = await generateAIAnalysis(context, !regenerate);
       
       // Calculate cache metadata
       const cached = getAIForecast(ticker, date);
       const cacheAge = cached
         ? Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000)
         : 0;
       
       return NextResponse.json({
         success: true,
         analysis,
         cached: !regenerate && cacheAge > 0,
         cacheAge,
         nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
       });
       
     } catch (error) {
       console.error('AI forecast API error:', error);
       
       return NextResponse.json(
         {
           success: false,
           error: error instanceof Error ? error.message : 'Internal server error',
         },
         { status: 500 }
       );
     }
   }
   ```

2. **Test endpoint locally:**
   ```bash
   curl -X POST http://localhost:3002/api/options/ai-forecast \
     -H "Content-Type: application/json" \
     -d '{"ticker":"SPWX","date":"2026-03-09"}'
   ```

**Acceptance Criteria:**
- ✅ Endpoint returns 200 with valid analysis
- ✅ Cached requests return quickly (<100ms)
- ✅ Fresh requests complete within 10s
- ✅ Error handling works (invalid ticker, missing data)

---

### Task 2.2: API Unit Tests

**Estimated Time:** 1 hour  
**Files:**
- `__tests__/api/options/ai-forecast.test.ts` (NEW)

**Steps:**

1. **Write API tests:**
   ```typescript
   import { POST } from '@/app/api/options/ai-forecast/route';
   import { NextRequest } from 'next/server';
   
   describe('POST /api/options/ai-forecast', () => {
     it('returns cached forecast when available', async () => {
       const request = new NextRequest('http://localhost:3002/api/options/ai-forecast', {
         method: 'POST',
         body: JSON.stringify({ ticker: 'SPWX', date: '2026-03-09' }),
       });
       
       const response = await POST(request);
       const data = await response.json();
       
       expect(response.status).toBe(200);
       expect(data.success).toBe(true);
       expect(data.analysis).toBeDefined();
     });
     
     it('returns 400 for missing snapshot', async () => {
       const request = new NextRequest('http://localhost:3002/api/options/ai-forecast', {
         method: 'POST',
         body: JSON.stringify({ ticker: 'INVALID', date: '2026-03-09' }),
       });
       
       const response = await POST(request);
       const data = await response.json();
       
       expect(response.status).toBe(400);
       expect(data.error).toContain('No data available');
     });
   });
   ```

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Coverage >80% for API route

---

## Phase 3: Frontend Components (Days 3-4)

### Task 3.1: AI Forecast Section Component

**Estimated Time:** 3 hours  
**Files:**
- `app/components/options/AIOptionsForecastSection.tsx` (NEW)
- `app/components/options/AIOptionsForecastSection.module.css` (NEW)

**Steps:**

1. **Create component:**
   ```typescript
   // app/components/options/AIOptionsForecastSection.tsx
   
   import type { AIOptionsForecast } from '@/lib/types/aiOptionsForecast';
   import styles from './AIOptionsForecastSection.module.css';
   
   interface Props {
     analysis: AIOptionsForecast;
     loading?: boolean;
     error?: string;
   }
   
   export default function AIOptionsForecastSection({ analysis, loading, error }: Props) {
     if (loading) {
       return (
         <div className={styles.container} data-testid="ai-forecast-section">
           <div className={styles.loading}>Generating AI analysis...</div>
         </div>
       );
     }
     
     if (error) {
       return (
         <div className={styles.container} data-testid="ai-forecast-section">
           <div className={styles.error}>⚠️ {error}</div>
         </div>
       );
     }
     
     return (
       <div className={styles.container} data-testid="ai-forecast-section">
         <h2 className={styles.title}>AI-Powered Forecast</h2>
         
         {/* Executive Summary */}
         <div className={styles.summary}>
           <p>{analysis.summary}</p>
           <span className={styles.outlookBadge} data-outlook={analysis.outlook}>
             {analysis.outlook.toUpperCase()}
           </span>
         </div>
         
         {/* Price Targets */}
         <div className={styles.priceTargets}>
           <h3>Price Targets (4 Weeks)</h3>
           <div className={styles.targetGrid}>
             <div className={styles.target}>
               <span className={styles.label}>Conservative (25th %ile)</span>
               <span className={styles.value} data-testid="price-target-conservative">
                 ${analysis.priceTargets.conservative.toFixed(2)}
               </span>
             </div>
             <div className={styles.target}>
               <span className={styles.label}>Base Case (50th %ile)</span>
               <span className={styles.value} data-testid="price-target-base">
                 ${analysis.priceTargets.base.toFixed(2)}
               </span>
             </div>
             <div className={styles.target}>
               <span className={styles.label}>Aggressive (75th %ile)</span>
               <span className={styles.value} data-testid="price-target-aggressive">
                 ${analysis.priceTargets.aggressive.toFixed(2)}
               </span>
             </div>
           </div>
           <div className={styles.confidenceBar}>
             <div
               className={styles.confidenceFill}
               style={{ width: `${analysis.priceTargets.confidence * 100}%` }}
             />
             <span className={styles.confidenceLabel}>
               {(analysis.priceTargets.confidence * 100).toFixed(0)}% confidence
             </span>
           </div>
         </div>
         
         {/* Regime Analysis */}
         <div className={styles.regime}>
           <h3>Volatility Regime</h3>
           <div className={styles.regimeBadge} data-regime={analysis.regimeAnalysis.classification} data-testid="regime-badge">
             {analysis.regimeAnalysis.classification.toUpperCase()}
           </div>
           <p className={styles.justification}>{analysis.regimeAnalysis.justification}</p>
           <p className={styles.recommendation}>
             <strong>Recommendation:</strong> {analysis.regimeAnalysis.recommendation}
           </p>
         </div>
         
         {/* Trading Levels */}
         <div className={styles.tradingLevels}>
           <h3>Key Trading Levels</h3>
           <div className={styles.levelGrid}>
             <div className={styles.level}>
               <span className={styles.label}>Support</span>
               <span className={styles.value}>${analysis.tradingLevels.keySupport.toFixed(2)}</span>
             </div>
             <div className={styles.level}>
               <span className={styles.label}>Resistance</span>
               <span className={styles.value}>${analysis.tradingLevels.keyResistance.toFixed(2)}</span>
             </div>
             <div className={styles.level}>
               <span className={styles.label}>Stop Loss</span>
               <span className={styles.value}>${analysis.tradingLevels.stopLoss.toFixed(2)}</span>
             </div>
           </div>
           <div className={styles.profitTargets}>
             <strong>Profit Targets:</strong>{' '}
             {analysis.tradingLevels.profitTargets.map((pt, i) => (
               <span key={i} className={styles.profitTarget}>${pt.toFixed(2)}</span>
             ))}
           </div>
         </div>
         
         {/* Confidence */}
         <div className={styles.confidence} data-testid="confidence-badge">
           <strong>Overall Confidence:</strong>{' '}
           <span className={styles.confidenceScore}>
             {(analysis.confidence.overall * 100).toFixed(0)}%
           </span>
           <p className={styles.reasoning}>{analysis.confidence.reasoning}</p>
         </div>
       </div>
     );
   }
   ```

2. **Create CSS module:**
   ```css
   /* app/components/options/AIOptionsForecastSection.module.css */
   
   .container {
     background: white;
     border-radius: 8px;
     padding: 24px;
     margin: 24px 0;
     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
   }
   
   .title {
     font-size: 24px;
     margin-bottom: 16px;
   }
   
   .summary {
     background: #f8f9fa;
     padding: 16px;
     border-radius: 4px;
     margin-bottom: 24px;
     display: flex;
     justify-content: space-between;
     align-items: center;
   }
   
   .outlookBadge {
     padding: 4px 12px;
     border-radius: 4px;
     font-weight: bold;
     font-size: 12px;
   }
   
   .outlookBadge[data-outlook="bullish"] {
     background: #d4edda;
     color: #155724;
   }
   
   .outlookBadge[data-outlook="neutral"] {
     background: #fff3cd;
     color: #856404;
   }
   
   .outlookBadge[data-outlook="bearish"] {
     background: #f8d7da;
     color: #721c24;
   }
   
   .priceTargets, .regime, .tradingLevels {
     margin-bottom: 24px;
   }
   
   .targetGrid, .levelGrid {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: 16px;
     margin-top: 12px;
   }
   
   .target, .level {
     text-align: center;
     padding: 12px;
     background: #f8f9fa;
     border-radius: 4px;
   }
   
   .label {
     display: block;
     font-size: 12px;
     color: #6c757d;
     margin-bottom: 8px;
   }
   
   .value {
     display: block;
     font-size: 20px;
     font-weight: bold;
   }
   
   .confidenceBar {
     margin-top: 12px;
     height: 24px;
     background: #e9ecef;
     border-radius: 4px;
     position: relative;
     overflow: hidden;
   }
   
   .confidenceFill {
     height: 100%;
     background: linear-gradient(to right, #28a745, #20c997);
     transition: width 0.3s ease;
   }
   
   .confidenceLabel {
     position: absolute;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
     font-size: 12px;
     font-weight: bold;
     color: #212529;
   }
   
   .regimeBadge {
     display: inline-block;
     padding: 8px 16px;
     border-radius: 4px;
     font-weight: bold;
     margin-bottom: 12px;
   }
   
   .regimeBadge[data-regime="elevated"] {
     background: #f8d7da;
     color: #721c24;
   }
   
   .regimeBadge[data-regime="normal"] {
     background: #d1ecf1;
     color: #0c5460;
   }
   
   .regimeBadge[data-regime="depressed"] {
     background: #d4edda;
     color: #155724;
   }
   
   .profitTargets {
     margin-top: 12px;
   }
   
   .profitTarget {
     display: inline-block;
     margin-right: 8px;
     padding: 4px 8px;
     background: #e7f3ff;
     border-radius: 4px;
     font-weight: bold;
   }
   
   .confidence {
     background: #f8f9fa;
     padding: 16px;
     border-radius: 4px;
   }
   
   .confidenceScore {
     font-size: 18px;
     font-weight: bold;
     color: #28a745;
   }
   
   .reasoning {
     margin-top: 8px;
     color: #6c757d;
     font-size: 14px;
   }
   
   .loading, .error {
     text-align: center;
     padding: 48px;
     font-size: 16px;
   }
   
   .error {
     color: #721c24;
     background: #f8d7da;
   }
   ```

**Acceptance Criteria:**
- ✅ Component renders without errors
- ✅ All sections displayed (summary, targets, regime, levels)
- ✅ Styling matches design specs
- ✅ Mobile responsive

---

### Task 3.2: Regime Change Alert Component

**Estimated Time:** 1.5 hours  
**Files:**
- `app/components/options/RegimeChangeAlert.tsx` (NEW)

**Steps:**

1. **Create component:**
   ```typescript
   // app/components/options/RegimeChangeAlert.tsx
   
   'use client';
   
   import { useState, useEffect } from 'react';
   import styles from './RegimeChangeAlert.module.css';
   
   interface Props {
     regimeChange: {
       from: 'elevated' | 'normal' | 'depressed';
       to: 'elevated' | 'normal' | 'depressed';
       severity: number;
       timestamp: string;
     };
     onDismiss?: () => void;
   }
   
   export default function RegimeChangeAlert({ regimeChange, onDismiss }: Props) {
     const [dismissed, setDismissed] = useState(false);
     
     useEffect(() => {
       // Check if already dismissed (localStorage)
       const key = `regime-alert-${regimeChange.timestamp}`;
       if (localStorage.getItem(key) === 'dismissed') {
         setDismissed(true);
       }
     }, [regimeChange.timestamp]);
     
     const handleDismiss = () => {
       const key = `regime-alert-${regimeChange.timestamp}`;
       localStorage.setItem(key, 'dismissed');
       setDismissed(true);
       onDismiss?.();
     };
     
     if (dismissed) return null;
     
     return (
       <div className={styles.alert} data-testid="regime-change-alert" data-severity={regimeChange.severity > 0.7 ? 'high' : 'medium'}>
         <div className={styles.icon}>⚠️</div>
         <div className={styles.content}>
           <strong>Volatility Regime Change Detected</strong>
           <p>
             {regimeChange.from.toUpperCase()} → {regimeChange.to.toUpperCase()}
           </p>
           <span className={styles.timestamp}>
             {new Date(regimeChange.timestamp).toLocaleString()}
           </span>
         </div>
         <button className={styles.dismissBtn} onClick={handleDismiss}>
           ✕
         </button>
       </div>
     );
   }
   ```

2. **Create CSS:**
   ```css
   /* app/components/options/RegimeChangeAlert.module.css */
   
   .alert {
     display: flex;
     align-items: center;
     padding: 16px;
     border-radius: 8px;
     margin-bottom: 24px;
     animation: slideDown 0.3s ease;
   }
   
   .alert[data-severity="high"] {
     background: #f8d7da;
     border-left: 4px solid #721c24;
   }
   
   .alert[data-severity="medium"] {
     background: #fff3cd;
     border-left: 4px solid #856404;
   }
   
   @keyframes slideDown {
     from {
       opacity: 0;
       transform: translateY(-20px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }
   
   .icon {
     font-size: 32px;
     margin-right: 16px;
   }
   
   .content {
     flex: 1;
   }
   
   .content strong {
     display: block;
     margin-bottom: 4px;
   }
   
   .timestamp {
     font-size: 12px;
     color: #6c757d;
   }
   
   .dismissBtn {
     background: none;
     border: none;
     font-size: 24px;
     cursor: pointer;
     padding: 4px 8px;
   }
   ```

**Acceptance Criteria:**
- ✅ Alert displays on regime change
- ✅ Dismissible with localStorage persistence
- ✅ Animation on first view

---

### Task 3.3: Integrate into Report Page

**Estimated Time:** 2 hours  
**Files:**
- `app/reports/option-projection/page.tsx` (ENHANCED)

**Steps:**

1. **Add AI forecast fetch logic:**
   ```typescript
   // app/reports/option-projection/page.tsx
   
   import AIOptionsForecastSection from '@/app/components/options/AIOptionsForecastSection';
   import RegimeChangeAlert from '@/app/components/options/RegimeChangeAlert';
   
   export default async function OptionProjectionReport({
     searchParams,
   }: {
     searchParams: { ticker?: string; date?: string };
   }) {
     const ticker = searchParams.ticker || 'SPWX';
     const date = searchParams.date || new Date().toISOString().split('T')[0];
     
     // Existing: fetch snapshot + projection
     const snapshot = await getOptionSnapshot(ticker, date);
     const projection = await getOptionProjection(ticker, date);
     
     // NEW: fetch AI forecast
     let aiForecast = null;
     let aiError = null;
     
     try {
       const response = await fetch(`http://localhost:3002/api/options/ai-forecast`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ ticker, date }),
       });
       
       const data = await response.json();
       if (data.success) {
         aiForecast = data.analysis;
       } else {
         aiError = data.error;
       }
     } catch (error) {
       console.error('Failed to fetch AI forecast:', error);
       aiError = 'AI forecast unavailable';
     }
     
     // Detect regime change
     const regimeChange = detectRegimeChange(ticker, date);
     
     return (
       <div className="container">
         <h1>Option Projection Report: {ticker}</h1>
         
         {/* Regime change alert */}
         {regimeChange && <RegimeChangeAlert regimeChange={regimeChange} />}
         
         {/* Existing: snapshot metrics */}
         <SnapshotMetrics snapshot={snapshot} />
         
         {/* Existing: projection charts */}
         <ProjectionCharts projection={projection} />
         
         {/* NEW: AI forecast section */}
         {aiForecast && <AIOptionsForecastSection analysis={aiForecast} />}
         {aiError && <AIOptionsForecastSection error={aiError} />}
       </div>
     );
   }
   
   function detectRegimeChange(ticker: string, date: string) {
     // Query DB for previous day's regime
     const today = getAIForecast(ticker, date);
     const yesterday = getAIForecast(ticker, getPreviousDate(date));
     
     if (!today || !yesterday) return null;
     
     if (today.regime_classification !== yesterday.regime_classification) {
       return {
         from: yesterday.regime_classification,
         to: today.regime_classification,
         severity: Math.abs(today.overall_confidence - yesterday.overall_confidence),
         timestamp: today.created_at,
       };
     }
     
     return null;
   }
   ```

**Acceptance Criteria:**
- ✅ AI section appears below projection charts
- ✅ Regime alert shows when regime changed
- ✅ Error handling graceful (shows warning if AI unavailable)

---

## Phase 4: Testing & QA (Days 5-6)

### Task 4.1: E2E Tests

**Estimated Time:** 2 hours  
**Files:**
- `e2e/option-projection-ai.spec.ts` (NEW)

**Steps:**

1. **Write E2E test:**
   ```typescript
   // e2e/option-projection-ai.spec.ts
   
   import { test, expect } from '@playwright/test';
   
   test('displays AI forecast section on report page', async ({ page }) => {
     await page.goto('http://localhost:3002/reports/option-projection?ticker=SPWX');
     
     // Wait for AI section
     await expect(page.locator('[data-testid="ai-forecast-section"]')).toBeVisible();
     
     // Verify price targets
     await expect(page.locator('[data-testid="price-target-base"]')).toContainText('$');
     
     // Verify confidence badge
     await expect(page.locator('[data-testid="confidence-badge"]')).toBeVisible();
     
     // Verify regime badge
     const regimeBadge = page.locator('[data-testid="regime-badge"]');
     await expect(regimeBadge).toHaveText(/ELEVATED|NORMAL|DEPRESSED/);
   });
   
   test('displays regime change alert when detected', async ({ page }) => {
     // TODO: Seed DB with regime change
     await page.goto('http://localhost:3002/reports/option-projection?ticker=SPWX');
     
     const alert = page.locator('[data-testid="regime-change-alert"]');
     if (await alert.isVisible()) {
       await expect(alert).toContainText('Volatility Regime Change');
     }
   });
   ```

2. **Run tests:**
   ```bash
   npm run test:e2e
   ```

**Acceptance Criteria:**
- ✅ All E2E tests pass
- ✅ Report page loads within 3 seconds

---

### Task 4.2: Manual QA Checklist

**Estimated Time:** 1 hour

**Checklist:**
- [ ] Load report page → AI section appears
- [ ] Price targets displayed (conservative, base, aggressive)
- [ ] Confidence score shown and valid (0-100%)
- [ ] Regime badge color-coded correctly
- [ ] Trading levels all valid numbers
- [ ] Regime change alert appears (if applicable)
- [ ] Dismiss alert → doesn't reappear on refresh
- [ ] Mobile responsive (test on iPhone/Android)
- [ ] Error handling: disable Claude API → shows cached forecast + warning

---

## Phase 5: Documentation & Launch (Days 7-8)

### Task 5.1: Backfill AI Forecasts

**Estimated Time:** 2 hours  
**Files:**
- `scripts/backfill-ai-forecasts.ts` (NEW)

**Steps:**

1. **Create backfill script:**
   ```typescript
   // scripts/backfill-ai-forecasts.ts
   
   import { generateAIAnalysis } from '../lib/aiOptionsForecast';
   import { getOptionSnapshot, getOptionProjection } from '../lib/db';
   
   async function backfillAIForecasts() {
     const ticker = 'SPWX';
     const today = new Date();
     
     for (let i = 0; i < 30; i++) {
       const date = new Date(today);
       date.setDate(today.getDate() - i);
       const dateStr = date.toISOString().split('T')[0];
       
       console.log(`Generating forecast for ${ticker} on ${dateStr}...`);
       
       const snapshot = getOptionSnapshot(ticker, dateStr);
       const projection = getOptionProjection(ticker, dateStr);
       
       if (!snapshot || !projection) {
         console.warn(`  Skipping ${dateStr} — no data`);
         continue;
       }
       
       const context = buildContext(ticker, dateStr, snapshot, projection);
       
       try {
         await generateAIAnalysis(context, false); // Force fresh generation
         console.log(`  ✅ Success`);
       } catch (error) {
         console.error(`  ❌ Error:`, error);
       }
       
       // Rate limit: 1 request per 2 seconds
       await new Promise(resolve => setTimeout(resolve, 2000));
     }
     
     console.log('Backfill complete!');
   }
   
   backfillAIForecasts();
   ```

2. **Run backfill:**
   ```bash
   npx tsx scripts/backfill-ai-forecasts.ts
   ```

**Acceptance Criteria:**
- ✅ 30 days of forecasts generated
- ✅ All forecasts saved to DB
- ✅ No errors during backfill

---

### Task 5.2: Update Documentation

**Estimated Time:** 1.5 hours  
**Files:**
- `README.md` (ENHANCED)
- `DEV.md` (ENHANCED)

**Steps:**

1. **Update README.md:**
   ```markdown
   ## Features
   
   ### AI-Powered Options Forecast (NEW)
   
   Intelligent analysis of option price projections using Claude AI.
   
   **Capabilities:**
   - Executive summary and market outlook (bullish/neutral/bearish)
   - Probability-weighted price targets (conservative, base, aggressive)
   - Volatility regime classification (elevated/normal/depressed)
   - Smart trading levels (support, resistance, profit targets, stop loss)
   - Confidence scores and reasoning
   
   **Usage:**
   
   View AI analysis on the Option Projection Report:
   ```
   http://localhost:3002/reports/option-projection?ticker=SPWX
   ```
   
   **API Endpoint:**
   
   ```bash
   curl -X POST http://localhost:3002/api/options/ai-forecast \
     -H "Content-Type: application/json" \
     -d '{"ticker":"SPWX","date":"2026-03-09","regenerate":false}'
   ```
   
   **Environment Variables:**
   
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
   ```

2. **Update DEV.md:**
   ```markdown
   ## How to Regenerate AI Forecasts
   
   ### Daily Backfill (Automated)
   
   AI forecasts are generated daily at 16:00 UTC via cron job.
   
   ### Manual Regeneration
   
   **Single Forecast:**
   ```bash
   curl -X POST http://localhost:3002/api/options/ai-forecast \
     -H "Content-Type: application/json" \
     -d '{"ticker":"SPWX","date":"2026-03-09","regenerate":true}'
   ```
   
   **Backfill 30 Days:**
   ```bash
   npx tsx scripts/backfill-ai-forecasts.ts
   ```
   
   ### Troubleshooting
   
   **Claude API Errors:**
   - Check `ANTHROPIC_API_KEY` is set in `.env.local`
   - Verify API quota not exceeded (check Anthropic dashboard)
   - Fallback: cached forecasts served automatically
   
   **Invalid Analysis:**
   - Run validation: `npm run test __tests__/lib/aiOptionsForecast.test.ts`
   - Check logs for Claude response parsing errors
   - Adjust system prompt if needed (see `lib/aiOptionsForecast.ts`)
   ```

**Acceptance Criteria:**
- ✅ README describes feature clearly
- ✅ DEV.md has regeneration instructions
- ✅ Environment variables documented

---

### Task 5.3: Final Validation & Deploy

**Estimated Time:** 2 hours

**Checklist:**

**Pre-Deploy:**
- [ ] All unit tests passing (`npm test`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] Manual QA complete (see Task 4.2)
- [ ] 30 days of forecasts backfilled
- [ ] Documentation updated (README, DEV.md)
- [ ] Code reviewed (self-review or peer review)

**Deploy to Staging:**
- [ ] Merge feature branch to `develop`
- [ ] Deploy to staging environment (port 3002)
- [ ] Smoke test: visit `/reports/option-projection` → AI section loads
- [ ] Test API endpoint manually
- [ ] Check logs for errors

**Deploy to Production:**
- [ ] Merge `develop` to `main`
- [ ] Deploy to production
- [ ] Verify AI forecasts generating correctly
- [ ] Monitor error rates (target: <0.5%)
- [ ] Monitor Claude API costs (target: <$5/month)

**Post-Deploy:**
- [ ] Announce feature in team channel
- [ ] Update project board (move tasks to "Done")
- [ ] Schedule retro meeting

---

## Success Metrics (Track Post-Launch)

**Week 1:**
- [ ] AI forecast generation success rate >95%
- [ ] Cache hit rate >80%
- [ ] API response time p95 <3s
- [ ] No critical errors

**Week 2:**
- [ ] User engagement: >50% of report page viewers interact with AI section
- [ ] Forecast accuracy validation started (4-week lag)
- [ ] Claude API cost within budget (<$5/month)

**Month 1:**
- [ ] Forecast accuracy: >70% within 1-sigma range (backtest 30 forecasts)
- [ ] User feedback: >4/5 stars (in-app survey)
- [ ] Feature adoption: >50% of active users view AI section

---

## Risk Mitigation

**Risk:** Claude API down during critical hours  
**Mitigation:** Cached forecasts served automatically + warning banner

**Risk:** Invalid AI responses (hallucination)  
**Mitigation:** Validation layer catches out-of-bounds targets; tests verify schema

**Risk:** Performance degradation  
**Mitigation:** Aggressive caching (4h), async generation in background

**Risk:** Cost overruns  
**Mitigation:** Track spend daily; alert if >$10/month; consider batching or model downgrade

---

## Appendix: Useful Commands

**Run Full Test Suite:**
```bash
npm test && npm run test:e2e
```

**Generate Fresh Forecast:**
```bash
curl -X POST http://localhost:3002/api/options/ai-forecast \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPWX","date":"2026-03-09","regenerate":true}'
```

**Check Database:**
```bash
sqlite3 data/dev.db "SELECT ticker, date, summary FROM ai_forecasts ORDER BY created_at DESC LIMIT 5;"
```

**Monitor Claude API Costs:**
```bash
# Visit: https://console.anthropic.com/settings/billing
```

---

**Ready to implement! Assign tasks and get started.**
