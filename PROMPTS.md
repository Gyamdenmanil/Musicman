# Musicman — Chord Context Rework: Build Prompts

Six self-contained prompts, one per phase. Run them **in order** — each assumes the
previous one landed. Paste one prompt per fresh Claude Code session, then commit
before moving on.

---

## How to use this

1. **Put the context block in `CLAUDE.md` once** (next section). It gets auto-loaded
   into every session in this repo, so you never paste it again and every prompt stays
   short.
2. **Save the mockup** you already have to `docs/mockup-chord-context.html`. Phase 2
   reads it from disk rather than having it pasted in.
3. **Run Phase 0 first.** It builds the test harness every later phase depends on.
4. **Commit after each phase.** One 4600-line file, no test suite — git is the only
   undo.

---

## The context block → `CLAUDE.md`

```markdown
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
- Data tables: `SOLO_SCALES`, `SPICE`, `ROLE_DEFS`, `CHORD_FAMILY`, `SCALE_RECIPES`.

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
```

---

## Phase 0 — Test harness + the symmetric-scale spelling fix

**Why first:** every later phase needs a way to run the theory engine without a
browser, and there is one known spelling defect to clear before building UI on top
of the engine.

**Estimate:** ~10k tokens.

```text
Two small tasks, in order.

TASK 1 — Build the headless test harness for the theory engine.

There is no node/npm/npx on this machine. The only available JS runtime is
JavaScriptCore via `osascript -l JavaScript` (JXA), which does support ES6 classes
and class fields. Create three committed files:

`tools/extract-component.py`
  Reads index.html, extracts the body of the
  `<script type="text/x-dc" data-dc-script>` block, writes it to
  /tmp/mm-component.js. Fail loudly if the markers are not found exactly once.

`tools/theory-test.js`
  A JXA script that:
    - imports Foundation
    - stubs the globals the component expects: `React` (needs `createElement`
      returning {t,p,c}, and `createRef` returning {current:null}) and `DCLogic`
      (a constructor with a no-op `setState` on its prototype)
    - reads /tmp/mm-component.js, evals it, and grabs `Component`
    - instantiates it and exercises the engine
    - accumulates lines into an array and returns them joined by newlines as the
      final expression (JXA prints the last value)
    - catches and reports parse errors and runtime errors rather than dying silently

`tools/test-theory.sh`
  Runs the python extractor then the JXA script. chmod +x it.

The harness must do two things:

  (a) A readable report for a list of (key, mode, chord root, quality) cases.
      For each, print the chord name, its tones, its invited extensions, then one
      line per returned scale: tier label, scale label, note spelling, missingCount,
      and flags for isParentKey / inKey. Include at minimum these cases:
        C major:  Cmaj7, G7, F maj, Bm7b5, E 7#9, C 5, C# dim7, G 7#5
        A minor:  E dom7
        Eb major: Ebmaj7
        F# major: F#maj7, C# dom7      <-- sharp keys, where spelling breaks
        Db major: Dbmaj7, Ab dom7      <-- flat keys

  (b) An assertion sweep over ALL keys of `QUAL` x all 12 roots x both modes that
      fails loudly if any result:
        - returns an empty scales array
        - contains the substring "undefined", "NaN", "null" in any label,
          notesStr or note
        - contains a TRIPLE accidental (###, bbb) anywhere in a note name
        - claims tier SAFE while missingCount > 0
      Print a clear PASS/FAIL summary line and list up to 20 offenders.

TASK 2 — Fix the symmetric-scale spelling defect that sweep will catch.

`SOLO_SCALES` (~line 2933) holds three symmetric scales that have no consistent
letter-degree spelling: `halfWhole`, `wholeHalf`, `wholeTone`. On sharp roots they
currently produce garbage — C# half-whole spells as `C# D E E# F## G# A# B`.

