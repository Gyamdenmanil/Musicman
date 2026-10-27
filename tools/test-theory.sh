#!/bin/bash
# Run the chord -> scale engine headlessly and report.
#
# There is no node on this machine, so the runtime is JavaScriptCore, reached
# through `osascript -l JavaScript`. The component has to be lifted out of
# index.html first because the rest of that file is a browser-only template.
set -euo pipefail

cd "$(dirname "$0")/.."

python3 tools/extract-component.py
osascript -l JavaScript tools/theory-test.js
