#!/usr/bin/env bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

check() {
  local name="$1"; local pidfile=".pids/${name}.pid"
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "✓ $name : UP   (PID $(cat "$pidfile"))"
  else
    echo "✗ $name : DOWN"
  fi
}

echo "État RetroBuzz :"
check api
check web
echo ""
echo "Ports écoutés :"
ss -ltnp 2>/dev/null | grep -E ':3000|:4000' || echo "  (aucun)"
