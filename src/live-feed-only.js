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
