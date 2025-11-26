#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Installing backend dependencies..."
cd "$ROOT/backend"
npm ci || npm install

echo "Installing frontend dependencies..."
cd "$ROOT/frontend"
npm ci || npm install

echo "Generating Prisma client (backend)..."
cd "$ROOT/backend"
if command -v npx >/dev/null 2>&1; then
  npx prisma generate || true
else
  echo "npx not found — skipping prisma generate"
fi

echo "All done."
