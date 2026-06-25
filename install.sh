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

copy_skill() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$ROOT_DIR/skills/papermentor/." "$dest/"
  cp -R "$ROOT_DIR/prompts" "$dest/prompts"
  cp -R "$ROOT_DIR/templates" "$dest/templates"
  cp -R "$ROOT_DIR/examples" "$dest/examples"
  cp -R "$ROOT_DIR/tests" "$dest/tests"
  mkdir -p "$dest/scripts" "$dest/assets"
  cp "$ROOT_DIR/scripts/papermentor-session.mjs" "$dest/scripts/papermentor-session.mjs"
  cp -R "$ROOT_DIR/assets/fonts" "$dest/assets/fonts"
  cp -R "$ROOT_DIR/assets/mathjax" "$dest/assets/mathjax"
}

install_cli() {
  local skill_dir="$1"
  if [[ "${PAPERMENTOR_INSTALL_CLI:-1}" == "0" ]]; then
    return
  fi
  local bin_dir="${PAPERMENTOR_BIN_DIR:-$HOME/.local/bin}"
  mkdir -p "$bin_dir"
  local bin_path="$bin_dir/papermentor"
  local pm_path="$bin_dir/pm"
  local script_path="$skill_dir/scripts/papermentor-session.mjs"
  local quoted_script_path
  printf -v quoted_script_path '%q' "$script_path"
  cat > "$bin_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PAPERMENTOR_CLI="papermentor"
exec node $quoted_script_path "\$@"
EOF
  chmod +x "$bin_path"
  cat > "$pm_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PAPERMENTOR_CLI="pm"
exec node $quoted_script_path "\$@"
EOF
  chmod +x "$pm_path"
  printf 'PaperMentor CLI installed: %s\n' "$bin_path"
  printf 'PaperMentor palette shortcut installed: %s\n' "$pm_path"
  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *) printf 'Note: add %s to PATH to run `papermentor` from any shell.\n' "$bin_dir" ;;
  esac
}

install_codex() {
  local codex_home="${CODEX_HOME:-$HOME/.codex}"
  local dest="$codex_home/skills/papermentor"
  copy_skill "$dest"
  printf 'PaperMentor installed for Codex: %s\n' "$dest"
  install_cli "$dest"
}

install_claude() {
  local claude_home="${CLAUDE_HOME:-$HOME/.claude}"
  local dest="$claude_home/skills/papermentor"
  copy_skill "$dest"
  printf 'PaperMentor installed for Claude Code: %s\n' "$dest"
  install_cli "$dest"
}

case "$TARGET" in
  codex) install_codex ;;
  claude|claude-code) install_claude ;;
  all|both) install_codex; install_claude ;;
  *)
    echo "Usage: install.sh [codex|claude|all]" >&2
    exit 2
    ;;
esac

printf 'Try: pm <paper.pdf-or-url>\n'
