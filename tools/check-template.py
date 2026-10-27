#!/usr/bin/env python3
"""Check the <x-dc> template against what renderVals() actually returns.

The template is only parsed at runtime by support.js, so a typo'd {{ binding }}
or an unbalanced <sc-for> is invisible until the app is opened in a browser.
This catches both statically: it walks the template tracking <sc-for as="..">
scopes, then checks every binding's root identifier against the key list that
tools/vals-dump.js collected by running renderVals() for real.

    python3 tools/extract-component.py
    osascript -l JavaScript tools/vals-dump.js > /tmp/mm-vals.txt
    python3 tools/check-template.py /tmp/mm-vals.txt
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')

start = html.index('<x-dc>') + len('<x-dc>')
end = html.index('</x-dc>')
tpl = html[start:end]

dump = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/mm-vals.txt')
lines = dump.read_text(encoding='utf-8').splitlines()
keys = {l[4:] for l in lines if l.startswith('KEY ')}
errors = [l for l in lines if l.startswith(('PARSE_ERROR', 'RENDER_ERROR'))]
states = [l for l in lines if l.startswith('STATE_OK')]

problems = []
if errors:
    problems += ['renderVals failed: ' + e for e in errors]
if not keys:
    problems.append('no keys in %s — did vals-dump.js run?' % dump)

# Walk tags and bindings in document order, keeping a stack of sc-for aliases.
TOKEN = re.compile(r'<sc-for\b[^>]*>|</sc-for>|<sc-if\b[^>]*>|</sc-if>|\{\{(.*?)\}\}', re.S)
AS_ATTR = re.compile(r'\bas\s*=\s*"([^"]+)"')
LITERAL = re.compile(r'^(true|false|null|-?\d+(\.\d+)?|[\'"{\[].*)$', re.S)
IDENT = re.compile(r'^([A-Za-z_$][\w$]*)')

alias_stack = []
if_depth = 0
for m in TOKEN.finditer(tpl):
    tok = m.group(0)
    line = tpl.count('\n', 0, m.start()) + 1 + html.count('\n', 0, start)
    if tok.startswith('<sc-for'):
        a = AS_ATTR.search(tok)
        alias_stack.append(a.group(1) if a else None)
        if not a:
            problems.append('line %d: <sc-for> with no as="" attribute' % line)
    elif tok == '</sc-for>':
        if not alias_stack:
            problems.append('line %d: </sc-for> with no open <sc-for>' % line)
        else:
            alias_stack.pop()
    elif tok.startswith('<sc-if'):
        if_depth += 1
    elif tok == '</sc-if>':
        if_depth -= 1
        if if_depth < 0:
            problems.append('line %d: </sc-if> with no open <sc-if>' % line)
    else:
        expr = (m.group(1) or '').strip()
        if not expr or LITERAL.match(expr):
            continue
        im = IDENT.match(expr)
        if not im:
            problems.append('line %d: cannot parse binding {{ %s }}' % (line, expr))
            continue
        root = im.group(1)
        if root in alias_stack:
            continue
        if root not in keys:
            scope = ('in scope: ' + ', '.join(a for a in alias_stack if a)) if alias_stack else 'top level'
            problems.append('line %d: {{ %s }} -> "%s" is not a renderVals key (%s)'
                            % (line, expr, root, scope))

if alias_stack:
    problems.append('%d unclosed <sc-for> at end of template' % len(alias_stack))
if if_depth:
    problems.append('%d unclosed <sc-if> at end of template' % if_depth)

total = len(TOKEN.findall(tpl))
print('template: %d tags/bindings scanned, %d renderVals keys, %d states rendered'
      % (total, len(keys), len(states)))
if problems:
    print('RESULT FAIL - %d problem(s):' % len(problems))
    for p in problems[:40]:
        print('  ' + p)
    sys.exit(1)
print('RESULT PASS - every binding resolves, every sc-if/sc-for balanced')
