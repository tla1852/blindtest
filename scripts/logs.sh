#!/usr/bin/env bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p logs
touch logs/api.log logs/web.log
echo "Tail des logs (Ctrl+C pour quitter) — api=bleu web=violet"
tail -n 50 -F logs/api.log logs/web.log
