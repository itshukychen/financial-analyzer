# Implementation Tasks: CI Screenshot Automation

**Feature ID:** ci-screenshots  
**Status:** Ready for Implementation  
**Date:** 2026-03-11

---

## Task 1: Project Setup and Dependencies

Install required npm packages and set up the initial directory structure for the CI screenshot pipeline. This includes adding Playwright, pixelmatch, sharp for image processing, simple-git for git operations, and Handlebars for report templating. Create the base directory structure under `scripts/ci-screenshots/` with subdirectories for utilities and configuration files.

**Acceptance Criteria:**
- All required packages installed and listed in package.json
- `scripts/ci-screenshots/` directory created with proper structure
- TypeScript types available for all dependencies
- npm script `ci:screenshots` defined in package.json
- Directory structure matches design doc specification

**Dependencies:** pixelmatch, sharp, simple-git, @typescript-eslint/parser, handlebars, pngjs

---

## Task 2: Route Manifest Configuration

Create the static route manifest file that defines which routes should be screenshotted and maps components to their affected routes. This manifest will be the source of truth for determining screenshot coverage and will include configuration for viewports, custom wait selectors, and elements to hide.

**Acceptance Criteria:**
- `route-manifest.ts` created with all current application routes
- Routes include: `/`, `/markets`, `/reports`, `/watchlist`, `/alerts`
- Each route has component dependencies listed
- Viewport configurations defined (mobile 375px, tablet 768px, desktop 1440px)
- Manifest includes optional configuration for custom wait selectors
- TypeScript interfaces exported for type safety

**Files to create:** `scripts/ci-screenshots/route-manifest.ts`, `scripts/ci-screenshots/viewport-configs.ts`

---

## Task 3: Git Diff Analyzer Implementation

Implement the git diff analyzer that parses the difference between the PR branch and main branch to identify modified files. The analyzer should classify files by type (component, page, style, api, other) and return a structured list of changes.

**Acceptance Criteria:**
- `git-diff-analyzer.ts` implemented using simple-git library
- Correctly identifies added, modified, and deleted files
- Classifies files into categories: component, page, style, api, other
- Handles edge cases (binary files, renames, moves)
- Returns structured DiffAnalyzerOutput with summary statistics
- Unit tests cover various git diff scenarios
- Handles git errors gracefully (detached HEAD, merge conflicts)

**Files to create:** `scripts/ci-screenshots/git-diff-analyzer.ts`, `__tests__/ci-screenshots/git-diff-analyzer.test.ts`

---

## Task 4: Component-to-Route Mapper Implementation

Build the component mapper that takes the list of modified files and maps them to affected routes using the route manifest. The mapper should handle both direct changes (page.tsx files) and indirect changes (components imported by pages).

**Acceptance Criteria:**
- `component-mapper.ts` implemented with route lookup logic
- Correctly identifies direct page modifications
- Maps component changes to dependent routes via manifest
- Handles global CSS changes (affects all routes)
- Deduplicates routes that are affected by multiple changes
- Assigns priority levels (direct vs. indirect changes)
- Returns structured AffectedRoute array
- Unit tests cover all mapping scenarios

**Files to create:** `scripts/ci-screenshots/component-mapper.ts`, `__tests__/ci-screenshots/component-mapper.test.ts`

---

## Task 5: Screenshot Capture Engine

Implement the Playwright-based screenshot capture engine that navigates to each affected route, waits for content to load, and captures screenshots at all configured viewport sizes. The engine should handle loading states, dynamic content, and capture failures gracefully.

**Acceptance Criteria:**
- `screenshot-capturer.ts` implemented with Playwright
- Launches headless Chromium browser
- Navigates to each route with networkidle wait
- Captures screenshots at mobile, tablet, and desktop viewports
- Implements 1000ms buffer wait for charts/animations
- Saves screenshots with consistent naming convention: `{route-slug}-{viewport}.png`
- Stores metadata (timestamp, URL, dimensions, file size) alongside images
- Handles navigation errors and timeouts gracefully
- Reuses browser instance across routes for performance
- Implements CSS injection to hide dynamic content (timestamps, live indicators)
- Unit tests with mocked Playwright API

**Files to create:** `scripts/ci-screenshots/screenshot-capturer.ts`, `__tests__/ci-screenshots/capturer.test.ts`

---

## Task 6: Baseline Manager Implementation

Create the baseline manager that fetches reference screenshots from the main branch using GitHub Actions artifact cache. The manager should handle cache misses gracefully and support on-demand baseline generation.

**Acceptance Criteria:**
- `baseline-manager.ts` implemented with artifact cache integration
- Attempts to download baselines from previous CI runs on main branch
- Falls back to generating baselines if cache miss
- Stores baselines in `.ci-screenshots/baselines/` directory
- Implements baseline metadata file (commit hash, timestamp)
- Returns map of route+viewport → baseline filepath
- Identifies missing baselines and reports them
- Handles corrupted or incomplete baselines gracefully
- Unit tests with mocked artifact downloads

