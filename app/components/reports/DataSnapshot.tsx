import StatCard from '@/app/components/StatCard';
import type { DeltaDirection } from '@/app/types';

interface InstrumentData {
  current:   number;
  changePct: number;
  points:    { time: string; value: number }[];
}

interface DataSnapshotProps {
  marketData: {
    spx:      InstrumentData;
    vix:      InstrumentData;
    dxy:      InstrumentData;
    yield10y: InstrumentData;
    yield2y:  InstrumentData;
  };
}

interface CardDef {
  label:    string;
  key:      keyof DataSnapshotProps['marketData'];
  format:   (v: number) => string;
  // VIX is inverted: rising VIX = fear = "down" for markets
  invert?:  boolean;
}

const CARDS: CardDef[] = [
  { label: 'S&P 500',           key: 'spx',      format: v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { label: 'VIX',               key: 'vix',      format: v => v.toFixed(2), invert: true },
  { label: 'US Dollar (DXY)',   key: 'dxy',      format: v => v.toFixed(2) },
  { label: '10Y Yield',         key: 'yield10y', format: v => `${v.toFixed(2)}%` },
  { label: '2Y Yield',          key: 'yield2y',  format: v => `${v.toFixed(2)}%` },
];

function toDeltaDirection(changePct: number, invert?: boolean): DeltaDirection {
  if (changePct === 0) return 'neutral';
  const positive = changePct > 0;
  return (invert ? !positive : positive) ? 'up' : 'down';
}

export default function DataSnapshot({ marketData }: DataSnapshotProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {CARDS.map(({ label, key, format, invert }) => {
        const data       = marketData[key];
        const sign       = data.changePct >= 0 ? '+' : '';
        const delta      = `${sign}${data.changePct.toFixed(2)}%`;
        const direction  = toDeltaDirection(data.changePct, invert);

        return (
          <StatCard
            key={key}
            label={label}
            value={format(data.current)}
            delta={delta}
            deltaDirection={direction}
          />
        );
      })}
    </div>
  );
}
