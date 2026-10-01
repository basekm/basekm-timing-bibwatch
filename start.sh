#!/usr/bin/env bash
# One command on any Mac: builds whatever is missing or out of date, starts the server and the
# viewer, and opens the viewer. Ctrl-C stops both. Pick the race folder in the viewer (Open folder…).
#
#   ./start.sh                     # server on :8765, viewer on :3000
#   ./start.sh --port 9000 --web-port 3001 --no-open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
WEB_PORT=3000
OPEN_BROWSER=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    --no-open) OPEN_BROWSER=0; shift ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 1 ;;
  esac
done

step() { printf '\033[1m→ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Newer than `target` (or target missing)? Any file under the given paths counts.
is_stale() {
  local target="$1"; shift
  [[ ! -e "$target" ]] && return 0
  [[ -n "$(find "$@" -newer "$target" -type f -print -quit 2>/dev/null)" ]]
}

# --- Tools -----------------------------------------------------------------------------------
[[ "$(uname)" == "Darwin" ]] || fail "bibwatch needs macOS (AVFoundation + Apple Vision)."
command -v swift >/dev/null || fail "Swift not found: install Xcode or run: xcode-select --install"
command -v node >/dev/null || fail "Node not found: install Node 22 or newer (https://nodejs.org or nvm)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 22 )) || fail "Node $(node -v) is too old: bibwatch needs Node 22 or newer."

# --- Scanner (Swift) -------------------------------------------------------------------------
if is_stale "$ROOT/.build/release/bibwatch" "$ROOT/Sources" "$ROOT/Package.swift"; then
  step "Building the scanner (first time takes a few minutes)"
  (cd "$ROOT" && swift build -c release)
  # swift build leaves an up-to-date binary untouched; mark it as checked.
  touch "$ROOT/.build/release/bibwatch"
fi

# --- Packages --------------------------------------------------------------------------------
for app in server web; do
  if is_stale "$ROOT/$app/node_modules/.package-lock.json" "$ROOT/$app/package-lock.json"; then
    step "Installing $app packages"
    (cd "$ROOT/$app" && npm ci --no-audit --no-fund)
  fi
done

# The database driver is compiled for one Node version; rebuild it after switching Node.
if ! (cd "$ROOT/server" && node -e "new (require('better-sqlite3'))(':memory:')" 2>/dev/null); then
  step "Rebuilding the database driver for Node $(node -v)"
  (cd "$ROOT/server" && npm rebuild better-sqlite3)
fi

# --- Builds ----------------------------------------------------------------------------------
if is_stale "$ROOT/server/dist/main.js" "$ROOT/server/src" "$ROOT/server/package-lock.json"; then
  step "Building the server"
  (cd "$ROOT/server" && npm run build)
fi

# The server's address is fixed into the viewer's build, so a different --port means a rebuild.
SERVER_URL="http://127.0.0.1:$PORT"
WEB_STAMP="$ROOT/web/.next/bibwatch-server-url"
if [[ "$(cat "$WEB_STAMP" 2>/dev/null)" != "$SERVER_URL" ]] \
  || is_stale "$WEB_STAMP" "$ROOT/web/app" "$ROOT/web/components" "$ROOT/web/screens" "$ROOT/web/src" \
    "$ROOT/web/hooks" "$ROOT/web/lib" "$ROOT/web/public" "$ROOT/web/next.config.ts" "$ROOT/web/package-lock.json"; then
  step "Building the viewer"
  (cd "$ROOT/web" && BIBWATCH_SERVER_URL="$SERVER_URL" npm run build)
  echo "$SERVER_URL" > "$WEB_STAMP"
fi

# --- Run -------------------------------------------------------------------------------------
for port in "$PORT" "$WEB_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "port $port is in use (another bibwatch running?). Stop it, or pick another with --port / --web-port."
  fi
done

PIDS=()
stop() {
  trap - INT TERM EXIT
  echo
  step "Stopping"
  # (bash 3.2, the macOS default, treats an empty array as unset)
  kill ${PIDS[@]+"${PIDS[@]}"} 2>/dev/null || true
  wait 2>/dev/null || true
}
trap stop INT TERM EXIT

step "Starting the server on :$PORT"
# exec: the PID kept is node itself, so stopping it really stops the server.
(cd "$ROOT/server" && PORT="$PORT" NODE_ENV=production exec node dist/main) &
PIDS+=($!)

for _ in $(seq 1 60); do
  curl -sf "$SERVER_URL/api/health" >/dev/null && break
  kill -0 "${PIDS[0]}" 2>/dev/null || fail "the server stopped while starting (see above)."
  sleep 0.5
done

step "Starting the viewer on :$WEB_PORT"
(cd "$ROOT/web" && exec node_modules/.bin/next start -p "$WEB_PORT" -H 127.0.0.1) &
PIDS+=($!)

VIEWER_URL="http://localhost:$WEB_PORT"
for _ in $(seq 1 60); do
  curl -sf "$VIEWER_URL" >/dev/null && break
  sleep 0.5
done

printf '\n\033[1mbibwatch is running: %s\033[0m  (Ctrl-C to stop)\n\n' "$VIEWER_URL"
if (( OPEN_BROWSER )); then
  open "$VIEWER_URL"
fi

# Until either stops (or Ctrl-C); then the trap stops the other.
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do
  sleep 1
done
