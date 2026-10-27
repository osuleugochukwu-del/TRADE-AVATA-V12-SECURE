/* Trade Avata live-edge anchoring.
 * Professional chart behaviour:
 * - while the viewer is at the live edge, each newly appended candle keeps the
 *   newest candle at the same right-side anchor and shifts older candles left;
 * - if the viewer drags into history, incoming candles never steal the viewport;
 * - Home/LIVE restores following.
 * No market data is created or modified here.
 */
import marketFeed from './market-feed-adapter.js';

const LIVE_TOLERANCE=3;
const states=new WeakMap();
const periodKey=p=>`${String(p?.mode||'time').toLowerCase()}:${String(p?.value??p??'1m').toLowerCase()}`;
const same=(pane,payload)=>String(pane?.symbol||'').toUpperCase()===String(payload?.symbol||'').toUpperCase()&&periodKey(pane?.period||{mode:'time',value:pane?.timeframe})===periodKey(payload?.period);
function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvataLiveReady?.app||window.__tradeAvata;}
function range(p){try{return p.chart?.timeScale?.().getVisibleLogicalRange?.()||null;}catch{return null;}}
function lastIndex(p){return Math.max(-1,(p.currentDataLength?.()??p.displayBars?.length??0)-1);}
function isLive(p){const r=range(p),last=lastIndex(p);if(!r||last<0)return true;return r.to>=last-LIVE_TOLERANCE;}
function anchor(p){
  const r=range(p),last=lastIndex(p);if(!r||last<0)return;
  const s=states.get(p)||{};
  // Preserve the current live-edge future space instead of using scrollToRealTime,
  // which can allow the live marker to walk forward as bars append.
  if(!Number.isFinite(s.future))s.future=Math.max(0,r.to-last);
  const span=Math.max(8,r.to-r.from),to=last+s.future,from=to-span;
  p.suppressRangeEvent=true;
  try{p.chart.timeScale().setVisibleLogicalRange({from,to});}catch{}
  requestAnimationFrame(()=>{p.suppressRangeEvent=false;p.renderOverlays?.();p.nativeV27Renderer?.render?.();});
}
function installPane(p){
  if(!p?.chart||p.__taLiveEdgeAnchor)return;p.__taLiveEdgeAnchor=true;
  const s={following:true,future:null,internal:false};states.set(p,s);
  const ts=p.chart.timeScale();
  ts.subscribeVisibleLogicalRangeChange?.(()=>{
    if(p.suppressRangeEvent||s.internal)return;
    s.following=isLive(p);
    if(s.following){const r=range(p),last=lastIndex(p);if(r&&last>=0)s.future=Math.max(0,r.to-last);}
  });
  const oldGoLive=p.goLive?.bind(p);p.goLive=function(){const out=oldGoLive?.();requestAnimationFrame(()=>{s.following=true;s.future=null;anchor(p);});return out;};
  const oldHome=p.homeView?.bind(p);if(oldHome)p.homeView=function(...args){const out=oldHome(...args);requestAnimationFrame(()=>{s.following=true;s.future=null;const r=range(p),last=lastIndex(p);if(r&&last>=0)s.future=Math.max(0,r.to-last);});return out;};
}
function install(){const app=appNow();if(!app){setTimeout(install,50);return;}for(const p of app.panes||[])installPane(p);setTimeout(install,750);}
marketFeed.addEventListener('bar',e=>{
  const payload=e.detail||{};const app=appNow();if(!app)return;
  // market-feed dispatch happens after pane subscribers have received the bar;
  // wait one frame so lastIndex reflects the appended candle.
  requestAnimationFrame(()=>{for(const p of app.panes||[]){if(!same(p,payload))continue;installPane(p);const s=states.get(p);if(s?.following)anchor(p);}});
});
install();
window.__TRADE_AVATA_LIVE_EDGE_ANCHOR={installed:true};
