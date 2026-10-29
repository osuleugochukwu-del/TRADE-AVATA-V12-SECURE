/* Trade Avata genuine-history cache + progressive paging.
 * No synthetic fallback. Backend contract: history requests accept before/beforeTs,
 * limit/count and direction=older; responses may return hasMore and nextBefore/cursor.
 *
 * UX contract:
 * - history is fetched in small viewport-aware pages (250-500 bars), never 1000-bar bursts;
 * - one deliberate left-navigation gesture can trigger at most one older-page request;
 * - prepending a page must not recursively trigger another request;
 * - the visible logical window is shifted by exactly the number of newly prepended bars;
 * - genuine bars survive page/session restarts through IndexedDB; sessionStorage remains a fast fallback.
 */
import marketFeed from './market-feed-adapter.js';
import {normalizeMarketBar,mergeMarketBars,historyDiagnostics} from './real-market-data.js';

const MIN_PAGE=250,MAX_PAGE=500,MIN_INITIAL_BARS=24,SESSION_CACHE_MAX=10000;
const DB_NAME='trade-avata-genuine-history',DB_VERSION=1,STORE='ranges';
const state=new Map(),cache=new Map();
const key=(s,p)=>`${String(s||'').toUpperCase()}|${String(p?.mode||'time').toLowerCase()}:${String(p?.value??p??'1m').toLowerCase()}`;
function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;}
function paneFor(k){return(appNow()?.panes||[]).find(p=>key(p.symbol,p.period||{mode:'time',value:p.timeframe})===k);}
function pageSizeFor(pane){try{const ts=pane?.chart?.timeScale?.(),range=ts?.getVisibleLogicalRange?.();const visible=range&&Number.isFinite(range.to-range.from)?Math.ceil(range.to-range.from):0;const width=Number(pane?.chartHost?.clientWidth||0);const spacing=Number(ts?.options?.()?.barSpacing||pane?.app?.state?.chartSettings?.barSpacing||7);const estimated=visible||Math.ceil(width/Math.max(.45,spacing))||MIN_PAGE;return Math.max(MIN_PAGE,Math.min(MAX_PAGE,Math.ceil(estimated*1.75)));}catch{return MIN_PAGE;}}
function requestOlder(pane,period,before,limit){const p=window.TRADE_AVATA_CTRADER_PROVIDER;if(!p?.requestHistory||!before)return false;return p.requestHistory({symbol:pane.symbol,period,before,limit,direction:'older'});}

let dbPromise=null;
function openDb(){
  if(!('indexedDB'in window))return Promise.resolve(null);
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(resolve=>{
    try{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
      req.onblocked=()=>resolve(null);
    }catch{resolve(null);}
  });
  return dbPromise;
}
async function persist(k,bars){
  const safe=mergeMarketBars(bars).slice(-SESSION_CACHE_MAX);
  try{sessionStorage.setItem(`ta-history:${k}`,JSON.stringify(safe));}catch{}
  const db=await openDb();if(!db)return;
  try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:k,bars:safe,updatedAt:Date.now(),oldest:safe[0]?.time??null,newest:safe.at(-1)?.time??null});}catch{}
}
function remember(k,bars){const safe=mergeMarketBars(bars).slice(-SESSION_CACHE_MAX);cache.set(k,safe);void persist(k,safe);return safe;}
function restore(k){if(cache.has(k))return cache.get(k);try{const x=JSON.parse(sessionStorage.getItem(`ta-history:${k}`)||'[]'),bars=mergeMarketBars(x);if(bars.length)cache.set(k,bars);return bars;}catch{return[];}}
async function hydratePersistent(k){
  const db=await openDb();if(!db)return restore(k);
  try{
    const row=await new Promise(resolve=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(k);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);});
    if(!row?.bars?.length)return restore(k);
    const bars=mergeMarketBars(restore(k),row.bars);cache.set(k,bars);try{sessionStorage.setItem(`ta-history:${k}`,JSON.stringify(bars.slice(-SESSION_CACHE_MAX)));}catch{}return bars;
  }catch{return restore(k);}
}
function captureViewport(pane){try{const r=pane?.chart?.timeScale?.().getVisibleLogicalRange?.();return r&&Number.isFinite(r.from)&&Number.isFinite(r.to)?{from:r.from,to:r.to}:null;}catch{return null;}}
function restoreViewport(pane,range,prepended){if(!pane||!range||!Number.isFinite(prepended)||prepended<=0)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{try{pane.chart?.timeScale?.().setVisibleLogicalRange?.({from:range.from+prepended,to:range.to+prepended});}catch{}}));}

