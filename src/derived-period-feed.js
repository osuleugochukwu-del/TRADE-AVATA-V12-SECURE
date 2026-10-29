/* Trade Avata derived-period feed router.
 * Renko/Range are frontend constructions, not cTrader gateway periods.
 * Never subscribe the VPS to renko-pips/renko-time/range-pips. Instead consume
 * genuine 1-second market data and deterministically derive the selected view.
 *
 * Renko rules used here:
 * - completed continuation bricks require one full box;
 * - a reversal requires two full boxes from the current Renko close;
 * - an unfinished counter-move is a developing projection, not an opposite brick;
 * - fast moves are split into fixed-size bricks, never stretched bodies;
 * - genuine 1s source history is persisted separately so reopening a Renko period
 *   reconstructs history instead of starting from the moment it was selected.
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
const SOURCE_PERSIST_MAX=100000;
const DERIVED_BOOTSTRAP_BARS=10000;
const DERIVED_OLDER_SOURCE_BARS=10000;
const SOURCE_DB='trade-avata-derived-source-history';
const SOURCE_DB_VERSION=1;
const SOURCE_STORE='symbols';
let dbPromise=null;

function isDerived(period){return DERIVED.has(String(period?.mode||'').toLowerCase());}
function settings(){return window.__tradeAvata?.state?.periodSettings||window.__tradeAvataV111?.app?.state?.periodSettings||{};}
function openDb(){
 if(!('indexedDB'in window))return Promise.resolve(null);
 if(dbPromise)return dbPromise;
 dbPromise=new Promise(resolve=>{try{const req=indexedDB.open(SOURCE_DB,SOURCE_DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SOURCE_STORE))db.createObjectStore(SOURCE_STORE,{keyPath:'symbol'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);}catch{resolve(null);}});
 return dbPromise;
}
async function persistSource(symbol,bars){
 const safe=mergeMarketBars(bars).slice(-SOURCE_PERSIST_MAX);const db=await openDb();if(!db)return;
 try{const tx=db.transaction(SOURCE_STORE,'readwrite');tx.objectStore(SOURCE_STORE).put({symbol:key(symbol),bars:safe,oldest:safe[0]?.time??null,newest:safe.at(-1)?.time??null,updatedAt:Date.now()});}catch{}
}
async function hydrateSource(symbol){
 const k=key(symbol),db=await openDb();if(!db)return sourceCache.get(k)||[];
 try{const row=await new Promise(resolve=>{const tx=db.transaction(SOURCE_STORE,'readonly'),req=tx.objectStore(SOURCE_STORE).get(k);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);});if(!row?.bars?.length)return sourceCache.get(k)||[];const next=mergeMarketBars(row.bars,sourceCache.get(k)||[]).slice(-SOURCE_CACHE_MAX);sourceCache.set(k,next);return next;}catch{return sourceCache.get(k)||[];}
}
function remember(symbol,incoming){const k=key(symbol),prev=sourceCache.get(k)||[],next=mergeMarketBars(prev,incoming).slice(-SOURCE_CACHE_MAX);sourceCache.set(k,next);void persistSource(k,next);return next;}
function activeBucket(source,interval){if(!source.length)return null;const seconds=Math.max(1,timeframeSeconds(String(interval||'1m'))),last=source.at(-1),start=Math.floor(Number(last.time)/seconds)*seconds,part=source.filter(b=>Number(b.time)>=start);if(!part.length)return null;return{time:start,open:Number(part[0].open),high:Math.max(...part.map(b=>Number(b.high))),low:Math.min(...part.map(b=>Number(b.low))),close:Number(part.at(-1).close),volume:part.reduce((n,b)=>n+(Number(b.volume)||0),0),seconds};}

/* Projection for the active time bucket. Completed bricks obey the same one-box
 * continuation / two-box reversal rule as historical Renko. The residual preview
 * follows price but cannot create a one-box opposite brick. */
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
  const against=dir!==0&&Math.sign(residual)!==dir;
  const maxResidual=against?Math.max(0,2*brickSize-Number.EPSILON):brickSize;
  const close=a+Math.sign(residual)*Math.min(Math.abs(residual),maxResidual),open=a;
  t+=1;out.push({time:t,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:Number(bucket?.volume)||0,sourceTime,renkoTimeInterval:interval,renkoDeveloping:true,renkoProjection:true,renkoCounterMove:against,renkoProgress:Math.min(1,Math.abs(close-open)/(against?2*brickSize:brickSize))});
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

