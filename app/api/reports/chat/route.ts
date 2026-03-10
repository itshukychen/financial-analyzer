// app/api/reports/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimiter } from '../../../lib/rate-limiter';
import { validateChatRequest, buildContextMessages, getAIResponse } from '../../../lib/chat-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse request body
    const body = await request.json();
    
    // 2. Validate input
    const validation = validateChatRequest(body);
    
    if (!validation.valid) {
      console.warn('[Chat API] Validation failed:', validation.error);
      return NextResponse.json(
        { error: 'validation_failed', message: validation.error! },
        { status: 400 }
      );
    }

    const { message, reportDate, reportPeriod, conversationHistory, contextData } = validation.data!;

    // 3. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const sessionId = request.headers.get('x-session-id') || uuidv4();

    const rateLimit = rateLimiter.checkLimit(sessionId, ip);
    if (!rateLimit.allowed) {
      console.warn('[Chat API] Rate limited:', { sessionId: sessionId.substring(0, 8), ip: ip.substring(0, 8) });
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: `Too many requests. Please wait ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
    }

    // 4. Log request
    console.log('[Chat API Request]', {
      timestamp: new Date().toISOString(),
      reportDate,
      reportPeriod,
      messageLength: message.length,
      conversationLength: conversationHistory.length,
      sessionId: sessionId.substring(0, 8) + '***',
      ip: ip.substring(0, 8) + '***'
    });

    // 5. Build context and call AI
    const messages = buildContextMessages(
      reportDate,
      reportPeriod,
      contextData,
      conversationHistory,
      message
    );

    const aiResponse = await getAIResponse(messages);

    // 6. Log response
    const latency = Date.now() - startTime;
    console.log('[Chat API Response]', {
      timestamp: new Date().toISOString(),
      latency,
      tokensUsed: aiResponse.tokensUsed,
      responseLength: aiResponse.content.length
    });

    // 7. Return response
    return NextResponse.json({
      id: uuidv4(),
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      tokensUsed: aiResponse.tokensUsed
    });

  } catch (error: any) {
    console.error('[Chat API Error]', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });

    // Handle specific Anthropic errors
    if (error.status === 429) {
      return NextResponse.json(
        {
          error: 'api_rate_limited',
          message: 'AI service is temporarily overwhelmed. Please try again in a minute.',
          retryAfter: 60
        },
        { status: 429 }
      );
    }

    if (error.status === 503 || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'service_unavailable',
          message: 'AI service is temporarily unavailable. Please try again later.'
        },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Something went wrong. Please try again.'
      },
      { status: 500 }
    );
  }
}
