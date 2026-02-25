#!/usr/bin/env bash
set -euo pipefail

# Production deploy — always operates on the prod clone, never the dev workspace.
# Triggered by the GitHub Actions self-hosted runner after CI passes on main.

PROD_DIR="/home/claw/prod/financial-analyzer"
SERVICE_NAME="financial-analyzer"

echo "🚀 [deploy] Starting at $(date)"
echo "📁 [deploy] Target: $PROD_DIR"

cd "$PROD_DIR"

echo "📥 [deploy] Pulling latest main..."
git pull origin main

echo "📦 [deploy] Installing dependencies..."
npm ci

echo "🔨 [deploy] Building..."
npm run build

echo "♻️  [deploy] Restarting service..."
systemctl --user restart "$SERVICE_NAME"

echo "✅ [deploy] Done at $(date)"
