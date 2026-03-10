// app/lib/chat-helpers.ts
import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, ChatMessage } from '../../types/chat';

// Lazy initialization to avoid issues in test environment
let anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

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
  
  const client = getAnthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
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
