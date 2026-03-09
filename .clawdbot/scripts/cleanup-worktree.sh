#!/usr/bin/env bash
set -euo pipefail

FEATURE_ID="$1"
WORKTREE_PATH="$HOME/worktrees/$FEATURE_ID"

if [[ -d "$WORKTREE_PATH" ]]; then
  git worktree remove "$WORKTREE_PATH" --force || true
fi

git worktree prune
