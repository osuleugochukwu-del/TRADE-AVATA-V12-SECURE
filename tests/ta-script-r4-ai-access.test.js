import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,parse,describeProgram} from '../src/ta-script/index.js';

const bars=Array.from({length:120},(_,i)=>{
  const close=100+i*.12+Math.sin(i/7)*2;
  return{time:i*60000,open:close-.2,high:close+1,low:close-1,close,volume:1000+i};
});

test('R4 parses owner/grant access metadata without embedding a user TA ID',()=>{
  const p=parse(`ta_script 1.0\nrevision R4\nindicator "Private Indicator"\naccess owner_or_grant\nentitlement "gold-hunter-v4"\ndefault_attach owner\ngrant_via ta_id\nplot close as "Price"`);
  assert.equal(p.accessPolicy,'owner_or_grant');
  assert.equal(p.entitlement,'gold-hunter-v4');
  assert.equal(p.defaultAttach,'owner');
  assert.equal(p.grantVia,'ta_id');
  const d=describeProgram(p);
  assert.equal(d.accessPolicy,'owner_or_grant');
  assert.equal(d.defaultAttach,'owner');
});

test('R4 private script denies unverified access, allows owner and backend-granted entitlement',()=>{
  const c=compile(`ta_script 1.0\nrevision R4\nindicator "Private Indicator"\naccess owner_or_grant\nentitlement "gold-hunter-v4"\nplot close as "Price"`);
  assert.throws(()=>c.run(bars),/access denied/);
  const owner=c.run(bars,{authorization:{verified:true,isOwner:true,taId:'TA-U-OWNER'}});
  assert.equal(owner.access.allowed,true);
  assert.equal(owner.access.reason,'owner');
  const granted=c.run(bars,{authorization:{verified:true,isOwner:false,taId:'TA-U-GRANTEE',entitlements:['gold-hunter-v4']}});
  assert.equal(granted.access.allowed,true);
  assert.equal(granted.access.reason,'granted-entitlement');
  assert.throws(()=>c.run(bars,{authorization:{verified:true,isOwner:false,taId:'TA-U-NOPE',entitlements:[]}}),/grant-required/);
});

test('R4 generic AI components can be combined into reusable normalized decisions',()=>{
  const c=compile(`ta_script 1.0\nrevision R4\nindicator "AI Framework"\nlet fast = ema(close,10)\nlet slow = ema(close,30)\nlet trend = ai_component(fast > slow, 40)\nlet momentum = ai_component(rsi(close,14) > 50, 30)\nlet structure = market_structure(2,2)\nlet market = ai_component(structure.trend_code >= 0, 30)\nlet ai = ai_decision(70, trend, momentum, market)\nplot ai.score as "AI Score"\nsignal "ALLOW" when ai.allow`);
  const r=c.run(bars);
  const score=r.plots[0].values;
  assert.equal(score.length,bars.length);
  assert.ok(score.some(x=>Number.isFinite(x)&&x>=0&&x<=100));
  assert.ok(r.signals.length>0);
});

test('R4 Gold Hunter classic AI primitive exposes original 40/30/30 score model',()=>{
  const c=compile(`ta_script 1.0\nrevision R4\nindicator "Gold Hunter AI"\nlet trend = ema(close,30)\nlet ai = gold_hunter_ai(trend, "buy", 1, 0.01, "filter")\nplot ai.score as "AI Score"\nsignal "ALLOW" when ai.allow`);
  const r=c.run(bars,{pipSize:.01});
  assert.ok(r.plots[0].values.some(x=>[0,30,40,60,70,100].includes(x)));
  assert.ok(r.signals.length>0);
});
