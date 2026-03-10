# Technical Design: Git Worktree Parallel Development (Repo-Agnostic)

**Status:** Draft  
**Author:** Architect Agent  
**Date:** 2026-03-09  
**PRD:** `docs/prd-git-worktree-parallel.md`  
**Tasks:** `docs/tasks-git-worktree-parallel.md`

---

## 1. Overview

This feature isolates each feature pipeline run into a dedicated Git worktree, enabling true parallel development across **any repository** in the Zoe pipeline. Worktrees are organized by repo name: `~/worktrees/<repo-name>/<feature-id>/`. The worktree manager is a **standalone global utility** (not tied to any specific repo), storing metadata in `~/.clawdbot/worktrees.json`. When Zoe adds new repos to the pipeline later, they all use the same worktree infrastructure without modification.

**Key Architectural Changes from Original:**
1. **Worktree manager is standalone** — lives in `~/.clawdbot/bin/worktree-manager.ts` (global, outside any repo)
2. **Global metadata registry** — `~/.clawdbot/worktrees.json` tracks worktrees across all repos
3. **Repo-scoped directory structure** — `~/worktrees/<repo-name>/<feature-id>/` (repo name extracted from repo path)
4. **Pipeline passes repo path** — worktree manager accepts `repoPath` as parameter, derives repo name
5. **Agents scoped by env var** — `WORKTREE_PATH` points to the specific repo worktree

**Open Question Decisions:**
1. **Worktree path to agents:** Environment variable `WORKTREE_PATH` (e.g., `/home/claw/worktrees/financial-analyzer/my-feature-20260309045723/`)
2. **Metadata committed?** No — stored in `~/.clawdbot/worktrees.json`, persists globally, never committed to any repo
3. **Feature ID generation:** User-provided slug + timestamp suffix (e.g., `git-worktree-parallel-20260309045723`) with collision fallback to UUID

---

## 2. Change Surface

### Files Modified
None. (All new infrastructure is standalone.)

### Files Created
| File | Purpose |
|------|---------|
| `~/.clawdbot/bin/worktree-manager.ts` | Global worktree lifecycle manager (create, cleanup, metadata CRUD) |
| `~/.clawdbot/worktrees.json` | Global audit log of all worktrees across all repos |
| `~/.clawdbot/bin/cleanup-worktree.sh` | Bash script: `git worktree remove` + metadata update |

### Files Deleted
None.

---

## 3. Schema Changes

None. (Metadata is JSON file, not SQLite.)

---

## 4. TypeScript Interfaces / Types

```typescript
// ~/.clawdbot/bin/worktree-manager.ts
export interface WorktreeMetadata {
  repoName: string;              // e.g., "financial-analyzer", "user-auth-service"
  repoPath: string;              // e.g., "/home/claw/repos/financial-analyzer"
  featureId: string;             // e.g., "git-worktree-parallel-20260309045723"
  status: "active" | "cleaned";
  createdAt: string;             // ISO 8601
  agents: string[];              // ["Architect", "Engineer", "QA", "Reviewer"]
  branch: string;                // e.g., "feat/git-worktree-parallel"
  path: string;                  // e.g., "~/worktrees/financial-analyzer/my-feature-123/"
  cleanedAt?: string;            // ISO 8601, set when cleaned
}

export interface WorktreeRegistry {
  worktrees: WorktreeMetadata[];
}
```

---

## 5. API Changes

No HTTP API changes. This is internal infrastructure.

---

## 6. Component Changes

### `~/.clawdbot/bin/worktree-manager.ts` (NEW)

**Exports:**
- `createWorktree(repoPath: string, featureSlug: string, branchName: string): Promise<WorktreeMetadata>` — creates worktree, updates global metadata, returns metadata
- `cleanupWorktree(repoName: string, featureId: string): Promise<void>` — removes worktree, updates metadata to `status: "cleaned"`
- `getActiveWorktrees(repoName?: string): Promise<WorktreeMetadata[]>` — reads metadata file, filters `status === "active"` (optionally scoped to one repo)
- `ensureMetadataFile(): Promise<void>` — creates `~/.clawdbot/worktrees.json` if missing, with empty `{ worktrees: [] }`

