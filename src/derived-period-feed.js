/* Trade Avata derived-period feed router.
 * Renko/Range are frontend constructions, not cTrader gateway periods.
 * Never subscribe the VPS to renko-pips/renko-time/range-pips. Instead consume
 * genuine 1-second market data and deterministically derive the selected view.
 */
import hub from './market-feed-adapter.js';
import {buildPeriodBars} from './data.js';
import {mergeMarketBars,normalizeMarketBar} from './real-market-data.js';

const DERIVED=new Set(['renko-pips','renko-time','range-pips']);
const originalSubscribe=hub.subscribe.bind(hub);
const sourceCache=new Map();
const key=s=>String(s||'').toUpperCase();
const sourcePeriod={mode:'time',value:'1s'};

function isDerived(period){return DERIVED.has(String(period?.mode||'').toLowerCase());}
function derive(symbol,period,bars){
  return buildPeriodBars(bars,String(symbol||'').toUpperCase(),period,window.__tradeAvata?.state?.periodSettings||{});
}
function remember(symbol,incoming){
  const k=key(symbol),prev=sourceCache.get(k)||[];
  const next=mergeMarketBars(prev,incoming).slice(-20000);
  sourceCache.set(k,next);return next;
}

hub.subscribe=function(opts={}){
  if(!isDerived(opts.period))return originalSubscribe(opts);
  const requested=structuredClone(opts.period),symbol=String(opts.symbol||'').toUpperCase();
  let lastDerived=[];
  return originalSubscribe({
    ...opts,
    symbol,
    period:sourcePeriod,
    onHistory:payload=>{
      const incoming=(payload?.bars||payload?.data||[]).map(normalizeMarketBar).filter(Boolean);
      if(!incoming.length)return;
      const source=remember(symbol,incoming);
      lastDerived=derive(symbol,requested,source);
      if(!lastDerived.length)return;
      opts.onHistory?.({...payload,symbol,period:requested,bars:lastDerived,data:undefined,count:lastDerived.length,source:'ctrader-derived-1s'});
    },
    onBar:payload=>{
      const raw=normalizeMarketBar(payload?.bar||payload);
      if(!raw)return;
      const source=remember(symbol,[raw]),next=derive(symbol,requested,source);
      if(!next.length)return;
      const bar=next.at(-1),previous=lastDerived.at(-1);
      lastDerived=next;
      // Publish only the current derived bar. applyLiveBar handles replace/append.
      if(!previous||Number(previous.time)!==Number(bar.time)||previous.open!==bar.open||previous.high!==bar.high||previous.low!==bar.low||previous.close!==bar.close){
        opts.onBar?.({...payload,symbol,period:requested,bar,closed:!!payload?.closed,source:'ctrader-derived-1s'});
      }
    }
  });
};

window.__TRADE_AVATA_DERIVED_PERIOD_FEED={installed:true,source:'1s',modes:[...DERIVED],cache:sourceCache};
