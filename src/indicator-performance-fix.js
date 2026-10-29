/* Trade Avata SECURE indicator scheduling repair.
 * Keeps the main chart responsive while indicator work is queued for idle time.
 * No market data is fabricated or altered.
 */
const IDLE_TIMEOUT=320;
const QUIET_MS=110;

function appNow(){return window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;}
function idle(cb){
  if('requestIdleCallback' in window)return requestIdleCallback(cb,{timeout:IDLE_TIMEOUT});
  return setTimeout(()=>cb({didTimeout:true,timeRemaining:()=>0}),32);
}
function cancelIdle(id){
  if(id==null)return;
  if('cancelIdleCallback' in window)cancelIdleCallback(id);else clearTimeout(id);
}
function installPane(pane){
  if(!pane||pane.__taIndicatorScheduler||typeof pane.rebuildSeries!=='function')return;
  pane.__taIndicatorScheduler=true;
  pane.__taIndicatorBusy=false;
  pane.__taIndicatorLastInteraction=0;
  pane.__taIndicatorGeneration=0;
  pane.__taIndicatorIdle=null;
  const original=pane.rebuildSeries.bind(pane);

  const schedule=(opts,originalIndicators,generation)=>{
    cancelIdle(pane.__taIndicatorIdle);
    const run=()=>{
      if(generation!==pane.__taIndicatorGeneration)return;
      const wait=Math.max(0,QUIET_MS-(performance.now()-pane.__taIndicatorLastInteraction));
      if(pane.__taIndicatorBusy||wait>0){pane.__taIndicatorIdle=setTimeout(()=>schedule(opts,originalIndicators,generation),Math.max(24,wait));return;}
      const state=pane.app?.state;
      if(!state)return;
      const current=state.indicators;
      try{
        state.indicators=originalIndicators;
        pane.__taIndicatorApplying=true;
        original({...opts,preserveVisibleRange:true});
      }finally{
        pane.__taIndicatorApplying=false;
        state.indicators=current===originalIndicators?originalIndicators:current;
      }
      pane.renderOverlays?.();
      pane.nativeV27Renderer?.sync?.();
      pane.nativeV27Renderer?.render?.();
    };
    pane.__taIndicatorIdle=idle(run);
  };

  pane.rebuildSeries=function(opts={}){
    if(pane.__taIndicatorApplying)return original(opts);
    const state=pane.app?.state;
    const indicators=Array.isArray(state?.indicators)?state.indicators:[];
    const visible=indicators.some(i=>i?.visible!==false);
    if(!visible)return original(opts);

    const generation=++pane.__taIndicatorGeneration;
    cancelIdle(pane.__taIndicatorIdle);
    const hidden=indicators.map(i=>i?.visible===false?i:{...i,visible:false});
    try{
      state.indicators=hidden;
      original(opts); // candles/main series become usable first
    }finally{
      state.indicators=indicators;
    }
    schedule(opts,indicators,generation);
  };

  const host=pane.chartHost||pane.root;
  if(host){
    const begin=()=>{pane.__taIndicatorBusy=true;pane.__taIndicatorLastInteraction=performance.now();};
    const move=()=>{if(pane.__taIndicatorBusy)pane.__taIndicatorLastInteraction=performance.now();};
    const end=()=>{pane.__taIndicatorBusy=false;pane.__taIndicatorLastInteraction=performance.now();};
    host.addEventListener('pointerdown',begin,{passive:true,capture:true});
    host.addEventListener('pointermove',move,{passive:true,capture:true});
    host.addEventListener('pointerup',end,{passive:true,capture:true});
    host.addEventListener('pointercancel',end,{passive:true,capture:true});
    host.addEventListener('touchstart',begin,{passive:true,capture:true});
    host.addEventListener('touchend',end,{passive:true,capture:true});
    host.addEventListener('wheel',()=>{pane.__taIndicatorLastInteraction=performance.now();},{passive:true,capture:true});
  }
}
function install(){
  const app=appNow();
  if(!app){setTimeout(install,50);return;}
  for(const pane of app.panes||[])installPane(pane);
  setTimeout(install,750);
}
install();
window.__TRADE_AVATA_INDICATOR_IDLE_PIPELINE=true;
