/* Run renderVals() headlessly and print the keys it exposes to the template,
 * one per line. Pairs with tools/check-template.py, which checks that every
 * {{ binding }} in the <x-dc> template is actually one of them.
 *
 * osascript -l JavaScript tools/vals-dump.js
 */
ObjC.import('Foundation');

var React = {
  createElement: function(t, p, c){ return {t:t, p:p, c:c}; },
  createRef: function(){ return {current:null}; }
};
var DCLogic = function(){};
DCLogic.prototype.setState = function(){};

/* just enough browser for renderVals to run */
var localStorage = {getItem:function(){return null;}, setItem:function(){}, removeItem:function(){}};
var navigator = {standalone:false, userAgent:'jxa', mediaDevices:null};
var document = {
  createElement:function(){ return {style:{},setAttribute:function(){},appendChild:function(){}}; },
  querySelectorAll:function(){ return []; },
  querySelector:function(){ return null; },
  addEventListener:function(){},
  documentElement:{style:{}},
  body:{style:{},appendChild:function(){}}
};
var window = {
  matchMedia:function(){ return {matches:false, addEventListener:function(){}}; },
  addEventListener:function(){}, removeEventListener:function(){},
  AudioContext:null, webkitAudioContext:null,
  innerWidth:430, innerHeight:932, devicePixelRatio:2,
  localStorage:localStorage, navigator:navigator, document:document
};
var out = [];
function log(s){ out.push(String(s)); }

var code = $.NSString.stringWithContentsOfFileEncodingError(
  '/tmp/mm-component.js', $.NSUTF8StringEncoding, null).js;

var Component = null;
try { Component = eval(String(code) + '\n;Component;'); }
catch (e) { log('PARSE_ERROR ' + e); }

if (Component) {
  var c = new Component();
  /* a couple of states worth exercising: no chord selected, and one selected */
  var STATES = [
    {name:'lab-empty', patch:{tab:'lab'}},
    {name:'lab-cmaj7', patch:{tab:'lab', labChord:{rootPC:0, quality:'maj7', roman:'Imaj7', name:'Cmaj7'}}},
    {name:'lab-g7-inkey', patch:{tab:'lab', labChord:{rootPC:7, quality:'dom7', roman:'V7', name:'G7'}}},
    {name:'lab-bm7b5', patch:{tab:'lab', labChord:{rootPC:11, quality:'m7b5', roman:'viiø7', name:'Bm7♭5'}}},
    {name:'lab-eb-key', patch:{tab:'lab', keyRoot:'Eb', labChord:{rootPC:3, quality:'maj7', roman:'Imaj7', name:'Ebmaj7'}}},
    {name:'theory', patch:{tab:'theory'}},
    {name:'guitar', patch:{tab:'guitar'}},
    {name:'prog', patch:{tab:'prog', builderChords:[{name:'Cmaj7',roman:'Imaj7',pcs:[0,4,7,11]}], insightIdx:0}},
    {name:'home-wheel', patch:{tab:'home', wheelMode:'chords', chordWheelSel:'V7'}},
    {name:'songs', patch:{tab:'songs'}}
  ];
  var union = {};
  STATES.forEach(function (st) {
    Object.keys(st.patch).forEach(function (k) { c.state[k] = st.patch[k]; });
    var vals = null;
    try { vals = c.renderVals(); }
    catch (e) { log('RENDER_ERROR ' + st.name + ' :: ' + e); return; }
    log('STATE_OK ' + st.name + ' ' + Object.keys(vals).length);
    Object.keys(vals).forEach(function (k) { union[k] = 1; });
  });
  Object.keys(union).sort().forEach(function (k) { log('KEY ' + k); });
}

out.join('\n');
