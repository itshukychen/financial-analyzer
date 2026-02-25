#!/usr/bin/env bash
# dev-worktree.sh — spin up an isolated dev environment for a feature branch
#
# Usage:
#   ./scripts/dev-worktree.sh create <branch-name> [port]
#   ./scripts/dev-worktree.sh list
#   ./scripts/dev-worktree.sh remove <branch-name>
#
# Port convention:
#   3000  → production       (~/ prod/financial-analyzer, systemd managed)
#   3001  → dev preview      (main branch, quick iteration)
#   3002+ → feature branches (auto-assigned or explicit)
#
# Worktrees land at: ~/worktrees/financial-analyzer/<branch-name>
# Each gets its own node_modules and a .env.local with PORT set.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_BASE="$HOME/worktrees/financial-analyzer"
BASE_PORT=3002

cmd="${1:-}"

# ─── helpers ────────────────────────────────────────────────────────────────

next_free_port() {
  local port=$BASE_PORT
  while ss -tlnp | grep -q ":$port "; do
    port=$((port + 1))
  done
  echo "$port"
}

# ─── list ───────────────────────────────────────────────────────────────────

if [[ "$cmd" == "list" ]]; then
  echo ""
  echo "  PORT   BRANCH                  PATH"
  echo "  ─────  ──────────────────────  ──────────────────────────────────────────"
  echo "  3000   main (production)       ~/prod/financial-analyzer  [systemd]"
  if ss -tlnp | grep -q ":3001 "; then
    echo "  3001   dev preview              (running)"
  fi
  git -C "$REPO_DIR" worktree list | tail -n +2 | while read -r path hash branch; do
    branch="${branch//[\[\]]/}"
    wt_dir="$WORKTREE_BASE/$branch"
    port_file="$wt_dir/.env.local"
    port="?"
    if [[ -f "$port_file" ]]; then
      port=$(grep PORT "$port_file" | cut -d= -f2)
    fi
    pid=$(ss -tlnp | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    status="stopped"
    [[ -n "$pid" ]] && status="running (pid $pid)"
    printf "  %-6s %-23s %s  [%s]\n" "$port" "$branch" "$wt_dir" "$status"
  done
  echo ""
  exit 0
fi

# ─── create ─────────────────────────────────────────────────────────────────

if [[ "$cmd" == "create" ]]; then
  branch="${2:-}"
  if [[ -z "$branch" ]]; then
    echo "❌ Usage: $0 create <branch-name> [port]"
    exit 1
  fi
  port="${3:-$(next_free_port)}"
  wt_dir="$WORKTREE_BASE/$branch"

  echo "🌿 Creating worktree for '$branch' on port $port..."
  mkdir -p "$WORKTREE_BASE"

  # create branch if it doesn't exist
  if ! git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$branch"; then
    echo "   → Branch '$branch' doesn't exist, creating from main..."
    git -C "$REPO_DIR" branch "$branch" main
  fi

  # add the worktree
  if [[ -d "$wt_dir" ]]; then
    echo "   → Worktree already exists at $wt_dir"
  else
    git -C "$REPO_DIR" worktree add "$wt_dir" "$branch"
  fi

  # install deps + write port config
  echo "📦 Installing dependencies..."
  cd "$wt_dir"
  npm ci --silent

  echo "PORT=$port" > .env.local

  echo ""
  echo "✅ Worktree ready:"
  echo "   Branch : $branch"
  echo "   Dir    : $wt_dir"
  echo "   Port   : $port"
  echo ""
  echo "   Start dev server:"
  echo "     cd $wt_dir && npm run dev -- --port $port"
  echo ""
  echo "   Or run in background:"
  echo "     cd $wt_dir && nohup npm run dev -- --port $port > /tmp/dev-$branch.log 2>&1 &"
  echo ""
  exit 0
fi

# ─── remove ─────────────────────────────────────────────────────────────────

if [[ "$cmd" == "remove" ]]; then
  branch="${2:-}"
  if [[ -z "$branch" ]]; then
    echo "❌ Usage: $0 remove <branch-name>"
    exit 1
  fi
  wt_dir="$WORKTREE_BASE/$branch"

  # kill any dev server on this worktree's port
  if [[ -f "$wt_dir/.env.local" ]]; then
    port=$(grep PORT "$wt_dir/.env.local" | cut -d= -f2)
    pid=$(ss -tlnp | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    if [[ -n "$pid" ]]; then
      echo "🛑 Stopping dev server on port $port (pid $pid)..."
      kill "$pid" 2>/dev/null || true
    fi
  fi

  echo "🗑  Removing worktree '$branch'..."
  git -C "$REPO_DIR" worktree remove "$wt_dir" --force 2>/dev/null || rm -rf "$wt_dir"
  git -C "$REPO_DIR" worktree prune
  echo "✅ Done"
  exit 0
fi

echo "Usage: $0 <create|list|remove> [branch] [port]"
exit 1
