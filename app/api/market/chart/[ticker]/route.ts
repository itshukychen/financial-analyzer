import { NextRequest, NextResponse } from 'next/server';

const TICKER_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^VIX': 'VIX',
  'DX-Y.NYB': 'US Dollar Index',
  '^TNX': '10Y Treasury Yield',
  'DGS2': '2Y Treasury Yield',
  'DGS10': '10Y Treasury Yield',
};

interface DataPoint {
  time: string;
  value: number;
}

interface RouteResponse {
  symbol: string;
  name: string;
  points: DataPoint[];
  current: number;
  open: number;
  change: number;
  changePct: number;
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    let points: DataPoint[];
    if (ticker === 'DGS2' || ticker === 'DGS10') {
      points = await fetchFRED(ticker);
    } else {
      points = await fetchYahoo(ticker);
    }

    if (points.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 500 });
    }

    const current = points[points.length - 1].value;
    const open = points[0].value;
    const change = current - open;
    const changePct = (change / open) * 100;

    const response: RouteResponse = {
      symbol: ticker,
      name: TICKER_NAMES[ticker] ?? ticker,
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
