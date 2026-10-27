/* Trade Avata timeframe transition UX.
 * Messenger-inspired pulse: compact, modern feedback while genuine history is
 * prepared. Existing genuine candles remain visible; no market data is created.
 */
import marketFeed from './market-feed-adapter.js';

const pending=new Map();
const periodKey=p=>`${String(p?.mode||'time').toLowerCase()}:${String(p?.value??'').toLowerCase()}`;
const label=p=>{const mode=String(p?.mode||'time');const v=String(p?.value??'');if(mode==='time')return v;if(mode==='renko-pips')return`Renko ${v}P`;if(mode==='renko-time')return`Renko ${v}`;if(mode==='range-pips')return`Range ${v}P`;if(mode==='tick')return`${v||1} tick`;return v||mode;};
const paneFor=(symbol,period)=>{const app=window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;return(app?.panes||[]).find(p=>String(p.symbol||'').toUpperCase()===String(symbol||'').toUpperCase()&&periodKey(p.period)===periodKey(period));};

function ensureOverlay(pane){
 if(!pane?.root)return null;
 let node=pane.root.querySelector?.('.ta-timeframe-loading');
 if(!node){
  node=document.createElement('div');node.className='ta-timeframe-loading';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  node.innerHTML='<span class="ta-timeframe-pulse" aria-hidden="true"><i></i><i></i><i></i></span><strong></strong><small></small>';
  pane.root.append(node);
 }
 return node;
}
function setCopy(node,main,sub=''){const strong=node?.querySelector('strong'),small=node?.querySelector('small');if(strong)strong.textContent=main||'';if(small){small.textContent=sub||'';small.hidden=!sub;}}
function begin(symbol,period){
 const pane=paneFor(symbol,period)||((window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata)?.activePane?.());
 if(!pane)return;
 const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;
 const old=pending.get(key);if(old){clearTimeout(old.slowTimer);clearTimeout(old.timeoutTimer);}
 const node=ensureOverlay(pane);if(!node)return;
 setCopy(node,`Loading ${label(period)} candles…`);
 node.classList.remove('ta-timeframe-waiting','ta-timeframe-slow');node.classList.add('show');pane.root.classList.add('ta-timeframe-switching');
 const slowTimer=setTimeout(()=>{if(node.classList.contains('show')){node.classList.add('ta-timeframe-slow');setCopy(node,`Loading ${label(period)} candles…`,`Still preparing genuine market history`);}},1800);
 const timeoutTimer=setTimeout(()=>{if(node.classList.contains('show'))setCopy(node,`Still loading ${label(period)}…`,`Live chart remains available while market history arrives`);},8000);
 pending.set(key,{pane,node,slowTimer,timeoutTimer,started:performance.now()});
}
function finish(symbol,period){
 const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;const item=pending.get(key);if(!item)return;
 clearTimeout(item.slowTimer);clearTimeout(item.timeoutTimer);item.node.classList.remove('show','ta-timeframe-waiting','ta-timeframe-slow');item.pane.root.classList.remove('ta-timeframe-switching');pending.delete(key);
}
function connectionState(e){
 const status=e?.detail?.status||marketFeed.status;
 if(status!=='reconnecting'&&status!=='offline'&&status!=='error')return;
 for(const item of pending.values())if(item.node?.classList.contains('show')){item.node.classList.add('ta-timeframe-waiting');setCopy(item.node,'Reconnecting…','Waiting for live market data');}
}

const originalSubscribe=marketFeed.subscribe.bind(marketFeed);
marketFeed.subscribe=function(opts={}){begin(opts.symbol,opts.period);return originalSubscribe(opts);};
marketFeed.addEventListener('history',e=>finish(e.detail?.symbol,e.detail?.period));
marketFeed.addEventListener('bar',e=>finish(e.detail?.symbol,e.detail?.period));
marketFeed.addEventListener('status',connectionState);

window.__TRADE_AVATA_TIMEFRAME_TRANSITION={begin,finish,pending};
