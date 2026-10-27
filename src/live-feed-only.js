/* Trade Avata live-feed-only guard.
 * A configured cTrader deployment must never render synthetic/demo market data.
 * Every pane starts empty and remains empty until genuine gateway history/live
 * bars arrive. Unsupported periods/constructions stay blank rather than falling
 * back to generated prices.
 */
import {ChartPane} from './chart-pane.js';

function liveGatewayConfigured(){
  const cfg=window.TRADE_AVATA_CTRADER_CONFIG||{};
  return cfg.enabled===true||!!cfg.gatewayWs||!!cfg.gatewayHttp;
}

function clearPane(pane){
  pane.rawBars=[];
  pane.periodBars=[];
  pane.displayBars=[];
  pane.barIndex=new Map();
  pane.replayIndex=null;
  pane.__taLiveHistoryLoaded=false;

  try{
    pane.series?.setData?.([]);
  }catch{}

  try{
    for(const meta of pane.indicatorSeries||[])meta.series?.setData?.([]);
  }catch{}

  try{
    pane.refreshHeader?.();
    pane.renderOverlays?.(true);
  }catch{}
}

if(!ChartPane.prototype.__taSyntheticLoadData){
  ChartPane.prototype.__taSyntheticLoadData=ChartPane.prototype.loadData;

  ChartPane.prototype.loadData=function({home=true}={}){
    if(!liveGatewayConfigured()){
      return this.__taSyntheticLoadData({home});
    }

    // Hard live-only rule: no generated bars, no stale demo series, no fake EMA.
    clearPane(this);

    // Keep the chart in AUTO while it waits for genuine history. Do not call
    // the original loadData because that path invokes generateBars().
    this.manualMode=false;
    this.manualRange=null;
    try{ this.clearManualProvider?.(); }catch{}
    try{ this.updateModeChip?.(); }catch{}

    return undefined;
  };

  // hardHome/reset must not resurrect generated history while live mode is on.
  const originalHardHome=ChartPane.prototype.hardHome;
  ChartPane.prototype.hardHome=function(){
    if(!liveGatewayConfigured())return originalHardHome.call(this);
    if(!this.displayBars?.length){
      clearPane(this);
      return false;
    }
    return this.homeView?.()||false;
  };
}

window.__TRADE_AVATA_LIVE_FEED_ONLY=true;
