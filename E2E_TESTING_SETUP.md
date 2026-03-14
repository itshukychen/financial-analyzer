# E2E Testing Setup Guide

## System Dependencies

The E2E tests use Playwright which requires system libraries to run headless browser tests.

### Linux System Libraries Required

If you encounter errors like:
```
error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file
```

Install the required dependencies using one of these methods:

#### Method 1: Using Playwright's installer (Recommended)
```bash
sudo npx playwright install-deps
```

#### Method 2: Manual APT installation
```bash
sudo apt-get install -y \
  libxdamage1 \
  libgtk-3-0t64 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libatk1.0-0t64 \
  libcairo-gobject2 \
  libcairo2 \
  libasound2t64
```

## Running E2E Tests

### Prerequisites
1. Install system dependencies (see above)
2. Install Node.js dependencies: `npm install`
3. Ensure your app can build: `npm run build`
4. Database fixture is created automatically by Playwright global setup

### Running Tests

**All E2E tests:**
```bash
npm run test:e2e
```

**Specific test file:**
```bash
npm run test:e2e -- e2e/dashboard.spec.ts
```

**Specific test by name:**
```bash
npm run test:e2e -- --grep "placeholder widgets are present"
```

**Interactive UI mode:**
```bash
npm run test:e2e:ui
```

**Watch mode (dev):**
```bash
npm run test:e2e -- --watch
```

## Test Status

### Passing Categories
- ✅ Navigation tests (with proper waits added)
- ✅ Dashboard tests (with error filtering)
- ✅ Charts tests
- ✅ Accessibility tests (with focus handling improvements)
- ✅ Options AI Analysis tests (with assertion fixes)

### Skipped/Pending
- ⏭️ Option Projection AI tests: These tests are currently skipped because the AI forecast UI feature is not yet implemented on the `/reports/option-projection` page. To enable these tests, implement the following components on that page:
  - AI Forecast section with `data-testid="ai-forecast-section"`
  - Price targets with data-testids for conservative, base, and aggressive targets
  - Regime badge and confidence score displays
  - Regime change alert component
  - Trading levels section with support/resistance levels

## Test Improvements Made

1. **Timeout Enhancements**: All tests now use explicit 10-second timeouts for network-dependent operations
2. **Wait States**: Added `waitForLoadState('networkidle')` to ensure page resources are fully loaded
3. **Error Filtering**: Console error tests now filter out non-critical warnings (favicon, ResizeObserver, etc.)
4. **Focus Handling**: Accessibility tests include proper delays for focus state changes (100ms)
5. **Assertion Fixes**: Corrected locator assertions to use proper Playwright patterns

## CI/CD Integration

The tests are run automatically in CI. See the GitHub Actions workflow for current configuration.

### Common CI Issues

**"Cannot find module" errors:**
- Run `npm install` to ensure dependencies are up to date
- Clear `node_modules` and `.next` cache if issues persist

**Timeout errors in CI:**
- CI may be slower than local machines; timeout values are set to 10s for network operations
- If tests still timeout, consider increasing further or investigating API response times

**Flaky tests:**
- If tests pass locally but fail in CI, it's often due to environment differences
- Check for hardcoded paths, timezone assumptions, or timing-dependent logic
