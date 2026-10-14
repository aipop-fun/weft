#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f ../../.env ]; then
  echo "! .env não encontrado na raiz"
  exit 1
fi

set -a; . ../../.env; set +a
docker compose up -d --build
echo ""
echo "weft rodando:"
echo "  api  http://localhost:3000/health"
echo "  web  http://localhost:3001"
echo ""
echo "logs: docker compose logs -f"
