/* Trade Avata SECURE market-status synchronization fix — 2026-10-30.
 * The live feed hub is authoritative. Do not let a persisted app.state.marketFeed
 * value keep the top badge stuck on RECONNECTING after the hub is already LIVE.
 */
import marketFeed from './market-feed-adapter.js';

const appNow=()=>window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;

function syncFromHub(reason='status'){
  const app=appNow();
  if(!app?.state)return false;
  const status=String(marketFeed.status||'not-configured');
  const detail=String(marketFeed.statusDetail||status);
  app.state.marketFeed={
    provider:marketFeed.activeProviderName||'ctrader',
    status,
    detail,
    lastChangedAt:new Date().toISOString(),
    syncReason:reason
  };
  document.documentElement.dataset.marketLive=status==='live'?'true':'false';
  // Frequent genuine quotes/bars only update the badge in place. Rebuilding
  // #topbar on every packet interrupts horizontal swipes on mobile devices.
  const badge=document.querySelector('#topbar .live-pill');
  if(badge){
    const label=({live:'LIVE',connecting:'CONNECTING',reconnecting:'RECONNECTING',offline:'OFFLINE','not-configured':'FEED NOT CONFIGURED',error:'FEED ERROR'})[status]||status.toUpperCase();
    badge.classList.toggle('ta-feed-live',status==='live');
    badge.classList.toggle('ta-feed-wait',status!=='live');
    let dot=badge.querySelector('.live-dot');
    if(!dot){dot=document.createElement('span');dot.className='live-dot';badge.replaceChildren(dot);}
    let textNode=[...badge.childNodes].find(node=>node.nodeType===3);
    if(!textNode){textNode=document.createTextNode('');badge.append(textNode);}
    if(textNode.textContent!==label)textNode.textContent=label;
    badge.title=detail;
    badge.onclick=()=>app.openMarketConnectionStatus?.();
  }
  return true;
}

marketFeed.addEventListener('status',()=>syncFromHub('status-event'));
marketFeed.addEventListener('bar',()=>syncFromHub('bar-packet'));
marketFeed.addEventListener('quote',()=>syncFromHub('quote-packet'));

function install(){
  if(syncFromHub('install'))return;
  setTimeout(install,50);
}
install();

window.__TRADE_AVATA_MARKET_STATUS_SYNC_FIX=true;
