// types/chat.ts

export interface ChatMessage {
  id: string;                   // UUID
  role: 'user' | 'assistant';
  content: string;              // Message text (markdown for assistant)
  timestamp: string;            // ISO 8601
}

export interface ChatRequest {
  message: string;              // User's question (1-2000 chars)
  reportDate: string;           // "YYYY-MM-DD"
  reportPeriod: 'eod' | 'morning' | 'midday';
  conversationHistory: ChatMessage[];
  contextData: {
    marketData: any;            // MarketData from report
    analysis: any;              // Analysis from report
  };
}

export interface ChatResponse {
  id: string;                   // Message UUID
  role: 'assistant';
  content: string;              // AI response (markdown)
  timestamp: string;            // ISO 8601
  tokensUsed: {
    input: number;
    output: number;
  };
}

export interface ChatError {
  error: string;                // Error code
  message: string;              // User-friendly message
  retryAfter?: number;          // Seconds to wait (429 only)
}
