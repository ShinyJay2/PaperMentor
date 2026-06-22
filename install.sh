#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
DEST="$CODEX_HOME_DIR/skills/papermentor"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST"

# Install the canonical Codex Skill entrypoint plus bundled production resources.
cp -R "$ROOT_DIR/skills/papermentor/." "$DEST/"
cp -R "$ROOT_DIR/prompts" "$DEST/prompts"
cp -R "$ROOT_DIR/templates" "$DEST/templates"
cp -R "$ROOT_DIR/examples" "$DEST/examples"
cp -R "$ROOT_DIR/tests" "$DEST/tests"

printf 'PaperMentor installed to %s\n' "$DEST"
printf 'Installed bundled resources: prompts, templates, examples, tests.\n'
printf 'Try: Use $papermentor to explain Equation (1) atomically.\n'
