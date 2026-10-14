#!/usr/bin/env bash
# roda no cron de uma máquina separada (ou GitHub Action)
set -euo pipefail
URL="${1:-https://weft-app.fly.dev/health}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" || echo "000")
if [ "$STATUS" != "200" ]; then
  echo "ALERTA: $URL respondeu $STATUS" >&2
  # aqui: curl slack webhook, ou mandar email
  exit 1
fi
echo "ok ($STATUS)"
