/* Trade Avata live-feed-only guard.
 * A configured cTrader deployment must never render synthetic/demo market data.
 * Every pane starts empty and remains empty until genuine gateway history/live
 * bars arrive. Unsupported periods/constructions stay blank rather than falling
 * back to generated prices.
 *
 * cTrader gateway compatibility: historical trendbars use `ts` milliseconds,
 * while the native chart consumes `time` seconds. Normalize that wire shape
 * before the downstream live-ready layer receives history/bar payloads.
 */
import {ChartPane} from './chart-pane.js';
import marketFeed from './market-feed-adapter.js';

function liveGatewayConfigured(){
  const cfg=window.TRADE_AVATA_CTRADER_CONFIG||{};
  return cfg.enabled===true||!!cfg.gatewayWs||!!cfg.gatewayHttp;
}

function normalizeWireBar(bar){
  if(!bar||typeof bar!=='object')return bar;
  if(bar.time!=null||bar.timestamp!=null||bar.openTime!=null||bar.ts==null)return bar;
  let time=Number(bar.ts);
  if(Number.isFinite(time)&&time>1e12)time=Math.floor(time/1000);
  else if(Number.isFinite(time)&&time>1e10)time=Math.floor(time/1000);
  return {...bar,time};
}

function installWireTimestampCompatibility(){
  if(marketFeed.__taTsCompatibility)return;
  marketFeed.__taTsCompatibility=true;

  const publishHistory=marketFeed.publishHistory?.bind(marketFeed);
  if(publishHistory)marketFeed.publishHistory=function(payload={}){
    const source=payload.bars||payload.data;
    if(Array.isArray(source)){
      const bars=source.map(normalizeWireBar);
      payload={...payload,bars};
      if(payload.data)payload.data=bars;
    }
    return publishHistory(payload);
  };

  const publishBar=marketFeed.publishBar?.bind(marketFeed);
  if(publishBar)marketFeed.publishBar=function(payload={}){
    if(payload.bar)payload={...payload,bar:normalizeWireBar(payload.bar)};
    else payload=normalizeWireBar(payload);
    return publishBar(payload);
  };
}

installWireTimestampCompatibility();

function clearPane(pane){
  pane.rawBars=[];
  pane.periodBars=[];
  pane.displayBars=[];
  pane.barIndex=new Map();
  pane.replayIndex=null;
  pane.__taLiveHistoryLoaded=false;

  try{ pane.series?.setData?.([]); }catch{}
  try{ for(const meta of pane.indicatorSeries||[])meta.series?.setData?.([]); }catch{}
  try{ pane.refreshHeader?.(); pane.renderOverlays?.(true); }catch{}
}

if(!ChartPane.prototype.__taSyntheticLoadData){
  ChartPane.prototype.__taSyntheticLoadData=ChartPane.prototype.loadData;

  ChartPane.prototype.loadData=function({home=true}={}){
    if(!liveGatewayConfigured())return this.__taSyntheticLoadData({home});

    // Hard live-only rule: never invoke generateBars() in a configured live deployment.
    clearPane(this);
    this.manualMode=false;
    this.manualRange=null;
    try{ this.clearManualProvider?.(); }catch{}
    try{ this.updateModeChip?.(); }catch{}
    return undefined;
  };

  const originalHardHome=ChartPane.prototype.hardHome;
  ChartPane.prototype.hardHome=function(){
    if(!liveGatewayConfigured())return originalHardHome.call(this);
    if(!this.displayBars?.length){ clearPane(this); return false; }
    return this.homeView?.()||false;
  };
}

window.__TRADE_AVATA_LIVE_FEED_ONLY=true;
