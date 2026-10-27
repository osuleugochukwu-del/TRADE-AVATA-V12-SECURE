/* Trade Avata live-feed-only guard.
 * When the secure cTrader gateway is configured, synthetic/demo market bars
 * must never enter a chart pane. The pane starts empty and waits for genuine
 * gateway history/live bars. This deliberately applies to every construction:
 * unsupported constructions remain empty rather than silently showing fake data.
 */
import {ChartPane} from './chart-pane.js';

function liveGatewayConfigured(){
  const cfg=window.TRADE_AVATA_CTRADER_CONFIG||{};
  return cfg.enabled===true||!!cfg.gatewayWs||!!cfg.gatewayHttp;
}

if(!ChartPane.prototype.__taSyntheticLoadData){
  ChartPane.prototype.__taSyntheticLoadData=ChartPane.prototype.loadData;

  ChartPane.prototype.loadData=function({home=true}={}){
    if(!liveGatewayConfigured()){
      return this.__taSyntheticLoadData({home});
    }

    // Never generate or display local/demo candles in a live deployment.
    this.rawBars=[];
    this.periodBars=[];
    this.displayBars=[];
    this.barIndex=new Map();
    this.replayIndex=null;
    this.__taLiveHistoryLoaded=false;

    // Clear any previously rendered data synchronously, before the browser paints.
    try{
      if(this.series){
        if(typeof this.series.setData==='function')this.series.setData([]);
        else this.applyMainSeriesData?.();
      }else{
        this.rebuildSeries?.({preserveVisibleRange:false});
      }
    }catch{}

    try{
      for(const meta of this.indicatorSeries||[])meta.series?.setData?.([]);
    }catch{}

    this.setAutoMode?.(false);
    this.refreshHeader?.();
    this.renderOverlays?.(true);

    // live-ready-upgrade binds the pane immediately after this call and the
    // cTrader provider requests genuine history + subscribes to live bars.
    return undefined;
  };
}

window.__TRADE_AVATA_LIVE_FEED_ONLY=true;
