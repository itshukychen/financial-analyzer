import PageHeader from '../components/PageHeader';
import PlaceholderWidget from '../components/PlaceholderWidget';

export default function MarketsPage() {
  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Live quotes, indices, and sector performance"
      />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PlaceholderWidget
          label="Indices Overview"
          description="Real-time major index quotes and daily performance"
          minHeight="240px"
        />
        <PlaceholderWidget
          label="Sector Performance"
          description="S&P 500 sectors ranked by daily returns"
          minHeight="240px"
        />
      </div>
      <PlaceholderWidget
        label="Options Flow"
        description="Unusual options activity and large block trades"
        minHeight="240px"
      />
    </>
  );
}
