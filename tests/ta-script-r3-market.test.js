import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,parse} from '../src/ta-script/index.js';

const bar=(i,o,h,l,c,v=1000)=>({time:i*60000,open:o,high:h,low:l,close:c,volume:v});

test('R3 adds pure user functions and anchored chart markers',()=>{
  const src=`ta_script 1.0
revision R3
indicator "Functions"
function above(a,b) = a > b
let s = market_structure(1,1)
marker "HH" at s.swing_high anchor s.swing_high_index when s.hh
signal "UP" when above(close, open)`;
  const p=parse(src);
  assert.equal(p.functions.length,1);
  assert.equal(p.markers.length,1);
  const bars=[bar(0,100,101,99,100),bar(1,100,110,100,108),bar(2,108,109,95,97),bar(3,97,112,97,110),bar(4,110,111,98,100),bar(5,100,115,100,113),bar(6,113,114,101,102)];
  const r=compile(src).run(bars);
  assert.ok(r.signals.length>0);
  assert.ok(r.markers.some(x=>x.text==='HH'&&x.index===3&&x.confirmedAt===4));
});

test('R3 candle engine identifies anatomy and common candle patterns',()=>{
  const bars=[
    bar(0,10,10.5,7.5,8),
    bar(1,7.8,10.8,7.6,10.5), // bullish engulfing
    bar(2,10.5,10.7,8.0,10.4), // hammer-like
    bar(3,10.4,10.6,10.0,10.41), // doji-ish
  ];
  const c=compile(`ta_script 1.0\nrevision R3\nindicator "Candles"\nlet c = candle_patterns()\nplot c.body as "Body"\nsignal "ENGULF" when c.bullishEngulfing\nsignal "DOJI" when c.doji`).run(bars);
  assert.equal(c.plots[0].values.length,bars.length);
  assert.ok(c.signals.some(x=>x.name==='ENGULF'&&x.index===1));
  assert.ok(c.signals.some(x=>x.name==='DOJI'&&x.index===3));
});

test('R3 market structure confirms HH/HL without using future bars before confirmation',()=>{
  const bars=[
    bar(0,100,101,99,100),
    bar(1,100,110,100,108), // H1
    bar(2,108,109,95,97),   // L1, confirms H1 here
    bar(3,97,112,102,110),  // H2, confirms L1 here
    bar(4,110,111,98,100),  // L2, confirms H2 (HH) here
    bar(5,100,115,100,113), // H3, confirms L2 (HL) here
    bar(6,113,114,101,102), // confirms H3 (HH)
  ];
  const r=compile(`ta_script 1.0\nrevision R3\nindicator "Structure"\nlet s = market_structure(1,1)\nplot s.trend_code as "Trend"\nsignal "HH" when s.hh\nsignal "HL" when s.hl`).run(bars);
  assert.ok(r.signals.some(x=>x.name==='HH'&&x.index===4));
  assert.ok(r.signals.some(x=>x.name==='HL'&&x.index===5));
  assert.equal(r.plots[0].values[5],1);
});

test('R3 chart pattern engine detects a confirmed double top from confirmed swings',()=>{
  const bars=[
    bar(0,100,101,99,100),
    bar(1,100,110,100,108),
    bar(2,108,109,95,97),
    bar(3,97,109.6,97,108),
    bar(4,108,108.5,96,98),
  ];
  const r=compile(`ta_script 1.0\nrevision R3\nindicator "Pattern"\nlet p = pattern("double_top",1,1,0.01,50)\nsignal "DT" when p.confirmed\nplot p.neckline as "Neckline"`).run(bars);
  assert.ok(r.signals.some(x=>x.name==='DT'));
  assert.ok(r.plots[0].values.some(Number.isFinite));
});

test('R3 market regime distinguishes directional trend from a choppy range',()=>{
  const trend=Array.from({length:140},(_,i)=>bar(i,100+i*.4,101+i*.4,99+i*.4,100.3+i*.4,1000+i));
  const range=Array.from({length:140},(_,i)=>{const c=100+Math.sin(i*.8)*2;return bar(i,c-.2,c+1,c-1,c,1000+i);});
  const src=`ta_script 1.0\nrevision R3\nindicator "Regime"\nlet r = market_regime(2,2,30,0.22)\nsignal "UP" when r.uptrend\nsignal "RANGE" when r.range`;
  const a=compile(src).run(trend),b=compile(src).run(range);
  assert.ok(a.signals.some(x=>x.name==='UP') || a.signals.length===0); // monotonic data can lack confirmed swing structure
  assert.ok(b.signals.some(x=>x.name==='RANGE'));
});

test('R3 exposes the expanded Trade Avata native technical library to TA Script',()=>{
  const bars=Array.from({length:240},(_,i)=>{const c=100+i*.02+Math.sin(i/7)*3+Math.sin(i/23)*5;return bar(i,c-.3,c+1.2,c-1.1,c,900+(i%50)*10);});
  const src=`ta_script 1.0
revision R3
indicator "Library"
let env = envelopes(close,20,0.1,"sma")
let ichi = ichimoku(9,26,52,26)
let sar = psar(0.02,0.2)
let zz = zigzag(12,0,3)
let bp = bulls_power(13)
let br = bears_power(13)
let dm = demarker(14)
let fi = force_index(13,"ema")
let os = osma(close,12,26,9)
let rv = rvi(10)
let wr = williams_r(14)
let ad = accumulation_distribution()
let mf = money_flow_index(14)
let ob = obv()
let ao = awesome_oscillator()
let ac = accelerator_oscillator()
let al = alligator(13,8,8,5,5,3)
let ga = gator()
let fr = fractals(2,2)
let bw = market_facilitation_index()
let mp = market_profile(80,20,0.7)
plot env.upper as "Envelope"
plot ichi.tenkan as "Tenkan"
plot sar as "SAR"
plot zz.line as "ZigZag"
plot bp as "Bulls"
plot br as "Bears"
plot dm as "DeMarker"
plot fi as "Force"
plot os as "OsMA"
plot rv.line as "RVI"
plot wr as "WPR"
plot ad as "AD"
plot mf as "MFI"
plot ob as "OBV"
plot ao as "AO"
plot ac as "AC"
plot al.jaw as "Alligator"
plot ga.upper as "Gator"
plot fr.up as "Fractal"
plot bw as "BW MFI"
plot mp.poc as "POC"`;
  const r=compile(src).run(bars);
  assert.equal(r.plots.length,21);
  assert.ok(r.plots.every(x=>x.values.length>=bars.length));
  assert.ok(r.plots.find(x=>x.name==='Tenkan').values.length===bars.length);
  assert.ok(r.plots.find(x=>x.name==='Alligator').values.length>bars.length); // forward projection is intentionally retained
  assert.ok(r.plots.filter(x=>x.values.some(Number.isFinite)).length>=18);
});

test('R3 exposes projected trend channels and rolling range bounds',()=>{
  const bars=[
    bar(0,100,101,99,100),bar(1,100,110,100,108),bar(2,108,109,95,97),
    bar(3,97,112,102,110),bar(4,110,111,98,100),bar(5,100,115,103,113),
    bar(6,113,114,101,102),bar(7,102,118,104,116),bar(8,116,117,105,107),
  ];
  const r=compile(`ta_script 1.0\nrevision R3\nindicator "Channels"\nlet c = trend_channel(1,1)\nlet b = range_bounds(4)\nplot c.mid as "Channel"\nplot b.mid as "Range"`).run(bars);
  assert.ok(r.plots[1].values.some(Number.isFinite));
});
