#!/bin/bash
cd "$(dirname "$0")"
PORT=${1:-8019}
echo "Starting Mens Day Card server at http://localhost:$PORT/ ..."
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT/"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT/"
fi
exec python3 -m http.server "$PORT"
