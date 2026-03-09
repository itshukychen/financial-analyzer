# Infrastructure

This document describes the **external infrastructure** that the financial-analyzer repo integrates with as a consumer.

## Worktree Parallel Development

### Overview

Feature pipelines run in isolated **Git worktrees** managed by a **global utility** external to this repo. This enables true parallel development across multiple repos in the Zoe pipeline without branch interference.

### How It Works

1. **Pipeline creation:** Zoe calls `createWorktree('/home/claw/repos/financial-analyzer', featureSlug, branchName)`
2. **Agents spawned:** Each agent receives `WORKTREE_PATH` environment variable pointing to the worktree
3. **Isolated development:** All git commands, builds, and tests run within the worktree
4. **PR & cleanup:** After PR merge/close, `cleanupWorktree(repoName, featureId)` removes the worktree

### Directory Structure

```
~/worktrees/
├── financial-analyzer/
│   ├── my-feature-20260309120000/  ← Isolated copy of this repo
│   ├── another-feature-20260309120130/
│   └── ...
└── [other repos]/
```

### Environment Variable

Agents receive:
```
WORKTREE_PATH=/home/claw/worktrees/financial-analyzer/my-feature-<timestamp>/
```

This repo's code should **read** `WORKTREE_PATH` if needed but does **not** manage worktrees directly.

### For Developers

- **Local development:** Clone normally, work on `main` or feature branches directly
- **Pipeline development:** Zoe handles worktree setup; agents have `WORKTREE_PATH` set
- **No action needed:** This repo is a consumer, not a manager

### Full Documentation

See `~/.clawdbot/README.md` for complete documentation of:
- Worktree lifecycle (create, cleanup, metadata)
- Multi-repo isolation examples
- Error recovery procedures
- API function reference
