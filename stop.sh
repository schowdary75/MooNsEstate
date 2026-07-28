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
    local windows_pid
    windows_pid="$(
      ps -W 2>/dev/null |
        awk -v pid="$parent_pid" 'NR > 1 && $1 == pid { print $4; exit }'
    )"
    [[ -n "$windows_pid" ]] &&
      taskkill //PID "$windows_pid" //T //F >/dev/null 2>&1 || true
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

terminate_windows_app_processes() {
  local root_windows
  root_windows="$(cygpath -w "$ROOT_DIR")"
  MOONESTATES_ROOT_WINDOWS="$root_windows" powershell.exe -NoProfile -NonInteractive -Command '
    $root = $env:MOONESTATES_ROOT_WINDOWS
    $rootForward = $root.Replace("\", "/")
    $all = @(Get-CimInstance Win32_Process)
    $children = @{}
    foreach ($process in $all) {
      $parent = [int]$process.ParentProcessId
      if (-not $children.ContainsKey($parent)) {
        $children[$parent] = [System.Collections.Generic.List[int]]::new()
      }
      $children[$parent].Add([int]$process.ProcessId)
    }

    $visited = [System.Collections.Generic.HashSet[int]]::new()
    $ordered = [System.Collections.Generic.List[int]]::new()
    function Add-ProcessTree([int]$processId) {
      if (-not $visited.Add($processId)) { return }
      if ($children.ContainsKey($processId)) {
        foreach ($childId in $children[$processId]) {
          Add-ProcessTree $childId
        }
      }
      $ordered.Add($processId)
    }

    foreach ($process in $all) {
      if ($process.Name -ne "node.exe" -or -not $process.CommandLine) { continue }
      $command = $process.CommandLine
      if (
        $command.IndexOf($root, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $command.IndexOf($rootForward, [StringComparison]::OrdinalIgnoreCase) -ge 0
      ) {
        Add-ProcessTree ([int]$process.ProcessId)
      }
    }

    foreach ($processId in $ordered) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  ' >/dev/null 2>&1 || true
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

if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || "$OSTYPE" == win32* ]]; then
  printf 'Stopping any remaining MooNsEstate processes...\n'
  terminate_windows_app_processes
fi

if [[ -f "$MANAGED_MARKER" && -f "$COMPOSE_ENV" ]] && command -v docker >/dev/null 2>&1; then
  printf 'Stopping the private local database...\n'
  docker compose --env-file "$COMPOSE_ENV" stop database >/dev/null 2>&1 || true
fi

printf 'Stopped. Your local database and data were preserved.\n'
