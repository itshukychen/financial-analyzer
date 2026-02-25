import PageHeader from '../components/PageHeader';
import PlaceholderWidget from '../components/PlaceholderWidget';

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Daily SPX analysis and market commentary"
      />
      <div className="mb-4">
        <PlaceholderWidget
          label="Today's SPX Report"
          description="AI-generated daily analysis of S&P 500 price action, key levels, and macro context"
          minHeight="320px"
        />
      </div>
      <PlaceholderWidget
        label="Report Archive"
        description="Browse and search historical daily reports"
        minHeight="200px"
      />
    </>
  );
}
