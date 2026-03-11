import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/github
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
  context: { repo: { owner: 'owner', repo: 'repo' }, sha: 'abc123' },
}));

// Mock @actions/core
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

import { buildPosterOptionsFromEnv } from '../../scripts/ci-screenshots/github-poster';

describe('buildPosterOptionsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN;
    expect(buildPosterOptionsFromEnv()).toBeNull();
  });

  it('parses owner/repo from GITHUB_REPOSITORY', () => {
    process.env.GITHUB_TOKEN = 'tok';
    process.env.GITHUB_REPOSITORY = 'myorg/myrepo';
    delete process.env.PR_NUMBER;
    const opts = buildPosterOptionsFromEnv();
    expect(opts?.owner).toBe('myorg');
    expect(opts?.repo).toBe('myrepo');
    expect(opts?.prNumber).toBeNull();
  });

  it('parses PR_NUMBER', () => {
    process.env.GITHUB_TOKEN = 'tok';
    process.env.GITHUB_REPOSITORY = 'org/repo';
    process.env.PR_NUMBER = '42';
    const opts = buildPosterOptionsFromEnv();
    expect(opts?.prNumber).toBe(42);
  });
});
