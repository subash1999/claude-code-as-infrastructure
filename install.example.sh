#!/usr/bin/env bash
# Config as code (Part 6): idempotent install.
# Clone this repo AS your agent home dir (e.g. ~/.claude), then run this.
# Backs up existing files before overwrite. Safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${CLAUDE_DIR:-$HOME/.claude}"
BACKUP="$TARGET/.install-backup-$(date +%Y%m%d-%H%M%S)"

command -v claude >/dev/null || { echo "ERROR: 'claude' CLI not found"; exit 1; }
command -v node   >/dev/null || { echo "ERROR: node not found"; exit 1; }

echo "==> install target: $TARGET"

# Back up then copy (idempotent). Skip if running in-place (repo IS the target).
if [ "$SCRIPT_DIR" != "$TARGET" ]; then
  mkdir -p "$TARGET"
  for item in model-registry.example.yaml resolve.mjs privacy routing deepseek-mcp-server; do
    if [ -e "$TARGET/$item" ]; then
      mkdir -p "$BACKUP"; cp -R "$TARGET/$item" "$BACKUP/"; echo "  backed up: $item"
    fi
    cp -R "$SCRIPT_DIR/$item" "$TARGET/$item"
  done
fi

# Build + register the MCP server.
( cd "$TARGET/deepseek-mcp-server" && npm install --no-audit --no-fund )

# Env check (never echo the key).
[ -n "${ANTHROPIC_API_KEY:-}" ] && echo "  ✓ ANTHROPIC_API_KEY set" || echo "  ✗ set ANTHROPIC_API_KEY in your shell"
[ -n "${DEEPSEEK_API_KEY:-}" ]  && echo "  ✓ DEEPSEEK_API_KEY set"  || echo "  ✗ set DEEPSEEK_API_KEY  (https://platform.deepseek.com/api_keys)"

if [ -n "${DEEPSEEK_API_KEY:-}" ] && ! claude mcp list 2>/dev/null | grep -q '^deepseek-v4:'; then
  claude mcp add -s user --env="DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" deepseek-v4 -- \
    node "$TARGET/deepseek-mcp-server/server.mjs" && echo "  ✓ deepseek-v4 registered"
fi

# Validate the registry parses.
node -e "import('yaml').then(m=>m.parse(require('fs').readFileSync('$TARGET/model-registry.example.yaml','utf8'))&&console.log('  ✓ registry parses'))" 2>/dev/null \
  || echo "  (install 'yaml' to validate the registry)"

echo "==> done. Previous files (if any) at: $BACKUP"
