import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {BUILTIN_INDICATORS,computeIndicator,makeIndicator,ema,cci,valuesToData} from '../src/indicators.js';
import {TA_MATH} from '../src/ta-script/runtime.js';
import {validateIndicatorSpec} from '../src/indicator-security.js';
import {compile,parse,describeProgram} from '../src/ta-script/index.js';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const bars=Array.from({length:320},(_,i)=>{
  const base=100+i*.025+Math.sin(i/8)*2.4+Math.sin(i/31)*4.8;
  return{time:1700000000+i*60,open:base-.25,high:base+1.15,low:base-1.05,close:base,volume:800+(i%53)*17};
});

const nativeBaseline=[
  'adx','bollinger','envelopes','ichimoku','moving-average','parabolic-sar','standard-deviation','zigzag',
  'atr','bears-power','bulls-power','cci','demarker','force-index','macd','momentum','osma','rsi','rvi','stochastic','williams-r',
  'accumulation-distribution','market-profile','mfi','obv','volume',
  'accelerator','alligator','awesome','fractals','gator','market-facilitation'
];

test('V12 keeps the complete Trade Avata native indicator baseline',()=>{
  const kinds=new Set(BUILTIN_INDICATORS.map(x=>x.kind));
  for(const kind of nativeBaseline)assert.ok(kinds.has(kind),`missing ${kind}`);
  for(const extra of ['ema','sma','wma','vwap','roc'])assert.ok(kinds.has(extra),`missing Trade Avata extra ${extra}`);
  assert.ok(BUILTIN_INDICATORS.length>=37);
});

test('the browser security gate allows every reviewed first-party built-in while still using declarative specs',()=>{
  for(const def of BUILTIN_INDICATORS){
    const gate=validateIndicatorSpec(makeIndicator(def.kind));
    assert.equal(gate.ok,true,`${def.kind}: ${gate.errors.join(' ')}`);
  }
});

test('every built-in indicator computes without throwing on a common OHLCV dataset',()=>{
  for(const def of BUILTIN_INDICATORS){
    const ind=makeIndicator(def.kind,{id:`test-${def.kind}`});
    const r=computeIndicator(ind,bars,{hasLiveBar:false,pipSize:.01});
    assert.equal(r.kind,def.kind,def.kind);
    assert.ok(Array.isArray(r.series),`${def.kind} series`);
    assert.ok(r.series.length>0,`${def.kind} must render at least one series`);
    assert.ok(r.series.some(s=>s.values.some(Number.isFinite)),`${def.kind} must produce finite output`);
  }
});

test('indicator warm-up gaps keep native bar-index alignment instead of shifting lines left',()=>{
  const values=TA_MATH.ema(bars.map(x=>x.close),20);
  const data=valuesToData(bars,values);
  assert.equal(data.length,bars.length);
  assert.equal(data[0].time,bars[0].time);
  assert.ok(Number.isNaN(data[0].value));
  assert.equal(data[19].time,bars[19].time);
  assert.ok(Number.isFinite(data[19].value));
});

test('native indicators consume the same certified math core used by TA Script',()=>{
  const values=bars.map(x=>x.close);
  assert.deepEqual(ema(values,20),TA_MATH.ema(values,20));
  assert.deepEqual(cci(bars,20),TA_MATH.cci(bars,20));
  const native=computeIndicator(makeIndicator('ema',{length:20}),bars).series[0].values;
  const shared=TA_MATH.ema(values,20).map(x=>Number.isFinite(x)?x:null);
  assert.deepEqual(native,shared);
});

test('new stochastic instances use the approved 9/3/9 SMA LowHigh baseline',()=>{
  const s=makeIndicator('stochastic');
  assert.equal(s.k,9);assert.equal(s.kSlowing,3);assert.equal(s.d,9);
  assert.equal(s.maType,'sma');assert.equal(s.calculation,'lowhigh');
});

test('TA Script R4 exposes market structure, patterns, candles and reusable AI decisions',()=>{
  const source=`ta_script 1.0\nrevision R4\nindicator "Structure AI"\nlet s = market_structure(2,2)\nlet c = candle_patterns()\nlet p = pattern("double_top",2,2,0.03,120)\nlet trend = ai_component(s.trend_code >= 0, 40)\nlet candle = ai_component(c.bullish, 20)\nlet pat = ai_component(not p.confirmed, 40)\nlet ai = ai_decision(60, trend, candle, pat)\nplot ai.score as "AI Score"\nsignal "ALLOW" when ai.allow`;
  const compiled=compile(source),result=compiled.run(bars);
  assert.equal(compiled.descriptor.calculate,'all-bars');
  assert.equal(result.plots[0].values.length,bars.length);
  assert.ok(result.plots[0].values.some(Number.isFinite));
});

