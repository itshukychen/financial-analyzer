import { NextRequest, NextResponse } from 'next/server';

const TICKER_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^VIX': 'VIX',
  'DX-Y.NYB': 'US Dollar Index',
  '^TNX': '10Y Treasury Yield',
  'DGS2': '2Y Treasury Yield',
  'DGS10': '10Y Treasury Yield',
  'CL=F':  'WTI Crude Oil',
  'BZ=F':  'Brent Crude Oil',
};

const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'] as const;
type Range = typeof VALID_RANGES[number];

const FRED_TICKERS = new Set(['DGS2', 'DGS10']);

const YAHOO_RANGE_CONFIG: Record<Range, { yahooRange: string; interval: string; revalidate: number }> = {
  '1D':  { yahooRange: '1d',  interval: '5m',  revalidate: 60  },
  '5D':  { yahooRange: '5d',  interval: '1d',  revalidate: 900 },
  '1M':  { yahooRange: '1mo', interval: '1d',  revalidate: 900 },
  '3M':  { yahooRange: '3mo', interval: '1d',  revalidate: 900 },
  '6M':  { yahooRange: '6mo', interval: '1d',  revalidate: 900 },
  '1Y':  { yahooRange: '1y',  interval: '1d',  revalidate: 900 },
  'YTD': { yahooRange: 'ytd', interval: '1d',  revalidate: 900 },
};

const FRED_RANGE_CONFIG: Record<Exclude<Range, '1D'>, { cutoffDays: number; sliceLast: number | 'ytd' }> = {
  '5D':  { cutoffDays: 15,  sliceLast: 5   },
  '1M':  { cutoffDays: 35,  sliceLast: 22  },
  '3M':  { cutoffDays: 100, sliceLast: 66  },
  '6M':  { cutoffDays: 200, sliceLast: 130 },
  '1Y':  { cutoffDays: 400, sliceLast: 252 },
  'YTD': { cutoffDays: 0,   sliceLast: 'ytd' },
};

interface DataPoint {
  time: string;
  value: number;
}

interface RouteResponse {
  symbol:       string;
  name:         string;
  points:       DataPoint[];
  current:      number;
  open:         number;
  change:       number;
  changePct:    number;
  unsupported?: boolean;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchFRED(ticker: string): Promise<DataPoint[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ticker}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`FRED fetch failed: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n');
  // Skip header line
  const dataLines = lines.slice(1);

  // Calculate cutoff: last 10 calendar days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);
  const cutoffStr = formatDate(cutoff);

  const points: DataPoint[] = [];
  for (const line of dataLines) {
    const [date, valueStr] = line.split(',');
    if (!date || !valueStr) continue;
    const trimmedDate = date.trim();
    const trimmedValue = valueStr.trim();
    if (!trimmedValue || trimmedValue === '.' || trimmedDate < cutoffStr) continue;
    const value = parseFloat(trimmedValue);
    if (isNaN(value)) continue;
    points.push({ time: trimmedDate, value });
  }

  // Return last 7 data points
  return points.slice(-7);
}

async function fetchYahoo(ticker: string): Promise<DataPoint[]> {
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=10d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart result from Yahoo Finance');

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: DataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || isNaN(close)) continue;
    const date = new Date(timestamps[i] * 1000);
    points.push({ time: formatDate(date), value: close });
  }

  // Return last 7 data points
  return points.slice(-7);
}

async function fetchYahooRange(ticker: string, range: Range): Promise<DataPoint[]> {
  const { yahooRange, interval, revalidate } = YAHOO_RANGE_CONFIG[range];
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=${yahooRange}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart result from Yahoo Finance');

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: DataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || isNaN(close)) continue;
    const date = new Date(timestamps[i] * 1000);
    // For intraday (5m interval): keep full ISO timestamp so chart renders time axis correctly
    const timeStr = interval === '5m'
      ? date.toISOString().replace('Z', '')   // "YYYY-MM-DDTHH:MM:SS.sss" → strip Z
      : formatDate(date);                      // "YYYY-MM-DD"
    points.push({ time: timeStr, value: close });
  }

  return points; // No .slice() — Yahoo already scopes the response to the requested range
}

async function fetchFREDRange(ticker: string, range: Exclude<Range, '1D'>): Promise<DataPoint[]> {
  const config = FRED_RANGE_CONFIG[range];
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ticker}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`FRED fetch failed: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n').slice(1); // skip header

  let cutoffStr: string;
  if (range === 'YTD') {
    cutoffStr = `${new Date().getFullYear()}-01-01`;
  } else {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.cutoffDays);
    cutoffStr = formatDate(cutoff);
  }

  const points: DataPoint[] = [];
  for (const line of lines) {
    const [date, valueStr] = line.split(',');
    if (!date || !valueStr) continue;
    const trimmedDate  = date.trim();
    const trimmedValue = valueStr.trim();
    if (!trimmedValue || trimmedValue === '.' || trimmedDate < cutoffStr) continue;
    const value = parseFloat(trimmedValue);
    if (isNaN(value)) continue;
    points.push({ time: trimmedDate, value });
  }

  if (config.sliceLast === 'ytd') return points;
  return points.slice(-config.sliceLast);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const range = _req.nextUrl.searchParams.get('range') ?? undefined;

  // Validate range if provided
  if (range !== undefined) {
    if (!(VALID_RANGES as readonly string[]).includes(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }
  }

  const typedRange = range as Range | undefined;

  try {
    // ── FRED 1D special case ──────────────────────────────────────────────────
    if (typedRange === '1D' && FRED_TICKERS.has(ticker)) {
      return NextResponse.json({ data: [], unsupported: true });
    }

    let points: DataPoint[];

    if (typedRange !== undefined) {
      // Range-aware path
      if (FRED_TICKERS.has(ticker)) {
        points = await fetchFREDRange(ticker, typedRange as Exclude<Range, '1D'>);
      } else {
        points = await fetchYahooRange(ticker, typedRange);
      }
    } else {
      // ── Existing no-range path (unchanged) ─────────────────────────────────
      if (ticker === 'DGS2' || ticker === 'DGS10') {
        points = await fetchFRED(ticker);
      } else {
        points = await fetchYahoo(ticker);
      }
    }

    if (points.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 500 });
    }

    const current   = points[points.length - 1].value;
    const open      = points[0].value;
    const change    = current - open;
    const changePct = (change / open) * 100;

    const response: RouteResponse = {
      symbol: ticker,
      name:   TICKER_NAMES[ticker] ?? ticker,
      points,
      current,
      open,
      change,
      changePct,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