**Files to create:** `scripts/ci-screenshots/baseline-manager.ts`, `__tests__/ci-screenshots/baseline-manager.test.ts`

---

## Task 7: Visual Diff Engine Implementation

Build the visual diff engine that compares new screenshots against baselines using pixelmatch. The engine should generate pixel-accurate difference percentages and create visual diff overlay images highlighting changed regions.

**Acceptance Criteria:**
- `visual-diff-engine.ts` implemented with pixelmatch and sharp
- Loads PNG images from filesystem using pngjs
- Handles dimension mismatches by resizing baselines
- Performs pixel-level comparison with configurable threshold (0.1 default)
- Calculates difference percentage (mismatched pixels / total pixels)
- Classifies changes: unchanged (<0.1%), minor (0.1-2%), major (>2%)
- Generates diff overlay images with red pixels for differences
- Saves diff images with `-diff.png` suffix
- Returns structured Comparison array with all results
- Unit tests verify diff accuracy with known test images

**Files to create:** `scripts/ci-screenshots/visual-diff-engine.ts`, `__tests__/ci-screenshots/diff-engine.test.ts`

---

## Task 8: Report Generator Implementation

Implement the markdown report generator that creates a comprehensive visual comparison report from the diff results. The report should include summary statistics, before/after/diff image comparisons, and be formatted for GitHub PR comments.

**Acceptance Criteria:**
- `report-generator.ts` implemented with Handlebars templating
- Generates markdown report with summary table
- Includes sections for: major changes, minor changes, unchanged routes, new routes
- Embeds before/after/diff images using relative paths
- Uses collapsible `<details>` sections for each route comparison
- Calculates and displays summary statistics
- Formats pixel difference percentages to 3 decimal places
- Links to workflow artifacts for full screenshot downloads
- Returns both markdown content and structured summary object
- Report template stored in separate file for maintainability
- Unit tests verify markdown formatting and data inclusion

**Files to create:** `scripts/ci-screenshots/report-generator.ts`, `scripts/ci-screenshots/templates/report.hbs`, `__tests__/ci-screenshots/report-generator.test.ts`

---

## Task 9: GitHub Integration Module

Create the GitHub integration module that posts the report as a PR comment and sets the GitHub check status based on the diff results. The module should use GitHub's REST API via the actions toolkit.

**Acceptance Criteria:**
- `github-poster.ts` implemented using @actions/github
- Posts markdown report as PR comment
- Updates existing comment if re-run (avoids spam)
- Creates GitHub check with status: success (no changes), neutral (minor/major changes)
- Includes check summary with route counts
- Handles API errors gracefully (rate limits, permissions)
- Works with both PR events and push events
- Unit tests with mocked GitHub API client

**Files to create:** `scripts/ci-screenshots/github-poster.ts`, `__tests__/ci-screenshots/github-poster.test.ts`

---

## Task 10: Main Orchestrator Script

Build the main orchestrator script (`index.ts`) that coordinates all components in the correct sequence. This is the entry point invoked by the GitHub Actions workflow and should handle the complete pipeline from diff analysis to report posting.

**Acceptance Criteria:**
- `index.ts` implemented with full pipeline orchestration
- Reads configuration from environment variables (BASE_BRANCH, HEAD_BRANCH, PR_NUMBER, etc.)
- Executes components in correct order: diff → map → build → baseline → capture → compare → report → post
- Implements proper error handling and cleanup (kills dev server on failure)
- Logs progress with emoji indicators for each stage
- Writes output files: `report.md`, `summary.json`, screenshots, diffs
- Returns appropriate exit code (0 = success, 1 = failure)
- Supports `--local` flag for local development/testing
- Integration test covers full pipeline with sample repo

**Files to create:** `scripts/ci-screenshots/index.ts`, `__tests__/ci-screenshots/integration.test.ts`

---

## Task 11: Utility Functions and Helpers

Implement utility functions used across multiple components, including image loading, file operations, logging, and common helpers for path sanitization and process management.

**Acceptance Criteria:**
- `utils/image-loader.ts` with PNG load/save functions
- `utils/file-utils.ts` with path sanitization and directory operations
- `utils/logger.ts` with colored console output and log levels
- `utils/process-utils.ts` with dev server start/stop helpers
- All utilities properly typed with TypeScript
- Utility functions handle edge cases (missing directories, invalid paths)
- Unit tests for each utility module

**Files to create:** `scripts/ci-screenshots/utils/image-loader.ts`, `scripts/ci-screenshots/utils/file-utils.ts`, `scripts/ci-screenshots/utils/logger.ts`, `scripts/ci-screenshots/utils/process-utils.ts`

---

## Task 12: GitHub Actions Workflow Configuration

Create the GitHub Actions workflow file that triggers the screenshot pipeline on PR events and push to main. The workflow should handle dependency installation, caching, baseline management, and artifact uploads.