**Logic:**
- **Repo name extraction:** `path.basename(repoPath)` — e.g., `/home/claw/repos/financial-analyzer` → `"financial-analyzer"`
- **Feature ID generation:** `${featureSlug}-${YYYYMMDDHHMMSS}` (timestamp in UTC)
- **Collision detection:** if `~/worktrees/<repoName>/<featureId>` exists, append `-${uuidv4().slice(0, 8)}`
- **Worktree path:** `~/worktrees/<repoName>/<featureId>/` (note: no repo name duplication in path)
- **Git command:** Execute in `repoPath` context:
  ```bash
  cd ${repoPath}
  git worktree add -b ${branchName} ~/worktrees/${repoName}/${featureId} origin/main
  ```
- **Error handling:** if `git worktree add` fails, remove partial directory, throw descriptive error (include repo name and feature ID)

### `~/.clawdbot/bin/cleanup-worktree.sh` (NEW)

**Purpose:** Bash wrapper for `git worktree remove` + `git worktree prune`

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="$1"       # /home/claw/repos/financial-analyzer
REPO_NAME="$2"       # financial-analyzer
FEATURE_ID="$3"      # my-feature-20260309045723

WORKTREE_PATH="$HOME/worktrees/$REPO_NAME/$FEATURE_ID"

if [[ -d "$WORKTREE_PATH" ]]; then
  cd "$REPO_PATH"
  git worktree remove "$WORKTREE_PATH" --force || true
fi

cd "$REPO_PATH"
git worktree prune
```

Called by `cleanupWorktree()` after updating metadata.

---

## 7. Page Changes

None. (Infrastructure only.)

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Zoe (Pipeline Orchestrator)                                    │
│  1. Receives feature request from user                          │
│  2. Calls createWorktree(repoPath, featureSlug, branchName)     │
│  3. Receives WORKTREE_PATH                                      │
│  4. Spawns agents with env WORKTREE_PATH=...                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────────────────┐
         │  ~/.clawdbot/bin/worktree-manager.ts (GLOBAL)        │
         │  - createWorktree(repoPath, featureSlug, branchName) │
         │    → derives repoName from repoPath                  │
         │    → mkdir ~/worktrees/<repoName>/<featureId>        │
         │    → cd <repoPath> && git worktree add ...           │
         │    → append to ~/.clawdbot/worktrees.json            │
         │  - cleanupWorktree(repoName, featureId)              │
         │    → cleanup-worktree.sh <repoPath> <repoName> <id>  │
         │    → update metadata: status="cleaned"               │
         └──────────────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────────────────┐
         │  ~/worktrees/<repoName>/<featureId>/                 │
         │  Example: ~/worktrees/financial-analyzer/feat-123/   │
         │  ├── app/                                            │
         │  ├── lib/                                            │
         │  ├── .git   (worktree-specific)                      │
         │  └── ...                                             │
         │                                                      │
         │  Example: ~/worktrees/user-auth-service/auth-456/    │
         │  ├── src/                                            │
         │  ├── tests/                                          │
         │  └── ...                                             │
         └──────────────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────────────────┐
         │  Agents: Architect, Engineer, QA, Reviewer           │
         │  - Read env WORKTREE_PATH on startup                 │
         │  - Execute all commands scoped to worktree           │
         │  - Commit to feature branch in worktree              │
         │  - Multiple repos' agents can run simultaneously     │
         └──────────────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────────────────┐
         │  PR Merge/Close Event (any repo)                     │
         │  → cleanupWorktree(repoName, featureId)              │
         │  → removes ~/worktrees/<repoName>/<featureId>/       │
         │  → updates metadata status="cleaned"                 │
         └──────────────────────────────────────────────────────┘
```

---

## 9. Multi-Repo Parallel Example

