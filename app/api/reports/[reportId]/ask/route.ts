import { NextRequest, NextResponse } from 'next/server';
import { getReportByDate, insertQuestionLog, type ReportPeriod } from '@/lib/db';
import { callClaudeForReportQA } from '@/lib/ai/report-qa-client';
import type { DailyReport } from '@/scripts/generate-report';

function parseReportId(reportId: string): { date: string; period?: ReportPeriod } | null {
  // Format: "2026-03-14-morning" or "2026-03-14"
  const match = reportId.match(/^(\d{4}-\d{2}-\d{2})(?:-(morning|midday|eod))?$/);
  if (!match) return null;

  return {
    date: match[1],
    period: match[2] as ReportPeriod | undefined,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await context.params;
    const body = (await request.json()) as { question?: string };

    // Validate reportId format
    const parsed = parseReportId(reportId);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid reportId format. Expected: YYYY-MM-DD or YYYY-MM-DD-period' },
        { status: 400 }
      );
    }

    // Validate question
    const { question } = body;
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      );
    }

    if (question.trim().length < 1) {
      return NextResponse.json(
        { error: 'Question cannot be empty' },
        { status: 400 }
      );
    }

    if (question.length > 500) {
      return NextResponse.json(
        { error: 'Question too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Fetch report from database
    const reportRow = getReportByDate(parsed.date, parsed.period);
    if (!reportRow) {
      return NextResponse.json(
        { error: 'Report not found for the specified date and period' },
        { status: 404 }
      );
    }

    // Reconstruct DailyReport object
    const report: DailyReport = {
      date: reportRow.date,
      generatedAt: new Date(reportRow.generated_at * 1000).toISOString(),
      marketData: JSON.parse(reportRow.ticker_data),
      analysis: JSON.parse(reportRow.report_json),
    };

    // Call Claude API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let result;
    try {
      result = await callClaudeForReportQA(question.trim(), report, reportRow.period);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout - API took too long to respond' },
          { status: 502 }
        );
      }
      throw error;
    }
    clearTimeout(timeoutId);

    // Log to database
    insertQuestionLog(
      reportId,
      question.trim(),
      result.answer,
      result.tokensUsed.input,
      result.tokensUsed.output
    );

    // Return response
    return NextResponse.json({
      answer: result.answer,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    console.error('[Report Q&A API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
