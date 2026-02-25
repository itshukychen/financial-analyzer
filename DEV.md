# DEV.md — Development Workflow

> **Read this before touching anything.**

## Two Environments, One Rule

| Environment | Path | Port | Managed by |
|---|---|---|---|
| **Production** | `~/prod/financial-analyzer` | **3000** | CD pipeline only |
| **Dev workspace** | `~/repos/financial-analyzer` | 3001+ | Agents / devs |

**The prod clone is untouchable.** Only `deploy.sh` (triggered by GitHub Actions after CI passes on `main`) ever runs there. Never manually build, restart, or modify files in `~/prod/`.

---

## Starting a Feature

1. **Create a worktree** — isolated copy of the repo on its own branch, its own port:

   ```bash
   bash ~/repos/financial-analyzer/scripts/dev-worktree.sh create feature/my-feature
   ```

   This:
   - Creates branch `feature/my-feature` off `main`
   - Checks it out at `~/worktrees/financial-analyzer/feature/my-feature`
   - Installs deps
   - Auto-assigns a port (3002+)

2. **Start the dev server** in that worktree:

   ```bash
   cd ~/worktrees/financial-analyzer/feature/my-feature
   npm run dev -- --port <assigned-port>
   ```

3. **Iterate.** Edits in the worktree don't affect prod or any other worktree.

4. **When done:** open a PR from the feature branch. CI runs. On merge → CD deploys to prod automatically.

5. **Clean up** the worktree after merge:

   ```bash
   bash ~/repos/financial-analyzer/scripts/dev-worktree.sh remove feature/my-feature
   ```

---

## Port Convention

| Port | Purpose |
|---|---|
| `3000` | **Production** — do not use |
| `3001` | Dev preview (quick main-branch iteration) |
| `3002` | First feature worktree |
| `3003` | Second feature worktree |
| `3004+` | Additional worktrees (auto-assigned) |

The `dev-worktree.sh create` script auto-assigns the next free port starting at 3002.

---

## What Lives Where

```
~/prod/financial-analyzer/     ← CD-only. Never touch manually.
~/repos/financial-analyzer/    ← Dev workspace. Edit freely.
~/worktrees/financial-analyzer/ ← Git worktrees for parallel features.
  feature/spx-report/
  feature/watchlist-ui/
  ...
```

---

## Quick Reference

```bash
# See all environments + their status
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh list

# Create a new feature env
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh create feature/my-feature

# Remove after merge
bash ~/repos/financial-analyzer/scripts/dev-worktree.sh remove feature/my-feature

# Check prod service
systemctl --user status financial-analyzer

# Manually trigger a prod restart (only after deploy.sh runs, not instead of it)
systemctl --user restart financial-analyzer
```

---

## Rules for Agents

- ✅ Work in `~/repos/financial-analyzer` or a worktree
- ✅ Run `npm run dev` on port 3001+ 
- ✅ Build and test freely in your worktree
- ✅ Push branches, open PRs
- ❌ Never run `npm run build` in `~/prod/`
- ❌ Never `systemctl restart financial-analyzer` as part of dev work
- ❌ Never push directly to `main` for feature work — use PRs
