#!/usr/bin/env bash
# Open NagrikAI: installs dependencies if needed, starts the app on a free port,
# and opens it in your browser. Press Ctrl+C to stop.
#
#   ./start.sh            development mode (live reload)
#   ./start.sh prod       production build — faster, use this for the demo
#   ./start.sh --no-open  don't open the browser (can combine: ./start.sh prod --no-open)
set -euo pipefail

# Works from the project root or from inside nagrikai/ (where a shortcut link lives).
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$ROOT/nagrikai"

MODE=dev
OPEN=1
for arg in "$@"; do
  case "$arg" in
    prod|production) MODE=prod ;;
    --no-open) OPEN=0 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

# Node 22.5+ is needed for the built-in SQLite used by registration.
if ! command -v node >/dev/null; then
  echo "Node.js is not installed. Install Node 22 or newer from https://nodejs.org"; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
NODE_MINOR=$(node -p 'process.versions.node.split(".")[1]')
if (( NODE_MAJOR < 22 || (NODE_MAJOR == 22 && NODE_MINOR < 5) )); then
  echo "Node $(node -v) found, but NagrikAI needs Node 22.5 or newer."; exit 1
fi

# Install dependencies on first run, or when package.json changed since the last install.
if [[ ! -d node_modules || package.json -nt node_modules/.package-lock.json ]]; then
  echo "📦 Installing dependencies (first run only)…"
  npm install --no-audit --no-fund
fi

# Find a free port starting at 3000.
PORT=3000
while (echo >"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; do PORT=$((PORT + 1)); done
URL="http://localhost:$PORT"

if [[ "$MODE" == prod ]]; then
  echo "🏗️  Building for production…"
  # Separate build folder so a running dev server isn't disturbed.
  export NEXT_DIST_DIR=.next-build
  npm run build >/dev/null
  npx next start -p "$PORT" &
else
  npx next dev -p "$PORT" &
fi
SERVER_PID=$!
trap 'echo; echo "Stopping NagrikAI…"; kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; exit 0' INT TERM

# Wait until the app answers (first dev compile can take a few seconds).
printf "⏳ Starting"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$URL"; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then echo; echo "Server failed to start."; exit 1; fi
  printf "."; sleep 1
done
echo

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "✅ NagrikAI is running"
echo "   On this computer:  $URL"
[[ -n "$LAN_IP" ]] && echo "   On a phone (same Wi-Fi): http://$LAN_IP:$PORT   (voice input needs localhost or HTTPS)"
[[ -f .env.local ]] && grep -qE '^(GEMINI|ANTHROPIC)_API_KEY=.+' .env.local && echo "   AI mode: on" || echo "   AI mode: off (rules mode) — add GEMINI_API_KEY to nagrikai/.env.local to enable"
echo "   Press Ctrl+C to stop."

if (( OPEN )); then
  # Voice input works in every browser when an AI key is set, but Chrome's own recognition is
  # free, unlimited and shows words as you speak — so prefer Chrome when it is installed.
  CHROME=$(command -v google-chrome-stable || command -v google-chrome || true)
  if [[ -n "$CHROME" ]]; then "$CHROME" "$URL" >/dev/null 2>&1 &
  elif [[ -d "/Applications/Google Chrome.app" ]]; then open -a "Google Chrome" "$URL"
  elif command -v xdg-open >/dev/null; then
    echo "   ℹ️  Google Chrome not found — voice input will use the server (needs GEMINI_API_KEY)."
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null; then open "$URL"
  fi
fi

wait "$SERVER_PID"
