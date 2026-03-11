/**
 * GitHub Integration Module
 *
 * Posts the visual regression report as a PR comment and sets the check status.
 * Uses @actions/github REST API. No-ops gracefully in local mode.
 */

import * as core from '@actions/core';
import { getOctokit, context as githubContext } from '@actions/github';
import type { ReportOutput } from './report-generator';

export interface GitHubPosterOptions {
  token: string;
  owner: string;
  repo: string;
  prNumber: number | null;
  /** Run ID used for artifact links */
  runId?: string;
}

/** Marker comment to identify our bot comments for upsert logic */
const COMMENT_MARKER = '<!-- ci-screenshots-report -->';

/**
 * Post or update the report as a PR comment.
 * Finds an existing comment with our marker and edits it, or creates a new one.
 */
export async function postPrComment(
  markdown: string,
  options: GitHubPosterOptions
): Promise<void> {
  if (!options.prNumber) {
    core.info('No PR number available — skipping PR comment.');
    return;
  }

  const octokit = getOctokit(options.token);
  const body = `${COMMENT_MARKER}\n${markdown}`;

  // Find existing comment from a previous run
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: options.owner,
    repo: options.repo,
    issue_number: options.prNumber,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: options.owner,
      repo: options.repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated existing PR comment #${existing.id}`);
  } else {
    await octokit.rest.issues.createComment({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.prNumber,
      body,
    });
    core.info('Created new PR comment');
  }
}

/**
 * Create a GitHub check run reflecting the diff results.
 * Status: success (no changes), neutral (changes detected).
 */
export async function setCheckStatus(
  reportOutput: ReportOutput,
  options: GitHubPosterOptions,
  headSha: string
): Promise<void> {
  const octokit = getOctokit(options.token);
  const { summary } = reportOutput;

  const conclusion = summary.hasChanges ? 'neutral' : 'success';
  const title = summary.hasChanges
    ? `Visual changes detected: ${summary.major} major, ${summary.minor} minor`
    : 'No visual changes detected';

  await octokit.rest.checks.create({
    owner: options.owner,
    repo: options.repo,
    name: 'Visual Regression',
    head_sha: headSha,
    status: 'completed',
    conclusion,
    output: {
      title,
      summary: [
        `Total routes: ${summary.total}`,
        `Major: ${summary.major}`,
        `Minor: ${summary.minor}`,
        `Unchanged: ${summary.unchanged}`,
        `New: ${summary.new}`,
      ].join('\n'),
    },
  });

  core.info(`GitHub check set: ${conclusion} — ${title}`);
}

/**
 * Convenience: post comment and set check in one call.
 * Handles API errors gracefully.
 */
export async function postReport(
  reportOutput: ReportOutput,
  options: GitHubPosterOptions,
  headSha: string
): Promise<void> {
  try {
    await postPrComment(reportOutput.markdown, options);
  } catch (err) {
    core.warning(`Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await setCheckStatus(reportOutput, options, headSha);
  } catch (err) {
    core.warning(`Failed to set check status: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Build poster options from environment variables (as set by GitHub Actions).
 */
export function buildPosterOptionsFromEnv(): GitHubPosterOptions | null {
  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token) return null;

  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '/').split('/');
  const prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : null;
  const runId = process.env.GITHUB_RUN_ID;

  return { token, owner, repo, prNumber, runId };
}

// Re-export context for consumers that need SHA etc.
export { githubContext };
