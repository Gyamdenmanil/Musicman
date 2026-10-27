#!/usr/bin/env python3
"""Pull the dc-runtime component script out of index.html for headless testing.

index.html is the whole app: an <x-dc> template plus a single
<script type="text/x-dc" data-dc-script> block holding `class Component`.
Only that block can run outside a browser, so extract it verbatim and leave
the template behind.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'index.html'
OUT = pathlib.Path('/tmp/mm-component.js')

OPEN_MARK = '<script type="text/x-dc"'
CLOSE_MARK = '</script>'

src = SRC.read_text(encoding='utf-8')

found = src.count(OPEN_MARK)
if found != 1:
    sys.exit('extract-component: expected exactly one %r in %s, found %d'
             % (OPEN_MARK, SRC, found))

start = src.index(OPEN_MARK)
start = src.index('>', start) + 1
end = src.find(CLOSE_MARK, start)
if end < 0:
    sys.exit('extract-component: no closing %r after the component script in %s'
             % (CLOSE_MARK, SRC))

body = src[start:end]
if 'class Component extends DCLogic' not in body:
    sys.exit('extract-component: extracted block does not contain the Component class')

OUT.write_text(body, encoding='utf-8')
print('extract-component: %s (%d bytes)' % (OUT, len(body)))
