/* Trade Avata derived-period feed router.
 * Renko/Range are frontend constructions, not cTrader gateway periods.
 * Never subscribe the VPS to renko-pips/renko-time/range-pips. Instead consume
 * genuine 1-second market data and deterministically derive the selected view.
 */
import hub from './market-feed-adapter.js';
import {buildPeriodBars,timeframeSeconds,SYMBOLS} from './data.js';
import {mergeMarketBars,normalizeMarketBar} from './real-market-data.js';

const DERIVED=new Set(['renko-pips','renko-time','range-pips']);
const originalSubscribe=hub.subscribe.bind(hub);
const sourceCache=new Map();
const key=s=>String(s||'').toUpperCase();
const sourcePeriod={mode:'time',value:'1s'};
const SOURCE_CACHE_MAX=100000;
const DERIVED_BOOTSTRAP_BARS=10000;
const DERIVED_OLDER_SOURCE_BARS=10000;

function isDerived(period){return DERIVED.has(String(period?.mode||'').toLowerCase());}
function settings(){return window.__tradeAvata?.state?.periodSettings||window.__tradeAvataV111?.app?.state?.periodSettings||{};}
function remember(symbol,incoming){const k=key(symbol),prev=sourceCache.get(k)||[],next=mergeMarketBars(prev,incoming).slice(-SOURCE_CACHE_MAX);sourceCache.set(k,next);return next;}
function activeBucket(source,interval){if(!source.length)return null;const seconds=Math.max(1,timeframeSeconds(String(interval||'1m'))),last=source.at(-1),start=Math.floor(Number(last.time)/seconds)*seconds,part=source.filter(b=>Number(b.time)>=start);if(!part.length)return null;return{time:start,open:Number(part[0].open),high:Math.max(...part.map(b=>Number(b.high))),low:Math.min(...part.map(b=>Number(b.low))),close:Number(part.at(-1).close),volume:part.reduce((n,b)=>n+(Number(b.volume)||0),0),seconds};}

/* TradingView-style Renko projection principle: a fast move never stretches one
 * Renko body across several boxes. Every completed threshold is represented by
 * another fixed-size projection brick. Only the final unfinished remainder may
 * be shorter than one box while the current time bucket is still open. */
function projectRenkoMove({anchor,direction,price,brickSize,startTime,bucket,sourceTime,interval}){
 const out=[];let a=Number(anchor),dir=Number(direction)||0,t=Math.floor(Number(startTime)||0),guard=0;
 const push=d=>{const open=a,close=a+d*brickSize;t+=1;out.push({time:t,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:0,renkoDirection:d,sourceTime,renkoTimeInterval:interval,renkoDeveloping:true,renkoProjection:true,renkoProgress:1});a=close;dir=d;};
 while(guard++<2000){
  if(dir===0){if(price>=a+brickSize){push(1);continue;}if(price<=a-brickSize){push(-1);continue;}break;}
  if(dir>0){if(price>=a+brickSize){push(1);continue;}if(price<=a-2*brickSize){a-=brickSize;push(-1);continue;}break;}
  if(price<=a-brickSize){push(-1);continue;}if(price>=a+2*brickSize){a+=brickSize;push(1);continue;}break;
 }
 const residual=Number(price)-a;
 if(Math.abs(residual)>1e-10){
  const close=a+Math.sign(residual)*Math.min(Math.abs(residual),brickSize),open=a;
  t+=1;out.push({time:t,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:Number(bucket?.volume)||0,sourceTime,renkoTimeInterval:interval,renkoDeveloping:true,renkoProjection:true,renkoProgress:Math.min(1,Math.abs(close-open)/brickSize)});
 }else if(out.length){out[out.length-1].volume=Number(bucket?.volume)||0;}
 return out;
}

