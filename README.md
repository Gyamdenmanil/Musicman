# Musicman

A songwriter's workbench for the browser — pick a key, explore its scales and diatonic chords, find guitar voicings, build chord progressions, keep time, and write full songs with lyrics, chords, and tab.

## Features

- **Circle of Fifths** — home view showing the current key, its relative major/minor, and key signature.
- **Theory** — scales & modes with playback, scale degrees, an interactive fretboard diagram, and diatonic chords for the current key (with extensions like 7ths/9ths and a roman-numeral legend).
- **Guitar** — chord voicings by root and quality (maj/min/7/9/dim/aug/sus/etc.), diatonic quick-jump chips, borrowed ("color") chords, and secondary dominants, each with playable chord/arpeggio audio and fretboard diagrams.
- **Progression** — build a chord progression by tapping diatonic, borrowed, or secondary-dominant chords, get feedback on how it resolves, and browse genre-tagged preset progressions for inspiration.
- **Rhythm** — a metronome with tap tempo, adjustable BPM, time signatures, and eighth-note subdivision.
- **Songs** — write lyrics, attach chords to individual words, add section labels (verse/chorus/etc.), build a chord/tab grid, transpose or capo the song, preview with auto-scroll, search saved songs by name/tag/lyrics, record voice memos, and export/import a full backup.

Everything is stored locally on-device (no server/account); backup & restore lets you move data between devices.

## Structure

- `index.html` — the app: a single [`dc-runtime`](support.js) component (`x-dc` template + a `Component` class implementing the app's state and logic), rendered client-side with React.
- `support.js` — the generated `dc-runtime` bundle (React-based template/runtime engine) the component runs on. Generated — do not edit directly.
- `icon-512.png` — app icon (used for favicon and iOS home-screen install).

## Running locally

Serve the directory with any static file server and open `index.html`, e.g.:

```bash
npx serve .
```
