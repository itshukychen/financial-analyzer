# CI Screenshot Pipeline — Troubleshooting Guide

## Common Issues

### Flaky Routes

**Symptom:** A route shows minor changes on every run even without code changes.

**Causes & Fixes:**
- **Animated content** — add `extraWaitMs: 2000` to the route manifest entry
- **Live price data** — add the element's selector to `hideSelectors`
- **Loading spinners** — add `waitSelectors` for a stable element that only appears after load
- **Random data** — if the page generates random content, consider mocking the data source

```typescript
// Example: flaky route fix in route-manifest.ts
{
  path: '/markets',
  hideSelectors: ['[data-testid="live-indicator"]', '.price-flash', '.sparkline'],
  extraWaitMs: 2000,
}
```

### Cache Misses

**Symptom:** All routes appear as "new" (no baseline comparison).

**Causes & Fixes:**
- The baseline cache key changed (e.g., you modified `route-manifest.ts`)
- No baseline was saved yet (first run on main)
- Cache was evicted (GitHub Actions caches expire after 7 days of no use)

**Fix:** Push a commit to `main` to regenerate baselines. The pipeline will capture fresh baselines and save them to the cache.

### Dimension Mismatches

**Symptom:** Diff percentages are very high on routes that haven't visually changed.

**Cause:** The baseline was captured at a different viewport size than the current screenshot.

**Fix:** The diff engine automatically resizes baselines to match current dimensions using `sharp`. If this still fails, delete the stale baseline and let it regenerate:
```bash
rm -rf .ci-screenshots/baselines/
```

### Screenshot Capture Failures

**Symptom:** Some routes show `success: false` in `metadata.json`.

**Common causes:**
- Route returns a 404/500 error
- Page takes too long to reach `networkidle`
- `waitSelectors` element never appears

**Debugging:**
```bash
# Run locally with verbose output
npm run ci:screenshots:local

# Check metadata for error messages
cat .ci-screenshots/output/metadata.json | jq '.[] | select(.success == false)'
```

### Large Diff Percentages from Layout Shifts

**Symptom:** Major changes detected but the UI looks identical.

**Cause:** CLS (Cumulative Layout Shift) during screenshot capture.

**Fix:** Increase `extraWaitMs` or add a `waitSelector` for a stable element that only appears after layout settles:
```typescript
waitSelectors: ['[data-testid="chart-ready"]'],
extraWaitMs: 1500,
```

### GitHub API Rate Limits

**Symptom:** `Failed to post PR comment` in workflow logs.

**Cause:** Too many API calls within the rate limit window.

**Fix:** The pipeline handles this gracefully — it logs a warning but does not fail. Check rate limit status:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
```

### Dev Server Not Starting

**Symptom:** All screenshots fail with connection refused errors.

**Fix in CI:** Ensure the `npm run start` step completes before the pipeline runs. The workflow waits up to 30 seconds for the server.

**Fix locally:** Start the dev server before running `npm run ci:screenshots:local`:
```bash
npm run dev &
sleep 5
npm run ci:screenshots:local
```

## Performance Tuning

### Pipeline taking too long (>5 min)

- Reduce `extraWaitMs` on routes that don't need it
- Limit viewports per route with the `viewports` config:
  ```typescript
  viewports: ['desktop'] // skip mobile and tablet for this route
  ```
- Only capture routes with significant UI (exclude pure API/redirect routes)

### Artifact size too large

Screenshots at 1440px desktop can be 500KB+. Options:
- Reduce JPEG quality in `screenshot-capturer.ts` (or use JPEG format)
- Reduce retention days in the workflow (currently 30 days)
- Archive old artifacts with a cleanup workflow

## Architecture Overview

```
scripts/ci-screenshots/
├── index.ts                  # Orchestrator entry point
├── route-manifest.ts         # Route coverage configuration
├── viewport-configs.ts       # Viewport size definitions
├── git-diff-analyzer.ts      # Parse git diff → changed files
├── component-mapper.ts       # Map files → affected routes
├── screenshot-capturer.ts    # Playwright capture engine
├── baseline-manager.ts       # Baseline storage/retrieval
├── visual-diff-engine.ts     # Pixelmatch comparison
├── report-generator.ts       # Markdown report builder
├── github-poster.ts          # GitHub API integration
├── templates/
│   └── report.hbs            # Handlebars report template
└── utils/
    ├── logger.ts             # Colored logging
    ├── file-utils.ts         # Path/file helpers
    ├── image-loader.ts       # PNG load/save
    └── process-utils.ts      # Dev server management
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_BRANCH` | `origin/main` | Branch to compare against |
| `HEAD_BRANCH` | `HEAD` | Branch being tested |
| `PR_NUMBER` | — | PR number for comment posting |
| `GITHUB_TOKEN` | — | GitHub API token |
| `GITHUB_REPOSITORY` | — | `owner/repo` |
| `GITHUB_SHA` | `unknown` | Head commit SHA |
| `GITHUB_RUN_ID` | — | Run ID for artifact URLs |
| `BASE_URL` | `http://localhost:3000` | Dev server URL |
| `OUTPUT_DIR` | `.ci-screenshots/output` | Where to write outputs |
| `BASELINE_DIR` | `.ci-screenshots/baselines` | Where baselines are stored |

### Classification Thresholds

Edit `scripts/ci-screenshots/visual-diff-engine.ts`:
```typescript
const UNCHANGED_THRESHOLD = 0.1; // < 0.1% diff → unchanged
const MAJOR_THRESHOLD = 2.0;     // > 2.0% diff → major
// Between these → minor
```
