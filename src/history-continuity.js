/* Trade Avata genuine-history cache + progressive paging.
 * No synthetic fallback. Backend contract: history requests accept before/beforeTs,
 * limit/count and direction=older; responses may return hasMore and nextBefore/cursor.
 *
 * UX contract:
 * - history is fetched in small viewport-aware pages (250-500 bars), never 1000-bar bursts;
 * - one deliberate left-navigation gesture can trigger at most one older-page request;
 * - prepending a page must not recursively trigger another request;
 * - the visible time window is restored after a prepend so indicators/chart geometry settle;
 * - already fetched genuine bars remain cached in the browser session and are reused.
 */
import marketFeed from './market-feed-adapter.js';
import {normalizeMarketBar,mergeMarketBars,historyDiagnostics} from './real-market-data.js';

const MIN_PAGE=250,MAX_PAGE=500,MIN_INITIAL_BARS=24,SESSION_CACHE_MAX=10000;
const state=new Map(),cache=new Map();
const key=(s,p)=>`${String(s||'').toUpperCase()}|${String(p?.mode||'time').toLowerCase()}:${String(p?.value??p??'1m').toLowerCase()}`;
function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;}
function paneFor(k){return(appNow()?.panes||[]).find(p=>key(p.symbol,p.period||{mode:'time',value:p.timeframe})===k);}
function pageSizeFor(pane){
  try{
    const ts=pane?.chart?.timeScale?.();
    const range=ts?.getVisibleLogicalRange?.();
    const visible=range&&Number.isFinite(range.to-range.from)?Math.ceil(range.to-range.from):0;
    const width=Number(ts?.width?.()||pane?.chartHost?.clientWidth||0);
    const spacing=Number(ts?.options?.()?.barSpacing||pane?.app?.state?.chartSettings?.barSpacing||7);
    const estimated=visible||Math.ceil(width/Math.max(.45,spacing))||MIN_PAGE;
    return Math.max(MIN_PAGE,Math.min(MAX_PAGE,Math.ceil(estimated*1.75)));
  }catch{return MIN_PAGE;}
}
function requestOlder(pane,period,before,limit){
  const p=window.TRADE_AVATA_CTRADER_PROVIDER;
  if(!p?.requestHistory||!before)return false;
  return p.requestHistory({symbol:pane.symbol,period,before,limit,direction:'older'});
}
function remember(k,bars){
  cache.set(k,bars);
  try{sessionStorage.setItem(`ta-history:${k}`,JSON.stringify(bars.slice(-SESSION_CACHE_MAX)));}catch{}
}
function restore(k){
  if(cache.has(k))return cache.get(k);
  try{
    const x=JSON.parse(sessionStorage.getItem(`ta-history:${k}`)||'[]'),bars=mergeMarketBars(x);
    if(bars.length)cache.set(k,bars);
    return bars;
  }catch{return[];}
}
function captureViewport(pane){
  try{return pane?.chart?.timeScale?.().getVisibleRange?.()||null;}catch{return null;}
}
function restoreViewport(pane,range){
  if(!pane||!range)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    try{pane.chart?.timeScale?.().setVisibleRange?.(range);}catch{}
  }));
}

const original=marketFeed.publishHistory.bind(marketFeed);
marketFeed.publishHistory=function(payload){
  if(!payload?.symbol||!payload?.period)return original(payload);
  const incoming=(payload.bars||payload.data||[]).map(normalizeMarketBar).filter(Boolean);
  if(!incoming.length)return original(payload);
  const k=key(payload.symbol,payload.period),s=state.get(k)||{},pane=paneFor(k);
  const existing=restore(k).length?restore(k):(pane?.periodBars||[]);
  const oldestExisting=Number(existing[0]?.time),newestIncoming=Number(incoming.at(-1)?.time);
  const older=!!existing.length&&(payload.direction==='older'||payload.prepend===true||newestIncoming<=oldestExisting);
  const bars=mergeMarketBars(existing,incoming);
  remember(k,bars);
  s.loading=false;
  s.initialReady=s.initialReady||payload.direction==='initial'||payload.direction==null;
  s.hasMore=payload.hasMore!==false;
  s.cursor=payload.nextBefore??payload.cursor??bars[0]?.time??null;
  s.lastPageCount=incoming.length;
  s.lastMode=older?'prepend':'merge';
  s.lastSettledAt=performance.now();
  state.set(k,s);
  window.__TRADE_AVATA_HISTORY_DIAGNOSTICS=window.__TRADE_AVATA_HISTORY_DIAGNOSTICS||{};
  window.__TRADE_AVATA_HISTORY_DIAGNOSTICS[k]=historyDiagnostics(payload.symbol,payload.period,bars,{hasMore:s.hasMore,cursor:s.cursor,pageSize:s.lastPageSize||MIN_PAGE,lastPageCount:s.lastPageCount,lastMode:s.lastMode});
  const result=original({...payload,bars,data:undefined,count:bars.length,prepend:older});
  if(older&&s.viewport)restoreViewport(pane,s.viewport);
  return result;
};

