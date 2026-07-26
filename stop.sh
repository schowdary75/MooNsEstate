#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.moonestates"
PID_FILE="$RUNTIME_DIR/dev.pid"
COMPOSE_ENV="$RUNTIME_DIR/compose.env"
MANAGED_MARKER="$RUNTIME_DIR/managed-local-environment"

cd "$ROOT_DIR"

terminate_tree() {
  local parent_pid="$1"
  if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || "$OSTYPE" == win32* ]]; then
    taskkill //PID "$parent_pid" //T //F >/dev/null 2>&1 || true
    return
  fi
  if command -v pgrep >/dev/null 2>&1; then
    local child_pid
    while read -r child_pid; do
      [[ -n "$child_pid" ]] && terminate_tree "$child_pid"
    done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
  fi
  kill "$parent_pid" 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  APP_PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    printf 'Stopping MooNsEstate (PID %s)...\n' "$APP_PID"
    terminate_tree "$APP_PID"
    for _ in $(seq 1 20); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$APP_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
else
  printf 'MooNsEstate application is not running.\n'
fi

if [[ -f "$MANAGED_MARKER" && -f "$COMPOSE_ENV" ]] && command -v docker >/dev/null 2>&1; then
  printf 'Stopping the private local database...\n'
  docker compose --env-file "$COMPOSE_ENV" stop database >/dev/null 2>&1 || true
fi

printf 'Stopped. Your local database and data were preserved.\n'
