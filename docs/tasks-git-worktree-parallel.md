# Tasks: Git Worktree Parallel Development (Repo-Agnostic)

**Feature:** `git-worktree-parallel`  
**Design:** `docs/design-git-worktree-parallel.md`  
**Branch prefix:** `feature/git-worktree-parallel`  
**Total tasks:** 7

Execute in order. Each task is independently committable.

**Note:** This feature creates **standalone global infrastructure** outside any specific repo. Tasks create files in `~/.clawdbot/`, not in the financial-analyzer repo. This is by design — the worktree manager works across ALL repos in the Zoe pipeline.

---

## TASK-01: Create global worktree manager module

**Files:** `~/.clawdbot/bin/worktree-manager.ts` (NEW)  
**Depends on:** nothing  
**Estimated size:** L

### What to do
Create the global TypeScript worktree lifecycle manager. This module is **repo-agnostic** — it accepts a repo path as a parameter and manages worktrees for any repo.

### Exact changes
- File: `~/.clawdbot/bin/worktree-manager.ts`
- Export interfaces: `WorktreeMetadata`, `WorktreeRegistry` (see design doc §4)
- Function `createWorktree(repoPath: string, featureSlug: string, branchName: string): Promise<WorktreeMetadata>`:
  - Validate `repoPath` exists and is a directory (throw if not)
  - Extract repo name: `path.basename(repoPath)` — e.g., `financial-analyzer`
  - Generate feature ID: `${featureSlug}-${YYYYMMDDHHMMSS}` (UTC timestamp)
  - Check collision: if `~/worktrees/<repoName>/<featureId>` exists, append `-${uuidv4().slice(0, 8)}`
  - Build worktree path: `~/worktrees/<repoName>/<featureId>/`
  - Create parent directory: `mkdir -p ~/worktrees/<repoName>`
  - Execute in repo context: `cd ${repoPath} && git worktree add -b ${branchName} ~/worktrees/${repoName}/${featureId} origin/main`
  - On failure: remove partial directory (`rm -rf <worktreePath>`), throw descriptive error (include repo name, feature ID, git error)
  - On success: append metadata to `~/.clawdbot/worktrees.json`, return metadata
- Function `cleanupWorktree(repoName: string, featureId: string): Promise<void>`:
  - Find metadata entry in `~/.clawdbot/worktrees.json` matching `repoName` and `featureId`
  - If not found, throw error: "Worktree not found: `<repoName>/<featureId>`"
  - Call `~/.clawdbot/bin/cleanup-worktree.sh <repoPath> <repoName> <featureId>`
  - Update metadata: set `status: "cleaned"`, `cleanedAt: <ISO 8601>`
  - Soft-fail if cleanup script errors (log warning, do not throw)
- Function `getActiveWorktrees(repoName?: string): Promise<WorktreeMetadata[]>`:
  - Read `~/.clawdbot/worktrees.json`
  - Filter `status === "active"`
  - If `repoName` provided, filter by `repoName`
  - Return matching entries
- Function `ensureMetadataFile(): Promise<void>`:
  - If `~/.clawdbot/worktrees.json` missing or corrupt, create `{ worktrees: [] }`
  - Create parent directory `~/.clawdbot/` if missing
  - Log warning if recreated (do not throw)
- Error handling: descriptive errors for disk full, git permission denied, invalid branch, invalid repo path

### Done when
- [ ] Module exports all 4 functions + 2 interfaces
- [ ] `createWorktree()` validates repo path before proceeding
- [ ] `createWorktree()` extracts repo name correctly from repo path
- [ ] `createWorktree()` generates unique feature IDs with collision handling
- [ ] `createWorktree()` executes `git worktree add` in correct repo context
- [ ] `createWorktree()` creates worktree at `~/worktrees/<repoName>/<featureId>/`
- [ ] `cleanupWorktree()` accepts repo name and feature ID (not path)
- [ ] `getActiveWorktrees()` filters by repo name when provided
- [ ] `ensureMetadataFile()` creates `~/.clawdbot/` directory if missing
- [ ] TypeScript compiles: `npx tsc --noEmit ~/.clawdbot/bin/worktree-manager.ts` exits 0
- [ ] Manual smoke test in financial-analyzer repo:
  ```bash
  npx tsx -e "import {createWorktree} from '~/.clawdbot/bin/worktree-manager'; \
  createWorktree('/home/claw/repos/financial-analyzer', 'test', 'feat/test').then(console.log)"
  ```
  → Creates worktree at `~/worktrees/financial-analyzer/test-<timestamp>/`

