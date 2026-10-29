/* Trade Avata timeframe transition UX.
 * Messenger-inspired pulse: compact feedback only while a newly selected period
 * has no usable genuine chart data yet. Existing genuine candles remain visible.
 */
import marketFeed from './market-feed-adapter.js';

const pending=new Map();
const periodKey=p=>`${String(p?.mode||'time').toLowerCase()}:${String(p?.value??'').toLowerCase()}`;
const label=p=>{const mode=String(p?.mode||'time');const v=String(p?.value??'');if(mode==='time')return v;if(mode==='renko-pips')return`Renko ${v}P`;if(mode==='renko-time')return`Renko ${v}`;if(mode==='range-pips')return`Range ${v}P`;if(mode==='tick')return`${v||1} tick`;return v||mode;};
const app=()=>window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;
const paneFor=(symbol,period)=>(app()?.panes||[]).find(p=>String(p.symbol||'').toUpperCase()===String(symbol||'').toUpperCase()&&periodKey(p.period)===periodKey(period));
const hasUsableData=pane=>!!(pane?.displayBars?.length||pane?.periodBars?.length||pane?.rawBars?.length);

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
function clearItem(key,item){if(!item)return;clearTimeout(item.slowTimer);clearTimeout(item.timeoutTimer);item.node?.classList.remove('show','ta-timeframe-waiting','ta-timeframe-slow');item.pane?.root?.classList.remove('ta-timeframe-switching');pending.delete(key);}
function begin(symbol,period){
 const pane=paneFor(symbol,period)||app()?.activePane?.();
 if(!pane)return;
 const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;
 clearItem(key,pending.get(key));
 /* A reconnect must never cover a chart that already has genuine usable bars. */
 if(hasUsableData(pane))return;
 const node=ensureOverlay(pane);if(!node)return;
 setCopy(node,`Loading ${label(period)}…`);
 node.classList.remove('ta-timeframe-waiting','ta-timeframe-slow');node.classList.add('show');pane.root.classList.add('ta-timeframe-switching');
 const slowTimer=setTimeout(()=>{if(node.classList.contains('show')){node.classList.add('ta-timeframe-slow');setCopy(node,`Loading ${label(period)}…`,`Preparing genuine market history`);}},1800);
 const timeoutTimer=setTimeout(()=>{if(node.classList.contains('show'))setCopy(node,`Still loading ${label(period)}…`);},8000);
 pending.set(key,{pane,node,slowTimer,timeoutTimer,started:performance.now()});
}
function finish(symbol,period){const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;clearItem(key,pending.get(key));}
function finishUsablePanes(){for(const [key,item] of [...pending])if(hasUsableData(item.pane))clearItem(key,item);}
function connectionState(e){
 finishUsablePanes();
 const status=e?.detail?.status||marketFeed.status;
 if(status!=='reconnecting'&&status!=='offline'&&status!=='error')return;
 /* Only a genuinely empty newly-selected period may show reconnecting. A live
    transport recovery is represented by the header state and must not obscure
    already-rendered market data. */
 for(const item of pending.values())if(item.node?.classList.contains('show')&&!hasUsableData(item.pane)){item.node.classList.add('ta-timeframe-waiting');setCopy(item.node,'Reconnecting…','Waiting for live market data');}
}

const originalSubscribe=marketFeed.subscribe.bind(marketFeed);
marketFeed.subscribe=function(opts={}){
 begin(opts.symbol,opts.period);
 const symbol=opts.symbol,period=opts.period,onHistory=opts.onHistory,onBar=opts.onBar;
 return originalSubscribe({...opts,
  onHistory:payload=>{try{onHistory?.(payload);}finally{const bars=payload?.bars||payload?.data;if(Array.isArray(bars)&&bars.length)finish(symbol,period);}},
  onBar:payload=>{try{onBar?.(payload);}finally{if(payload?.bar||payload?.open!=null)finish(symbol,period);}}
 });
};
marketFeed.addEventListener('history',e=>{finish(e.detail?.symbol,e.detail?.period);finishUsablePanes();});
marketFeed.addEventListener('bar',e=>{finish(e.detail?.symbol,e.detail?.period);finishUsablePanes();});
marketFeed.addEventListener('status',connectionState);

window.__TRADE_AVATA_TIMEFRAME_TRANSITION={begin,finish,pending};
