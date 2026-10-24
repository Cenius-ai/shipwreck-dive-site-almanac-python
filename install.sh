#!/bin/sh
# Shipwreck Dive Site Almanac - setup check.
# Installs nothing, seeds nothing (data.json IS the seed) and never starts a
# server. Exits non-zero if the site is not ready to serve.
set -eu

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "install.sh: python3 is required on the PATH (Python 3.8 or newer)." >&2
  exit 1
fi

python3 - <<'PY'
import sys

if sys.version_info < (3, 8):
    sys.exit("install.sh: Python 3.8 or newer is required, found %s" % sys.version.split()[0])
print("Python %s" % sys.version.split()[0])
PY

python3 - <<'PY'
import json
import pathlib
import sys

path = pathlib.Path("data.json")
if not path.is_file():
    sys.exit("install.sh: data.json is missing from the repository root")

with path.open(encoding="utf-8") as handle:
    data = json.load(handle)

if data.get("schemaVersion") != 1:
    sys.exit("install.sh: data.json must declare schemaVersion 1")
if not isinstance(data.get("sites"), list) or not data["sites"]:
    sys.exit("install.sh: data.json publishes no wreck sites")
if not isinstance(data.get("checklist"), list) or not data["checklist"]:
    sys.exit("install.sh: data.json publishes no pre-dive checklist")

print("data.json: %d wreck sites, %d checklist items" % (len(data["sites"]), len(data["checklist"])))
PY

echo "Running the verification suite..."
python3 -m unittest discover -s tests -t .

echo ""
echo "Setup complete. Start the site with:"
echo "  sh serve.sh          # python3 -m http.server \"\${PORT:-8000}\" --bind 0.0.0.0"
echo "Then open http://localhost:8000/ - demo sign-in: cenius@cenius.ai / cenius"
