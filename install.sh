#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
DEST="$CODEX_HOME_DIR/skills/papermentor"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$ROOT_DIR/skills/papermentor" "$DEST"

printf 'PaperMentor installed to %s\n' "$DEST"
printf 'Try: Use $papermentor to explain Equation (1) atomically.\n'
