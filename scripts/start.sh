#!/usr/bin/env bash
# Démarre l'API et le frontend en arrière-plan (nohup + PID files).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p logs .pids

is_running() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

start_one() {
  local name="$1"; local cmd="$2"; local pidfile=".pids/${name}.pid"; local log="logs/${name}.log"
  if is_running "$pidfile"; then
    echo "→ $name déjà lancé (PID $(cat "$pidfile"))"
    return
  fi
  # setsid détache complètement du shell parent ; nohup fallback si setsid absent
  if command -v setsid >/dev/null 2>&1; then
    setsid bash -c "$cmd" >>"$log" 2>&1 < /dev/null &
  else
    nohup bash -c "$cmd" >>"$log" 2>&1 < /dev/null &
  fi
  echo $! > "$pidfile"
  echo "✓ $name démarré (PID $(cat "$pidfile")) — logs: $log"
}

echo "▶ RetroBuzz — démarrage en arrière-plan"
start_one api 'npm --workspace @retrobuzz/api run dev'
start_one web 'npm --workspace @retrobuzz/web run dev'

echo ""
echo "Commandes utiles :"
echo "  npm run status   → état des process"
echo "  npm run logs     → flux des logs (Ctrl+C pour quitter le tail)"
echo "  npm run stop     → arrêter l'app"
echo "  npm run restart  → redémarrer"
