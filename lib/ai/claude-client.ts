import type { AIAnalysisResponse } from '@/lib/types/options-ai';

export async function callClaudeAPI(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('[Claude API] Call failed:', error);
    throw error;
  }
}

export function parseClaudeResponse(response: string): Omit<AIAnalysisResponse, 'success' | 'metadata'> {
  try {
    // Strip markdown code blocks if present
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid response: missing sections array');
    }
    if (!parsed.nextDayProjection) {
      throw new Error('Invalid response: missing nextDayProjection');
    }

    return {
      sections: parsed.sections,
      nextDayProjection: parsed.nextDayProjection,
    };
  } catch (error) {
    console.error('[Claude API] Failed to parse response:', error);
    throw new Error('Claude returned invalid JSON');
  }
}
