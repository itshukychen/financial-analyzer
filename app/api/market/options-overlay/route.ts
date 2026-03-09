import { NextRequest, NextResponse } from 'next/server';
import { getOptionPrices, getUnderlyingPrices } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface OptionsOverlayParams {
  ticker: string;
  strike: number;
  expiry: string;
  optionType?: 'call' | 'put';
  range?: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';
}

export interface OptionsOverlayDataPoint {
  time: string;
  underlyingPrice: number;
  optionPrice: number;
}

export interface OptionsOverlayResponse {
  ticker: string;
  strike: number;
  expiry: string;
  optionType: 'call' | 'put';
  range: string;
  points: OptionsOverlayDataPoint[];
  current: {
    underlying: number | null;
    option: number | null;
  };
  metadata?: {
    dataAvailability: 'full' | 'partial' | 'none';
    earliestTimestamp?: string;
  };
}

const VALID_TICKERS = ['SPX', 'SPY', 'QQQ', 'IWM', 'DIA'];
const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y'];
const VALID_OPTION_TYPES = ['call', 'put'];

function validateParams(params: Partial<OptionsOverlayParams>): {
  valid: boolean;
  error?: string;
} {
  if (!params.ticker || !VALID_TICKERS.includes(params.ticker)) {
    return { valid: false, error: 'Invalid or missing ticker' };
  }

  if (params.strike === undefined || params.strike <= 0 || params.strike > 10000) {
    return { valid: false, error: 'Invalid strike price' };
  }

  if (!params.expiry || !/^\d{4}-\d{2}-\d{2}$/.test(params.expiry)) {
    return { valid: false, error: 'Invalid expiry date format (use YYYY-MM-DD)' };
  }

  if (params.optionType && !VALID_OPTION_TYPES.includes(params.optionType)) {
    return { valid: false, error: 'Invalid option type' };
  }

  if (params.range && !VALID_RANGES.includes(params.range)) {
    return { valid: false, error: 'Invalid range' };
  }

  return { valid: true };
}

function calculateTimeRange(range: string): { start: number; end: number } {
  const now = Date.now();
  const end = Math.floor(now / 1000);
  let start: number;

  switch (range) {
    case '1D':
      start = end - 24 * 60 * 60;
      break;
    case '5D':
      start = end - 5 * 24 * 60 * 60;
      break;
    case '1M':
      start = end - 30 * 24 * 60 * 60;
      break;
    case '3M':
      start = end - 90 * 24 * 60 * 60;
      break;
    case '6M':
      start = end - 180 * 24 * 60 * 60;
      break;
    case '1Y':
      start = end - 365 * 24 * 60 * 60;
      break;
    default:
      start = end - 24 * 60 * 60; // Default to 1D
  }

  return { start, end };
}

function mergeTimeSeries(
  underlyingData: Array<{ timestamp: number; price: number }>,
  optionData: Array<{ timestamp: number; price: number }>,
): OptionsOverlayDataPoint[] {
  const underlyingMap = new Map(underlyingData.map(d => [d.timestamp, d.price]));
  const optionMap = new Map(optionData.map(d => [d.timestamp, d.price]));

  // Inner join: only include timestamps where both exist
  const allTimestamps = Array.from(
    new Set([...underlyingMap.keys(), ...optionMap.keys()])
  ).sort((a, b) => a - b);

  return allTimestamps
    .filter(ts => underlyingMap.has(ts) && optionMap.has(ts))
    .map(ts => ({
      time: new Date(ts * 1000).toISOString(),
      underlyingPrice: underlyingMap.get(ts)!,
      optionPrice: optionMap.get(ts)!,
    }));
}

function getCacheHeader(range: string): string {
  switch (range) {
    case '1D':
      return 'max-age=60, stale-while-revalidate=300'; // 1 min cache, 5 min stale
    case '5D':
      return 'max-age=300, stale-while-revalidate=1800'; // 5 min cache, 30 min stale
    default:
      return 'max-age=900, stale-while-revalidate=3600'; // 15 min cache, 1 hr stale
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: Partial<OptionsOverlayParams> = {
      ticker: searchParams.get('ticker') || undefined,
      strike: searchParams.get('strike') ? parseFloat(searchParams.get('strike')!) : undefined,
      expiry: searchParams.get('expiry') || undefined,
      optionType: (searchParams.get('optionType') as 'call' | 'put') || 'call',
      range: (searchParams.get('range') as string) || '1D',
    };

    // Validate parameters
    const validation = validateParams(params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { start, end } = calculateTimeRange(params.range!);

    // Fetch option prices
    const optionPrices = getOptionPrices(
      params.ticker!,
      params.strike!,
      params.expiry!,
      params.optionType!,
      start,
      end
    );

    if (optionPrices.length === 0) {
      return NextResponse.json(
        { error: 'No option price data available for the specified parameters' },
        { status: 404 }
      );
    }

    // Fetch underlying prices
    const underlyingPrices = getUnderlyingPrices(params.ticker!, start, end);

    // If no underlying prices, use synthetic data based on option prices
    // (In a real implementation, this would query actual market data)
    let processedUnderlyingPrices = underlyingPrices;
    if (underlyingPrices.length === 0) {
      // Generate synthetic underlying prices based on option prices
      // Assumption: option price ≈ 2-5% of underlying for ATM calls
      processedUnderlyingPrices = optionPrices.map(opt => ({
        timestamp: opt.timestamp,
        price: Math.round((opt.price / 0.03) * 100) / 100, // Rough estimate
      }));
    }

    // Merge time series
    const points = mergeTimeSeries(processedUnderlyingPrices, optionPrices.map(p => ({
      timestamp: p.timestamp,
      price: p.price,
    })));

    if (points.length === 0) {
      return NextResponse.json(
        { error: 'No matching data points for underlying and option prices' },
        { status: 404 }
      );
    }

    // Get current values (latest data point)
    const lastPoint = points[points.length - 1];
    const current = {
      underlying: lastPoint.underlyingPrice,
      option: lastPoint.optionPrice,
    };

    const response: OptionsOverlayResponse = {
      ticker: params.ticker!,
      strike: params.strike!,
      expiry: params.expiry!,
      optionType: params.optionType!,
      range: params.range!,
      points,
      current,
      metadata: {
        dataAvailability: optionPrices.length === points.length ? 'full' : 'partial',
        earliestTimestamp: points.length > 0 ? points[0].time : undefined,
      },
    };

    // Set cache headers
    const headers = new Headers({
      'Cache-Control': getCacheHeader(params.range!),
      'Content-Type': 'application/json',
    });

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error in options-overlay endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
