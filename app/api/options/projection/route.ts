import { NextRequest, NextResponse } from 'next/server';
import {
  getOptionProjection,
  getLatestOptionSnapshot,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'SPWX';
  const horizonDays = parseInt(req.nextUrl.searchParams.get('horizonDays') ?? '30');

  try {
    // Get latest snapshot date
    const latestSnapshot = getLatestOptionSnapshot(ticker, '30d');
    if (!latestSnapshot) {
      return NextResponse.json(
        { error: 'No snapshot data available' },
        { status: 404 }
      );
    }

    // Get projection for the latest date
    const projection = getOptionProjection(
      latestSnapshot.date,
      ticker,
      horizonDays
    );

    if (!projection) {
      return NextResponse.json(
        { error: 'No projection data available' },
        { status: 404 }
      );
    }

    // Format response
    const response = {
      ticker: projection.ticker,
      date: projection.date,
      expiry_horizon: projection.horizon_days,
      prob_distribution: projection.prob_distribution,
      keyLevels: projection.key_levels,
      regimeTransition: {
        from: latestSnapshot.regime,
        to: projection.regime_classification,
        confidence: 0.75, // Mock confidence for now
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching projection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
