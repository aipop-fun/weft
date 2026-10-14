#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "→ .env não encontrado. copiando de .env.example"
  cp .env.example .env
  echo "! edite .env e adicione OPENROUTER_API_KEY (ou ANTHROPIC_API_KEY)"
fi

if [ ! -d node_modules ]; then
  echo "→ instalando dependências…"
  bun install
fi

# carrega .env
set -a
. ./.env
set +a

echo "→ iniciando server e web"
bun apps/server/src/main.ts &
SERVER_PID=$!
bun apps/web/src/main.ts &
WEB_PID=$!

cleanup() {
  kill $SERVER_PID $WEB_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "  server  http://localhost:${PORT:-3000}"
echo "  web     http://localhost:${WEB_PORT:-3001}"
echo "  demo    http://localhost:${WEB_PORT:-3001}/demo"
echo ""

wait
