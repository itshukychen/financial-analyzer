import { PERIOD_LABELS, type ReportPeriod } from '@/lib/db';
import type { DailyReport } from '@/scripts/generate-report';

export function buildReportQAPrompt(
  question: string,
  report: DailyReport,
  period: ReportPeriod
): string {
  return `You are a financial market analyst. A user is asking questions about a market report.

**Report Details:**
- Date: ${report.date}
- Type: ${PERIOD_LABELS[period]} Report
- Generated: ${report.generatedAt}

**Market Data Snapshot:**
${JSON.stringify(report.marketData, null, 2)}

**Analysis:**
${Object.entries(report.analysis)
  .filter(([key]) => key !== 'regimeProbabilities')
  .map(([key, value]) => {
    // Convert camelCase to Title Case
    const title = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
    return `### ${title}\n${value}`;
  })
  .join('\n\n')}

${report.analysis.regimeProbabilities ? `**Regime Probabilities:** ${report.analysis.regimeProbabilities}` : ''}

---

**User Question:** ${question}

**Instructions:**
1. Answer based ONLY on the report content above
2. Be concise (under 200 words unless asked for details)
3. If the report doesn't address the question, say so and offer related insights
4. Do not make up data or external information
5. Use plain language unless technical terms are in the report
6. Format as markdown if including lists or emphasis

**Answer:**`;
}

export async function callClaudeForReportQA(
  question: string,
  report: DailyReport,
  period: ReportPeriod
): Promise<{ answer: string; tokensUsed: { input: number; output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = buildReportQAPrompt(question, report, period);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      answer: data.content[0].text,
      tokensUsed: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error('[Report Q&A] Claude API call failed:', error);
    throw error;
  }
}
