import { NextRequest, NextResponse } from 'next/server';
import { fetchAllMarketData, buildPrompt, callClaude } from '../../../../scripts/generate-report';
import { insertOrReplaceReport, getLatestReport } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth check
  const auth   = req.headers.get('authorization') ?? '';
  const secret = process.env.REPORT_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const marketData = await fetchAllMarketData();
    const today      = marketData.spx.points[marketData.spx.points.length - 1].time;
    const prompt     = buildPrompt(marketData, today);
    const analysis   = await callClaude(prompt);

    insertOrReplaceReport(today, marketData, analysis, 'claude-sonnet-4-5');

    const saved = getLatestReport();
    return NextResponse.json({ success: true, date: today, id: saved?.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
