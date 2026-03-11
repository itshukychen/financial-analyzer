/**
 * Git Diff Analyzer
 *
 * Parses the diff between PR branch and main branch to identify modified files.
 * Classifies files by type and returns structured change metadata.
 */

import simpleGit, { type SimpleGit, type DiffResult } from 'simple-git';

export type FileCategory = 'component' | 'page' | 'style' | 'api' | 'other';
export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ChangedFile {
  path: string;
  previousPath?: string; // set for renames/moves
  changeType: ChangeType;
  category: FileCategory;
  isBinary: boolean;
}

export interface DiffAnalyzerOutput {
  baseBranch: string;
  headBranch: string;
  changedFiles: ChangedFile[];
  summary: {
    total: number;
    added: number;
    modified: number;
    deleted: number;
    renamed: number;
    byCategory: Record<FileCategory, number>;
  };
}

/** Classify a file path into a category */
export function classifyFile(filePath: string): FileCategory {
  const lower = filePath.toLowerCase();

  // Pages: Next.js App Router page files
  if (/app\/.*page\.(tsx?|jsx?)$/.test(lower) || /pages\/.*\.(tsx?|jsx?)$/.test(lower)) {
    return 'page';
  }

  // Components
  if (
    lower.includes('/components/') ||
    lower.includes('src/components') ||
    /\.(tsx?|jsx?)$/.test(lower)
  ) {
    // But exclude API routes below
    if (!lower.includes('/api/')) {
      return 'component';
    }
  }

  // API routes
  if (lower.includes('/api/') || lower.includes('app/api/') || lower.includes('pages/api/')) {
    return 'api';
  }

  // Styles
  if (/\.(css|scss|sass|less)$/.test(lower) || lower.includes('tailwind')) {
    return 'style';
  }

  return 'other';
}

/**
 * Analyse the diff between baseBranch and headBranch in the given repo directory.
 */
export async function analyzeDiff(
  baseBranch: string,
  headBranch: string,
  repoDir: string = process.cwd()
): Promise<DiffAnalyzerOutput> {
  const git: SimpleGit = simpleGit(repoDir);

  let diffResult: DiffResult;
  try {
    diffResult = await git.diffSummary([`${baseBranch}...${headBranch}`]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`git diff failed (base=${baseBranch}, head=${headBranch}): ${msg}`);
  }

  const changedFiles: ChangedFile[] = [];
  const summary = {
    total: 0,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    byCategory: { component: 0, page: 0, style: 0, api: 0, other: 0 } as Record<
      FileCategory,
      number
    >,
  };

  for (const file of diffResult.files) {
    // simple-git returns binary files with `.binary = true`
    const isBinary = (file as Record<string, unknown>).binary === true;

    // Detect rename: file.file may be "old => new"
    let path = file.file;
    let previousPath: string | undefined;
    let changeType: ChangeType = 'modified';

    if (path.includes(' => ')) {
      const match = path.match(/^(.*?) => (.*)$/);
      if (match) {
        previousPath = match[1].trim();
        path = match[2].trim();
        changeType = 'renamed';
      }
    } else if ((file as Record<string, unknown>).insertions === file.changes && file.deletions === 0) {
      changeType = 'added';
    } else if (file.insertions === 0 && (file as Record<string, unknown>).deletions === file.changes) {
      changeType = 'deleted';
    }

    const category = classifyFile(path);

    changedFiles.push({ path, previousPath, changeType, category, isBinary });

    summary.total += 1;
    summary[changeType === 'renamed' ? 'renamed' : changeType] += 1;
    summary.byCategory[category] += 1;
  }

  return { baseBranch, headBranch, changedFiles, summary };
}
