/* Trade Avata genuine-history cache + progressive paging.
 * No synthetic fallback. The VPS may answer immediately or later once the
 * cTrader history protocol is expanded; the browser contract is ready now.
 */
import marketFeed from './market-feed-adapter.js';
import {normalizeMarketBar,mergeMarketBars,historyDiagnostics} from './real-market-data.js';

const PAGE=1000,state=new Map(),cache=new Map();
const key=(s,p)=>`${String(s||'').toUpperCase()}|${String(p?.value??p??'1m').toLowerCase()}`;
function requestOlder(symbol,period,before){const p=window.TRADE_AVATA_CTRADER_PROVIDER;if(!p?.send||!before)return false;return p.send({type:'history',symbol:String(symbol).toUpperCase(),period,limit:PAGE,count:PAGE,before:before*1000,beforeTs:before*1000,direction:'older'});}
function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;}
function paneFor(k){return (appNow()?.panes||[]).find(p=>key(p.symbol,p.period||{mode:'time',value:p.timeframe})===k);}

const original=marketFeed.publishHistory.bind(marketFeed);
marketFeed.publishHistory=function(payload){
  if(!payload?.symbol||!payload?.period)return original(payload);
  const incoming=(payload.bars||payload.data||[]).map(normalizeMarketBar).filter(Boolean);if(!incoming.length)return original(payload);
  const k=key(payload.symbol,payload.period),s=state.get(k)||{},existing=cache.get(k)||paneFor(k)?.periodBars||[];
  const oldestExisting=Number(existing[0]?.time),newestIncoming=Number(incoming.at(-1)?.time),older=!!existing.length&&newestIncoming<=oldestExisting;
  const bars=older?mergeMarketBars(incoming,existing):mergeMarketBars(existing,incoming);
  cache.set(k,bars);s.loading=false;s.hasMore=payload.hasMore!==false;s.cursor=payload.cursor??payload.nextBefore??bars[0]?.time??null;state.set(k,s);
  window.__TRADE_AVATA_HISTORY_DIAGNOSTICS=window.__TRADE_AVATA_HISTORY_DIAGNOSTICS||{};
  window.__TRADE_AVATA_HISTORY_DIAGNOSTICS[k]=historyDiagnostics(payload.symbol,payload.period,bars,{hasMore:s.hasMore,cursor:s.cursor,pageSize:PAGE});
  return original({...payload,bars,data:undefined,count:bars.length});
};

function install(){
  const app=appNow();if(!app){setTimeout(install,50);return;}
  for(const pane of app.panes||[]){
    if(pane.__taHistoryContinuity)continue;pane.__taHistoryContinuity=true;
    pane.chart?.timeScale?.().subscribeVisibleLogicalRangeChange?.(()=>{
      const r=pane.chart?.timeScale?.().getVisibleLogicalRange?.();if(!r||r.from>80)return;
      const period=pane.period||{mode:'time',value:pane.timeframe},k=key(pane.symbol,period),s=state.get(k)||{},oldest=Number(pane.periodBars?.[0]?.time||cache.get(k)?.[0]?.time);
      if(!oldest||s.loading||s.hasMore===false||s.before===oldest)return;
      s.loading=true;s.before=oldest;state.set(k,s);requestOlder(pane.symbol,period,oldest);
      setTimeout(()=>{const latest=state.get(k);if(latest?.loading){latest.loading=false;state.set(k,latest);}},2500);
    });
  }
  setTimeout(install,1000);
}
install();
window.__TRADE_AVATA_HISTORY_CACHE=cache;
window.__TRADE_AVATA_HISTORY_STATE=state;
window.__TRADE_AVATA_HISTORY_CONTINUITY=true;