function deriveRenkoTime(symbol,period,source){
 if(!source.length)return[];const interval=String(period?.value||settings().renkoTime||'1m'),bucket=activeBucket(source,interval);if(!bucket)return[];
 const completedSource=source.filter(b=>Number(b.time)<bucket.time);let completed=completedSource.length?buildPeriodBars(completedSource,key(symbol),period,settings()):[];completed=completed.filter(b=>b?.renkoDirection===1||b?.renkoDirection===-1);
 const cfg=SYMBOLS[key(symbol)]||SYMBOLS.XAUUSD,brickSize=cfg.pipSize*(Number(settings().renkoPips)||5),last=completed.at(-1),anchor=Number(last?.close??completedSource.at(-1)?.close??bucket.open),direction=Number(last?.renkoDirection)||0,startTime=Math.max(bucket.time-1,Math.floor(Number(last?.time)||0)),sourceTime=source.at(-1).time;
 const projection=projectRenkoMove({anchor,direction,price:Number(bucket.close),brickSize,startTime,bucket,sourceTime,interval});
 return projection.length?[...completed,...projection]:completed;
}
function derive(symbol,period,bars){if(String(period?.mode||'').toLowerCase()==='renko-time')return deriveRenkoTime(symbol,period,bars);return buildPeriodBars(bars,key(symbol),period,settings());}
function provider(){return window.TRADE_AVATA_CTRADER_PROVIDER;}
const rawRequestHistory=provider()?.requestHistory?.bind(provider());
function requestSourceHistory({symbol,before=null,direction='initial',limit=DERIVED_BOOTSTRAP_BARS}={}){if(!rawRequestHistory)return false;return rawRequestHistory({symbol:key(symbol),period:sourcePeriod,before,limit:Math.max(500,Math.min(10000,Number(limit)||DERIVED_BOOTSTRAP_BARS)),direction});}
function bootstrapHistory(symbol){return requestSourceHistory({symbol,direction:'initial',limit:DERIVED_BOOTSTRAP_BARS});}
function requestOlderDerived({symbol,before}={}){const cached=sourceCache.get(key(symbol))||[],oldestSource=Number(cached[0]?.time),cursor=Number.isFinite(oldestSource)&&oldestSource>0?oldestSource:Number(before);if(!Number.isFinite(cursor)||cursor<=0)return false;return requestSourceHistory({symbol,before:cursor,direction:'older',limit:DERIVED_OLDER_SOURCE_BARS});}

/* History-continuity asks the provider for the pane's displayed period. Translate
 * those Renko/Range paging requests back to genuine 1s history instead of ever
 * sending a derived period to the VPS. */
const p=provider();
if(p&&rawRequestHistory&&!p.__taDerivedHistoryRouter){p.__taDerivedHistoryRouter=true;p.requestHistory=function(opts={}){return isDerived(opts.period)?requestOlderDerived(opts):rawRequestHistory(opts);};}

hub.subscribe=function(opts={}){
 if(!isDerived(opts.period))return originalSubscribe(opts);
 const requested=structuredClone(opts.period),symbol=key(opts.symbol);let lastDerived=[];
 const unsubscribe=originalSubscribe({...opts,symbol,period:sourcePeriod,
  onHistory:payload=>{const incoming=(payload?.bars||payload?.data||[]).map(normalizeMarketBar).filter(Boolean);if(!incoming.length)return;const source=remember(symbol,incoming);lastDerived=derive(symbol,requested,source);if(!lastDerived.length)return;opts.onHistory?.({...payload,symbol,period:requested,bars:lastDerived,data:undefined,count:lastDerived.length,source:'ctrader-derived-1s',sourceBars:source.length});},
  onBar:payload=>{const raw=normalizeMarketBar(payload?.bar||payload);if(!raw)return;const source=remember(symbol,[raw]),next=derive(symbol,requested,source);if(!next.length)return;const bar=next.at(-1),previous=lastDerived.at(-1);lastDerived=next;if(!previous||Number(previous.time)!==Number(bar.time)||previous.open!==bar.open||previous.high!==bar.high||previous.low!==bar.low||previous.close!==bar.close||previous.renkoDeveloping!==bar.renkoDeveloping){opts.onBar?.({...payload,symbol,period:requested,bar,closed:!bar.renkoDeveloping&&!!payload?.closed,source:'ctrader-derived-1s'});}},onQuote:opts.onQuote
 });
 queueMicrotask(()=>bootstrapHistory(symbol));return unsubscribe;
};

window.__TRADE_AVATA_DERIVED_PERIOD_FEED={installed:true,source:'1s',modes:[...DERIVED],cache:sourceCache,bootstrapBars:DERIVED_BOOTSTRAP_BARS,olderSourceBars:DERIVED_OLDER_SOURCE_BARS,isDerived,requestOlder:requestOlderDerived};
