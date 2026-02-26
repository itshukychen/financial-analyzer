import { NextResponse } from 'next/server';
import { getReportByDate } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;

  // Validate YYYY-MM-DD format to prevent path traversal
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  const row = getReportByDate(date);
  if (!row) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({
    id:          row.id,
    date:        row.date,
    generatedAt: row.generated_at,
    model:       row.model,
    marketData:  JSON.parse(row.ticker_data),
    analysis:    JSON.parse(row.report_json),
  });
}
