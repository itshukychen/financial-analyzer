import PageHeader from '../components/PageHeader';
import PlaceholderWidget from '../components/PlaceholderWidget';

export default function WatchlistPage() {
  return (
    <>
      <PageHeader
        title="Watchlist"
        subtitle="Track your instruments and price targets"
      />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PlaceholderWidget
          label="My Watchlist"
          description="Custom list of tracked tickers with live quotes"
          minHeight="320px"
        />
        <PlaceholderWidget
          label="Price Targets"
          description="Set and monitor price targets with distance indicators"
          minHeight="320px"
        />
      </div>
    </>
  );
}
