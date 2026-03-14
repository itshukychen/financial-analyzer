import { describe, it, expect } from 'vitest';
import { buildReportQAPrompt } from './report-qa-client';
import type { DailyReport } from '@/scripts/generate-report';

describe('buildReportQAPrompt', () => {
  const mockReport: DailyReport = {
    date: '2026-03-14',
    generatedAt: '2026-03-14T09:00:00Z',
    marketData: {
      SPX: 5745,
      VIX: 18.2,
      ES: 5743.25,
    },
    analysis: {
      equityDiagnosis: 'Bullish bias with technical support at 5730. Watch 5760 resistance.',
      equityForecast: '3-5% upside toward 5900 if support holds.',
      regimeProbabilities: 'Low vol 60%, Normal vol 30%, High vol 10%',
      technicalAnalysis: 'Support at 5730, Resistance at 5760',
    },
  };

  it('includes report date in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('2026-03-14');
  });

  it('includes period type in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('Open Report');
  });

  it('includes market data in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('5745');
    expect(prompt).toContain('SPX');
  });

  it('includes analysis sections in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('Bullish bias');
    expect(prompt).toContain('3-5% upside');
  });

  it('includes user question in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('What is SPX?');
  });

  it('includes regime probabilities in prompt', () => {
    const prompt = buildReportQAPrompt('What is SPX?', mockReport, 'morning');
    expect(prompt).toContain('Low vol 60%');
  });

  it('handles different periods', () => {
    const morningPrompt = buildReportQAPrompt('Test', mockReport, 'morning');
    const middayPrompt = buildReportQAPrompt('Test', mockReport, 'midday');
    const eodPrompt = buildReportQAPrompt('Test', mockReport, 'eod');

    expect(morningPrompt).toContain('Open Report');
    expect(middayPrompt).toContain('Midday Report');
    expect(eodPrompt).toContain('Close Report');
  });

  it('filters out regimeProbabilities from analysis section', () => {
    const prompt = buildReportQAPrompt('Test', mockReport, 'morning');
    // Should appear as "Regime Probabilities:" at the end, not in analysis section
    const analysisSectionEnd = prompt.indexOf('---');
    const regimeProbabilitiesInAnalysis = prompt.substring(0, analysisSectionEnd).indexOf('### Regime Probabilities');
    expect(regimeProbabilitiesInAnalysis).toBe(-1);
  });
});
