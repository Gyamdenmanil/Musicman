# Musicman

A songwriter's workbench: pick a key, explore scales and diatonic chords, find
voicings, build progressions, write songs with lyrics + chords + tab. Guitar-first.
Everything is stored on-device; no server, no account.

## Architecture — read this before editing

Three files. `index.html` is the entire app (~4600 lines, ~394KB).

- `index.html` has two halves:
  - **Template**: the `<x-dc>` element, lines 38–1344. Declarative HTML.
  - **Logic**: `<script type="text/x-dc" data-dc-script>`, lines 1345–4614,
    containing `class Component extends DCLogic`.
- `support.js` — the generated `dc-runtime` bundle (React-based template engine).
  **Never edit it.** If it goes missing, `git checkout -- support.js`.
- `icon-512.png` — app icon.

### How the template and logic connect

`renderVals()` (~line 3623) returns one flat object. Every key in it is addressable
from the template:

- `{{ someVal }}` — interpolate a value. **A React element works here** — see
  `scaleFretboard` built at ~line 3831 and consumed at template line 363.
- `<sc-if value="{{ flag }}" hint-placeholder-val="{{ false }}">…</sc-if>`
- `<sc-for list="{{ arr }}" as="item" hint-placeholder-count="7">…{{ item.x }}…</sc-for>`
- `onClick="{{ handler }}"` — a function from `renderVals`.
- `style="{{ styleString }}"` plus `style-hover="…"` / `style-active="…"`.

Styling convention: inline `style="…"` in the template, or a style string built by a
helper in `renderVals` (`pill()`, `card()`, `seg()`, `romanChip()`). Shared CSS and
`--mm-*` custom properties live in the `<helmet><style>` block, lines 44–101.
`TOKENS` (line 1347) mirrors those custom properties for use in JS.

### State

One flat object at line 1556. Mutate with `this.setState({ … })`. Tab routing is
`state.tab`; the template gates on boolean flags built at ~line 4518
(`isTheory`, `isGuitar`, `isProg`, `isSongs`, …). Nav structure is `ROOM_DEFS`
(~3333) + `TOOL_LABELS` (~3339); navigate with `goTool(tab)` / `goRoom(id)` (~3362).

### Chord → scale engine

Lives at lines ~2925–3320. Public surface:

- `chordToScales(chordRootPC, quality, keyRootPC, keyMode)` → `{ chordRootName,
  chordPcs, scales[], preferFlat }`. Each scale: `{ label, shortLabel, scaleRootPC,
  scaleRootName, semis, degs, pcs, notes[{name,pc,role}], notesStr, tier, note,
  inKey, isParentKey, missingCount, extCount, altCount }`.
- `chordToneBreakdown(rootName, rootPC, quality)` → `{ tones, tonesStr, exts, extsStr }`
- `renderRoleFretboard(opt)` → React element. Options: `chordRootPC`, `quality`,
  `chordPcs`, `scalePcs`, `fretLo`, `fretHi`, `showOutside`, `highlightPcs`,
  `seqOrder` (Map of `"string:fret"` → step index), `preferFlat`, `colW`, `rowH`.
- `renderRoleLegend(roles)` → React element.
- `noteRole(pc, chordRootPC, chordPcSet, scalePcSet, chordIvSet)` →
  `'root' | 'tone' | 'ext' | 'alt' | 'pass' | 'out'`
- `pcName(pc, preferFlat)` -> plain pitch-class name; `spellBest(root, semi)` ->
  the cleanest letter spelling for a note with no obvious scale degree.
- Data tables: `SOLO_SCALES`, `SPICE`, `ROLE_DEFS`, `CHORD_FAMILY`, `SCALE_RECIPES`.
  A `SCALE_RECIPES` entry may set `allowMissing:true` to declare that omitting a
  chord tone is the point (the altered scale has no natural 5th); without it, a
  seven-note scale tiered SAFE that omits a tone is demoted automatically.

Quality keys come from `QUAL` (line 1362); display suffixes from `SUF` (line 1363).

## Constraints

- **No build step, no dependencies, no bundler.** Self-contained files only.
  Google Fonts is the one allowed external host (already linked).
- **There is no `node`, `npm`, or `npx` on this machine.** Do not write a prompt,
  script, or test that assumes them.
  - Serve locally with `python3 -m http.server 8000`.
  - Test logic headlessly with `./tools/test-theory.sh` (JavaScriptCore via
    `osascript -l JavaScript`).
- **Surgical edits.** Do not reformat, re-indent, or "clean up" code you were not
  asked to change. Prefer a Python string-replace patch script with an assertion that
  each anchor matched exactly once over hand-editing a 4600-line file.
- Match the surrounding idiom: same comment density, same naming, same style-string
  helpers. New code should be indistinguishable from what is already there.
- Mobile-first. iPhone 16 Pro Max (430×932 CSS px) is the reference viewport; the
  body must never scroll horizontally.
- Dark UI only — the app sets `color-scheme: dark` deliberately.

## Verification expectations

Never report a change as working without evidence. For logic, show harness output.
For UI, serve the app and screenshot the actual screen you changed.

## Build plan

`PROMPTS.md` holds the phased rework plan (Phase 0 → 5b) as copy-paste prompts.
Run the phases in order; commit between them.
