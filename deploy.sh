#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="financial-analyzer"

echo "🚀 [deploy] Starting deployment at $(date)"

cd "$REPO_DIR"

echo "📥 [deploy] Pulling latest code..."
git pull origin main

echo "📦 [deploy] Installing dependencies..."
npm ci

echo "🔨 [deploy] Building..."
npm run build

echo "♻️  [deploy] Restarting service..."
systemctl --user restart "$SERVICE_NAME"

echo "✅ [deploy] Done at $(date)"