Add `chromatic:true` to those three definitions, and in `chordToScales` (~3145) make
the note-name construction honour it: when `def.chromatic` is set, name every note
except the scale root by pitch class via `this.pcName(pc, preferFlat)` instead of
`this.spell(...)`. The scale root keeps its proper spelled name so the label and the
first note agree.

Do not change the `degs` arrays of any other scale. Do not touch the altered scale —
its degree spelling is deliberate (G altered must read `G Ab Bb B Db Eb F`).

VERIFY
Run ./tools/test-theory.sh. Report the actual output. The assertion sweep must pass.
Confirm by eye that:
  - C# half-whole no longer contains F##
  - E whole tone contains no B#
  - G altered still reads `G Ab Bb B Db Eb F`
  - G7 in C major still ranks G Mixolydian first, flagged as the parent key

DONE WHEN
  - tools/ exists with all three files, test-theory.sh is executable
  - the sweep passes with zero offenders
  - you have pasted the real harness output, not a summary of it
```

---

## Phase 1 — Audit and harden the chord → scale engine

**Status:** already landed in the working tree (lines ~2925–3320). This prompt is an
audit, not a build. Run it to confirm the engine is trustworthy before any UI depends
on it.

**Estimate:** ~20k tokens.

```text
Audit the chord → scale engine at lines ~2925–3320 of index.html. It is already
written and I want it stress-tested, not rewritten. Use ./tools/test-theory.sh to
drive everything; extend the harness as needed.

Check each of these and report findings with evidence:

1. MUSICAL CORRECTNESS of SCALE_RECIPES (~2988). For each of the 12 chord families,
   verify every recipe entry actually fits the chord it is offered for:
     - Does the scale contain all the chord's tones? If not, is the omission
       deliberate and is the tier honest about it? A SAFE scale must have
       missingCount 0.
     - Is the tier right? SAFE should mean "you cannot play a wrong note here".
       Flag anything mis-tiered.
     - Is the technique note factually true for that chord/scale pair, in every key?
       Notes must not name specific pitches unless they hold universally.

2. ENHARMONIC SPELLING across all 12 keys and both modes. The engine spells relative
   to the key signature via `preferFlat`. Find cases that produce a double accidental
   or a wrong letter. Report them; fix only clear errors.

3. ROLE CLASSIFICATION. `noteRole` (~3103) distinguishes root / tone / ext / alt /
   pass / out. Verify:
     - the 4th over a plain major chord classifies as `pass`, not `ext`
       (this distinction is the whole point of the feature)
     - on chords with no 3rd (5, sus2, sus4) the 3rd classifies as `ext`
     - on chords with no 7th the 7th classifies as `ext`
     - ♭9/♯9/♯11/♭13 classify as `alt`, not `ext`

4. RANKING. `chordToScales` sorts by tier, then missingCount, then isParentKey, then
   inKey, then extCount. Sanity-check the top 3 results for 20 common chords in
   context and tell me if any ordering is musically wrong.

5. COVERAGE GAPS. Which `QUAL` qualities fall through `CHORD_FAMILY` to a default
   family that does not really suit them? List them with a recommendation.

6. DEAD CODE. Report anything defined and unused (e.g. check whether `EXT_NAMES`,
   `keyPcSet`, `renderRoleLegend` are actually reachable yet).

OUTPUT
A findings list ordered most-severe first. For each: what is wrong, the concrete
case that demonstrates it, and the one-line fix. Then apply only the fixes that are
unambiguous correctness bugs, re-run the harness, and show the output. Leave
judgement calls on tiers and wording for me to decide — list them separately.

DO NOT restructure the engine, rename its methods, or change its public signatures.
Other work depends on them.
```

---

## Phase 2 — The chord context panel

**The big one.** Turns the engine into the feature.

**Estimate:** 75–95k tokens.

```text
Build the chord context panel: tap a chord anywhere in the app, see what you can
play over it.

