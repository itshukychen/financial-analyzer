import { NextResponse } from 'next/server';
import { getLatestReport } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const row = getLatestReport();
  if (!row) return NextResponse.json({ error: 'No report available yet' }, { status: 404 });
  return NextResponse.json({
    id:          row.id,
    date:        row.date,
    generatedAt: row.generated_at,
    model:       row.model,
    marketData:  JSON.parse(row.ticker_data),
    analysis:    JSON.parse(row.report_json),
  });
}
