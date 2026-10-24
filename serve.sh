#!/bin/sh
# Shipwreck Dive Site Almanac - static server.
# Serves the repository root on 0.0.0.0 so the preview, a container port map or
# another machine on the LAN can all reach it. Honours $PORT.
set -eu

cd "$(dirname "$0")"

PORT="${PORT:-8000}"

echo "Shipwreck Dive Site Almanac: serving $(pwd) on http://0.0.0.0:${PORT}"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
