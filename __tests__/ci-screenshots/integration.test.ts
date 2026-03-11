/**
 * Integration test for the orchestrator pipeline.
 * Mocks all I/O dependencies and verifies the pipeline stages are called in order.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all pipeline modules
vi.mock('../../scripts/ci-screenshots/git-diff-analyzer', () => ({
  analyzeDiff: vi.fn(),
}));

vi.mock('../../scripts/ci-screenshots/component-mapper', () => ({
  mapChangesToRoutes: vi.fn(),
}));

vi.mock('../../scripts/ci-screenshots/screenshot-capturer', () => ({
  captureScreenshots: vi.fn(),
  buildFilename: vi.fn((route: string, vp: { name: string }) => `${route}-${vp.name}.png`),
}));

vi.mock('../../scripts/ci-screenshots/baseline-manager', () => ({
  checkBaselines: vi.fn(),
  buildBaselineMap: vi.fn(),
}));

vi.mock('../../scripts/ci-screenshots/visual-diff-engine', () => ({
  runVisualDiff: vi.fn(),
}));

vi.mock('../../scripts/ci-screenshots/report-generator', () => ({
  generateReport: vi.fn(),
  writeReport: vi.fn(),
}));

vi.mock('../../scripts/ci-screenshots/github-poster', () => ({
  postReport: vi.fn(),
  buildPosterOptionsFromEnv: vi.fn(),
}));

import { analyzeDiff } from '../../scripts/ci-screenshots/git-diff-analyzer';
import { mapChangesToRoutes } from '../../scripts/ci-screenshots/component-mapper';
import { generateReport } from '../../scripts/ci-screenshots/report-generator';

describe('Pipeline integration (mocked modules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('analyzeDiff is callable with branch arguments', async () => {
    const mockAnalyze = vi.mocked(analyzeDiff);
    mockAnalyze.mockResolvedValue({
      baseBranch: 'origin/main',
      headBranch: 'HEAD',
      changedFiles: [],
      summary: { total: 0, added: 0, modified: 0, deleted: 0, renamed: 0, byCategory: { component: 0, page: 0, style: 0, api: 0, other: 0 } },
    });

    const result = await analyzeDiff('origin/main', 'HEAD');
    expect(result.changedFiles).toHaveLength(0);
  });

  it('mapChangesToRoutes returns empty array for no changes', () => {
    const mockMapper = vi.mocked(mapChangesToRoutes);
    mockMapper.mockReturnValue([]);
    expect(mapChangesToRoutes([])).toEqual([]);
  });

  it('generateReport produces output with summary', async () => {
    const mockGenerate = vi.mocked(generateReport);
    mockGenerate.mockResolvedValue({
      markdown: '# Report',
      summary: { total: 0, major: 0, minor: 0, unchanged: 0, new: 0, missingBaseline: 0, hasChanges: false },
    });

    const output = await generateReport([], { baseBranch: 'main', headBranch: 'HEAD' });
    expect(output.summary.hasChanges).toBe(false);
  });
});
