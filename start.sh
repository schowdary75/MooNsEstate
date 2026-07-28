#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.moonestates"
PID_FILE="$RUNTIME_DIR/dev.pid"
LOG_FILE="$RUNTIME_DIR/dev.log"
COMPOSE_ENV="$RUNTIME_DIR/compose.env"
MANAGED_MARKER="$RUNTIME_DIR/managed-local-environment"
DEPENDENCY_STATE_FILE="$RUNTIME_DIR/dependencies.state"
SERVER_ENV="$ROOT_DIR/server/.env"

cd "$ROOT_DIR"

say() { printf '\n%s\n' "$1"; }
fail() { printf '\nError: %s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "$2"; }
pause_on_failure() {
  local status=$?
  if (( status != 0 )) &&
     [[ -t 0 ]] &&
     [[ "${MOONESTATES_NO_PAUSE:-0}" != "1" ]]; then
    printf '\nStartup failed. Press Enter to close this window...' >&2
    read -r _ || true
  fi
}
random_hex() {
  node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"
}

trap pause_on_failure EXIT

need node "Node.js 22 is required. Install it from https://nodejs.org/"
need npm "npm is required and is normally installed with Node.js."
need curl "curl is required. Install it or use Git Bash, which includes curl."
need docker "Docker Desktop (or Docker Engine with Compose) is required."
docker compose version >/dev/null 2>&1 || fail "Docker Compose is not available. Start or update Docker Desktop."

NODE_SUPPORTED="$(node -p "const [major, minor] = process.versions.node.split('.').map(Number); major === 22 && minor >= 22")"
[[ "$NODE_SUPPORTED" == "true" ]] || fail "Node.js 22.22 or newer (but below 23) is required; found $(node --version)."
docker info >/dev/null 2>&1 || fail "Docker is installed but not running. Start Docker Desktop and try again."

mkdir -p "$RUNTIME_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    say "MooNsEstate is already running (PID $EXISTING_PID)."
    printf 'Open: http://localhost:3000\nLogs: %s\n' "$LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [[ ! -f "$SERVER_ENV" ]]; then
  say "Creating a private local configuration..."
  DB_PASSWORD="$(random_hex 18)"
  DB_ROOT_PASSWORD="$(random_hex 24)"
  JWT_SECRET="$(random_hex 32)"
  INTEGRATION_KEY="$(random_hex 32)"
  ADMIN_PASSWORD="$(random_hex 12)"

  cat > "$COMPOSE_ENV" <<EOF
MYSQL_DATABASE=moonestates
MYSQL_USER=moonestates
MYSQL_PASSWORD=$DB_PASSWORD
MYSQL_ROOT_PASSWORD=$DB_ROOT_PASSWORD
EOF

  cat > "$SERVER_ENV" <<EOF
DATABASE_URL="mysql://moonestates:$DB_PASSWORD@127.0.0.1:3306/moonestates"
JWT_SECRET="$JWT_SECRET"
PORT=5001
CORS_ORIGIN="http://127.0.0.1:3000,http://localhost:3000"
APP_PUBLIC_URL="http://localhost:3000"
NODE_ENV="development"
SESSION_COOKIE_NAME="moon_session"
SESSION_DAYS=14
SESSION_ROTATE_HOURS=12
ALLOW_DEVELOPMENT_PROVIDER_PREVIEWS=false
INTEGRATION_ENCRYPTION_KEY="$INTEGRATION_KEY"
REDIS_URL=""
SEED_ADMIN_EMAIL="admin@moonestates.local"
SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD"
EOF

  printf 'Email: admin@moonestates.local\nPassword: %s\n' "$ADMIN_PASSWORD" > "$RUNTIME_DIR/admin-credentials.txt"
  : > "$MANAGED_MARKER"
  chmod 600 "$SERVER_ENV" "$COMPOSE_ENV" "$RUNTIME_DIR/admin-credentials.txt" 2>/dev/null || true
elif [[ -f "$MANAGED_MARKER" && ! -f "$COMPOSE_ENV" ]]; then
  fail "The managed database configuration is incomplete. Delete server/.env and .moonestates/, then run ./start.sh again."
fi

if [[ -f "$MANAGED_MARKER" ]]; then
  say "Starting the private local database..."
  docker compose --env-file "$COMPOSE_ENV" up -d database

  DB_CONTAINER_ID="$(docker compose --env-file "$COMPOSE_ENV" ps -q database)"
  [[ -n "$DB_CONTAINER_ID" ]] || fail "The database container did not start."
  for _ in $(seq 1 60); do
    DB_STATUS="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$DB_CONTAINER_ID" 2>/dev/null || true)"
    [[ "$DB_STATUS" == "healthy" ]] && break
    [[ "$DB_STATUS" == "exited" || "$DB_STATUS" == "dead" ]] && fail "The database container stopped unexpectedly."
    sleep 2
  done
  [[ "${DB_STATUS:-}" == "healthy" ]] || fail "The database was not ready after two minutes."
