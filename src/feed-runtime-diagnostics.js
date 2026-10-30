/* Trade Avata SECURE feed runtime diagnostics — 2026-10-30.
 * Replaces the static latency placeholder with real browser connection telemetry.
 * Read-only: does not alter chart data, subscriptions, reconnect policy or rendering.
 */
import marketFeed from './market-feed-adapter.js';

const provider=()=>window.TRADE_AVATA_CTRADER_PROVIDER;
const socketState=s=>({0:'CONNECTING',1:'OPEN',2:'CLOSING',3:'CLOSED'})[s]||'NO SOCKET';
const ageText=ms=>{
  if(!Number.isFinite(ms)||ms<0)return '—';
  if(ms<1000)return `${Math.round(ms)} ms`;
  if(ms<60000)return `${(ms/1000).toFixed(ms<10000?1:0)} s`;
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;
};

function update(){
  const p=provider(),now=Date.now();
  const state=socketState(p?.socket?.readyState);
  const msgAge=p?.lastMessageAt?now-p.lastMessageAt:NaN;
  const dataAge=p?.lastMarketDataAt?now-p.lastMarketDataAt:NaN;
  for(const box of document.querySelectorAll('.pane-latency')){
    const label=box.querySelector('span'),main=box.querySelector('b'),small=box.querySelector('small');
    if(label)label.textContent=`WS ${state}`;
    if(main)main.textContent=`DATA ${ageText(dataAge)}`;
    if(small)small.textContent=`msg ${ageText(msgAge)} · ${String(marketFeed.status||'unknown').toUpperCase()}`;
    box.title=`WebSocket ${state}; last market data ${ageText(dataAge)} ago; last socket message ${ageText(msgAge)} ago; hub ${marketFeed.status||'unknown'}`;
  }
}

marketFeed.addEventListener('status',update);
marketFeed.addEventListener('bar',update);
marketFeed.addEventListener('quote',update);
marketFeed.addEventListener('history',update);
setInterval(update,1000);
setTimeout(update,0);

window.__TRADE_AVATA_FEED_RUNTIME_DIAGNOSTICS=true;
