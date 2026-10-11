import test from 'node:test';
import assert from 'node:assert/strict';
import {TA_MATH} from '../src/ta-script/runtime.js';
import {BUILTIN_INDICATORS,computeIndicator,makeIndicator} from '../src/indicators.js';

const approx=(a,b,eps=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} != ${b}`);
const bar=(time,open,high,low,close,volume=100)=>({time,open,high,low,close,volume});

function flatBars(n=80,price=100){return Array.from({length:n},(_,i)=>bar(1700000000+i*60,price,price,price,price,100+i));}
function trendBars(n=120,dir=1){return Array.from({length:n},(_,i)=>{const c=100+dir*i*.4;return bar(1700000000+i*60,c-dir*.1,c+1,c-1,c,1000+i);});}

test('certified MA seed vectors: SMA, EMA and WMA',()=>{
  const v=[1,2,3,4,5];
  const sma=TA_MATH.sma(v,3),ema=TA_MATH.ema(v,3),wma=TA_MATH.wma(v,3);
  assert.ok(Number.isNaN(sma[0])&&Number.isNaN(sma[1])); approx(sma[2],2);approx(sma[3],3);approx(sma[4],4);
  assert.ok(Number.isNaN(ema[0])&&Number.isNaN(ema[1])); approx(ema[2],2);approx(ema[3],3);approx(ema[4],4);
  approx(wma[2],14/6);approx(wma[3],20/6);approx(wma[4],26/6);
});

test('ATR uses Wilder smoothing with an arithmetic seed',()=>{
  const bars=[bar(0,10,12,9,11),bar(60,11,13,10,12),bar(120,12,14,11,13),bar(180,13,16,12,15)];
  const a=TA_MATH.atr(bars,3);
  approx(a[2],3);approx(a[3],10/3);
});

test('flat RSI is neutral instead of a false overbought 100',()=>{
  const r=TA_MATH.rsi(Array(40).fill(100),14);
  approx(r[14],50);approx(r.at(-1),50);
});

test('Stochastic 9/3/9 is directionally correct and flat markets stay neutral',()=>{
  const up=TA_MATH.stochastic(trendBars(120,1),9,3,9,'sma','lowhigh');
  const down=TA_MATH.stochastic(trendBars(120,-1),9,3,9,'sma','lowhigh');
  assert.ok(up.k.at(-1)>80&&up.d.at(-1)>80,`up ${up.k.at(-1)}/${up.d.at(-1)}`);
  assert.ok(down.k.at(-1)<20&&down.d.at(-1)<20,`down ${down.k.at(-1)}/${down.d.at(-1)}`);
  const flat=TA_MATH.stochastic(flatBars(80),9,3,9,'sma','lowhigh');
  approx(flat.rawK.at(-1),50);approx(flat.k.at(-1),50);approx(flat.d.at(-1),50);
});

test('ADX and DeMarker have defined neutral results on flat data',()=>{
  const bars=flatBars(100);
  const dm=TA_MATH.directionalMovement(bars,14),dem=TA_MATH.demarker(bars,14);
  const finiteAdx=dm.adx.filter(Number.isFinite);assert.ok(finiteAdx.length>0);approx(finiteAdx.at(-1),0);
  approx(dm.plusDI.filter(Number.isFinite).at(-1),0);approx(dm.minusDI.filter(Number.isFinite).at(-1),0);
  approx(dem.filter(Number.isFinite).at(-1),.5);
});

test('Ichimoku and Alligator retain their forward projection slots',()=>{
  const bars=trendBars(120,1);
  const ichi=TA_MATH.ichimoku(bars,9,26,52,26),all=TA_MATH.alligator(bars,13,8,8,5,5,3);
  assert.equal(ichi.tenkan.length,bars.length);assert.equal(ichi.spanA.length,bars.length+26);assert.equal(ichi.spanB.length,bars.length+26);
  assert.equal(all.jaw.length,bars.length+8);assert.equal(all.teeth.length,bars.length+5);assert.equal(all.lips.length,bars.length+3);
  assert.ok(ichi.spanA.slice(bars.length).some(Number.isFinite));assert.ok(all.jaw.slice(bars.length).some(Number.isFinite));
});

test('Fractals display on the pivot candle while confirmation stays later',()=>{
  const highs=[1,2,5,2,1,2,6,2,1],lows=[0,.5,1,.2,-2,.3,1,.1,-3];
  const bars=highs.map((h,i)=>bar(i*60,(h+lows[i])/2,h,lows[i],(h+lows[i])/2));
  const raw=TA_MATH.fractals(bars,2,2);assert.equal(raw.upIndex[4],2);assert.equal(raw.up[4],5);
  const rendered=computeIndicator(makeIndicator('fractals',{left:2,right:2}),bars).series[0].values;
  assert.equal(rendered[2],5);assert.equal(rendered[4],null);
});

test('ZigZag visual pivots are anchored to pivot bars and alternate high/low',()=>{
  const highs=[1,2,5,2,1,2,6,2,1,2,4,2,1],lows=[0,.5,1,.2,-2,.3,1,.1,-3,.4,1,.3,-1];
  const bars=highs.map((h,i)=>bar(i*60,(h+lows[i])/2,h,lows[i],(h+lows[i])/2));
  const z=TA_MATH.zigzag(bars,4,0,1);
  assert.deepEqual(z.pivots.map(x=>x.type),['H','L','H','L','H']);
  for(const p of z.pivots){assert.equal(z.displayLine[p.pivot],p.price);assert.equal(z.line[p.confirm],p.price);assert.ok(p.confirm>=p.pivot);}
});

test('session VWAP honors an explicit session start hour',()=>{
  const t=s=>Math.floor(new Date(s).getTime()/1000);
  const bars=[bar(t('2026-01-02T16:59:00Z'),10,12,10,11,1),bar(t('2026-01-02T17:00:00Z'),20,22,20,21,1),bar(t('2026-01-02T17:01:00Z'),22,24,22,23,1)];
  const v=TA_MATH.vwap(bars,'session',0,17);
  approx(v[0],11);approx(v[1],21);approx(v[2],22);
});

test('Volume Profile is labelled as Trade Avata Volume Profile, not Market Profile',()=>{
  const d=BUILTIN_INDICATORS.find(x=>x.kind==='market-profile');assert.ok(d);assert.equal(d.name,'Volume Profile');assert.equal(d.short,'Vol Profile');
});

test('all built-in indicators satisfy finite/range invariants across deterministic OHLCV families',()=>{
  for(let seed=1;seed<=20;seed++){
    const bars=Array.from({length:260},(_,i)=>{const c=100+i*.015+Math.sin((i+seed)/7)*3+Math.cos((i*3+seed)/29)*4;const spread=1+((i+seed)%7)*.07;return bar(1700000000+i*60,c-.2,c+spread,c-spread*.9,c,700+((i*37+seed*11)%500));});
    for(const def of BUILTIN_INDICATORS){
      const r=computeIndicator(makeIndicator(def.kind,{id:`${seed}-${def.kind}`}),bars,{hasLiveBar:false,pipSize:.01});
      assert.ok(r.series.length>0,`${def.kind} has no series`);
      for(const s of r.series){
        const vals=s.values.filter(Number.isFinite);assert.ok(vals.length>0,`${def.kind}/${s.name} has no finite output`);
        if(['rsi','stochastic','adx','mfi'].includes(def.kind))for(const v of vals)assert.ok(v>=-1e-9&&v<=100+1e-9,`${def.kind} out of range ${v}`);
        if(def.kind==='demarker')for(const v of vals)assert.ok(v>=-1e-9&&v<=1+1e-9,`DeMarker out of range ${v}`);
        if(def.kind==='williams-r')for(const v of vals)assert.ok(v>=-100-1e-9&&v<=1e-9,`WPR out of range ${v}`);
        if(['atr','standard-deviation'].includes(def.kind))for(const v of vals)assert.ok(v>=-1e-12,`${def.kind} negative ${v}`);
      }
    }
  }
});
