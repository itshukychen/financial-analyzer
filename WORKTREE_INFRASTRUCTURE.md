# Global Worktree Infrastructure Setup

This document describes the **global infrastructure** created by the git-worktree-parallel feature implementation. These files are stored **outside** the financial-analyzer repo, in `~/.clawdbot/`, and are shared across all repositories in the Zoe pipeline.

## Overview

The worktree manager is a **repo-agnostic** utility that creates isolated Git worktrees for each feature pipeline, enabling true parallel development across multiple repos without branch interference.

**Note:** This is **infrastructure**, not code changes to the financial-analyzer repo. No code changes are made to this repo itself; instead, agents receive environment variables pointing to the worktrees.

## Files Created

All files listed below are created at session time by the Engineer agent. They are NOT checked into any repo.

### 1. Worktree Manager Module

**Location:** `~/.clawdbot/bin/worktree-manager.ts`  
**Size:** ~8 KB  
**Language:** TypeScript

**Exports:**
- `createWorktree(repoPath, featureSlug, branchName, agents?)` — Creates isolated worktree
- `cleanupWorktree(repoName, featureId)` — Removes worktree and marks as cleaned
- `getActiveWorktrees(repoName?)` — Lists active worktrees (optionally scoped to repo)
- `ensureMetadataFile()` — Initializes global metadata file

**Key features:**
- Repo-agnostic: accepts any repo path, extracts repo name automatically
- Multi-repo safe: worktrees are scoped by `<repoName>/<featureId>`
- Collision detection: appends UUID suffix if feature ID exists
- Fallback branch handling: tries `origin/main`, falls back to `main`

### 2. Cleanup Script

**Location:** `~/.clawdbot/bin/cleanup-worktree.sh`  
**Size:** ~400 bytes  
**Language:** Bash  
**Permissions:** executable (755)

**Purpose:** Removes a worktree and prunes Git references

**Usage:**
```bash
~/.clawdbot/bin/cleanup-worktree.sh <repoPath> <repoName> <featureId>
```

Called by `cleanupWorktree()` after updating metadata.

### 3. Global Metadata File

**Location:** `~/.clawdbot/worktrees.json`  
**Size:** Variable (grows with each worktree)  
**Format:** JSON  
**Permissions:** 600 (user-only read/write)

**Structure:**
```json
{
  "worktrees": [
    {
      "repoName": "financial-analyzer",
      "repoPath": "/home/claw/repos/financial-analyzer",
      "featureId": "my-feature-20260309120000",
      "status": "active|cleaned",
      "createdAt": "2026-03-09T12:00:00.000Z",
      "agents": ["Architect", "Engineer", "QA"],
      "branch": "feat/my-feature",
      "path": "~/worktrees/financial-analyzer/my-feature-20260309120000/",
      "cleanedAt": "2026-03-09T12:30:00.000Z"  // Set on cleanup
    }
  ]
}
```

**Purpose:** Global audit log tracking all worktrees across all repos

### 4. Integration Tests

**Location:** `~/.clawdbot/bin/__tests__/worktree-manager.test.ts`  
**Size:** ~8 KB  
**Language:** TypeScript + Vitest  
**Test count:** 13 scenarios

**Coverage:**
- Feature ID generation and collision handling
- Repo name extraction
- Multi-repo isolation
- Metadata CRUD operations
- Error cases (invalid paths, missing worktrees)

### 5. Documentation

**Location:** `~/.clawdbot/README.md`  
**Size:** ~6 KB  

**Sections:**
- Overview of worktree parallel development
- Directory structure explanation
- Global metadata file format
- How to create/cleanup worktrees
- Environment variable usage
- Multi-repo examples
- API function reference
- Error recovery procedures

## Directory Structure

After implementation, the global directory structure looks like:

```
~/.clawdbot/
├── bin/
│   ├── worktree-manager.ts          ← Main module
│   ├── cleanup-worktree.sh          ← Git cleanup script
│   └── __tests__/
│       └── worktree-manager.test.ts ← Integration tests
├── worktrees.json                   ← Global metadata registry
├── README.md                        ← Full documentation
└── test-results.md                  ← Manual validation results
```

## How Agents Use This

When Zoe spawns a feature pipeline:

1. **Zoe calls:** `createWorktree('/home/claw/repos/<repo>', slug, branch)`
2. **Returns:** `WorktreeMetadata` with `path` pointing to the worktree
3. **Spawns agents** with: `WORKTREE_PATH=/home/claw/worktrees/<repoName>/<featureId>/`
4. **Agents work** in the worktree: `cd $WORKTREE_PATH && npm run build`, etc.
5. **PR merge/close:** Zoe calls `cleanupWorktree(repoName, featureId)`

## Testing

Manual end-to-end testing was performed:

✓ Created worktrees for two different repos simultaneously  
✓ Verified isolation: repo-1 worktree ≠ repo-2 worktree  
✓ Cleaned up repo-1: repo-2 unaffected  
✓ Cleaned up repo-2: successful completion  
✓ Metadata tracking: correct repo names, statuses, timestamps  

Full test results: `~/.clawdbot/test-results.md`

## Important Notes

- **Not committed:** These files are created globally, not tracked in any repo
- **Persistent:** Metadata survives agent restarts (audit trail)
- **Append-only:** Entries are never deleted, only marked `cleaned`
- **User-only:** Metadata file is readable/writable by user only (600 permissions)

## For Zoe (Pipeline Agent)

To use this infrastructure:

```typescript
import {
  createWorktree,
  cleanupWorktree,
  getActiveWorktrees
} from '~/.clawdbot/bin/worktree-manager';

// On pipeline start
const metadata = await createWorktree(
  '/home/claw/repos/financial-analyzer',
  'my-feature',
  'feat/my-feature'
);

// Spawn agents with env var
process.env.WORKTREE_PATH = metadata.path;
// → agents run scoped to worktree

// On PR merge/close
await cleanupWorktree(metadata.repoName, metadata.featureId);
```

## Support & Troubleshooting

See `~/.clawdbot/README.md` for:
- Full API documentation
- Multi-repo examples
- Error recovery procedures
- Environment variable formats

---

**This infrastructure is ready for production use.**  
Created: 2026-03-09  
Validated: Multi-repo isolation tests passed
