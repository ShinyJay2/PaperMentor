#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-${PAPERMENTOR_TARGET:-codex}}"
REPO_URL="${PAPERMENTOR_REPO_URL:-https://github.com/ShinyJay2/PaperMentor.git}"
CACHE_DIR="${PAPERMENTOR_HOME:-$HOME/.papermentor}/repo"
SCRIPT_PATH="${BASH_SOURCE[0]:-}"
ROOT_DIR=""

if [[ -n "$SCRIPT_PATH" && -f "$SCRIPT_PATH" ]]; then
  ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
fi

if [[ -z "$ROOT_DIR" || ! -f "$ROOT_DIR/scripts/install.mjs" || ! -f "$ROOT_DIR/papermentor.manifest.json" ]]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "PaperMentor install requires git for one-line remote installation." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$CACHE_DIR")"
  if [[ -d "$CACHE_DIR/.git" ]]; then
    git -C "$CACHE_DIR" pull --ff-only >/dev/null
  else
    rm -rf "$CACHE_DIR"
    git clone --depth 1 "$REPO_URL" "$CACHE_DIR" >/dev/null
  fi
  ROOT_DIR="$CACHE_DIR"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "PaperMentor install requires Node.js 18+ on PATH." >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/install.mjs" "$TARGET" "${@:2}"
