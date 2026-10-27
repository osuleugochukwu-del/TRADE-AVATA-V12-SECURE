/* Trade Avata genuine market-data engine.
 * Pure transforms only. No synthetic/demo prices are ever generated here.
 * The gateway remains authoritative; this layer normalizes, merges and derives
 * supported custom intervals/chart constructions from genuine received bars.
 */

export function normalizeMarketBar(b){
  if(!b)return null;
  let time=Number(b.time??b.ts??b.timestamp??b.openTime);
  if(time>1e12)time=Math.floor(time/1000);
  if(time>1e10)time=Math.floor(time/1000);
  const out={time,open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume??b.tickVolume??0)};
  return Number.isFinite(time)&&['open','high','low','close'].every(k=>Number.isFinite(out[k]))?out:null;
}

export function mergeMarketBars(...sets){
  const map=new Map();
  for(const set of sets)for(const raw of set||[]){const b=normalizeMarketBar(raw);if(b)map.set(b.time,b);}
  return [...map.values()].sort((a,b)=>a.time-b.time);
}

export function periodSeconds(value){
  const s=String(value||'').trim().toLowerCase();
  let m=/^(\d+)s$/.exec(s);if(m)return +m[1];
  m=/^(\d+)m$/.exec(s);if(m)return +m[1]*60;
  m=/^(\d+)h$/.exec(s);if(m)return +m[1]*3600;
  m=/^(\d+)d$/.exec(s);if(m)return +m[1]*86400;
  m=/^(\d+)w$/.exec(s);if(m)return +m[1]*604800;
  return null;
}

export function aggregateTimeBars(source,period){
  const step=periodSeconds(period);if(!step)return mergeMarketBars(source);
  const bars=mergeMarketBars(source),out=[];let cur=null;
  for(const b of bars){
    const time=Math.floor(b.time/step)*step;
    if(!cur||cur.time!==time){cur={time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume||0};out.push(cur);}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=(b.volume||0);}
  }
  return out;
}

export function heikinAshiBars(source){
  const bars=mergeMarketBars(source),out=[];let prev=null;
  for(const b of bars){const close=(b.open+b.high+b.low+b.close)/4,open=prev?(prev.open+prev.close)/2:(b.open+b.close)/2,x={...b,open,close,high:Math.max(b.high,open,close),low:Math.min(b.low,open,close)};out.push(x);prev=x;}
  return out;
}

export function linePoints(source){return mergeMarketBars(source).map(b=>({time:b.time,value:b.close}));}

export function renkoBars(source,brickSize){
  const bars=mergeMarketBars(source),size=Math.abs(Number(brickSize));if(!bars.length||!Number.isFinite(size)||size<=0)return [];
  const out=[];let anchor=bars[0].open;
  for(const b of bars){let guard=0;while(Math.abs(b.close-anchor)>=size&&guard++<10000){const dir=b.close>anchor?1:-1,open=anchor,close=open+dir*size;out.push({time:b.time,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:b.volume||0});anchor=close;}}
  return out;
}

export function rangeBars(source,rangeSize){
  const bars=mergeMarketBars(source),size=Math.abs(Number(rangeSize));if(!bars.length||!Number.isFinite(size)||size<=0)return [];
  const out=[];let cur={time:bars[0].time,open:bars[0].open,high:bars[0].open,low:bars[0].open,close:bars[0].open,volume:0};
  for(const b of bars){cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;cur.volume+=(b.volume||0);if(cur.high-cur.low>=size){out.push(cur);cur={time:b.time,open:cur.close,high:cur.close,low:cur.close,close:cur.close,volume:0};}}
  if(cur.volume||!out.length)out.push(cur);return out;
}

export function historyDiagnostics(symbol,period,bars,extra={}){
  const x=mergeMarketBars(bars),times=x.map(b=>b.time);return{symbol:String(symbol||'').toUpperCase(),period:String(period?.value??period??''),loaded:x.length,oldest:times[0]??null,newest:times.at(-1)??null,duplicates:Math.max(0,(bars?.length||0)-new Set(times).size),source:'cTrader',synthetic:false,...extra};
}

window.__TRADE_AVATA_REAL_MARKET_DATA={normalizeMarketBar,mergeMarketBars,periodSeconds,aggregateTimeBars,heikinAshiBars,linePoints,renkoBars,rangeBars,historyDiagnostics};