---

## TASK-02: Create global cleanup script

**Files:** `~/.clawdbot/bin/cleanup-worktree.sh` (NEW)  
**Depends on:** nothing  
**Estimated size:** S

### What to do
Create bash script to remove a worktree and prune Git references. Accepts repo path, repo name, and feature ID as parameters.

### Exact changes
- File: `~/.clawdbot/bin/cleanup-worktree.sh`
- Shebang: `#!/usr/bin/env bash`
- Set: `set -euo pipefail`
- Input: 
  ```bash
  REPO_PATH="$1"   # /home/claw/repos/financial-analyzer
  REPO_NAME="$2"   # financial-analyzer
  FEATURE_ID="$3"  # my-feature-20260309045723
  ```
- Logic:
  ```bash
  WORKTREE_PATH="$HOME/worktrees/$REPO_NAME/$FEATURE_ID"
  
  if [[ -d "$WORKTREE_PATH" ]]; then
    cd "$REPO_PATH"
    git worktree remove "$WORKTREE_PATH" --force || true
  fi
  
  cd "$REPO_PATH"
  git worktree prune
  ```
- Exit 0 always (soft-fail on errors)
- Executable: `chmod +x ~/.clawdbot/bin/cleanup-worktree.sh`

### Done when
- [ ] Script created at `~/.clawdbot/bin/cleanup-worktree.sh`
- [ ] Script is executable (`chmod +x`)
- [ ] Accepts 3 positional arguments: repo path, repo name, feature ID
- [ ] Handles missing worktree gracefully (no error if path doesn't exist)
- [ ] Calls `git worktree remove --force` + `git worktree prune` in repo context
- [ ] Manual test:
  ```bash
  ~/.clawdbot/bin/cleanup-worktree.sh \
    /home/claw/repos/financial-analyzer \
    financial-analyzer \
    test-20260309120000
  ```
  → Removes worktree if exists, exits 0

---

## TASK-03: Initialize global metadata file

**Files:** `~/.clawdbot/worktrees.json` (NEW)  
**Depends on:** nothing  
**Estimated size:** S

### What to do
Create the initial empty global worktree metadata file. This file tracks worktrees across ALL repos.

### Exact changes
- File: `~/.clawdbot/worktrees.json`
- Content:
  ```json
  {
    "worktrees": []
  }
  ```
- Format: 2-space indent, trailing newline
- Create parent directory: `mkdir -p ~/.clawdbot/`
- Permissions: readable/writable by user only (`chmod 600 ~/.clawdbot/worktrees.json`)

### Done when
- [ ] Directory `~/.clawdbot/` exists
- [ ] File created with valid JSON
- [ ] `cat ~/.clawdbot/worktrees.json | jq .` exits 0
- [ ] Permissions are 600 (user-only read/write)

---

## TASK-04: Integration test for worktree lifecycle

**Files:** `~/.clawdbot/bin/__tests__/worktree-manager.test.ts` (NEW)  
**Depends on:** TASK-01, TASK-02, TASK-03  
**Estimated size:** L

### What to do
Write Vitest unit tests covering worktree creation, cleanup, and metadata CRUD. Use temp directories and real Git repos for isolation (test both in-memory and real Git behavior).

### Test scenarios
1. `createWorktree()` generates unique feature ID with timestamp
2. `createWorktree()` extracts repo name from repo path correctly
3. `createWorktree()` creates directory at `~/worktrees/<repoName>/<featureId>/`
4. `createWorktree()` appends metadata to `~/.clawdbot/worktrees.json` with correct repo name
5. `createWorktree()` handles collision by appending UUID suffix
6. `createWorktree()` throws error if repo path does not exist
7. `cleanupWorktree()` removes worktree directory
8. `cleanupWorktree()` updates metadata to `status: "cleaned"`
9. `getActiveWorktrees()` filters only active worktrees
10. `getActiveWorktrees(repoName)` filters by repo name
11. `ensureMetadataFile()` creates file if missing
12. Multi-repo: create worktrees for two different repos, verify no collision
13. Error: `createWorktree()` with invalid branch name throws descriptive error

### Test setup
- Use temp directories for test repos and worktrees
- Mock or use real Git commands (prefer real Git for integration fidelity)
- Clean up after each test (remove temp dirs, reset metadata)

### Done when
- [ ] All 13 scenarios pass
- [ ] Tests use temp directories (clean up after each test)
- [ ] Tests validate multi-repo isolation (worktrees for different repos don't interfere)
- [ ] Test file lives in `~/.clawdbot/bin/__tests__/` (adjacent to the module)
- [ ] `npm run test -- ~/.clawdbot/bin/__tests__/worktree-manager.test.ts` exits 0
- [ ] Coverage: 85%+ branches for worktree-manager.ts

---

## TASK-05: Document global worktree manager

**Files:** `~/.clawdbot/README.md` (NEW)  
**Depends on:** TASK-01, TASK-02  
**Estimated size:** M

### What to do
Document how Zoe and agents should use the global worktree manager. Include example usage for multiple repos, environment variable format, and cleanup triggers.

### Exact changes
- File: `~/.clawdbot/README.md`
- Section: **Worktree Parallel Development (Repo-Agnostic)**
  - **Overview:** Explain that this is a global utility managing worktrees across ALL repos
  - **Directory structure:** `~/worktrees/<repo-name>/<feature-id>/`
  - **Metadata:** `~/.clawdbot/worktrees.json` (global audit log)
  - **How to create a worktree:** `createWorktree(repoPath, featureSlug, branchName)`
  - **How to pass path to agents:** `WORKTREE_PATH=/home/claw/worktrees/<repo-name>/<feature-id>/`
  - **How to clean up:** `cleanupWorktree(repoName, featureId)` (call on PR merge/close)
  - **Error recovery:** `cd <repoPath> && git worktree prune` + manually remove stale directories under `~/worktrees/<repo-name>/`
  - **Multi-repo example:** Show two repos running in parallel with different worktrees
- Example code snippet:
  ```typescript
  import { createWorktree, cleanupWorktree } from '~/.clawdbot/bin/worktree-manager';

  // In Zoe (pipeline start for financial-analyzer)
  const meta1 = await createWorktree(
    '/home/claw/repos/financial-analyzer',
    'my-feature',
    'feat/my-feature'
  );
  console.log(meta1.path); // ~/worktrees/financial-analyzer/my-feature-<timestamp>/

  // In Zoe (pipeline start for user-auth-service)
  const meta2 = await createWorktree(
    '/home/claw/repos/user-auth-service',
    'oauth-flow',
    'feat/oauth-flow'
  );
  console.log(meta2.path); // ~/worktrees/user-auth-service/oauth-flow-<timestamp>/

  // In cleanup handler (PR merge/close for financial-analyzer)
  await cleanupWorktree('financial-analyzer', meta1.featureId);

  // In cleanup handler (PR merge/close for user-auth-service)
  await cleanupWorktree('user-auth-service', meta2.featureId);
  ```

### Done when
- [ ] Section added to `~/.clawdbot/README.md`
- [ ] Documents directory structure: `~/worktrees/<repo-name>/<feature-id>/`
- [ ] Documents global metadata file: `~/.clawdbot/worktrees.json`
- [ ] Example code is copy-pasteable and syntactically correct
- [ ] Multi-repo example shows two repos running in parallel
- [ ] Documents environment variable format and cleanup triggers
- [ ] File is markdown-formatted and readable

---

## TASK-06: Update financial-analyzer docs (reference only)

**Files:** `/home/claw/repos/financial-analyzer/docs/infrastructure.md` (NEW or modified)  
**Depends on:** TASK-05  
**Estimated size:** S

### What to do
Add a brief reference in the financial-analyzer repo docs pointing to the global worktree manager. This is for discoverability — the actual implementation lives outside the repo.

### Exact changes
- File: `/home/claw/repos/financial-analyzer/docs/infrastructure.md`
- Add section: **Worktree Parallel Development**
  - Brief: "Feature pipelines run in isolated Git worktrees managed by a global utility."
  - Location: "See `~/.clawdbot/README.md` for full documentation."
  - Environment variable: "Agents receive `WORKTREE_PATH` env var pointing to the worktree."
  - Local impact: "None. Worktree manager is external; this repo is a consumer."
- If `infrastructure.md` does not exist, create it with this section as the first entry

### Done when
- [ ] Section added or file created
- [ ] Points to `~/.clawdbot/README.md` for full docs
- [ ] Explains that worktree manager is external (not repo-specific)
- [ ] `npm run lint` exits 0 (if linting markdown)

---

## TASK-07: Validate multi-repo isolation (manual test)

**Files:** None (manual testing only)  
**Depends on:** TASK-01, TASK-02, TASK-03, TASK-04  
**Estimated size:** M

### What to do
Perform a manual end-to-end test simulating parallel feature pipelines for two different repos. Verify worktrees are isolated and cleanup works correctly for each repo independently.

### Test procedure
1. **Setup:** Ensure two repos exist locally (e.g., `financial-analyzer` and a test repo)
2. **Create worktree for repo 1:**
   ```bash
   npx tsx -e "import {createWorktree} from '~/.clawdbot/bin/worktree-manager'; \
   createWorktree('/home/claw/repos/financial-analyzer', 'test-feature-1', 'feat/test-1').then(console.log)"
   ```
3. **Create worktree for repo 2:**
   ```bash
   npx tsx -e "import {createWorktree} from '~/.clawdbot/bin/worktree-manager'; \
   createWorktree('/home/claw/repos/test-repo', 'test-feature-2', 'feat/test-2').then(console.log)"
   ```
4. **Verify isolation:**
   - Check `~/worktrees/financial-analyzer/test-feature-1-<timestamp>/` exists
   - Check `~/worktrees/test-repo/test-feature-2-<timestamp>/` exists
   - Verify both worktrees are in `~/.clawdbot/worktrees.json` with correct `repoName` fields
5. **Cleanup worktree for repo 1:**
   ```bash
   npx tsx -e "import {cleanupWorktree} from '~/.clawdbot/bin/worktree-manager'; \
   cleanupWorktree('financial-analyzer', 'test-feature-1-<timestamp>').then(() => console.log('Cleaned'))"
   ```
6. **Verify partial cleanup:**
   - Check `~/worktrees/financial-analyzer/test-feature-1-<timestamp>/` is removed
   - Check `~/worktrees/test-repo/test-feature-2-<timestamp>/` still exists
   - Verify metadata: repo 1 entry has `status: "cleaned"`, repo 2 entry still `status: "active"`
7. **Cleanup worktree for repo 2:**
   ```bash
   npx tsx -e "import {cleanupWorktree} from '~/.clawdbot/bin/worktree-manager'; \
   cleanupWorktree('test-repo', 'test-feature-2-<timestamp>').then(() => console.log('Cleaned'))"
   ```
8. **Verify full cleanup:**
   - Check `~/worktrees/test-repo/test-feature-2-<timestamp>/` is removed
   - Verify metadata: both entries have `status: "cleaned"`

### Done when
- [ ] Both worktrees created successfully with correct paths
- [ ] Metadata file contains two entries with correct `repoName` fields
- [ ] Cleanup for repo 1 does not affect repo 2's worktree
- [ ] Cleanup for repo 2 completes successfully
- [ ] All directories under `~/worktrees/` are removed after cleanup
- [ ] Metadata shows both entries with `status: "cleaned"`
- [ ] Document test results in `~/.clawdbot/test-results.md` (summary + any issues encountered)

---

## Completion Checklist (all tasks)

- [ ] All tasks committed (note: tasks create files outside any repo, document in `~/.clawdbot/`)
- [ ] `npx tsc --noEmit ~/.clawdbot/bin/worktree-manager.ts` exits 0
- [ ] Unit tests pass: `npm run test -- ~/.clawdbot/bin/__tests__/worktree-manager.test.ts` exits 0
- [ ] Manual multi-repo isolation test passed (TASK-07)
- [ ] Documentation complete: `~/.clawdbot/README.md` + financial-analyzer reference
- [ ] PR opened against `main` (financial-analyzer) documenting the integration (TASK-06 only)
- [ ] PR body includes:
  - Summary: "Integrate global worktree manager for parallel development"
  - Location: "Infrastructure lives in `~/.clawdbot/`, not in this repo"
  - Impact: "No code changes in this repo; agents will receive `WORKTREE_PATH` env var"
  - Testing: "Multi-repo isolation validated (see `~/.clawdbot/test-results.md`)"
- [ ] Zoe notified: "Worktree manager ready. Pass `repoPath` to `createWorktree()` when spawning feature pipelines."