**Scenario:** Zoe spawns feature pipelines for two repos simultaneously:
- Repo A: `financial-analyzer`, feature `oil-prices-chart`
- Repo B: `user-auth-service`, feature `oauth-integration`

**Worktree paths created:**
- `~/worktrees/financial-analyzer/oil-prices-chart-20260309120000/`
- `~/worktrees/user-auth-service/oauth-integration-20260309120130/`

**Metadata entries in `~/.clawdbot/worktrees.json`:**
```json
{
  "worktrees": [
    {
      "repoName": "financial-analyzer",
      "repoPath": "/home/claw/repos/financial-analyzer",
      "featureId": "oil-prices-chart-20260309120000",
      "status": "active",
      "createdAt": "2026-03-09T12:00:00Z",
      "agents": ["Architect", "Engineer", "QA", "Reviewer"],
      "branch": "feat/oil-prices-chart",
      "path": "~/worktrees/financial-analyzer/oil-prices-chart-20260309120000/"
    },
    {
      "repoName": "user-auth-service",
      "repoPath": "/home/claw/repos/user-auth-service",
      "featureId": "oauth-integration-20260309120130",
      "status": "active",
      "createdAt": "2026-03-09T12:01:30Z",
      "agents": ["Architect", "Engineer", "QA"],
      "branch": "feat/oauth-integration",
      "path": "~/worktrees/user-auth-service/oauth-integration-20260309120130/"
    }
  ]
}
```

**Result:** Both pipelines execute in parallel without interference. Cleanup is scoped by repo name and feature ID.

---

## 10. Sequencing Notes

1. Worktree creation is **synchronous** — pipeline waits for `createWorktree()` to complete before spawning any agent.
2. If worktree creation fails, pipeline **aborts immediately** — user is notified via Telegram, no agents are spawned.
3. Cleanup is **asynchronous** — triggered by PR webhook, does not block PR merge/close.
4. Metadata file is **append-only** for audit purposes — never delete entries, only update `status` field.
5. **Multi-repo safety:** Repo name is part of the worktree path and metadata key, preventing cross-repo collisions.

---

## 11. Error Handling

| Error | Action | User Notification |
|-------|--------|-------------------|
| Insufficient disk space | Abort before agent spawn, remove partial worktree | ❌ "Worktree creation failed for `<repoName>/<featureId>`: disk full. Free space in `~/worktrees/` and retry." |
| Feature ID collision (after retry) | Generate UUID suffix, notify user of new ID | ⚠️ "Feature ID `my-feature-20260309` exists in `<repoName>`. Using `my-feature-20260309-a1b2c3d4`." |
| Git worktree add fails | Abort, remove partial directory, log error | ❌ "Worktree creation failed for `<repoName>/<featureId>`: [git error]. Check Git permissions and retry." |
| Cleanup fails (git worktree remove) | Log soft failure, continue pipeline completion | ⚠️ "Worktree cleanup failed for `<repoName>/<featureId>`. Manual cleanup: `cd <repoPath> && git worktree prune`." |
| Metadata file corrupt/missing | Create new empty file, log warning | ⚠️ "Worktree metadata reset. Existing worktrees may need manual cleanup." |
| Invalid repo path (directory does not exist) | Abort immediately, do not create worktree | ❌ "Worktree creation failed: repo path `<repoPath>` does not exist." |

---

## 12. Migration Notes

**Existing worktrees from repo-specific implementation:**
- Old path: `~/worktrees/<featureId>/financial-analyzer`
- New path: `~/worktrees/financial-analyzer/<featureId>/`

**Migration strategy (out of scope for this feature):**
- Manual cleanup: remove all existing worktrees under old structure (`rm -rf ~/worktrees/*`)
- Metadata reset: remove `.clawdbot/worktrees.json` from financial-analyzer repo (no longer used)
- New worktrees will use global metadata at `~/.clawdbot/worktrees.json`

**No automated migration required** — this is new infrastructure, not a schema change.

---

## 13. Open Technical Questions

None. All PRD open questions resolved inline above.

---

**Design approved by Zoe before Engineer begins.**
