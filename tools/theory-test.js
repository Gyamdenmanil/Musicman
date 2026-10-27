/* Headless test harness for the chord -> scale engine.
 *
 * There is no node on this machine. This runs under JavaScriptCore via
 *   osascript -l JavaScript tools/theory-test.js
 * which supports ES6 classes and class fields, so the Component class evals
 * as-is once React and DCLogic are stubbed out.
 *
 * Driven by tools/test-theory.sh, which extracts the component first.
 * JXA prints the value of the last expression, so everything accumulates into
 * `out` and the file ends with out.join('\n').
 */
ObjC.import('Foundation');

/* --- stubs the Component expects from the browser ------------------------- */
var React = {
  createElement: function(t, p, c){ return {t:t, p:p, c:c}; },
  createRef: function(){ return {current:null}; }
};
var DCLogic = function(){};
DCLogic.prototype.setState = function(){};

/* --- output plumbing ------------------------------------------------------ */
var out = [];
function log(s){ out.push(String(s)); }
function pad(s, n){ s = String(s); while(s.length < n) s += ' '; return s; }
function rule(n){ var s = ''; while(s.length < n) s += '-'; return s; }

/* --- load the component --------------------------------------------------- */
var SRC = '/tmp/mm-component.js';
var Component = null;
var code = null;

try {
  var ns = $.NSString.stringWithContentsOfFileEncodingError(SRC, $.NSUTF8StringEncoding, null);
  code = ns.js;
} catch (e) {
  log('FATAL: cannot read ' + SRC + ' (' + e + ')');
  log('Run tools/extract-component.py first, or use tools/test-theory.sh.');
}

if (code) {
  try {
    Component = eval(String(code) + '\n;Component;');
  } catch (e) {
    log('FATAL: parse error evaluating the component');
    log('  ' + e);
  }
}

/* --- readable report ------------------------------------------------------ */
/* key root, key mode, chord root, quality */
var CASES = [
  ['C',  'major', 'C',  'maj7'],
  ['C',  'major', 'G',  'dom7'],
  ['C',  'major', 'F',  'maj'],
  ['C',  'major', 'B',  'm7b5'],
  ['C',  'major', 'E',  '7#9'],
  ['C',  'major', 'C',  '5'],
  ['C',  'major', 'C#', 'dim7'],
  ['C',  'major', 'G',  '7#5'],
  ['A',  'minor', 'E',  'dom7'],
  ['Eb', 'major', 'Eb', 'maj7'],
  ['F#', 'major', 'F#', 'maj7'],   /* sharp keys: where spelling breaks */
  ['F#', 'major', 'C#', 'dom7'],
  ['Db', 'major', 'Db', 'maj7'],   /* flat keys */
  ['Db', 'major', 'Ab', 'dom7']
];

function report(c, keyRoot, keyMode, rootName, q) {
  var r  = c.chordToScales(c.pcOf(rootName), q, c.pcOf(keyRoot), keyMode);
  var bd = c.chordToneBreakdown(r.chordRootName, c.pcOf(rootName), q);
  var suf = (c.SUF[q] !== undefined) ? c.SUF[q] : q;
  log('');
  log(r.chordRootName + suf + '   in ' + keyRoot + ' ' + keyMode);
  log(rule(78));
  log('  tones   ' + bd.tonesStr);
  log('  invites ' + (bd.extsStr || '-'));
  r.scales.forEach(function (s) {
    log('  ' + pad(s.tier.label, 8) + pad(s.label, 27) + pad(s.notesStr, 30)
        + ' miss=' + s.missingCount
        + (s.isParentKey ? ' [parent]' : '')
        + (s.inKey ? ' [in key]' : ''));
  });
}

/* --- assertion sweep ------------------------------------------------------ */
/* Mechanical failures only. "Is this tier musically right?" is a curatorial
 * judgement and belongs in the Phase 1 audit, not in an assertion — but a
 * SEVEN-note scale tiered SAFE really must contain every chord tone, because
 * there is no reason for a complete scale to contradict the chord. Pentatonics
 * and blues scales omit tones by design and are exempt, as are recipe entries
 * that declare allowMissing (the altered scale's absent natural 5th). */
function sweep(c) {
  var offenders = [], order = [];
  var quals = Object.keys(c.QUAL);
  var MODES = ['major', 'minor'];
  var calls = 0, scaleCount = 0;

  quals.forEach(function (q) {
    for (var chordPc = 0; chordPc < 12; chordPc++) {
      MODES.forEach(function (mode) {
        for (var keyPc = 0; keyPc < 12; keyPc++) {
          var tag = q + ' root=' + chordPc + ' key=' + keyPc + ' ' + mode;
          var r;
          calls++;
          try {
            r = c.chordToScales(chordPc, q, keyPc, mode);
          } catch (e) {
            offenders.push({key:q + ' THREW ' + e, sample:tag});
            continue;
          }
          if (!r || !r.scales || !r.scales.length) {
            offenders.push({key:q + ' EMPTY scales array', sample:tag});
            continue;
          }
          r.scales.forEach(function (s) {
            scaleCount++;
            var blob = [s.label, s.notesStr, s.note].join(' | ');
            if (/undefined|NaN|\bnull\b/.test(blob)) {
              offenders.push({key:q + ' / ' + s.scaleKey + ' PLACEHOLDER', sample:tag + '  ' + blob.slice(0, 90)});
            }
            if (/###|bbb/.test(s.label + ' ' + s.notesStr)) {
              offenders.push({key:q + ' / ' + s.scaleKey + ' TRIPLE ACCIDENTAL', sample:tag + '  ' + s.label + ' = ' + s.notesStr});
            }
            if (s.tier.id === 'safe' && s.semis.length >= 7 && s.missingCount > 0
                && !s.allowMissing) {
              offenders.push({key:q + ' / ' + s.scaleKey + ' tiered SAFE but omits a chord tone', sample:tag + '  ' + s.label + ' = ' + s.notesStr + '  miss=' + s.missingCount});
            }
          });
        }
      });
    }
  });

  log('');
  log(rule(78));
  log('SWEEP  ' + quals.length + ' qualities x 12 chord roots x 12 keys x 2 modes');
  log('       ' + calls + ' calls, ' + scaleCount + ' scale results checked');
  if (offenders.length) {
    /* 8352 calls produce the same handful of defects over and over. Group by
       (quality, scale, reason) so the report names causes, not instances. */
    var groups = {};
    offenders.forEach(function (o) {
      if (!groups[o.key]) { groups[o.key] = {n: 0, sample: o.sample}; order.push(o.key); }
      groups[o.key].n++;
    });
    order.sort(function (x, y) { return groups[y].n - groups[x].n; });
    log('RESULT FAIL - ' + offenders.length + ' instance(s) in '
        + order.length + ' distinct group(s):');
    order.slice(0, 20).forEach(function (k) {
      log('  x' + pad(groups[k].n, 6) + k);
      log('           e.g. ' + groups[k].sample);
    });
    if (order.length > 20) log('  ... and ' + (order.length - 20) + ' more group(s)');
  } else {
    log('RESULT PASS - no offenders');
  }
  return order.length ? order.length : 0;
}

