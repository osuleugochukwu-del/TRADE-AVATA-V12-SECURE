/* Trade Avata SECURE chart polish — 2026-10-29.
 * Surgical native-renderer corrections only. No market data is created or altered.
 */
import {TradeAvataNativeChart} from './native-chart.js';
import {ChartPane} from './chart-pane.js';

const rgbaTransparent=v=>String(v||'').replace(/\s/g,'')==='rgba(0,0,0,0)'||String(v||'')==='transparent';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function installNativePolish(){
  const p=TradeAvataNativeChart?.prototype;
  if(!p||p.__taChartPolish20261029)return;
  p.__taChartPolish20261029=true;

  /*
   * Candles: one continuous high->low wick, aligned to the backing-store pixel
   * grid. The wick is deliberately a little stronger than one physical pixel
   * on high-DPI screens so it does not feather into two faint threads.
   *
   * Renko: bricks remain unmistakably Renko but use a candle-like narrow body
   * instead of consuming almost the entire logical slot as a square block.
   */
  p._drawCandles=function(ctx,s,rect,start,end){
    const o=s.optionsData||{};
    const renko=['renko-pips','renko-time'].includes(o.constructionMode);
    const r=this.visibleRange;if(!r)return;
    const spacing=rect.width/Math.max(1,r.to-r.from);
    const hairX=this._hairX(),hairY=this._hairY();
    let bodyW=renko
      ?clamp(spacing*.52,Math.max(hairX,1.15),18)
      :clamp(spacing*.70,hairX,24);
    if(!renko&&spacing<1.15)bodyW=hairX;

    for(let i=start;i<=Math.min(end,s.data.length-1);i++){
      const b=s.data[i];if(!b)continue;
      const rawX=this.timeScaleApi.logicalToCoordinate(i);
      if(!Number.isFinite(rawX)||rawX<-40||rawX>rect.right+40)continue;
      const yo=this._priceToY(b.open,s.paneIndex),yc=this._priceToY(b.close,s.paneIndex),yh=this._priceToY(b.high,s.paneIndex),yl=this._priceToY(b.low,s.paneIndex);
      if(![yo,yc,yh,yl].every(Number.isFinite))continue;
      const x=this._snapX(rawX),up=Number(b.close)>=Number(b.open);
      const fill=up?(o.upColor||'#00c7b1'):(o.downColor||'#ff4d57');
      const border=up?(o.borderUpColor||fill):(o.borderDownColor||fill);
      const wick=up?(o.wickUpColor||fill):(o.wickDownColor||fill);

      if(!renko&&o.wickVisible!==false&&!rgbaTransparent(wick)){
        ctx.save();
        ctx.strokeStyle=wick;
        ctx.lineWidth=Math.max(hairX,Math.min(1,1.35*hairX));
        ctx.lineCap='butt';
        ctx.beginPath();
        ctx.moveTo(x,this._snapY(yh));
        ctx.lineTo(x,this._snapY(yl));
        ctx.stroke();
        ctx.restore();
      }

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

  /* More useful responsive price labels without allowing collisions. */
  const axisTicks=p._axisTicks;
  p._axisTicks=function(paneIndex,target=8){
    if(paneIndex===0){
      const mainH=this._paneRects?.()?.[0]?.height||this.height||400;
      target=Math.max(Number(target)||0,Math.floor(mainH/(window.innerWidth<=780?38:42)));
      target=Math.min(14,target);
    }
    return axisTicks.call(this,paneIndex,target);
  };

  /*
   * Calendar hierarchy overlay. Intraday time labels remain native. At actual
   * calendar boundaries we add date/month/year labels and vertical separators.
   * Month names are intentionally full (February, March...) for unmistakable
   * long-history orientation.
   */
  const render=p.render;
  p.render=function(){
    const result=render.call(this);
    try{this._drawCalendarHierarchy?.(this.ctx);}catch(e){console.warn('Trade Avata calendar hierarchy',e);}
    return result;
  };

  p._drawCalendarHierarchy=function(ctx){
    const data=this._mainData?.()||[],vr=this.visibleRange,plot=this._plotRect?.();
    if(!data.length||!vr||!plot)return;
    const start=Math.max(1,Math.floor(vr.from)-1),end=Math.min(data.length-1,Math.ceil(vr.to)+1);
    const tz=this.optionsData.timezone==='UTC+1 Lagos'?'Africa/Lagos':this.optionsData.timezone==='UTC'?'UTC':undefined;
    const parts=sec=>{
      const d=new Date(Number(sec)*1000);
      const f=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
      const get=t=>Number(f.find(x=>x.type===t)?.value||0);
      return{y:get('year'),m:get('month'),d:get('day')};
    };
    const label=(sec,kind)=>{
      const d=new Date(Number(sec)*1000),opts=kind==='year'?{year:'numeric'}:kind==='month'?{month:'long'}:{day:'numeric',month:'short'};
      if(tz)opts.timeZone=tz;
      return new Intl.DateTimeFormat('en-GB',opts).format(d);
    };
    ctx.save();ctx.textAlign='center';ctx.textBaseline='top';
    let lastLabelX=-Infinity;
    for(let i=start;i<=end;i++){
      const a=parts(data[i-1]?.time),b=parts(data[i]?.time);
      if(!a.y||!b.y)continue;
      let kind=null;
      if(a.y!==b.y)kind='year'; else if(a.m!==b.m)kind='month'; else if(a.d!==b.d)kind='day';
      if(!kind)continue;
      const x=this._snapX(this.timeScaleApi.logicalToCoordinate(i));
      if(!Number.isFinite(x)||x<0||x>plot.right)continue;
      ctx.beginPath();ctx.setLineDash(kind==='day'?[3,5]:[]);
      ctx.strokeStyle=kind==='year'?'rgba(157,180,204,.62)':kind==='month'?'rgba(157,180,204,.48)':'rgba(140,160,180,.30)';
      ctx.lineWidth=kind==='year'?1.5:kind==='month'?1.25:1;
      ctx.moveTo(x,0);ctx.lineTo(x,plot.bottom);ctx.stroke();
      if(x-lastLabelX<48&&kind==='day')continue;
      const text=label(data[i].time,kind);
      ctx.font=kind==='month'||kind==='year'?'700 9px Inter,system-ui,sans-serif':'600 9px Inter,system-ui,sans-serif';
      const w=Math.max(34,ctx.measureText(text).width+8),lx=clamp(x-w/2,0,Math.max(0,plot.right-w));
      ctx.fillStyle=this.optionsData.layout?.background?.color||'#111820';ctx.fillRect(lx,plot.bottom+2,w,18);
      ctx.fillStyle=this.optionsData.layout?.textColor||'#9db4cc';ctx.fillText(text,lx+w/2,plot.bottom+6);
      lastLabelX=x;
    }
    ctx.restore();
  };
}

function installDrawingTimeAnchors(){
  const p=ChartPane?.prototype;
  if(!p||p.__taDrawingTimeAnchors20261029)return;
  p.__taDrawingTimeAnchors20261029=true;

  /*
   * A drawing's timestamp is authoritative across timeframe changes. Logical
   * index is only a same-timeframe convenience and must never relocate/hide a
   * drawing when 30s becomes 15s, 1m, etc.
   */
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

window.__TRADE_AVATA_CHART_POLISH_20261029={
  candleWicks:'continuous-crisp',
  renkoGeometry:'narrow-candle-like',
  calendarAxis:'day-month-year-hierarchy',
  drawingAnchors:'timestamp-first',
  priceAxis:'responsive-density'
};
