/* Trade Avata SECURE chart polish — movement-safe revision 2026-10-30.
 * Keep useful non-render-loop corrections only.
 * No market data is created or altered.
 * IMPORTANT: do not wrap TradeAvataNativeChart.render() here. The former
 * calendar hierarchy render wrapper was confirmed by manual phone testing to
 * make chart movement heavy/stiff.
 */
import {TradeAvataNativeChart} from './native-chart.js';
import {ChartPane} from './chart-pane.js';

const rgbaTransparent=v=>String(v||'').replace(/\s/g,'')==='rgba(0,0,0,0)'||String(v||'')==='transparent';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function installNativePolish(){
  const p=TradeAvataNativeChart?.prototype;
  if(!p||p.__taChartPolish20261030)return;
  p.__taChartPolish20261030=true;

  /* Ordinary Candles and Heikin-Ashi stay on the original native renderer.
   * Only Renko retains its isolated narrow-brick geometry correction. */
  const nativeDrawCandles=p._drawCandles;
  p._drawCandles=function(ctx,s,rect,start,end){
    const o=s.optionsData||{};
    const renko=['renko-pips','renko-time'].includes(o.constructionMode);
    if(!renko)return nativeDrawCandles.call(this,ctx,s,rect,start,end);

    const r=this.visibleRange;if(!r)return;
    const spacing=rect.width/Math.max(1,r.to-r.from);
    const hairX=this._hairX(),hairY=this._hairY();
    const bodyW=clamp(spacing*.52,Math.max(hairX,1.15),18);

    for(let i=start;i<=Math.min(end,s.data.length-1);i++){
      const b=s.data[i];if(!b)continue;
      const rawX=this.timeScaleApi.logicalToCoordinate(i);
      if(!Number.isFinite(rawX)||rawX<-40||rawX>rect.right+40)continue;
      const yo=this._priceToY(b.open,s.paneIndex),yc=this._priceToY(b.close,s.paneIndex);
      if(![yo,yc].every(Number.isFinite))continue;
      const up=Number(b.close)>=Number(b.open);
      const fill=up?(o.upColor||'#00c7b1'):(o.downColor||'#ff4d57');
      const border=up?(o.borderUpColor||fill):(o.borderDownColor||fill);
      const top=this._snapY(Math.min(yo,yc)),bottom=this._snapY(Math.max(yo,yc));
      const height=this._snapHeight(Math.max(hairY,bottom-top));
      const width=this._snapWidth(bodyW),left=this._snapX(rawX-width/2);
      if(!rgbaTransparent(fill)){ctx.fillStyle=fill;ctx.fillRect(left,top,width,height);}
      if(o.borderVisible!==false&&!rgbaTransparent(border)&&width>=hairX*2&&height>=hairY*2){
        ctx.strokeStyle=border;ctx.lineWidth=hairX;
        ctx.strokeRect(left+hairX/2,top+hairY/2,Math.max(hairX,width-hairX),Math.max(hairY,height-hairY));
      }
    }
  };

  /* Responsive price labels without a second render pass. */
  const axisTicks=p._axisTicks;
  p._axisTicks=function(paneIndex,target=8){
    if(paneIndex===0){
      const mainH=this._paneRects?.()?.[0]?.height||this.height||400;
      target=Math.max(Number(target)||0,Math.floor(mainH/(window.innerWidth<=780?38:42)));
      target=Math.min(14,target);
    }
    return axisTicks.call(this,paneIndex,target);
  };
}

function installDrawingTimeAnchors(){
  const p=ChartPane?.prototype;
  if(!p||p.__taDrawingTimeAnchors20261030)return;
  p.__taDrawingTimeAnchors20261030=true;

  /* Timestamp is authoritative across timeframe changes. */
  p.xForPoint=function(point){
    if(point?.time!=null&&Number.isFinite(Number(point.time))){
      const x=this.xForTime(Number(point.time));
      if(x!=null&&Number.isFinite(x))return x;
    }
    if(Number.isFinite(point?.logical))return this.logicalToCoordinate(point.logical);
    return null;
  };

  p.shiftPoint=function(point,deltaLogical){
    const base=point?.time!=null?this.logicalForTime(Number(point.time)):(Number.isFinite(point?.logical)?point.logical:0);
    const next=base+deltaLogical;
    return{...point,logical:next,time:this.projectedTimeForLogical(next)};
  };
}

installNativePolish();
installDrawingTimeAnchors();

window.__TRADE_AVATA_CHART_POLISH_20261030={
  movementSafe:true,
  renderWrapper:'removed-after-manual-stiffness-confirmation',
  calendarAxis:'disabled-until-non-render-loop-implementation',
  candleWicks:'native-restored',
  candleBodies:'native-restored',
  renkoGeometry:'narrow-candle-like-isolated',
  drawingAnchors:'timestamp-first',
  priceAxis:'responsive-density'
};
