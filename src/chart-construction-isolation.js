/* Trade Avata SECURE chart-construction isolation.
 * Prevents transformed chart data from leaking across chart/period transitions.
 * No prices are generated here; every live construction is rebuilt by the existing
 * market-feed subscription from genuine broker history.
 */
import {ChartPane} from './chart-pane.js';

const key=(period,chartType)=>{
  const mode=String(period?.mode||'time').toLowerCase();
  const value=String(period?.value??'').toLowerCase();
  const type=String(chartType||'Candles').toLowerCase();
  return `${mode}:${value}|${type}`;
};

function clearConstructionState(pane){
  pane.rawBars=[];
  pane.periodBars=[];
  pane.displayBars=[];
  pane.barIndex=new Map();
  pane.replayIndex=null;
  pane.__taLiveHistoryLoaded=false;
  pane.__taConstructionEpoch=(pane.__taConstructionEpoch||0)+1;
  try{pane.series?.setData?.([]);}catch{}
  try{for(const meta of pane.indicatorSeries||[])meta.series?.setData?.([]);}catch{}
}

if(!ChartPane.prototype.__taConstructionIsolation20261029){
  ChartPane.prototype.__taConstructionIsolation20261029=true;
  const originalSetConfig=ChartPane.prototype.setConfig;

  ChartPane.prototype.setConfig=function(cfg={},opts={}){
    const before=key(this.period,this.chartType);
    const nextPeriod=cfg.period?.mode
      ?cfg.period
      :cfg.timeframe&&!cfg.period
        ?{mode:'time',value:cfg.timeframe}
        :this.period;
    const nextType=cfg.chartType||this.chartType;
    const after=key(nextPeriod,nextType);

    /*
     * A construction/timeframe switch is a hard data boundary. Clearing here is
     * intentional: live-feed-only must not preserve bars belonging to the old
     * construction, and live-ready-upgrade will immediately rebind the requested
     * period and refill it from genuine broker history.
     */
    if(before!==after){
      try{this.__taFeedUnsub?.();}catch{}
      this.__taFeedUnsub=null;
      clearConstructionState(this);
    }

    return originalSetConfig.call(this,cfg,opts);
  };
}

window.__TRADE_AVATA_CHART_CONSTRUCTION_ISOLATION={
  installed:true,
  policy:'genuine-source-rebuild-on-construction-change',
  isolated:['time-candles','heikin-ashi','renko-pips','renko-time','range-pips','line','area','bars']
};
