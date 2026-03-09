import { NextRequest, NextResponse } from 'next/server';
import { getLatestOptionSnapshot } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'SPWX';
  const expiry = req.nextUrl.searchParams.get('expiry') ?? '30d';

  try {
    // Fetch latest snapshot from DB
    const snapshot = getLatestOptionSnapshot(ticker, expiry);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'No data available for this ticker/expiry' },
        { status: 404 }
      );
    }

    // Extract spot price from raw_json if available, fallback to mock value
    let spotPrice: number | null = null;
    try {
      const rawData = JSON.parse(snapshot.raw_json);
      spotPrice = rawData.spotPrice || null;
    } catch {
      // raw_json parse error - spotPrice will remain null
    }

    // Format response
    const response = {
      ticker: snapshot.ticker,
      timestamp: new Date(snapshot.created_at * 1000).toISOString(),
      expirations: ['1w', '30d', '60d'],
      volatility: {
        iv_30d: snapshot.iv_30d,
        iv_60d: snapshot.iv_60d,
        hv_20d: snapshot.hv_20d,
        hv_60d: snapshot.hv_60d,
        iv_rank: snapshot.iv_rank,
        iv_percentile: snapshot.iv_rank ? snapshot.iv_rank / 100 : null,
      },
      greeks: {
        net_delta: snapshot.net_delta,
        atm_gamma: snapshot.atm_gamma,
        vega_per_1pct: snapshot.vega_per_1pct,
        theta_daily: snapshot.theta_daily,
      },
      skew: {
        call_otm_iv_25d: snapshot.call_otm_iv,
        put_otm_iv_25d: snapshot.put_otm_iv,
        skew_ratio: snapshot.skew_ratio,
        skew_direction:
          snapshot.skew_ratio && snapshot.skew_ratio > 1.05
            ? 'put_heavy'
            : snapshot.skew_ratio && snapshot.skew_ratio < 0.95
              ? 'call_heavy'
              : 'balanced',
      },
      implied_move: {
        '1w_move_pct': snapshot.implied_move_pct
          ? snapshot.implied_move_pct / 2
          : null,
        '30d_move_pct': snapshot.implied_move_pct,
        // Confidence bands: use actual spot price if available, fallback to 475
        '1w_conf_low': (spotPrice || 475) * (1 - ((snapshot.implied_move_pct || 2) / 2) / 100),
        '1w_conf_high': (spotPrice || 475) * (1 + ((snapshot.implied_move_pct || 2) / 2) / 100),
        '2sd_low': (spotPrice || 475) * (1 - (snapshot.implied_move_pct || 2) / 100),
        '2sd_high': (spotPrice || 475) * (1 + (snapshot.implied_move_pct || 2) / 100),
      },
      regime: snapshot.regime,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching option snapshot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
