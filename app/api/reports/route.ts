import { NextResponse } from 'next/server';
import { listReports } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = listReports();
  return NextResponse.json(rows);
}
