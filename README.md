This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CI Screenshot Pipeline

Automated visual regression detection — captures screenshots of modified routes on every PR and compares them against the main-branch baseline.

### How it works

1. **Git diff** identifies which files changed between your branch and `main`
2. **Route mapper** determines which UI routes are affected
3. **Playwright** captures screenshots at mobile (375px), tablet (768px), and desktop (1440px)
4. **Pixelmatch** compares against baseline screenshots from `main`
5. **Report** posted as a PR comment with before/after/diff images

### Running locally

```bash
# Start your dev server first
npm run dev

# In another terminal, run the screenshot pipeline locally
npm run ci:screenshots:local
```

Local mode uses `HEAD` vs `origin/main` and skips GitHub API calls.
Output is written to `.ci-screenshots/output/`.

### Configuration

Edit `scripts/ci-screenshots/route-manifest.ts` to add or remove routes from coverage.

Each route entry supports:
- `components` — file paths that affect this route
- `waitSelectors` — CSS selectors to wait for before capture
- `hideSelectors` — elements to hide (timestamps, live badges)
- `extraWaitMs` — additional wait for charts/animations

### Adding a new route

1. Add an entry to `ROUTE_MANIFEST` in `scripts/ci-screenshots/route-manifest.ts`
2. List all component dependencies for the route
3. Run locally to verify the route is captured correctly

### Threshold tuning

Change classification thresholds in `scripts/ci-screenshots/visual-diff-engine.ts`:
- `UNCHANGED_THRESHOLD` (default 0.1%) — below this → unchanged
- `MAJOR_THRESHOLD` (default 2%) — above this → major change

### Troubleshooting

See `docs/ci-screenshots-troubleshooting.md` for common issues.
