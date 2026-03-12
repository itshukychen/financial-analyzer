import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface HealthResponse {
  ok: boolean;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json({ ok: true });
}
