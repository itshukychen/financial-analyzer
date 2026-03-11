import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyFile, analyzeDiff } from '../../scripts/ci-screenshots/git-diff-analyzer';

// Mock simple-git
vi.mock('simple-git', () => {
  const mockDiffSummary = vi.fn();
  const mockGit = { diffSummary: mockDiffSummary };
  return {
    default: vi.fn(() => mockGit),
    __mockDiffSummary: mockDiffSummary,
  };
});

async function getMockDiffSummary() {
  const mod = await import('simple-git');
  return (mod as unknown as { __mockDiffSummary: ReturnType<typeof vi.fn> }).__mockDiffSummary;
}

describe('classifyFile', () => {
  it('classifies page files', () => {
    expect(classifyFile('app/page.tsx')).toBe('page');
    expect(classifyFile('app/markets/page.tsx')).toBe('page');
    expect(classifyFile('pages/index.tsx')).toBe('page');
  });

  it('classifies component files', () => {
    expect(classifyFile('src/components/Button.tsx')).toBe('component');
    expect(classifyFile('components/Header.tsx')).toBe('component');
  });

  it('classifies style files', () => {
    expect(classifyFile('styles/globals.css')).toBe('style');
    expect(classifyFile('app/globals.css')).toBe('style');
    expect(classifyFile('theme.scss')).toBe('style');
  });

  it('classifies api files', () => {
    expect(classifyFile('app/api/stocks/route.ts')).toBe('api');
    expect(classifyFile('pages/api/user.ts')).toBe('api');
  });

  it('classifies other files', () => {
    expect(classifyFile('README.md')).toBe('other');
    expect(classifyFile('package.json')).toBe('other');
    expect(classifyFile('scripts/setup.sh')).toBe('other');
  });
});

describe('analyzeDiff', () => {
  beforeEach(async () => {
    const mock = await getMockDiffSummary();
    mock.mockReset();
  });

  it('returns structured output for modified files', async () => {
    const mock = await getMockDiffSummary();
    mock.mockResolvedValue({
      files: [
        { file: 'src/components/Header.tsx', insertions: 5, deletions: 2, changes: 7, binary: false },
        { file: 'app/page.tsx', insertions: 10, deletions: 0, changes: 10, binary: false },
        { file: 'styles/globals.css', insertions: 3, deletions: 1, changes: 4, binary: false },
      ],
    });

    const result = await analyzeDiff('origin/main', 'HEAD');
    expect(result.changedFiles).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.byCategory.component).toBe(1);
    expect(result.summary.byCategory.page).toBe(1);
    expect(result.summary.byCategory.style).toBe(1);
  });

  it('handles binary files', async () => {
    const mock = await getMockDiffSummary();
    mock.mockResolvedValue({
      files: [
        { file: 'public/logo.png', insertions: 0, deletions: 0, changes: 0, binary: true },
      ],
    });

    const result = await analyzeDiff('origin/main', 'HEAD');
    expect(result.changedFiles[0].isBinary).toBe(true);
  });

  it('handles renames', async () => {
    const mock = await getMockDiffSummary();
    mock.mockResolvedValue({
      files: [
        { file: 'src/components/Old.tsx => src/components/New.tsx', insertions: 0, deletions: 0, changes: 0, binary: false },
      ],
    });

    const result = await analyzeDiff('origin/main', 'HEAD');
    const f = result.changedFiles[0];
    expect(f.changeType).toBe('renamed');
    expect(f.previousPath).toBe('src/components/Old.tsx');
    expect(f.path).toBe('src/components/New.tsx');
  });

  it('throws on git error', async () => {
    const mock = await getMockDiffSummary();
    mock.mockRejectedValue(new Error('not a git repository'));

    await expect(analyzeDiff('main', 'HEAD')).rejects.toThrow('git diff failed');
  });

  it('correctly counts added vs modified files', async () => {
    const mock = await getMockDiffSummary();
    mock.mockResolvedValue({
      files: [
        // added: insertions == changes, deletions == 0
        { file: 'src/components/New.tsx', insertions: 10, deletions: 0, changes: 10, binary: false },
        // modified: both insertions and deletions
        { file: 'src/components/Existing.tsx', insertions: 5, deletions: 3, changes: 8, binary: false },
      ],
    });

    const result = await analyzeDiff('origin/main', 'HEAD');
    expect(result.summary.added).toBe(1);
    expect(result.summary.modified).toBe(1);
  });
});
