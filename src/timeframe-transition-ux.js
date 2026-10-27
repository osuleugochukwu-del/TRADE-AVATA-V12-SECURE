/* Trade Avata timeframe transition UX.
 * Gives immediate feedback while genuine history is prepared, keeps the old
 * chart visible, and removes the overlay only after the selected period gets
 * genuine history/live data. No market data is created or modified here.
 */
import marketFeed from './market-feed-adapter.js';

const pending=new Map();
const periodKey=p=>`${String(p?.mode||'time').toLowerCase()}:${String(p?.value??'').toLowerCase()}`;
const label=p=>{const mode=String(p?.mode||'time');const v=String(p?.value??'');if(mode==='time')return v;if(mode==='renko-pips')return`Renko ${v}P`;if(mode==='renko-time')return`Renko ${v}`;if(mode==='range-pips')return`Range ${v}P`;if(mode==='tick')return`${v||1} tick`;return v||mode;};
const paneFor=(symbol,period)=>{const app=window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;return(app?.panes||[]).find(p=>String(p.symbol||'').toUpperCase()===String(symbol||'').toUpperCase()&&periodKey(p.period)===periodKey(period));};

function ensureOverlay(pane){
 if(!pane?.root)return null;
 let node=pane.root.querySelector?.('.ta-timeframe-loading');
 if(!node){node=document.createElement('div');node.className='ta-timeframe-loading';node.innerHTML='<span class="ta-timeframe-spinner" aria-hidden="true"></span><strong></strong><small>Preparing genuine market candles…</small>';pane.root.append(node);}
 return node;
}
function begin(symbol,period){
 const pane=paneFor(symbol,period)||((window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata)?.activePane?.());
 if(!pane)return;
 const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;
 const old=pending.get(key);if(old)clearTimeout(old.slowTimer);
 const node=ensureOverlay(pane);if(!node)return;
 node.querySelector('strong').textContent=`Loading ${label(period)} candles…`;
 node.querySelector('small').textContent='Preparing genuine market candles…';
 node.classList.add('show');pane.root.classList.add('ta-timeframe-switching');
 const slowTimer=setTimeout(()=>{if(node.classList.contains('show'))node.querySelector('small').textContent=`Still loading ${label(period)} market history…`;},1800);
 pending.set(key,{pane,node,slowTimer,started:performance.now()});
}
function finish(symbol,period){
 const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;const item=pending.get(key);if(!item)return;
 clearTimeout(item.slowTimer);item.node.classList.remove('show');item.pane.root.classList.remove('ta-timeframe-switching');pending.delete(key);
}
function connectionState(e){
 const status=e?.detail?.status||marketFeed.status;
 if(status!=='reconnecting'&&status!=='offline'&&status!=='error')return;
 for(const item of pending.values())if(item.node?.classList.contains('show'))item.node.querySelector('small').textContent='Waiting for live market connection…';
}

/* Subscription is the earliest reliable signal that a new timeframe was chosen.
   Repeated subscribe calls for the same pending period only refresh the message;
   they do not create another overlay/timer storm. */
const originalSubscribe=marketFeed.subscribe.bind(marketFeed);
marketFeed.subscribe=function(opts={}){begin(opts.symbol,opts.period);return originalSubscribe(opts);};
marketFeed.addEventListener('history',e=>finish(e.detail?.symbol,e.detail?.period));
marketFeed.addEventListener('bar',e=>finish(e.detail?.symbol,e.detail?.period));
marketFeed.addEventListener('status',connectionState);

window.__TRADE_AVATA_TIMEFRAME_TRANSITION={begin,finish,pending};