DESIGN SPEC
Read docs/mockup-chord-context.html. Its LAYOUT AND VISUAL DESIGN are the spec —
follow them closely. Its <script> is a throwaway prototype with real bugs; ignore it
entirely and wire the real engine instead. (For the record, the prototype's engine
offers G Ionian as SAFE over G7, renders C7#9 as "C###", find-replaces chord names
inside technique prose so "play E minor pentatonic" survives onto the wrong chord,
and never produces a passing-tone role. Do not port any of that.)

Section order from the mockup, all of which you implement:
  1. Chord hero — name + roman numeral chip
  2. Formula row — interval chips (degree label + note name)
  3. Chord tones — role-coloured circles with role captions
  4. Extensions this chord invites — from chordToneBreakdown().extsStr
  5. Scales that fit — spice dot + name + one-line tag, tappable, one selected
  6. Technique note — the selected scale's `note`, in the highlighted callout
  7. Fretboard — renderRoleFretboard() for the selected scale, with legend
  8. Piano — new renderer, same role colours (see below)
  9. Play chord / Play arpeggio buttons

IMPLEMENTATION NOTES
- The mockup uses CSS classes. Add them to the <helmet><style> block (lines 44-101)
  prefixed `mmcx-` so they cannot collide, and drive the markup from those classes
  rather than converting every rule to an inline style string. Map the mockup's
  hardcoded hex values onto the existing --mm-* custom properties where one already
  matches; only add a new custom property where the mockup introduces a genuinely
  new colour.
- Role colours must come from ROLE_DEFS, not be re-declared.
- New state keys: the selected chord (root pc + quality + roman, nullable) and the
  selected scale id. Default the scale to the first result whenever the chord
  changes.
- New method `renderRolePiano(opt)` next to renderRoleFretboard. Same role colouring,
  two octaves, correct black-key offsets (C#/D# sit closer together than F#/G#/A# —
  do not naively centre them on the white-key boundary). Label only the notes that
  have a role. Call the section "Piano" — it is a pitch-class map, not a voicing, so
  do not claim otherwise in the copy.
- Entry points. Make existing chords open the panel, without removing anything:
    - diatonic chord cards in the Theory tab (template ~341-392)
    - the Guitar tab's current root+quality selection (~394-464)
    - progression builder chips (~465+)
    - chord wheel selection on Home
  Each should set the panel's chord and show the panel. Keep every existing
  play/arp button working as it does now.
- The panel itself: add it as a new tool in the `chords` room (ROOM_DEFS ~3333) so it
  is reachable directly, AND render it inline under the chord sources above. Decide
  which reads better and tell me what you chose and why.

AUDIO
Port the mockup's `voice()` into the Component, replacing the current one at ~2422.
It is better: three partials, a per-note lowpass that sweeps down over the note's
decay, and a shared master gain into a master lowpass. Keep the existing method
signature `voice(freq, t, dur, vol)` so every current caller keeps working, and
create the master chain lazily inside `ensureAudio()` (~2416). Verify the metronome,
scale playback, diatonic chord buttons and the progression loop all still sound.

VERIFY
1. ./tools/test-theory.sh still passes.
2. python3 -m http.server 8000, open the app, and screenshot: the panel for Cmaj7,
   for G7, and for Bm7b5; the panel after switching the selected scale; and the
   panel at 430x932. Confirm no horizontal body scroll.
3. Click through every entry point and confirm it opens the panel with the right
   chord.
4. Confirm the technique note text changes with the selected scale and never
   contains a pitch name that contradicts the current chord.

DONE WHEN
  - all nine sections render with real engine data in any key
  - the fretboard redraws when you pick a different scale, and the F over Cmaj7
    Ionian renders as a passing tone, visually distinct from the D and A extensions
  - nothing that worked before is broken
  - you have posted the screenshots
```

---

## Phase 3 — Arpeggio explorer

**Estimate:** 25–35k tokens.

```text
Add the arpeggio explorer to the chord context panel.

