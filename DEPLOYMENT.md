# DEPLOYMENT.md — Production Deployment Guide

[Home](README.md) > [Docs Index](DOCS.md) > Deployment

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Deployment Flow](#deployment-flow)
3. [Manual Deployment](#manual-deployment)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Rollback Procedure](#rollback-procedure)
6. [Monitoring Commands](#monitoring-commands)
7. [Database Migrations During Deploy](#database-migrations-during-deploy)
8. [Emergency Procedures](#emergency-procedures)
9. [See Also](#see-also)

---

## Environment Overview

| | Production | Dev Workspace | Feature Worktree |
|---|---|---|---|
| **Path** | `~/prod/financial-analyzer` | `~/repos/financial-analyzer` | `~/worktrees/financial-analyzer/feature/<name>` |
| **Port** | `3000` | `3001` | `3002+` |
| **Branch** | `main` (always) | Any | `feature/<name>` |
| **Managed by** | CD pipeline only | Developers/agents | Developers/agents |
| **DB file** | `~/prod/financial-analyzer/data/reports.db` | Per workspace | Per worktree |
| **systemd** | `financial-analyzer.service` | Not managed | Not managed |

**Critical rule: Never manually run `npm run build` or `systemctl restart` in `~/prod/` as part of development work.** Only `deploy.sh` — triggered by GitHub Actions — should operate on the production directory.

---

## Deployment Flow

Code reaches production through this automated pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PIPELINE                          │
│                                                                 │
│  Developer                                                      │
│    │  git push origin feature/my-feature                        │
│    ▼                                                            │
│  GitHub                                                         │
│    │  Pull Request opened                                       │
│    ▼                                                            │
│  GitHub Actions (CI) — .github/workflows/ci.yaml               │
│    │  ✓ npm run lint                                            │
│    │  ✓ npx tsc --noEmit                                        │
│    │  ✓ npm run test:coverage                                   │
│    │  ✓ npm run test:e2e                                        │
│    ▼                                                            │
│  PR Review + Approval                                           │
│    │  Reviewer approves                                         │
│    │  Developer merges to main                                  │
│    ▼                                                            │
│  GitHub Actions (CD) — .github/workflows/report.yml            │
│    │  Triggers on push to main                                  │
│    │  Sends webhook to production server                        │
│    ▼                                                            │
│  Production Server (self-hosted runner)                         │
│    │  Executes deploy.sh                                        │
│    ▼                                                            │
│  deploy.sh                                                      │
│    │  1. cd ~/prod/financial-analyzer                           │
│    │  2. git pull origin main                                   │
│    │  3. npm ci                                                 │
│    │  4. npm run build                                          │
│    │  5. systemctl --user restart financial-analyzer            │
│    ▼                                                            │
│  Production Service Up                                          │
│    │  Port 3000 serving new version                             │
│    ▼                                                            │
│  Operator verifies: curl http://localhost:3000/api/reports      │
└─────────────────────────────────────────────────────────────────┘
```

Typical deploy time: **3-5 minutes** from merge to service restart.

---

## Manual Deployment

Use manual deployment only when CI/CD is unavailable (e.g., GitHub Actions outage, self-hosted runner down).

```bash
# 1. SSH to the production server
ssh claw@production-server

# 2. Navigate to prod directory
cd ~/prod/financial-analyzer

# 3. Pull latest main
git pull origin main

# 4. Install dependencies (ci = clean install, uses lock file)
npm ci

# 5. Build the application
npm run build

# 6. Restart the service
systemctl --user restart financial-analyzer

# 7. Verify it came back up
systemctl --user status financial-analyzer
sleep 3
curl http://localhost:3000/api/reports/latest | python3 -m json.tool | head -5
```

**If the build fails**, do not restart the service. The previous build remains in `.next/` and the old version continues to serve traffic. Fix the issue and retry from step 3.

---

## Pre-Deployment Checklist

Complete all items before merging to `main`:

```
[ ] All tests pass locally: npm run test
[ ] No TypeScript errors: npx tsc --noEmit
[ ] No lint errors: npm run lint
[ ] PR has been approved by at least one reviewer
[ ] CI is green (all checks passing on the PR)
[ ] Database migrations have been tested:
      - If schema changes exist, tested migration on a copy of prod DB
      - Verified migration is non-destructive (no data loss)
[ ] Backup taken (if schema changes): cp data/reports.db data/reports.db.pre-deploy
[ ] Environment variables documented:
      - Any new env vars added to DEV.md and set in production .env.local
[ ] API.md updated if endpoint behavior changed
[ ] No sensitive data (API keys, secrets) committed to git
```

---

## Rollback Procedure

**Target: complete rollback in under 5 minutes.**

### Option 1: Revert the Git Commit (Recommended)

```bash
cd ~/prod/financial-analyzer

# Find the last working commit
git log --oneline -10

# Revert to the last known-good commit
# (replace <commit-sha> with the actual hash)
git checkout <commit-sha>

# Rebuild and restart
npm ci
npm run build
systemctl --user restart financial-analyzer

# Verify
curl http://localhost:3000/api/reports/latest
```

### Option 2: Revert to Previous Build (Fast, no rebuild)

If the previous `.next/` build is still intact (i.e., only one bad deploy has happened):

```bash
cd ~/prod/financial-analyzer

# The previous build might be in .next.bak if deploy.sh backs it up
# Otherwise, revert git and restart (no need to rebuild):
git checkout HEAD~1  # go back one commit
systemctl --user restart financial-analyzer  # uses old .next/ if still present

# Verify
systemctl --user status financial-analyzer
curl http://localhost:3000/
```

**Note:** Next.js doesn't automatically keep old builds. Option 1 is the reliable path.

### Option 3: Database Rollback

If a migration caused data issues:

```bash
# Stop service
systemctl --user stop financial-analyzer

# Restore pre-deploy backup
cp data/reports.db.pre-deploy data/reports.db

# Roll back the code
cd ~/prod/financial-analyzer
git checkout <pre-migration-commit>

# Rebuild and start
npm ci
npm run build
systemctl --user start financial-analyzer
```

---

## Monitoring Commands

### Service Status

```bash
# Check if service is running
systemctl --user status financial-analyzer

# Full logs (last 100 lines)
journalctl --user -u financial-analyzer -n 100 --no-pager

# Follow live logs
journalctl --user -u financial-analyzer -f

# Check for errors only
journalctl --user -u financial-analyzer --since "1 hour ago" | grep -i "error\|warn\|fail"
```

### Application Health

```bash
# Basic health check
curl -s http://localhost:3000/api/reports/latest | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK:', d.get('date'))"

# Check all key endpoints
for endpoint in "reports/latest" "fear-greed" "options/snapshot?ticker=SPWX"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/$endpoint")
  echo "$endpoint → HTTP $status"
done
```

### Process Monitoring

```bash
# Check memory and CPU usage
systemctl --user show financial-analyzer --property=MemoryCurrent,CPUUsageNSec

# Check port is listening
ss -tlnp | grep :3000
# or
lsof -i :3000
```

---

## Database Migrations During Deploy

The application applies migrations **automatically** at startup. No manual `ALTER TABLE` or script execution is needed.

### How it Works

On startup, `lib/db.ts → migrate()` checks:
1. Whether required tables exist (using `sqlite_master` queries)
2. Whether required columns exist (using `PRAGMA table_info`)
3. If any are missing, creates them

This means:
- **Migrations are additive only** — new tables and columns are added, never dropped
- **Zero downtime for additive changes** — the new code starts serving with the updated schema
- **Old data is preserved** — existing rows are not modified by migrations

### Verifying Migration After Deploy

```bash
# Check schema after deploy
sqlite3 ~/prod/financial-analyzer/data/reports.db ".schema"

# Verify the new table/column exists
sqlite3 ~/prod/financial-analyzer/data/reports.db "PRAGMA table_info(new_table_name);"
```

### If Migration Fails

If the service fails to start after deploy, check the logs:

```bash
journalctl --user -u financial-analyzer -n 50 --no-pager | grep -i "sql\|database\|sqlite"
```

Common migration failures:
- **Disk full** — `df -h ~/prod/financial-analyzer/data/`
- **File permissions** — `ls -la ~/prod/financial-analyzer/data/`
- **Corrupt DB** — run `sqlite3 data/reports.db "PRAGMA integrity_check;"`

---

## Emergency Procedures

### Service is Down, Deploy.sh is Unavailable

```bash
# Start the service manually using the existing build
cd ~/prod/financial-analyzer
systemctl --user start financial-analyzer

# If .next/ doesn't exist, build manually
npm ci && npm run build
systemctl --user start financial-analyzer
```

### Disk Full

```bash
# Check disk usage
df -h ~

# Find large files
du -sh ~/prod/financial-analyzer/.next
du -sh ~/prod/financial-analyzer/data/reports.db

# Compress old backups
gzip ~/prod/backups/*.db

# Vacuum the database to reclaim space
sqlite3 ~/prod/financial-analyzer/data/reports.db "VACUUM;"
```

### Anthropic API Key Expired / Rotated

```bash
# Update in production
nano ~/prod/financial-analyzer/.env.local
# Update ANTHROPIC_API_KEY=sk-ant-...

# Restart service to pick up new key
systemctl --user restart financial-analyzer

# Test
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Authorization: Bearer $REPORT_SECRET" \
  -d '{"period":"eod"}'
```

---

## See Also

- [DEV.md](DEV.md) — Development environment and worktree setup
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Diagnosing service failures
- [DATABASE.md](DATABASE.md) — Database backup and recovery
- [CONTRIBUTING.md](CONTRIBUTING.md) — CI/CD pipeline overview
