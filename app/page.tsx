import PageHeader from './components/PageHeader';
import StatCard from './components/StatCard';
import PlaceholderWidget from './components/PlaceholderWidget';

const marketStats = [
  {
    label: 'S&P 500',
    value: '5,842.91',
    delta: '+0.72%',
    deltaDirection: 'up' as const,
  },
  {
    label: 'NASDAQ 100',
    value: '20,431.17',
    delta: '+1.14%',
    deltaDirection: 'up' as const,
  },
  {
    label: 'DOW JONES',
    value: '43,124.08',
    delta: '-0.23%',
    deltaDirection: 'down' as const,
  },
  {
    label: 'VIX',
    value: '18.42',
    delta: '+2.35%',
    deltaDirection: 'up' as const,
  },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Market Overview" />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {marketStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            deltaDirection={stat.deltaDirection}
          />
        ))}
      </div>

      {/* 2-column widgets */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PlaceholderWidget
          label="Daily Market Report"
          description="AI-generated SPX report will appear here each trading day"
          minHeight="260px"
        />
        <PlaceholderWidget
          label="Watchlist"
          description="Your tracked instruments and price targets"
          minHeight="260px"
        />
      </div>

      {/* Full-width widget */}
      <PlaceholderWidget
        label="Market Heatmap"
        description="S&P 500 sector performance visualized by weight and returns"
        minHeight="300px"
      />
    </>
  );
}
