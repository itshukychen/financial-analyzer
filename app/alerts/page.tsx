import PageHeader from '../components/PageHeader';
import PlaceholderWidget from '../components/PlaceholderWidget';

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Price and event notifications"
      />
      <div className="mb-4">
        <PlaceholderWidget
          label="Active Alerts"
          description="Your configured price alerts and triggered notifications"
          minHeight="280px"
        />
      </div>
      <PlaceholderWidget
        label="Create Alert"
        description="Set price-level triggers and notification rules for any instrument"
        minHeight="200px"
      />
    </>
  );
}
