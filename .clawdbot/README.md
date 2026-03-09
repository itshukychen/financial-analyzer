# ClawdBot Infrastructure

This directory contains internal infrastructure and utilities used by the ClawdBot pipeline orchestrator.

## Worktree Parallel Development

### Overview

The worktree manager enables true parallel development by isolating each feature pipeline run into a dedicated Git worktree. This prevents workspace contention when multiple agents work on different features simultaneously.

**Key benefits:**
- Each feature gets its own isolated filesystem at `~/worktrees/<featureId>/financial-analyzer`
- Agents work in parallel without conflicts
- Automatic cleanup after PR merge/close
- Metadata audit log tracks all worktree lifecycle events

### How It Works

1. **Zoe (Pipeline Orchestrator)** receives a feature request
2. **Zoe calls** `createWorktree(featureSlug, branchName)`
3. **Worktree is created** at `~/worktrees/<featureId>/financial-analyzer`
4. **Zoe passes** the worktree path to agents via `WORKTREE_PATH` environment variable
5. **Agents** run all commands scoped to the worktree
6. **PR merge/close** triggers `cleanupWorktree(featureId)`
7. **Worktree is removed**, metadata updated

### API Reference

#### `createWorktree(featureSlug: string, branchName: string, agents?: string[]): Promise<WorktreeMetadata>`

Creates a new Git worktree for a feature and returns metadata.

**Parameters:**
- `featureSlug` (string): Human-readable feature identifier (e.g., `git-worktree-parallel`)
- `branchName` (string): Git branch name (e.g., `feat/git-worktree-parallel`)
- `agents` (optional string[]): List of agents working on this feature

**Returns:** `WorktreeMetadata` with:
- `featureId`: Unique identifier (e.g., `git-worktree-parallel-20260309045723`)
- `status`: Always `"active"` for new worktrees
- `path`: Full path to worktree root (e.g., `/home/claw/worktrees/git-worktree-parallel-20260309045723/financial-analyzer`)
- `createdAt`: ISO 8601 timestamp
- `branch`: The feature branch name
- `agents`: List of agents assigned to this worktree

**Example:**
```typescript
import { createWorktree } from './.clawdbot/worktree-manager';

const meta = await createWorktree('my-feature', 'feat/my-feature', ['Architect', 'Engineer']);
console.log(`Created worktree at: ${meta.path}`);
// Output: Created worktree at: /home/claw/worktrees/my-feature-20260309045723/financial-analyzer
```

#### `cleanupWorktree(featureId: string): Promise<void>`

Removes a worktree and updates metadata to `status: "cleaned"`.

**Parameters:**
- `featureId` (string): Feature ID returned from `createWorktree()`

**Behavior:**
- Calls `.clawdbot/scripts/cleanup-worktree.sh` to remove the worktree
- Soft-fails if removal fails (logs warning, does not throw)
- Updates metadata file to mark worktree as cleaned

**Example:**
```typescript
import { cleanupWorktree } from './.clawdbot/worktree-manager';

await cleanupWorktree('my-feature-20260309045723');
// Worktree is now removed, metadata updated
```

#### `getActiveWorktrees(): Promise<WorktreeMetadata[]>`

Returns all currently active (non-cleaned) worktrees.

**Returns:** Array of `WorktreeMetadata` objects with `status === "active"`

**Example:**
```typescript
import { getActiveWorktrees } from './.clawdbot/worktree-manager';

const active = await getActiveWorktrees();
console.log(`${active.length} worktrees in use`);
```

#### `ensureMetadataFile(): Promise<void>`

Ensures the metadata file exists and is valid JSON. Called automatically by other functions.

### Passing Worktree Path to Agents

After creating a worktree, pass the path to agents via the `WORKTREE_PATH` environment variable:

```typescript
const meta = await createWorktree('my-feature', 'feat/my-feature');

// Spawn agents with environment variable
spawnAgent({
  env: {
    ...process.env,
    WORKTREE_PATH: meta.path,  // e.g., /home/claw/worktrees/my-feature-123/financial-analyzer
  },
});
```

Agents should use this environment variable to scope all file operations:

```typescript
// In agent code
const workdir = process.env.WORKTREE_PATH || process.cwd();
const filePath = path.join(workdir, 'app/some/file.tsx');
```

### Metadata File Structure

The metadata is stored in `.clawdbot/worktrees.json` (gitignored, local to main checkout only):

```json
{
  "worktrees": [
    {
      "featureId": "git-worktree-parallel-20260309045723",
      "status": "active",
      "createdAt": "2026-03-09T04:57:23.000Z",
      "agents": ["Architect", "Engineer"],
      "branch": "feat/git-worktree-parallel",
      "path": "/home/claw/worktrees/git-worktree-parallel-20260309045723/financial-analyzer"
    },
    {
      "featureId": "other-feature-20260309040000",
      "status": "cleaned",
      "createdAt": "2026-03-09T04:00:00.000Z",
      "agents": [],
      "branch": "feat/other-feature",
      "path": "/home/claw/worktrees/other-feature-20260309040000/financial-analyzer",
      "cleanedAt": "2026-03-09T04:30:00.000Z"
    }
  ]
}
```

**Notes:**
- File is append-only for audit purposes (never delete entries, only update `status`)
- `cleanedAt` is only set when `status` changes to `"cleaned"`
- File is not committed to git — each developer/environment maintains its own metadata

### Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| "Worktree creation failed: disk full" | Insufficient space in `~/worktrees/` | Free disk space and retry |
| "Worktree creation failed: permission denied" | Insufficient Git permissions | Check Git configuration and SSH keys |
| "Worktree creation failed: invalid branch" | Invalid branch name (e.g., spaces) | Use valid Git branch names |
| Feature ID collision | Multiple attempts to create same feature ID | UUID suffix added automatically |

### Cleanup Troubleshooting

If a worktree cleanup fails:

1. **Check metadata file:**
   ```bash
   cat .clawdbot/worktrees.json | jq '.worktrees[] | select(.status == "active")'
   ```

2. **Manual cleanup:**
   ```bash
   git worktree list                # List all worktrees
   git worktree remove --force WORKTREE_PATH
   git worktree prune
   ```

3. **Update metadata manually:**
   Edit `.clawdbot/worktrees.json` and change `status` to `"cleaned"`, add `cleanedAt` timestamp

### File Structure

```
.clawdbot/
├── README.md                    ← You are here
├── worktree-manager.ts          ← Core module with createWorktree, cleanupWorktree, etc.
├── worktrees.json               ← Metadata file (gitignored, created at runtime)
├── .gitignore
├── scripts/
│   └── cleanup-worktree.sh      ← Bash script to remove worktree
├── logs/                        ← Agent logs (gitignored)
├── prompts/                     ← Prompt templates
└── active-tasks.json            ← Runtime state (gitignored)
```

---

**Version:** 1.0  
**Last updated:** 2026-03-09  
**Status:** Production
