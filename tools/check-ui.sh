#!/bin/bash
# Static check of the <x-dc> template, for the things only a browser would
# otherwise catch: a binding that resolves to nothing, an unbalanced <sc-for>,
# or a renderVals() that throws on some tab.
#
# Not a substitute for actually looking at the app -- it says nothing about
# layout -- but it catches the blank-screen class of bug without one.
set -euo pipefail

cd "$(dirname "$0")/.."

python3 tools/extract-component.py
osascript -l JavaScript tools/vals-dump.js > /tmp/mm-vals.txt
python3 tools/check-template.py /tmp/mm-vals.txt