/* --- spot checks that must hold ------------------------------------------- */
/* These guard the specific defects this harness was written to catch. */
function spotChecks(c) {
  var fails = [];

  function find(keyRoot, mode, rootName, q, scaleKey) {
    var r = c.chordToScales(c.pcOf(rootName), q, c.pcOf(keyRoot), mode);
    for (var i = 0; i < r.scales.length; i++) {
      if (r.scales[i].scaleKey === scaleKey) return r.scales[i];
    }
    return null;
  }

  var cases = [
    ['C# half-whole has no double sharp', function () {
      var s = find('C', 'major', 'C#', 'dim7', 'halfWhole');
      return s ? (s.notesStr.indexOf('##') < 0 ? null : s.notesStr) : 'not offered';
    }],
    ['G half-whole keeps its idiomatic b9/#9 spelling', function () {
      var s = find('C', 'major', 'G', 'dom7', 'halfWhole');
      if (!s) return 'not offered';
      return s.notesStr === 'G Ab Bb B C# D E F' ? null : s.notesStr;
    }],
    ['Cmaj7 invites the 9 and the 13, not the 11', function () {
      var bd = c.chordToneBreakdown('C', 0, 'maj7');
      return bd.extsStr === 'D (9)   A (13)' ? null : bd.extsStr;
    }],
    ['E whole tone has no B#', function () {
      var s = find('C', 'major', 'E', '7#5', 'wholeTone');
      return s ? (s.notesStr.indexOf('B#') < 0 ? null : s.notesStr) : 'not offered';
    }],
    ['G altered reads G Ab Bb B Db Eb F', function () {
      var s = find('C', 'major', 'G', 'dom7', 'altered');
      if (!s) return 'not offered';
      return s.notesStr === 'G Ab Bb B Db Eb F' ? null : s.notesStr;
    }],
    ['G7 in C major ranks G Mixolydian first, flagged parent', function () {
      var r = c.chordToScales(c.pcOf('G'), 'dom7', c.pcOf('C'), 'major');
      var top = r.scales[0];
      if (top.scaleKey !== 'mixolydian') return 'top was ' + top.label;
      if (!top.isParentKey) return 'not flagged isParentKey';
      return null;
    }],
    ['4th over a plain major chord is a passing tone, not an extension', function () {
      var r = c.chordToScales(0, 'maj', 0, 'major');
      var ion = null;
      r.scales.forEach(function (s) { if (s.scaleKey === 'ionian') ion = s; });
      if (!ion) return 'ionian not offered';
      var f = null;
      ion.notes.forEach(function (n) { if (n.pc === 5) f = n; });
      if (!f) return 'F not in scale';
      return f.role === 'pass' ? null : 'F classified as ' + f.role;
    }]
  ];

  log('');
  log(rule(78));
  log('SPOT CHECKS');
  cases.forEach(function (pair) {
    var bad;
    try { bad = pair[1](); } catch (e) { bad = 'threw ' + e; }
    if (bad) { fails.push(pair[0]); log('  FAIL  ' + pair[0] + '  ->  ' + bad); }
    else { log('  ok    ' + pair[0]); }
  });
  if (!fails.length) log('  all spot checks passed');
  return fails.length;
}

/* --- run ------------------------------------------------------------------ */
if (Component) {
  var c = new Component();
  var problems = 0;
  try {
    CASES.forEach(function (cs) { report(c, cs[0], cs[1], cs[2], cs[3]); });
    problems += sweep(c);
    problems += spotChecks(c);

    /* renderRoleFretboard must still build an element tree */
    var top = c.chordToScales(0, 'maj7', 0, 'major').scales[0];
    var fb = c.renderRoleFretboard({
      chordRootPC: 0, quality: 'maj7', scalePcs: top.pcs, fretLo: 0, fretHi: 15
    });
    log('');
    log('renderRoleFretboard: ' + fb.c.length + ' elements, width ' + fb.p.style.width);
  } catch (e) {
    log('');
    log('RUNTIME ERROR: ' + e);
    problems++;
  }
  log('');
  log(rule(78));
  log(problems ? ('OVERALL: FAIL (' + problems + ' problem group(s))') : 'OVERALL: PASS');
}

out.join('\n');
