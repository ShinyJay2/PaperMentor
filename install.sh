#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${PAPERMENTOR_REPO_URL:-https://github.com/ShinyJay2/PaperMentor.git}"
CACHE_DIR="${PAPERMENTOR_HOME:-$HOME/.papermentor}/repo"
SCRIPT_PATH="${BASH_SOURCE[0]:-}"
ROOT_DIR=""

if [[ -n "$SCRIPT_PATH" && -f "$SCRIPT_PATH" ]]; then
  ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
fi

if [[ -z "$ROOT_DIR" || ! -d "$ROOT_DIR/skills/papermentor" ]]; then
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

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
DEST="$CODEX_HOME_DIR/skills/papermentor"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST"

cp -R "$ROOT_DIR/skills/papermentor/." "$DEST/"
cp -R "$ROOT_DIR/prompts" "$DEST/prompts"
cp -R "$ROOT_DIR/templates" "$DEST/templates"
cp -R "$ROOT_DIR/examples" "$DEST/examples"
cp -R "$ROOT_DIR/tests" "$DEST/tests"

printf 'PaperMentor installed to %s\n' "$DEST"
printf 'Try: Use $papermentor to scan this paper.\n'