else
  say "Using your existing server/.env database configuration."
fi

DEPENDENCY_STATE="$(
  node -e "
    const crypto = require('crypto');
    const fs = require('fs');
    const lockHash = crypto
      .createHash('sha256')
      .update(fs.readFileSync('package-lock.json'))
      .digest('hex');
    process.stdout.write([
      lockHash,
      process.versions.modules,
      process.platform,
      process.arch
    ].join(':'));
  "
)"

DEPENDENCIES_READY=false
if [[ -d "$ROOT_DIR/node_modules" &&
      -f "$ROOT_DIR/node_modules/.bin/concurrently" &&
      -f "$ROOT_DIR/node_modules/.bin/prisma" &&
      -f "$ROOT_DIR/node_modules/.bin/vite" &&
      -f "$DEPENDENCY_STATE_FILE" &&
      "$(tr -d '[:space:]' < "$DEPENDENCY_STATE_FILE")" == "$DEPENDENCY_STATE" ]]; then
  DEPENDENCIES_READY=true
fi

if [[ "$DEPENDENCIES_READY" == "true" ]]; then
  say "Dependencies are already up to date."
else
  say "Installing exact dependencies..."
  rm -f "$DEPENDENCY_STATE_FILE"
  npm ci
  printf '%s\n' "$DEPENDENCY_STATE" > "$DEPENDENCY_STATE_FILE"
fi

say "Preparing the database..."
npm run prisma:generate
if [[ -f "$MANAGED_MARKER" ]]; then
  (
    cd "$ROOT_DIR/server"
    ../node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate
  )
else
  (
    cd "$ROOT_DIR/server"
    ../node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
  )
fi

if [[ -f "$MANAGED_MARKER" && ! -f "$RUNTIME_DIR/admin-created" ]]; then
  npm run admin:reset --workspace moonestates-server
  : > "$RUNTIME_DIR/admin-created"
fi

say "Starting MooNsEstate..."
nohup npm run dev > "$LOG_FILE" 2>&1 &
APP_PID=$!
printf '%s\n' "$APP_PID" > "$PID_FILE"

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:5001/api/health >/dev/null 2>&1 &&
     curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    say "MooNsEstate is ready."
    printf 'Open: http://localhost:3000\nLogs: %s\nStop: ./stop.sh\n' "$LOG_FILE"
    if [[ -f "$RUNTIME_DIR/admin-credentials.txt" ]]; then
      printf '\nLocal sign-in (stored only on this machine):\n'
      cat "$RUNTIME_DIR/admin-credentials.txt"
    fi
    exit 0
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    tail -n 80 "$LOG_FILE" >&2 || true
    rm -f "$PID_FILE"
    fail "The application stopped during startup. See $LOG_FILE."
  fi
  sleep 2
done

tail -n 80 "$LOG_FILE" >&2 || true
fail "The application did not become ready after two minutes. Run ./stop.sh, then inspect $LOG_FILE."