const original=marketFeed.publishHistory.bind(marketFeed);
marketFeed.publishHistory=function(payload){
  if(!payload?.symbol||!payload?.period)return original(payload);
  const incoming=(payload.bars||payload.data||[]).map(normalizeMarketBar).filter(Boolean);if(!incoming.length)return original(payload);
  const k=key(payload.symbol,payload.period),s=state.get(k)||{},pane=paneFor(k);const restored=restore(k);const existing=restored.length?restored:(pane?.periodBars||[]);
  const oldestExisting=Number(existing[0]?.time),newestIncoming=Number(incoming.at(-1)?.time);const older=!!existing.length&&(payload.direction==='older'||payload.prepend===true||newestIncoming<=oldestExisting);
  const bars=remember(k,mergeMarketBars(existing,incoming)),prepended=older?Math.max(0,bars.length-existing.length):0;
  s.loading=false;s.initialReady=s.initialReady||payload.direction==='initial'||payload.direction==null;s.hasMore=payload.hasMore!==false;s.cursor=payload.nextBefore??payload.cursor??bars[0]?.time??null;s.lastPageCount=incoming.length;s.lastMode=older?'prepend':'merge';s.lastSettledAt=performance.now();state.set(k,s);
  window.__TRADE_AVATA_HISTORY_DIAGNOSTICS=window.__TRADE_AVATA_HISTORY_DIAGNOSTICS||{};window.__TRADE_AVATA_HISTORY_DIAGNOSTICS[k]=historyDiagnostics(payload.symbol,payload.period,bars,{hasMore:s.hasMore,cursor:s.cursor,pageSize:s.lastPageSize||MIN_PAGE,lastPageCount:s.lastPageCount,lastMode:s.lastMode});
  const result=original({...payload,bars,data:undefined,count:bars.length,prepend:older});if(older&&s.viewport)restoreViewport(pane,s.viewport,prepended);return result;
};

function publishRestore(pane,bars,source){if(!pane||!bars?.length)return false;const period=pane.period||{mode:'time',value:pane.timeframe};original({type:'history',symbol:pane.symbol,period,bars,count:bars.length,direction:'restore',source,cached:true});return true;}
function restorePane(pane){if(!pane)return false;const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);if(saved.length)publishRestore(pane,saved,'browser-session-cache');void hydratePersistent(k).then(bars=>{if(bars.length)publishRestore(pane,bars,'browser-indexeddb-cache');});return !!saved.length;}
function restoreAll(){const app=appNow();if(!app)return false;for(const pane of app.panes||[])restorePane(pane);return true;}
function armHistoryGesture(pane){const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{};s.gesture=(s.gesture||0)+1;s.gestureAt=performance.now();state.set(pk,s);}
function installGestureArming(pane){const host=pane.chartHost||pane.root;if(!host||pane.__taHistoryGestureArming)return;pane.__taHistoryGestureArming=true;host.addEventListener('pointerdown',()=>armHistoryGesture(pane),{passive:true,capture:true});host.addEventListener('touchstart',()=>armHistoryGesture(pane),{passive:true,capture:true});host.addEventListener('wheel',()=>{const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{},now=performance.now();if(now-(s.lastWheelArmAt||0)<700)return;s.lastWheelArmAt=now;state.set(pk,s);armHistoryGesture(pane);},{passive:true,capture:true});}
function install(){
  const app=appNow();if(!app){setTimeout(install,50);return;}
  for(const pane of app.panes||[]){const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);if(saved.length&&!pane.periodBars?.length)restorePane(pane);else if(!saved.length)void hydratePersistent(k).then(bars=>{if(bars.length)publishRestore(pane,bars,'browser-indexeddb-cache');});installGestureArming(pane);if(pane.__taHistoryContinuity)continue;pane.__taHistoryContinuity=true;
    pane.chart?.timeScale?.().subscribeVisibleLogicalRangeChange?.(()=>{const r=pane.chart?.timeScale?.().getVisibleLogicalRange?.();if(!r||r.from>80)return;const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{},bars=restore(pk),available=Math.max(bars.length,pane.periodBars?.length||0),oldest=Number(pane.periodBars?.[0]?.time||bars[0]?.time),gesture=s.gesture||0;if(!s.initialReady||available<MIN_INITIAL_BARS||!oldest||s.loading||s.hasMore===false||s.before===oldest)return;if(!gesture||s.consumedGesture===gesture)return;if(performance.now()-(s.lastSettledAt||0)<250)return;const limit=pageSizeFor(pane);s.loading=true;s.before=oldest;s.consumedGesture=gesture;s.lastPageSize=limit;s.viewport=captureViewport(pane);state.set(pk,s);if(!requestOlder(pane,p,oldest,limit)){s.loading=false;state.set(pk,s);}setTimeout(()=>{const latest=state.get(pk);if(latest?.loading){latest.loading=false;state.set(pk,latest);}},5000);});
  }
  setTimeout(install,1000);return true;
}

install();
window.addEventListener('pageshow',()=>{restoreAll();install();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){restoreAll();install();}});
marketFeed.addEventListener('status',e=>{const status=String(e?.detail?.status||e?.detail||'').toLowerCase();if(status.includes('reconnect')||status.includes('connect')||status.includes('error')||status.includes('offline'))restoreAll();});
window.__TRADE_AVATA_HISTORY_CACHE=cache;window.__TRADE_AVATA_HISTORY_STATE=state;window.__TRADE_AVATA_HISTORY_CONTINUITY=true;window.__TRADE_AVATA_RESTORE_GENUINE_HISTORY=restoreAll;window.__TRADE_AVATA_HISTORY_INDEXEDDB=true;
