import { NextResponse } from 'next/server';

export const revalidate = 900; // cache 15 min

export interface FearGreedData {
  score:          number;   // 0–100
  rating:         string;   // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  previousClose:  number;
  previous1Week:  number;
  previous1Month: number;
  previous1Year:  number;
  timestamp:      string;
}

export async function GET() {
  try {
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer':    'https://www.cnn.com/markets/fear-and-greed',
        },
        next: { revalidate: 900 },
      }
    );

    if (!res.ok) throw new Error(`CNN API returned ${res.status}`);

    const json = await res.json();
    const fg   = json.fear_and_greed;

    const data: FearGreedData = {
      score:          Math.round(fg.score),
      rating:         fg.rating,
      previousClose:  Math.round(fg.previous_close),
      previous1Week:  Math.round(fg.previous_1_week),
      previous1Month: Math.round(fg.previous_1_month),
      previous1Year:  Math.round(fg.previous_1_year),
      timestamp:      fg.timestamp,
    };

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