function restorePane(pane){
  if(!pane)return false;
  const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);
  if(!saved.length)return false;
  original({type:'history',symbol:pane.symbol,period,bars:saved,count:saved.length,direction:'restore',source:'browser-session-cache',cached:true});
  return true;
}
function restoreAll(){const app=appNow();if(!app)return false;for(const pane of app.panes||[])restorePane(pane);return true;}

function armHistoryGesture(pane){
  const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{};
  s.gesture=(s.gesture||0)+1;
  s.gestureAt=performance.now();
  state.set(pk,s);
}
function installGestureArming(pane){
  const host=pane.chartHost||pane.root;
  if(!host||pane.__taHistoryGestureArming)return;
  pane.__taHistoryGestureArming=true;
  host.addEventListener('pointerdown',()=>armHistoryGesture(pane),{passive:true,capture:true});
  host.addEventListener('touchstart',()=>armHistoryGesture(pane),{passive:true,capture:true});
  host.addEventListener('wheel',()=>{
    const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{},now=performance.now();
    if(now-(s.lastWheelArmAt||0)<700)return;
    s.lastWheelArmAt=now;state.set(pk,s);armHistoryGesture(pane);
  },{passive:true,capture:true});
}

function install(){
  const app=appNow();if(!app){setTimeout(install,50);return;}
  for(const pane of app.panes||[]){
    const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);
    if(saved.length&&!pane.periodBars?.length)restorePane(pane);
    installGestureArming(pane);
    if(pane.__taHistoryContinuity)continue;
    pane.__taHistoryContinuity=true;
    pane.chart?.timeScale?.().subscribeVisibleLogicalRangeChange?.(()=>{
      const r=pane.chart?.timeScale?.().getVisibleLogicalRange?.();
      if(!r||r.from>80)return;
      const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{};
      const bars=restore(pk),available=Math.max(bars.length,pane.periodBars?.length||0),oldest=Number(pane.periodBars?.[0]?.time||bars[0]?.time);
      const gesture=s.gesture||0;
      if(!s.initialReady||available<MIN_INITIAL_BARS||!oldest||s.loading||s.hasMore===false||s.before===oldest)return;
      /* A prepend/rerender can fire this callback too. Only a fresh user navigation
         gesture is allowed to consume another history page. */
      if(!gesture||s.consumedGesture===gesture)return;
      if(performance.now()-(s.lastSettledAt||0)<250)return;
      const limit=pageSizeFor(pane);
      s.loading=true;s.before=oldest;s.consumedGesture=gesture;s.lastPageSize=limit;s.viewport=captureViewport(pane);
      state.set(pk,s);
      if(!requestOlder(pane,p,oldest,limit)){s.loading=false;state.set(pk,s);}
      setTimeout(()=>{const latest=state.get(pk);if(latest?.loading){latest.loading=false;state.set(pk,latest);}},5000);
    });
  }
  setTimeout(install,1000);return true;
}

install();
window.addEventListener('pageshow',()=>{restoreAll();install();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){restoreAll();install();}});
marketFeed.addEventListener('status',e=>{const status=String(e?.detail?.status||e?.detail||'').toLowerCase();if(status.includes('reconnect')||status.includes('connect')||status.includes('error')||status.includes('offline'))restoreAll();});

window.__TRADE_AVATA_HISTORY_CACHE=cache;
window.__TRADE_AVATA_HISTORY_STATE=state;
window.__TRADE_AVATA_HISTORY_CONTINUITY=true;
window.__TRADE_AVATA_RESTORE_GENUINE_HISTORY=restoreAll;
