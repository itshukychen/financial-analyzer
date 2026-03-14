import AppShell from '@/app/components/AppShell';
import PageHeader from '@/app/components/PageHeader';
import { AnalysisSection } from './components/AnalysisSection';
import { NextDayForecast } from './components/NextDayForecast';
import { CacheNotice } from './components/CacheNotice';
import type { AIAnalysisResponse } from '@/lib/types/options-ai';

async function getAnalysis(): Promise<AIAnalysisResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  const res = await fetch(`${baseUrl}/api/options/ai-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: 'SPWX' }), // MVP: hardcoded ticker
    cache: 'no-store', // Always fetch fresh (API handles caching)
  });

  if (!res.ok) {
    throw new Error('Failed to fetch analysis');
  }

  return res.json();
}

export default async function OptionsAIAnalysisPage() {
  let data: AIAnalysisResponse;

  try {
    data = await getAnalysis();
  } catch (error) {
    console.error('Failed to load analysis:', error);
    return (
      <AppShell>
        <div className="p-8 text-center">
          <p className="text-red-500">Failed to load AI analysis. Please try again later.</p>
        </div>
      </AppShell>
    );
  }

  if (!data.success) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <p className="text-red-500">Failed to load analysis: {data.error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader 
        title="Options AI Analysis" 
        subtitle="AI-Powered Daily Insights" 
        badge={data.metadata.date} 
      />

      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {data.sections.map((section) => (
          <AnalysisSection key={section.id} {...section} />
        ))}

        <NextDayForecast projection={data.nextDayProjection} />

        <CacheNotice metadata={data.metadata} />
      </div>
    </AppShell>
  );
}
