import { describe, it, expect } from 'vitest';
import { generateReport } from '../../scripts/ci-screenshots/report-generator';
import type { ComparisonResult } from '../../scripts/ci-screenshots/visual-diff-engine';

function makeResult(
  route: string,
  viewport: 'desktop' | 'mobile' | 'tablet',
  classification: ComparisonResult['classification'],
  diffPct = 0
): ComparisonResult {
  return {
    route,
    viewport,
    baselinePath: classification === 'new' ? null : '/tmp/baseline.png',
    currentPath: '/tmp/current.png',
    diffPath: classification !== 'new' ? '/tmp/diff.png' : null,
    pixelsDifferent: Math.round((diffPct / 100) * 10000),
    totalPixels: 10000,
    diffPercentage: diffPct,
    classification,
  };
}

describe('generateReport', () => {
  it('returns markdown string and summary object', async () => {
    const results = [
      makeResult('/', 'desktop', 'unchanged', 0),
      makeResult('/markets', 'desktop', 'major', 5.5),
    ];

    const output = await generateReport(results, {
      baseBranch: 'main',
      headBranch: 'feature/test',
    });

    expect(typeof output.markdown).toBe('string');
    expect(output.markdown.length).toBeGreaterThan(0);
    expect(output.summary.total).toBe(2);
    expect(output.summary.major).toBe(1);
    expect(output.summary.unchanged).toBe(1);
    expect(output.summary.hasChanges).toBe(true);
  });

  it('includes major changes section in markdown', async () => {
    const results = [makeResult('/markets', 'desktop', 'major', 10)];
    const output = await generateReport(results, { baseBranch: 'main', headBranch: 'HEAD' });
    expect(output.markdown).toContain('Major Changes');
    expect(output.markdown).toContain('/markets');
  });

  it('includes new routes section', async () => {
    const results = [makeResult('/new-page', 'desktop', 'new')];
    const output = await generateReport(results, { baseBranch: 'main', headBranch: 'HEAD' });
    expect(output.markdown).toContain('New Routes');
  });

  it('formats diff percentage to 3 decimal places', async () => {
    const results = [makeResult('/markets', 'tablet', 'minor', 1.23456)];
    const output = await generateReport(results, { baseBranch: 'main', headBranch: 'HEAD' });
    expect(output.markdown).toContain('1.235');
  });

  it('summary shows zero changes when all unchanged', async () => {
    const results = [makeResult('/', 'desktop', 'unchanged', 0)];
    const output = await generateReport(results, { baseBranch: 'main', headBranch: 'HEAD' });
    expect(output.summary.hasChanges).toBe(false);
    expect(output.summary.major).toBe(0);
    expect(output.summary.minor).toBe(0);
  });
});
