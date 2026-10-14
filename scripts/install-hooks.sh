#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# cria hook commit-msg que roda commitlint
HOOK=".git/hooks/commit-msg"
if [ -d .git ]; then
  cat > "$HOOK" <<'HOOKEOF'
#!/usr/bin/env bash
exec bunx commitlint --edit "$1"
HOOKEOF
  chmod +x "$HOOK"
  echo "  ✓ hook commit-msg instalado"
else
  echo "  · sem .git — pulando hook"
fi
