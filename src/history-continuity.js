/* Trade Avata genuine-history cache + progressive paging.
 * No synthetic fallback. Backend contract: history requests accept before/beforeTs,
 * limit/count and direction=older; responses may return hasMore and nextBefore/cursor.
 *
 * Reconnect/offline rule: the last genuine broker candles are restored immediately
 * from browser session storage before a live socket is available. A disconnect must
 * freeze the last real chart, never turn it into an empty 0.10-0.80 pane.
 */
import marketFeed from './market-feed-adapter.js';
import {normalizeMarketBar,mergeMarketBars,historyDiagnostics} from './real-market-data.js';
const PAGE=1000,MIN_INITIAL_BARS=24,state=new Map(),cache=new Map();
const key=(s,p)=>`${String(s||'').toUpperCase()}|${String(p?.mode||'time').toLowerCase()}:${String(p?.value??p??'1m').toLowerCase()}`;
function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;}
function paneFor(k){return(appNow()?.panes||[]).find(p=>key(p.symbol,p.period||{mode:'time',value:p.timeframe})===k);}
function requestOlder(symbol,period,before){const p=window.TRADE_AVATA_CTRADER_PROVIDER;if(!p?.requestHistory||!before)return false;return p.requestHistory({symbol,period,before,limit:PAGE,direction:'older'});}
function remember(k,bars){cache.set(k,bars);try{sessionStorage.setItem(`ta-history:${k}`,JSON.stringify(bars.slice(-5000)));}catch{}}
function restore(k){if(cache.has(k))return cache.get(k);try{const x=JSON.parse(sessionStorage.getItem(`ta-history:${k}`)||'[]'),bars=mergeMarketBars(x);if(bars.length)cache.set(k,bars);return bars;}catch{return[];}}
const original=marketFeed.publishHistory.bind(marketFeed);
marketFeed.publishHistory=function(payload){if(!payload?.symbol||!payload?.period)return original(payload);const incoming=(payload.bars||payload.data||[]).map(normalizeMarketBar).filter(Boolean);if(!incoming.length)return original(payload);const k=key(payload.symbol,payload.period),s=state.get(k)||{},existing=restore(k).length?restore(k):(paneFor(k)?.periodBars||[]),oldestExisting=Number(existing[0]?.time),newestIncoming=Number(incoming.at(-1)?.time),older=!!existing.length&&(payload.direction==='older'||payload.prepend===true||newestIncoming<=oldestExisting),bars=mergeMarketBars(existing,incoming);remember(k,bars);s.loading=false;s.initialReady=s.initialReady||payload.direction==='initial'||payload.direction==null;s.hasMore=payload.hasMore!==false;s.cursor=payload.nextBefore??payload.cursor??bars[0]?.time??null;s.lastPageCount=incoming.length;s.lastMode=older?'prepend':'merge';state.set(k,s);window.__TRADE_AVATA_HISTORY_DIAGNOSTICS=window.__TRADE_AVATA_HISTORY_DIAGNOSTICS||{};window.__TRADE_AVATA_HISTORY_DIAGNOSTICS[k]=historyDiagnostics(payload.symbol,payload.period,bars,{hasMore:s.hasMore,cursor:s.cursor,pageSize:PAGE,lastPageCount:s.lastPageCount,lastMode:s.lastMode});return original({...payload,bars,data:undefined,count:bars.length,prepend:older});};

function restorePane(pane){
  if(!pane)return false;
  const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);
  if(!saved.length)return false;
  /* Route cached genuine history through the normal market hub so every live chart
     consumer receives exactly the same payload shape as server history. */
  original({type:'history',symbol:pane.symbol,period,bars:saved,count:saved.length,direction:'restore',source:'browser-session-cache',cached:true});
  return true;
}
function restoreAll(){const app=appNow();if(!app)return false;for(const pane of app.panes||[])restorePane(pane);return true;}

function install(){const app=appNow();if(!app){setTimeout(install,50);return;}for(const pane of app.panes||[]){const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),saved=restore(k);if(saved.length&&!pane.periodBars?.length)restorePane(pane);if(pane.__taHistoryContinuity)continue;pane.__taHistoryContinuity=true;pane.chart?.timeScale?.().subscribeVisibleLogicalRangeChange?.(()=>{const r=pane.chart?.timeScale?.().getVisibleLogicalRange?.();if(!r||r.from>80)return;const p=pane.period||{mode:'time',value:pane.timeframe},pk=key(pane.symbol,p),s=state.get(pk)||{},bars=restore(pk),available=Math.max(bars.length,pane.periodBars?.length||0),oldest=Number(pane.periodBars?.[0]?.time||bars[0]?.time);if(!s.initialReady||available<MIN_INITIAL_BARS||!oldest||s.loading||s.hasMore===false||s.before===oldest)return;s.loading=true;s.before=oldest;state.set(pk,s);if(!requestOlder(pane.symbol,p,oldest))s.loading=false;setTimeout(()=>{const latest=state.get(pk);if(latest?.loading){latest.loading=false;state.set(pk,latest);}},5000);});}setTimeout(install,1000);return true;}

/* Install/restore as early as possible and repeat on lifecycle/feed transitions.
   This is deliberately independent of socket availability. */
install();
window.addEventListener('pageshow',()=>{restoreAll();install();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){restoreAll();install();}});
marketFeed.addEventListener('status',e=>{const status=String(e?.detail?.status||e?.detail||'').toLowerCase();if(status.includes('reconnect')||status.includes('connect')||status.includes('error')||status.includes('offline'))restoreAll();});

window.__TRADE_AVATA_HISTORY_CACHE=cache;window.__TRADE_AVATA_HISTORY_STATE=state;window.__TRADE_AVATA_HISTORY_CONTINUITY=true;window.__TRADE_AVATA_RESTORE_GENUINE_HISTORY=restoreAll;
