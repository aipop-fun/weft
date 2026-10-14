#!/usr/bin/env bash
# release.sh — cria tag de versão e faz push
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "uso: bash scripts/release.sh v0.2.0"
  exit 1
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "! formato: vX.Y.Z"
  exit 1
fi

# atualiza package.json
bun -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$VERSION'.slice(1);
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

git add package.json CHANGELOG.md
git commit -m "chore(release): $VERSION"
git tag -a "$VERSION" -m "release $VERSION"
git push origin main --follow-tags

echo "✓ release $VERSION publicado"