test('TA Script private access metadata never embeds an owner TA ID',()=>{
  const p=parse(`ta_script 1.0\nrevision R4\nindicator "Private"\naccess owner_or_grant\nentitlement "gold-hunter-v4"\ndefault_attach owner\ngrant_via ta_id\nplot close as "Price"`);
  const d=describeProgram(p);
  assert.equal(d.accessPolicy,'owner_or_grant');
  assert.equal(d.entitlement,'gold-hunter-v4');
  assert.equal(d.defaultAttach,'owner');
  assert.equal(d.grantVia,'ta_id');
  assert.equal(JSON.stringify(d).includes('TA-'),false);
});

test('live indicator scheduler is non-starving and no longer uses the 300ms reset timer',()=>{
  const live=text('src/live-ready-upgrade.js');
  assert.ok(live.includes('requestAnimationFrame'));
  assert.equal(live.includes('const delay=immediate?0:300'),false);
  assert.equal(live.includes('clearTimeout(pane.__taIndicatorLiveTimer)'),false);
  assert.ok(live.includes('meta.series.update'));
});

test('V12 wires same-frame drawings, account sync and secure private indicator backend',()=>{
  const integration=text('src/v12-integration.js');
  const index=text('index.html');
  const server=text('gateway/server.js');
  const rules=text('firestore.rules');
  assert.ok(integration.includes('TradeAvataNativeChart.prototype.render'));
  assert.ok(integration.includes('pane?.drawingLayer?.render?.()'));
  for(const f of ['account-sync-adapter.js','private-indicator-adapter.js','v12-integration.js'])assert.ok(index.includes(f));
  for(const route of ['/api/indicators/entitlements','/api/indicators/program/','/api/indicators/grant','/api/indicators/revoke'])assert.ok(server.includes(route));
  assert.ok(server.includes('x-ta-device-id'));
  const ent=text('gateway/indicator-entitlements.js');
  assert.ok(ent.includes('deviceAllowance'));
  assert.ok(ent.includes('bindEntitlementDevice'));
  assert.ok(rules.includes('match /accountSettings/{uid}'));
  assert.ok(rules.includes('match /indicatorPrograms/{indicatorId}'));
  assert.ok(rules.includes('allow read, write: if false'));
});

test('public repository package does not ship Gold Hunter proprietary TA Script source',()=>{
  const forbidden=['gold-hunter-v4-core.tas','gold-hunter-v4-htf-core.tas','private-gold-hunter-ai.tas'];
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[e.name.toLowerCase()]);
  const names=walk(root);
  for(const f of forbidden)assert.equal(names.includes(f),false,`private source leaked: ${f}`);
  assert.ok(fs.existsSync(path.join(root,'gateway/scripts/seed-private-indicator.js')));
});

test('V12 R2 Indicator Portal is Trade Avata native only',()=>{
  const portal=text('src/live-ready-upgrade.js');
  assert.ok(portal.includes("new Set(['tas','taind'])"));
  assert.ok(portal.includes("accept:'.tas,.taind'"));
  assert.ok(portal.includes('Trade Avata · TA Script'));
  for(const term of ["'mq4'","'mq5'","'mql'","'algo'",'Pine Script'])assert.equal(portal.includes(term),false,`external platform indicator path remains: ${term}`);
});

test('protected commercial TA Script source stays server-side and the browser receives calculated results only',()=>{
  const entitlement=text('gateway/indicator-entitlements.js');
  const integration=text('src/v12-integration.js');
  const adapter=text('src/private-indicator-adapter.js');
  const server=text('gateway/server.js');
  const start=entitlement.indexOf('export async function getIndicatorProgram');
  const end=entitlement.indexOf('export async function runIndicatorProgram',start);
  const metadataFn=entitlement.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.equal(/\bsource\s*:/.test(metadataFn),false,'metadata endpoint must not return proprietary source');
  assert.ok(entitlement.includes('compileTaScript(source)'));
  assert.ok(server.includes('/api/indicators/run/'));
  assert.ok(adapter.includes('async function run('));
  assert.ok(integration.includes('TRADE_AVATA_PRIVATE_RESULTS'));
  assert.ok(integration.includes('TRADE_AVATA_PRIVATE_RUNNER'));
  assert.equal(integration.includes('TRADE_AVATA_TA_SCRIPT_SOURCES'),false);
});


test('TA Script live execution is bounded and custom tick indicators are throttled away from the candle hot path',()=>{
  const many=Array.from({length:6000},(_,i)=>{const c=100+i*.001;return{time:1700000000+i*60,open:c-.1,high:c+1,low:c-1,close:c,volume:1000};});
  const source=`ta_script 1.0
revision R4
indicator "Bounded"
let e = ema(close,20)
plot e as "EMA"`;
  const r=computeIndicator({id:'bounded',kind:'ta-script',sourceCode:source,name:'Bounded',inputs:{},visible:true},many,{hasLiveBar:true,liveRefresh:true,enforceAccess:false});
  assert.equal(r.execution.maxBars,5000);assert.equal(r.execution.offset,1000);assert.equal(r.series[0].values.length,many.length);
  const live=text('src/live-ready-upgrade.js'),v12=text('src/v12-integration.js');
  assert.ok(live.includes('liveRefresh:!full'));assert.ok(live.includes('count>5000?120:count>2000?80:40'));
  assert.ok(v12.includes('now-last<250'));
});
