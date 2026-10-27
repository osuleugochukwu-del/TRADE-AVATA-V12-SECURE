/* Trade Avata foreground/resume recovery.
 * Mobile browsers intentionally throttle/suspend background tabs. When the user
 * returns, wake the existing genuine market session without clearing candles.
 */
import marketFeed from './market-feed-adapter.js';

let lastWake=0;
const WAKE_DEBOUNCE_MS=650;
const provider=()=>window.TRADE_AVATA_CTRADER_PROVIDER;
const appNow=()=>window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;

function resizeVisibleCharts(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    for(const pane of appNow()?.panes||[])try{pane.resize?.();pane.renderOverlays?.(true);}catch{}
  }));
}

function wake(reason='foreground'){
  if(document.hidden)return;
  const now=Date.now();
  if(now-lastWake<WAKE_DEBOUNCE_MS)return;
  lastWake=now;

  /* Restore the last genuine candles first. Never blank the chart on resume. */
  try{window.__TRADE_AVATA_RESTORE_GENUINE_HISTORY?.();}catch{}
  resizeVisibleCharts();

  const p=provider();
  if(!p){try{marketFeed.connect();}catch{}return;}
  const socket=p.socket;
  const open=socket?.readyState===WebSocket.OPEN;
  const stale=!p.lastMessageAt||now-p.lastMessageAt>Math.max(15000,Number(p.config?.staleAfterMs)||15000);

  if(open&&!stale){
    /* A healthy socket may have been background-throttled. Reassert every desired
       subscription so the selected chart receives fresh history/live bars. */
    try{for(const sub of p.desiredSubscriptions?.values?.()||[])p.sendSubscription?.(sub);}catch{}
    return;
  }

  marketFeed.setStatus?.('reconnecting',`Resuming live market feed (${reason})…`);
  if(open){try{socket.close(4001,'foreground-resume');}catch{}}
  try{p.connect?.();}catch{try{marketFeed.connect();}catch{}}
}

window.addEventListener('pageshow',()=>wake('pageshow'),{passive:true});
window.addEventListener('focus',()=>wake('focus'),{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)wake('visible');},{passive:true});
window.visualViewport?.addEventListener('resize',resizeVisibleCharts,{passive:true});

/* Handles PWA/mobile restores where lifecycle events can arrive before the app
   finishes wiring the provider. */
setTimeout(()=>wake('startup'),250);
window.__TRADE_AVATA_WAKE_MARKET_FEED=wake;
