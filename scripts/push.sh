#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$#" -eq 0 ]; then
  echo "Usage: npm run push -- \"commit message\""
  exit 1
fi

MSG="$*"

git add -A
git restore --staged .github 2>/dev/null || true

if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -m "$MSG"
fi

git push origin main
npm run deploy

echo "Done: pushed to main and deployed to GitHub Pages."
