#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

stop_one() {
  local name="$1"; local pidfile=".pids/${name}.pid"
  if [[ ! -f "$pidfile" ]]; then
    echo "→ $name : pas de PID file"
    return
  fi
  local pid; pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    # Tuer tout le groupe de process (setsid a créé une session)
    kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
    echo "✓ $name arrêté (PID $pid)"
  else
    echo "→ $name : process déjà mort"
  fi
  rm -f "$pidfile"
}

echo "■ RetroBuzz — arrêt"
stop_one web
stop_one api

# Safety net : tuer tout tsx/next résiduel lié au repo
pkill -f "tsx watch.*apps/api" 2>/dev/null || true
pkill -f "next dev.*3000"      2>/dev/null || true