`renderRoleFretboard` already accepts a `seqOrder` option: a Map of "stringIndex:fret"
→ step index. Notes in that map render their step number instead of their note name,
with a highlight ring. That hook is unused — this phase is what it was built for.

BUILD
1. `arpPatterns(chordPcs)` → the pattern list, each with id, label and an ordered
   array of pitch classes:
     - Up (1-3-5-7), Down, 1-5-3-7, 1-7-5-3, Up-down, Thirds pairs
   Patterns must degrade sensibly: a triad has no 7th, a 9th chord has five tones.
   Do not ship buttons that produce an identical sequence to another button — the
   mockup had four patterns where two were duplicates.

2. `arpFingering(pattern, fretLo, fretHi)` → an ordered list of {string, fret} that
   is actually playable: one note per pitch class, ascending in pitch, each note
   within a 4-fret span of the previous one, lowest string first where there is a
   choice. Return the Map that `seqOrder` expects.

3. Playback that lights the board in time. Schedule the audio with the existing
   `voice()` on the WebAudio clock, and drive the visual steps from a timer that
   reads the same tempo so they stay together. Current step goes in state; the
   fretboard shows the step ring on the note being sounded. Stop cleanly, and clear
   the step state in componentWillUnmount (~1695) alongside the existing teardown.

4. Tempo control, reusing `state.bpm` so it matches the metronome.

5. A loop toggle.

VERIFY
Serve the app and screenshot mid-playback showing the step numbers on the board.
Confirm: switching pattern re-renders the fingering, the audio and the highlight
stay in sync over a 30-second loop, leaving the panel stops the audio, and every
pattern produces a distinct sequence.

DONE WHEN
  - every pattern is distinct and playable on a real neck
  - the board lights in time with what you hear
  - no orphaned timers (navigate away mid-loop and confirm silence)
```

---

## Phase 4 — Fretboard positions: CAGED and two-notes-per-string

**Estimate:** 30–45k tokens.

```text
Add real position views to the chord context panel's fretboard. The mockup has three
toggle buttons — Full neck / CAGED / 2-notes-per-string — where CAGED is a crude
"first root on the E or A string" heuristic and 2nps does literally nothing. Build
both properly.

`renderRoleFretboard` already windows with fretLo/fretHi. This phase supplies the
musical logic that decides the window and which notes to show.

BUILD
1. `cagedPositions(chordRootPC, quality)` → the CAGED shapes available for this
   chord, each with: shape letter (C/A/G/E/D), the fret window, the root-string
   positions, and the chord grip itself as a fret array compatible with the existing
   `renderDiagram` (~2822). The shape letter must be correct — a C-shape barre for an
   F major sits at fret 5 with the root on the A string, not wherever the first root
   happens to appear. Handle the quality: CAGED is defined for triads and common
   sevenths; for an exotic quality, fall back to the nearest triad shape and say so
   in the caption.

2. `twoNotesPerString(scale, fretLo)` → for a 7-note scale, the classic 2nps run:
   exactly two scale notes on each of the six strings, ascending, starting from the
   given position. Return the {string, fret} list so it can both window the board and
   feed `seqOrder` for playback. For a pentatonic (5 notes) return the standard
   box position instead and label it as such — 2nps is not defined for 5-note
   scales, so do not pretend it is.

3. Wire the three views to the toggle. Each view gets a one-line caption explaining
   what you are looking at and what to do with it. When a position view is active,
   dim or hide the scale notes outside that window rather than cropping the board, so
   you can see where the position sits on the neck.

4. CAGED view shows the chord grip diagram beside the scale window, so the
   relationship between the shape and the scale is visible. That relationship is the
   entire point of the view.

VERIFY
Serve and screenshot all three views for: F major (tests the barre shapes),
E minor (tests open position), Bb7 (tests a seventh), and A minor pentatonic
(tests the 5-note fallback). For each CAGED shape, confirm by eye that the grip is a
real fingering and that the root dots are on the right strings.

