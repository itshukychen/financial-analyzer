import PageHeader from './components/PageHeader';
import PlaceholderWidget from './components/PlaceholderWidget';
import MarketChartsWidget from './components/charts/MarketChartsWidget';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Market Overview" />

      {/* Live market charts — last 7 trading days */}
      <div style={{ marginBottom: '24px' }}>
        <MarketChartsWidget />
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