/* History-continuity asks the provider for the displayed period. Translate
 * Renko/Range paging back to genuine 1s history instead of sending a derived
 * timeframe to the VPS. */
const p=provider();
if(p&&rawRequestHistory&&!p.__taDerivedHistoryRouter){p.__taDerivedHistoryRouter=true;p.requestHistory=function(opts={}){return isDerived(opts.period)?requestOlderDerived(opts):rawRequestHistory(opts);};}

hub.subscribe=function(opts={}){
 if(!isDerived(opts.period))return originalSubscribe(opts);
 const requested=structuredClone(opts.period),symbol=key(opts.symbol);let lastDerived=[];
 const publishHistory=(payload,source)=>{lastDerived=derive(symbol,requested,source);if(!lastDerived.length)return;opts.onHistory?.({...payload,symbol,period:requested,bars:lastDerived,data:undefined,count:lastDerived.length,source:'ctrader-derived-1s',sourceBars:source.length});};
 const unsubscribe=originalSubscribe({...opts,symbol,period:sourcePeriod,
  onHistory:payload=>{const incoming=(payload?.bars||payload?.data||[]).map(normalizeMarketBar).filter(Boolean);if(!incoming.length)return;publishHistory(payload,remember(symbol,incoming));},
  onBar:payload=>{const raw=normalizeMarketBar(payload?.bar||payload);if(!raw)return;const source=remember(symbol,[raw]),next=derive(symbol,requested,source);if(!next.length)return;const previous=lastDerived,lastBar=previous.at(-1),changedFrom=Math.max(0,Math.min(previous.length,next.length)-8);lastDerived=next;
   /* A live price can complete several Renko bricks at once. Re-publish the full
      derived snapshot whenever structure/count changes so none of those bricks
      are lost; use the cheap single-bar path only for an ordinary developing update. */
   if(previous.length!==next.length||previous.slice(changedFrom).some((b,i)=>{const n=next[changedFrom+i];return !n||b.time!==n.time||b.open!==n.open||b.high!==n.high||b.low!==n.low||b.close!==n.close||b.renkoDirection!==n.renkoDirection;})){opts.onHistory?.({type:'history',symbol,period:requested,bars:next,count:next.length,direction:'live-rebuild',source:'ctrader-derived-1s',sourceBars:source.length});return;}
   const bar=next.at(-1);if(!lastBar||Number(lastBar.time)!==Number(bar.time)||lastBar.open!==bar.open||lastBar.high!==bar.high||lastBar.low!==bar.low||lastBar.close!==bar.close||lastBar.renkoDeveloping!==bar.renkoDeveloping){opts.onBar?.({...payload,symbol,period:requested,bar,closed:!bar.renkoDeveloping&&!!payload?.closed,source:'ctrader-derived-1s'});}},onQuote:opts.onQuote
 });
 /* Restore genuine source history first, then ask the VPS for the newest page.
    This makes timeframe re-selection deterministic and preserves deep history. */
 queueMicrotask(async()=>{const restored=await hydrateSource(symbol);if(restored.length)publishHistory({type:'history',direction:'restore-source',cached:true},restored);bootstrapHistory(symbol);});
 return unsubscribe;
};

window.__TRADE_AVATA_DERIVED_PERIOD_FEED={installed:true,source:'1s',modes:[...DERIVED],cache:sourceCache,bootstrapBars:DERIVED_BOOTSTRAP_BARS,olderSourceBars:DERIVED_OLDER_SOURCE_BARS,isDerived,requestOlder:requestOlderDerived,hydrateSource};