**Acceptance Criteria:**
- `.github/workflows/ci-screenshots.yml` created
- Triggers on PR events: opened, synchronize, reopened
- Triggers on push to main for baseline generation
- Runs on ubuntu-latest runner with 15-minute timeout
- Checks out code with full git history (fetch-depth: 0)
- Installs Node.js 20 with npm cache
- Installs Playwright browsers with dependencies
- Builds Next.js app in production mode
- Restores baseline cache from previous main branch runs
- Executes `npm run ci:screenshots`
- Uploads screenshots as artifacts with 30-day retention
- Saves baseline cache on main branch pushes
- Posts PR comment using actions/github-script
- Sets GitHub check status based on summary.json
- Includes proper error handling (if: always() for artifact upload)

**Files to create:** `.github/workflows/ci-screenshots.yml`

---

## Task 13: Local Development and Testing Support

Add support for running the screenshot pipeline locally for development and debugging. This includes a local mode flag, environment variable defaults, and documentation for developers.

**Acceptance Criteria:**
- `--local` flag supported in main orchestrator
- Local mode uses sensible defaults (compares HEAD to origin/main)
- Skips GitHub API calls in local mode
- Outputs report to console and `.ci-screenshots/` directory
- Provides mock data when baselines don't exist locally
- README section added with local testing instructions
- Developers can run `npm run ci:screenshots:local` to test changes
- Script validates required environment before running

**Files to update:** `scripts/ci-screenshots/index.ts`, `package.json`, `README.md`

---

## Task 14: Comprehensive Documentation

Write complete documentation covering pipeline usage, troubleshooting, configuration, and maintenance. This includes inline code comments, README sections, and a troubleshooting guide.

**Acceptance Criteria:**
- Inline JSDoc comments for all exported functions
- README.md section explaining CI screenshots feature
- Troubleshooting guide for common issues (flaky routes, cache misses, dimension mismatches)
- Configuration guide for route manifest
- Developer guide for adding new routes to screenshot coverage
- Performance tuning guide for threshold adjustments
- Examples of interpreting diff results
- Architecture diagram included in docs/

**Files to update:** `README.md`, `docs/ci-screenshots-troubleshooting.md`

---

## Task 15: End-to-End Testing and Validation

Perform end-to-end validation of the complete pipeline using a real PR with intentional UI changes. Verify accuracy, performance, and report quality.

**Acceptance Criteria:**
- Create test PR with known visual changes
- Pipeline completes successfully in under 5 minutes
- All affected routes captured at all viewports
- Baseline comparison produces accurate diff percentages
- Report includes correct before/after/diff images
- GitHub check status reflects actual changes
- Artifacts uploaded and accessible
- Cache properly saves and restores baselines
- No false positives or false negatives
- Performance metrics within acceptable range
- Developer feedback collected and addressed

**Validation checklist:**
- [ ] Small CSS change detected as minor (<2% diff)
- [ ] Layout change detected as major (>2% diff)
- [ ] New route marked as "new" with no baseline
- [ ] Unchanged route correctly identified as unchanged
- [ ] Failed route handled gracefully without pipeline failure
- [ ] Report posted as PR comment
- [ ] Artifacts downloadable
- [ ] Baseline cache persists across runs

---

## Task 16: Production Rollout and Monitoring

Deploy the screenshot pipeline to the main branch and monitor its performance across multiple PRs. Gather developer feedback and tune thresholds based on real-world usage.

**Acceptance Criteria:**
- Workflow merged to main branch
- Enabled for all new PRs automatically
- Monitor first 10 PRs for issues
- Collect developer feedback via survey/interview
- Tune diff thresholds based on false positive rate
- Update route manifest as new routes added
- Document any flaky routes requiring custom configuration
- Success metrics achieved (see PRD)
- No CI failures caused by screenshot pipeline
- Average pipeline execution time under 5 minutes

**Monitoring dashboard:**
- Pipeline execution time trend
- Success/failure rate
- Artifact size over time
- Developer satisfaction score
- Coverage percentage (routes captured / total routes)

---

## Summary

**Total Tasks:** 16  
**Estimated Effort:** 4-5 weeks (with parallelization)  
**Dependencies:** Tasks 1-2 are prerequisites for all others  
**Critical Path:** Tasks 3-10 are sequential and form the core pipeline  
**Testing:** Tasks 11, 13, 15 focus on quality assurance  
**Production:** Tasks 14, 16 focus on documentation and rollout  

**Recommended Implementation Order:**
1. Tasks 1-2 (Setup)
2. Tasks 3-4 (Analysis and mapping)
3. Tasks 5-7 (Capture and comparison)
4. Tasks 8-9 (Reporting)
5. Task 10 (Orchestration)
6. Task 11 (Utilities)
7. Task 12 (GitHub Actions)
8. Tasks 13-14 (Local testing and docs)
9. Tasks 15-16 (Validation and rollout)

**Parallelization Opportunities:**
- Tasks 5, 6, 7 can be developed in parallel after Task 4
- Tasks 11, 13 can be done anytime after Task 1
- Task 14 can begin as soon as core components (3-10) are complete