DONE WHEN
  - every CAGED shape returned is a shape a guitarist would recognise and could play
  - 2nps gives exactly two notes per string across all six
  - no view is a stub, and no caption promises something the code does not do
```

---

## Phase 5 — Simplify the app around the new centre

Two variants. Start with **5a**; only run **5b** when you are sure.

**Estimate:** 10–20k (5a) · 25–35k (5b).

### 5a — Additive: make the panel the centre, remove nothing

```text
The chord context panel is now the most valuable thing in the app, but it is buried.
Restructure navigation around it WITHOUT removing or hiding any existing feature.

CURRENT NAV
ROOM_DEFS (~3333) defines four rooms: write / chords / tempo / ideas, with
TOOL_LABELS (~3339) naming the nine tools. goTool/goRoom (~3362) handle routing.

DO
1. Make the chord context panel the default tool of the `chords` room, ahead of the
   wheel.
2. Add a persistent way to reach it from the Write room: when the cursor is on a word
   that has a chord attached, offer a direct jump that opens the panel for that chord.
3. Reorder TOOL_LABELS within each room so the most-used tool is first.
4. Reconsider the labels. "Shapes", "Build", "Vibe", "Drills" are terse to the point
   of being unguessable. Propose better ones and apply them.
5. Leave tuner, chord ID, mood generator, skill-level dots and advanced analysis
   exactly where they are and fully working.

VERIFY
Serve the app. Screenshot each of the four rooms. Confirm every one of the nine tools
is still reachable and functional, and that deep state survives navigation (build a
progression, leave, come back).

DONE WHEN
  - the panel is the first thing you land on in the chords room
  - nothing has been removed
  - every tool still works
```

### 5b — Subtractive: the three-tab app

```text
Collapse the app to three tabs: Write / Practice / Reference.

Before changing anything, inventory what currently exists and tell me, per feature,
whether you propose to keep it, fold it into something else, or hide it behind a
"more" affordance. Wait for my answer before editing. Removing working features is
my call, not yours.

Proposed from my side, for you to pressure-test:
  - fold presets into the progression builder
  - hide: tuner, chord ID, mood generator, skill-level dots, advanced analysis
  - "hide" means still reachable, not deleted — these took work and someone may
    use them

Constraints:
  - no user data loss: saved songs, recordings, tags and backups must survive, and
    existing localStorage must still load after the change
  - any state key you orphan gets removed from `state` (line 1556) in the same pass,
    along with its handlers, so dead code does not accumulate
  - every removed tab needs its deep links and `goTool` targets cleaned up or the
    nav will route to a blank screen

VERIFY
Serve the app. Screenshot all three tabs. Load a backup exported before the change
and confirm it restores. Confirm no console errors on every tab.

DONE WHEN
  - three tabs, each with a clear job
  - no console errors
  - a pre-change backup still restores cleanly
```

---

## Running order

| # | Phase | Est. tokens | Depends on |
|---|---|---|---|
| 0 | Harness + spelling fix | ~10k | — |
| 1 | Engine audit | ~20k | 0 |
| 2 | Chord context panel | 75–95k | 0, 1 |
| 3 | Arpeggio explorer | 25–35k | 2 |
| 4 | CAGED / 2nps positions | 30–45k | 2 |
| 5a | Nav, additive | 10–20k | 2 |
| 5b | Three-tab collapse | 25–35k | 5a |

Phases 3 and 4 are independent of each other — either order, or in parallel sessions
on separate branches.

---

## Two things to paste into every session

**At the start, if the agent starts reading the whole file:**

> `index.html` is ~130k tokens. Do not read it whole. Use grep to find anchors and
> `sed -n` to read only the ranges you need.

**At the end, before you accept the work:**

> Show me the actual command output and screenshots for every claim you just made.
> If you did not verify something, say so explicitly.
