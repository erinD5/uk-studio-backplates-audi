#!/usr/bin/env bash
set -euo pipefail

# Run from repo root:
#   bash github-essentials/build-full-app-folder.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/github-full-app"

echo "Building upload-ready folder at: $OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

rsync -av --prune-empty-dirs \
  --exclude ".git/" \
  --exclude ".next/" \
  --exclude ".next-dev/" \
  --exclude "node_modules/" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude "terminals/" \
  --exclude "agent-transcripts/" \
  --exclude "github-full-app/" \
  --exclude "github-essentials/" \
  "$ROOT_DIR/" "$OUT_DIR/"

cp -R "$ROOT_DIR/github-essentials/.github" "$OUT_DIR/.github"
cp "$ROOT_DIR/github-essentials/CODEOWNERS" "$OUT_DIR/CODEOWNERS"
cp "$ROOT_DIR/github-essentials/CONTRIBUTING.md" "$OUT_DIR/CONTRIBUTING.md"
cp "$ROOT_DIR/github-essentials/SECURITY.md" "$OUT_DIR/SECURITY.md"

echo ""
echo "Done."
echo "Upload this folder to GitHub:"
echo "  $OUT_DIR"
