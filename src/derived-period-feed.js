/* Trade Avata derived-period feed router.
 * Renko/Range are frontend constructions, not cTrader gateway periods.
 * Never subscribe the VPS to renko-pips/renko-time/range-pips. Instead consume
 * genuine 1-second market data and deterministically derive the selected view.
 *
 * Renko Time contract:
 * - completed historical buckets become completed Renko bricks;
 * - the active time bucket is shown as a developing candle-like Renko preview;
 * - the preview updates from genuine 1-second bars and is never treated as a
 *   completed brick until its time bucket closes;
 * - derived views bootstrap enough genuine source history to be useful at open.
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
const DERIVED_BOOTSTRAP_BARS=3000;

function isDerived(period){return DERIVED.has(String(period?.mode||'').toLowerCase());}
function settings(){return window.__tradeAvata?.state?.periodSettings||window.__tradeAvataV111?.app?.state?.periodSettings||{};}
function remember(symbol,incoming){
  const k=key(symbol),prev=sourceCache.get(k)||[];
  const next=mergeMarketBars(prev,incoming).slice(-SOURCE_CACHE_MAX);
  sourceCache.set(k,next);return next;
}
function activeBucket(source,interval){
  if(!source.length)return null;
  const seconds=Math.max(1,timeframeSeconds(String(interval||'1m')));
  const last=source.at(-1),start=Math.floor(Number(last.time)/seconds)*seconds;
  const part=source.filter(b=>Number(b.time)>=start);
  if(!part.length)return null;
  return{
    time:start,
    open:Number(part[0].open),
    high:Math.max(...part.map(b=>Number(b.high))),
    low:Math.min(...part.map(b=>Number(b.low))),
    close:Number(part.at(-1).close),
    volume:part.reduce((n,b)=>n+(Number(b.volume)||0),0),
    seconds
  };
}
function deriveRenkoTime(symbol,period,source){
  if(!source.length)return[];
  const interval=String(period?.value||settings().renkoTime||'1m');
  const bucket=activeBucket(source,interval);
  if(!bucket)return[];

  /* Only closed source buckets may print final Renko bricks. */
  const completedSource=source.filter(b=>Number(b.time)<bucket.time);
  let completed=completedSource.length
    ?buildPeriodBars(completedSource,key(symbol),period,settings())
    :[];

  /* renkoBars historically returned its last input bar when no threshold had
     completed. That fallback is not a completed Renko brick, so discard it. */
  completed=completed.filter(b=>b?.renkoDirection===1||b?.renkoDirection===-1);

  const cfg=SYMBOLS[key(symbol)]||SYMBOLS.XAUUSD;
  const brickSize=cfg.pipSize*(Number(settings().renkoPips)||5);
  const anchor=Number(completed.at(-1)?.close ?? completedSource.at(-1)?.close ?? bucket.open);
  const close=Number(bucket.close);
  const delta=close-anchor;

  /* A developing brick behaves like a candle while the time bucket is open.
     Its body follows price from the last completed Renko anchor; its wick shows
     the genuine high/low reached inside the active bucket. */
  const previewTime=Math.max(
    bucket.time,
    Math.floor(Number(completed.at(-1)?.time)||0)+1
  );
  const preview={
    time:previewTime,
    open:anchor,
    high:Math.max(anchor,close,bucket.high),
    low:Math.min(anchor,close,bucket.low),
    close,
    volume:bucket.volume,
    sourceTime:source.at(-1).time,
    renkoTimeInterval:interval,
    renkoDeveloping:true,
    renkoProgress:brickSize>0?Math.min(1,Math.abs(delta)/brickSize):0
  };
  return [...completed,preview];
}
function derive(symbol,period,bars){
  if(String(period?.mode||'').toLowerCase()==='renko-time')return deriveRenkoTime(symbol,period,bars);
  return buildPeriodBars(bars,key(symbol),period,settings());
}
function bootstrapHistory(symbol){
  const provider=window.TRADE_AVATA_CTRADER_PROVIDER;
  if(!provider?.requestHistory)return false;
  return provider.requestHistory({
    symbol,
    period:sourcePeriod,
    limit:DERIVED_BOOTSTRAP_BARS,
    direction:'initial'
  });
}

hub.subscribe=function(opts={}){
  if(!isDerived(opts.period))return originalSubscribe(opts);
  const requested=structuredClone(opts.period),symbol=key(opts.symbol);
  let lastDerived=[];
  const unsubscribe=originalSubscribe({
    ...opts,
    symbol,
    period:sourcePeriod,
    onHistory:payload=>{
      const incoming=(payload?.bars||payload?.data||[]).map(normalizeMarketBar).filter(Boolean);
      if(!incoming.length)return;
      const source=remember(symbol,incoming);
      lastDerived=derive(symbol,requested,source);
      if(!lastDerived.length)return;
      opts.onHistory?.({...payload,symbol,period:requested,bars:lastDerived,data:undefined,count:lastDerived.length,source:'ctrader-derived-1s',sourceBars:source.length});
    },
    onBar:payload=>{
      const raw=normalizeMarketBar(payload?.bar||payload);
      if(!raw)return;
      const source=remember(symbol,[raw]),next=derive(symbol,requested,source);
      if(!next.length)return;
      const bar=next.at(-1),previous=lastDerived.at(-1);
      lastDerived=next;
      // Publish the current completed/developing derived bar. applyLiveBar handles
      // replacement while the active Renko preview develops and append on close.
      if(!previous||Number(previous.time)!==Number(bar.time)||previous.open!==bar.open||previous.high!==bar.high||previous.low!==bar.low||previous.close!==bar.close||previous.renkoDeveloping!==bar.renkoDeveloping){
        opts.onBar?.({...payload,symbol,period:requested,bar,closed:!bar.renkoDeveloping&&!!payload?.closed,source:'ctrader-derived-1s'});
      }
    },
    onQuote:opts.onQuote
  });

  /* The ordinary provider subscription asks for 500 1-second bars. Derived
     constructions need a larger genuine source window to show useful history,
     so request one bounded bootstrap page. No synthetic backfill is allowed. */
  queueMicrotask(()=>bootstrapHistory(symbol));
  return unsubscribe;
};

window.__TRADE_AVATA_DERIVED_PERIOD_FEED={installed:true,source:'1s',modes:[...DERIVED],cache:sourceCache,bootstrapBars:DERIVED_BOOTSTRAP_BARS};
