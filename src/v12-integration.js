/* Trade Avata V12 Integration Layer
 * Additive over JESUS-JESUS-1/V11.2. Preserves the existing platform while adding:
 * - TA Script 1.0 R4 as the native indicator language
 * - secure owner/grant private indicators by TA ID/backend entitlement
 * - real-time account/device workspace synchronization
 * - same-frame candle + drawing overlay movement
 * - running-indicator management shortcuts and expanded settings metadata
 */
import {el,toast,clamp} from './utils.js';
import {ChartPane} from './chart-pane.js';
import {DrawingLayer} from './drawings.js';
import {TradeAvataNativeChart} from './native-chart.js';
import {BUILTIN_INDICATORS,indicatorDefinition,indicatorLabel} from './indicators.js';
import {compile as compileTaScript,describeProgram} from './ta-script/index.js';

const BUILD='Trade Avata V12 R2 · TA Script Native + Certified Indicators + Secure Private Runtime';
const SYNC_MODE_KEY='tradeAvataDeviceSyncModeV12';
const PRIVATE_DEFAULT='gold-hunter-v4';
const clone=v=>{try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}};
const nowIso=()=>new Date().toISOString();
const currentUser=app=>app.state.connection?.tradeAvataUser||window.TRADE_AVATA_AUTH_ADAPTER?.getCurrentUser?.()||null;
const verifiedOwner=app=>{const u=currentUser(app);return String(u?.role||'').toLowerCase()==='owner'&&(u?.roleVerified===true||['localhost','127.0.0.1',''].includes(location.hostname));};
const privateResults=globalThis.TRADE_AVATA_PRIVATE_RESULTS instanceof Map?globalThis.TRADE_AVATA_PRIVATE_RESULTS:new Map();
globalThis.TRADE_AVATA_PRIVATE_RESULTS=privateResults;

globalThis.TRADE_AVATA_TA_SCRIPT={compile:compileTaScript,describeProgram,version:'1.0',revision:'R4'};

function syncMode(){try{return localStorage.getItem(SYNC_MODE_KEY)||'linked';}catch{return'linked';}}
function setSyncMode(v){const mode=v==='independent'?'independent':'linked';try{localStorage.setItem(SYNC_MODE_KEY,mode);}catch{}return mode;}
function activeChartSnapshot(app){const c=app.activeConfig?.()||{};return{symbol:c.symbol||app.state.symbol,period:clone(c.period||app.state.period),timeframe:c.timeframe||app.state.timeframe,chartType:c.chartType||app.state.chartType};}
function sanitizeIndicator(ind){const x=clone(ind);if(x.securePrivate)delete x.sourceCode;return x;}
function v12Preferences(app){const s=app.state;return clone({
  platformTheme:s.platformTheme,themeSyncChart:s.themeSyncChart,uiStyle:s.uiStyle,performanceMode:s.performanceMode,
  gridH:s.gridH,gridV:s.gridV,majorRoundGrid:s.majorRoundGrid,roundNumbers:s.roundNumbers,background:s.background,
  textColor:s.textColor,gridColor:s.gridColor,candleStyle:s.candleStyle,crosshairColor:s.crosshairColor,marketLineStyles:s.marketLineStyles,
  showBidLine:s.showBidLine,showAskLine:s.showAskLine,showLastPriceLine:s.showLastPriceLine,showCountdown:s.showCountdown,timezone:s.timezone,
  favoritePeriods:s.favoritePeriods,favoriteSymbols:s.favoriteSymbols,watchlist:s.watchlist,
  indicators:(s.indicators||[]).map(sanitizeIndicator),indicatorProfiles:s.indicatorProfiles,indicatorFavorites:s.indicatorFavorites,
  chartSettings:s.chartSettings,panelVisibility:s.panelVisibility,drawingFavorites:s.drawingFavorites,taScriptPrograms:s.taScriptPrograms||[]
});}

function taAuthorization(app){
  const u=currentUser(app),verified=!!app.__taEntitlementsVerified||verifiedOwner(app),rows=app.state.secureIndicatorEntitlements||[];
  const entitlements=rows.filter(x=>x.active!==false&&x.status!=='revoked').map(x=>String(x.indicatorId||x.entitlement||'')).filter(Boolean);
  return{verified,isOwner:verifiedOwner(app),role:u?.role||'guest',taId:u?.taId||app.state.identity?.taId||null,entitlements,grants:entitlements};
}

function drawTaAnnotations(pane){
  const c=pane?.overlayCanvas,ctx=c?.getContext?.('2d');if(!ctx||!pane.__taIndicatorResults?.size)return;
  const range=pane.chart?.timeScale?.().getVisibleLogicalRange?.();
  const from=Math.floor(range?.from??0)-2,to=Math.ceil(range?.to??pane.displayBars.length)+2;
  ctx.save();ctx.lineWidth=1;ctx.textBaseline='middle';ctx.font='600 9px Inter,system-ui,sans-serif';
  for(const [id,result] of pane.__taIndicatorResults){
    const cfg=pane.app.state.indicators?.find(x=>x.id===id);if(cfg?.visible===false)continue;
    if(result?.kind==='market-profile'&&result.profileHistogram?.bins?.length){
      const profile=result.profileHistogram,max=Math.max(1,Number(profile.maxVolume)||1),right=Math.max(20,(c.clientWidth||pane.chartHost?.clientWidth||600)-(window.innerWidth<=780?44:48)),maxWidth=Math.max(24,Math.min(150,right*.24));
      ctx.save();ctx.globalAlpha=.24;ctx.fillStyle=cfg?.color||'#178eff';
      for(const b of profile.bins){const y1=pane.yForPrice(Number(b.high)),y2=pane.yForPrice(Number(b.low));if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;const h=Math.max(1,Math.abs(y2-y1)),w=maxWidth*(Math.max(0,Number(b.volume)||0)/max);ctx.fillRect(right-w,Math.min(y1,y2),w,h);}
      ctx.restore();
    }
    if(result?.kind!=='ta-script')continue;
    const markers=[...(result.markers||[]).slice(-400),...(result.signals||[]).slice(-400).map(x=>({...x,text:x.name||'Signal',signal:true}))];
    for(const m of markers){
      const i=Number(m.index);if(!Number.isFinite(i)||i<from||i>to)continue;
      const x=pane.logicalToCoordinate(i),y=pane.yForPrice(Number(m.price));if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      const text=String(m.text||m.name||'•').slice(0,24),w=Math.max(18,ctx.measureText(text).width+10),yy=clamp(y+(m.signal?-20:-14),10,(c.clientHeight||400)-10);
      ctx.fillStyle=m.signal?'rgba(22,140,255,.92)':'rgba(15,30,44,.92)';ctx.fillRect(x-w/2,yy-8,w,16);
      ctx.fillStyle='#f5f8fb';ctx.fillText(text,x-w/2+5,yy);
      ctx.strokeStyle=m.signal?'#62d6ff':'#9db4cc';ctx.beginPath();ctx.moveTo(x,yy+8);ctx.lineTo(x,y);ctx.stroke();
    }
  }
  ctx.restore();
}

function patchSameFrameOverlays(app){
  for(const p of app.panes||[])if(p.chart)p.chart.__taPane=p;
  if(!ChartPane.prototype.__taV12CreateChart){
    const old=ChartPane.prototype.createChart;ChartPane.prototype.__taV12CreateChart=old;
    ChartPane.prototype.createChart=function(...args){const out=old.apply(this,args);if(this.chart)this.chart.__taPane=this;return out;};
  }
  if(!DrawingLayer.prototype.__taV12Render){
    const old=DrawingLayer.prototype.render;DrawingLayer.prototype.__taV12Render=old;
    DrawingLayer.prototype.render=function(...args){const out=old.apply(this,args);try{drawTaAnnotations(this.pane);}catch{}return out;};
  }
  if(!TradeAvataNativeChart.prototype.__taV12SameFrame){
    const old=TradeAvataNativeChart.prototype.render;TradeAvataNativeChart.prototype.__taV12SameFrame=old;
    TradeAvataNativeChart.prototype.render=function(...args){const out=old.apply(this,args);const pane=this.__taPane;try{pane?.drawingLayer?.render?.();}catch{}return out;};
  }
  // During a native drag the native render now owns both candles and drawings in the same frame.
  if(!ChartPane.prototype.__taV12Overlay){
    const old=ChartPane.prototype.renderOverlays;ChartPane.prototype.__taV12Overlay=old;
    ChartPane.prototype.renderOverlays=function(force=false){
      if(!force&&this.chart?.drag){this.__taOverlayDirty=true;return;}
      const out=old.call(this,force);this.__taOverlayDirty=false;return out;
    };
  }
}

function settingControl(spec,ind,onChange){
  if(spec.type==='select'){
    const s=el('select',{class:'field'});for(const raw of spec.options||[]){const [v,l]=Array.isArray(raw)?raw:[raw,String(raw)];const o=el('option',{value:v},l);if(String(ind[spec.key]??spec.default)===String(v))o.selected=true;s.append(o);}s.onchange=()=>{ind[spec.key]=s.value;onChange();};return s;
  }
  const input=el('input',{class:'field',type:'number',value:ind[spec.key]??spec.default??'',step:spec.step??'any'});if(spec.min!=null)input.min=spec.min;if(spec.max!=null)input.max=spec.max;
  input.oninput=()=>{const v=Number(input.value);if(Number.isFinite(v)){ind[spec.key]=v;onChange();}};return input;
}
function openV12IndicatorSettings(app,id){
  const ind=app.state.indicators.find(x=>x.id===id),def=indicatorDefinition(ind?.kind);if(!ind||!def)return;
  const m=app.makeModal(ind.name||def.name,'indicator-settings-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.textContent='Done';m.cancel.style.display='none';
  const rerender=()=>{if(!ind.customName)ind.name=indicatorLabel(ind);app.refreshAllCharts?.();app.save?.();};
  body.append(el('div',{class:'side-card'},el('strong',{},def.name),el('small',{},`${def.category} · ${def.pane==='oscillator'?'Oscillator pane':'Main chart'}`)));
  for(const spec of def.settings||[]){const row=el('div',{class:'setting-row'},el('div',{},el('label',{},spec.label||spec.key)),settingControl(spec,ind,rerender));body.append(row);}
  const style=el('div',{class:'ta-upgrade-section'},el('h4',{},'Lines / Style'));
  const visible=el('input',{type:'checkbox'});visible.checked=ind.visible!==false;visible.onchange=()=>{ind.visible=visible.checked;rerender();};
  const width=el('input',{class:'field',type:'number',value:ind.lineWidth??1.5,min:.5,max:6,step:.5});width.oninput=()=>{ind.lineWidth=Math.max(.5,Number(width.value)||1.5);rerender();};
  const lineStyle=el('select',{class:'field'});for(const v of ['solid','dashed','dotted']){const o=el('option',{value:v},v[0].toUpperCase()+v.slice(1));if((ind.lineStyle||'solid')===v)o.selected=true;lineStyle.append(o);}lineStyle.onchange=()=>{ind.lineStyle=lineStyle.value;rerender();};
  const opacity=el('input',{class:'field',type:'range',min:20,max:100,step:1,value:Math.round((ind.opacity??1)*100)});opacity.oninput=()=>{ind.opacity=Number(opacity.value)/100;rerender();};
  const colorInput=(key,label,fallback)=>{const x=el('input',{class:'field',type:'color',value:/^#[0-9a-f]{6}$/i.test(ind[key]||'')?ind[key]:fallback});x.oninput=()=>{ind[key]=x.value;rerender();};style.append(el('div',{class:'setting-row'},el('label',{},label),x));};
  style.append(el('div',{class:'setting-row'},el('label',{},'Visible'),visible),el('div',{class:'setting-row'},el('label',{},'Line width'),width),el('div',{class:'setting-row'},el('label',{},'Line style'),lineStyle),el('div',{class:'setting-row'},el('label',{},'Opacity'),opacity));
  colorInput('color','Primary colour','#178eff');
  const extraColors={
    adx:[['plusColor','+DI colour','#22c55e'],['minusColor','-DI colour','#ef4444']],
    ichimoku:[['tenkanColor','Tenkan colour','#178eff'],['kijunColor','Kijun colour','#f59e0b'],['spanAColor','Senkou A colour','#22c55e'],['spanBColor','Senkou B colour','#ef4444'],['chikouColor','Chikou colour','#a855f7']],
    alligator:[['jawColor','Jaw colour','#3b82f6'],['teethColor','Teeth colour','#ef4444'],['lipsColor','Lips colour','#22c55e']],
    rvi:[['signalColor','Signal colour','#f3a000']],
    gator:[['signalColor','Lower colour','#ef4444']],
    fractals:[['upColor','Up fractal colour','#ef4444'],['downColor','Down fractal colour','#22c55e']],
    'market-profile':[['vahColor','VAH colour','#22c55e'],['valColor','VAL colour','#ef4444']]
  };
  for(const [key,label,fallback] of extraColors[ind.kind]||[])colorInput(key,label,fallback);
  body.append(style);
  if(Array.isArray(ind.levels||def.defaults?.levels)){
    const lv=el('input',{class:'field',type:'text',value:(ind.levels||def.defaults.levels).join(', ')});lv.onchange=()=>{const vals=lv.value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);if(vals.length){ind.levels=vals;rerender();}};
    body.append(el('div',{class:'ta-upgrade-section'},el('h4',{},'Levels'),el('div',{class:'setting-row'},el('label',{},'Horizontal levels'),lv)));
  }
  body.append(el('button',{class:'secondary',onclick:()=>{Object.assign(ind,clone(def.defaults||{}));ind.name=indicatorLabel(ind);rerender();app.openIndicatorSettings(id);}},'Reset to defaults'));
}

function patchIndicatorUi(app){
  const legacyKinds=new Set(['ema','sma','wma','moving-average','bollinger','vwap','rsi','macd','stochastic','atr','cci','momentum','roc','volume']);
  const oldSettings=app.openIndicatorSettings?.bind(app);app.openIndicatorSettings=function(id){const ind=this.state.indicators.find(x=>x.id===id);if(ind?.kind==='ta-script')return this.openTaScriptInstance(id);if(ind&&!legacyKinds.has(ind.kind))return openV12IndicatorSettings(this,id);return oldSettings?.(id);};
  const oldBrowser=app.openIndicatorBrowser?.bind(app);app.openIndicatorBrowser=function(anchor){oldBrowser?.(anchor);const body=document.querySelector('.indicator-browser'),head=body?.querySelector('.indicator-browser-head');if(!body||!head)return;
    if(!head.querySelector('.ta-v12-running'))head.append(el('button',{class:'secondary ta-v12-running',onclick:()=>this.openIndicatorManager?.()},`Running · ${this.state.indicators?.length||0}`),el('button',{class:'secondary',onclick:()=>this.openIndicatorPortal?.('mine')},'Indicator Portal'));
    const programs=this.state.authorizedPrivatePrograms||[];if(programs.length&&!body.querySelector('.ta-private-programs')){
      const box=el('div',{class:'ta-private-programs'},el('h4',{},'My private indicators'));
      for(const p of programs){
        const attached=this.state.indicators.some(x=>x.kind==='ta-script'&&x.programId===p.indicatorId);
        const row=el(
          'div',
          {class:'indicator-browser-row'},
          el('div',{class:'indicator-main'},
            el('strong',{},p.name||p.indicatorId),
            el('small',{},`TA Script · ${p.accessPolicy||'Private'}`)
          ),
          el('button',{
            class:'secondary',
            disabled:attached,
            onclick:()=>{this.attachPrivateIndicator(p.indicatorId);this.openIndicatorBrowser();}
          },attached?'Running':'Add')
        );
        box.append(row);
      }
      body.insertBefore(box,body.querySelector('.indicator-browser-tabs')||body.firstChild);
    }
  };
}

function patchTaScriptStudio(app){
  app.state.taScriptPrograms=Array.isArray(app.state.taScriptPrograms)?app.state.taScriptPrograms:[];
  app.openTaScriptStudio=function(existingId=null){
    this.closeMenu?.();const existing=this.state.taScriptPrograms.find(x=>x.id===existingId);const m=this.makeModal('TA Script 1.0 · Indicator Studio','ta-script-studio-modal');m.main.className='modal-main single';m.ok.style.display='none';m.cancel.textContent='Close';const body=el('div',{class:'settings-body ta-script-studio'});m.main.replaceChildren(body);
    body.append(el('div',{class:'side-card'},el('strong',{},'Native Trade Avata indicator language'),el('p',{},'Build indicators, signals, market-structure logic, patterns, backtests and controlled automation without editing the chart engine.')));
    const textarea=document.createElement('textarea');textarea.className='field ta-script-editor';textarea.spellcheck=false;textarea.value=existing?.source||`ta_script 1.0\nrevision R4\nindicator "My Indicator"\noverlay true\n\ninput length = 20\nlet fast = ema(close, length)\nplot fast as "EMA"\n`;
    const status=el('pre',{class:'ta-script-status'},'Ready.');const actions=el('div',{class:'ta-login-actions'});
    const validate=()=>{try{const c=compileTaScript(textarea.value),d=c.descriptor;status.textContent=`VALID · ${d.name} · ${d.kind} · ${d.overlay?'overlay':'separate pane'} · ${d.calculate}`;return c;}catch(e){status.textContent=`ERROR · ${e.message}`;return null;}};
    actions.append(el('button',{class:'secondary',onclick:validate},'Validate'),el('button',{class:'primary',onclick:()=>{const c=validate();if(!c)return;const d=c.descriptor,id=existing?.id||`tas-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const row={id,name:d.name,source:textarea.value,updatedAt:nowIso()};const ix=this.state.taScriptPrograms.findIndex(x=>x.id===id);if(ix>=0)this.state.taScriptPrograms[ix]=row;else this.state.taScriptPrograms.push(row);const attached=this.state.indicators.find(x=>x.kind==='ta-script'&&x.programId===id);if(attached){attached.sourceCode=textarea.value;attached.name=d.name;attached.calculate=d.calculate;attached.pane=d.overlay?'price':'oscillator';}else this.state.indicators.push({id:`ta-${id}`,kind:'ta-script',programId:id,sourceCode:textarea.value,name:d.name,scriptName:d.name,calculate:d.calculate,pane:d.overlay?'price':'oscillator',visible:true,color:'#178eff',lineWidth:1.5,lineStyle:'solid',opacity:1,inputs:{}});this.refreshAllCharts?.();this.save?.();toast(`${d.name} added to chart`,'success');this.closeModal();}},existing?'Save & update chart':'Add to chart'));
    body.append(textarea,actions,status);
    if(this.state.taScriptPrograms.length){const lib=el('div',{class:'ta-upgrade-section'},el('h4',{},'Saved TA Scripts'));for(const p of this.state.taScriptPrograms.slice(-30).reverse())lib.append(el('button',{class:'menu-item',onclick:()=>{this.closeModal();this.openTaScriptStudio(p.id);}},`${p.name} · ${new Date(p.updatedAt||Date.now()).toLocaleString()}`));body.append(lib);}
  };
  app.openTaScriptInstance=function(id){
    const ind=this.state.indicators.find(x=>x.id===id);if(!ind)return;
    if(ind.securePrivate){
      const m=this.makeModal(ind.name||'Private indicator','indicator-settings-modal'),body=el('div',{class:'settings-body'});m.ok.style.display='none';m.cancel.textContent='Close';m.main.replaceChildren(body);
      body.append(el('div',{class:'side-card'},el('strong',{},ind.name),el('p',{},'This indicator executes on the secure Trade Avata backend after account authorization. Its proprietary TA Script source is never sent to this browser.')));
      ind.inputs=ind.inputs||{};
      for(const spec of ind.settingsSchema||[]){
        let control;
        if(spec.type==='boolean'){
          control=el('input',{type:'checkbox'});control.checked=ind.inputs[spec.key]??spec.default??false;control.onchange=()=>{ind.inputs[spec.key]=control.checked;for(const pane of this.panes||[])runPrivateIndicator(pane,ind,{full:true});this.save();};
        }else{
          control=el('input',{class:'field',type:spec.type==='number'?'number':'text',value:ind.inputs[spec.key]??spec.default??'',step:spec.step??'any'});
          control.oninput=()=>{ind.inputs[spec.key]=spec.type==='number'?(Number(control.value)||0):control.value;for(const pane of this.panes||[])runPrivateIndicator(pane,ind,{full:true});this.save();};
        }
        body.append(el('div',{class:'setting-row'},el('label',{},spec.label||spec.key),control));
      }
      body.append(el('button',{class:'secondary',onclick:()=>{ind.visible=ind.visible===false;this.refreshAllCharts();this.save();}},ind.visible===false?'Show indicator':'Hide indicator'));
      return;
    }
    this.openTaScriptStudio(ind.programId);
  };
}

async function refreshPrivateAccess(app){
  const api=window.TRADE_AVATA_PRIVATE_INDICATORS,user=currentUser(app);app.__taEntitlementsVerified=false;app.state.secureIndicatorEntitlements=[];app.state.authorizedPrivatePrograms=[];
  if(!api||!user?.uid){removeUnauthorizedPrivate(app,new Set());return;}
  try{
    const rows=await api.entitlements();app.state.secureIndicatorEntitlements=rows;app.__taEntitlementsVerified=true;
    const ids=new Set(rows.filter(x=>x.active!==false&&x.status!=='revoked').map(x=>String(x.indicatorId||'')));if(verifiedOwner(app))ids.add(PRIVATE_DEFAULT);
    removeUnauthorizedPrivate(app,ids);
    for(const id of ids){if(!id)continue;try{const p=await api.program(id);app.state.authorizedPrivatePrograms.push(p);if(verifiedOwner(app)&&p.defaultAttach==='owner')attachPrivate(app,id,p);}catch(e){console.warn(`[${BUILD}] private indicator ${id}`,e.message);}}
    app.refreshAllCharts?.();app.renderTopbar?.();
    for(const pane of app.panes||[])for(const ind of app.state.indicators||[])if(ind.securePrivate)runPrivateIndicator(pane,ind,{full:true}).catch(()=>{});
  }catch(e){console.warn(`[${BUILD}] entitlement refresh`,e.message);}
}
function removeUnauthorizedPrivate(app,allowed){
  for(const key of [...privateResults.keys()]){const id=String(key).split('::')[0];if(!allowed.has(id))privateResults.delete(key);}
  const before=app.state.indicators?.length||0;app.state.indicators=(app.state.indicators||[]).filter(x=>!x.securePrivate||allowed.has(x.programId));if((app.state.indicators?.length||0)!==before)app.refreshAllCharts?.();
}
const privateRunPending=new Map();
const privateRunLast=new Map();
function privateCacheKey(pane,ind){return `${ind.programId||ind.id}::${pane?.id||'default'}`;}
async function runPrivateIndicator(pane,ind,{closed=false,full=false}={}){
  const api=window.TRADE_AVATA_PRIVATE_INDICATORS;if(!api?.run||!pane||!ind?.securePrivate)return;
  const key=privateCacheKey(pane,ind);
  if(ind.calculate==='bar-close'&&!closed&&!full&&privateResults.has(key))return;
  if(ind.calculate!=='bar-close'&&!closed&&!full){const now=Date.now(),last=privateRunLast.get(key)||0;if(now-last<250)return;privateRunLast.set(key,now);}
  if(privateRunPending.has(key))return privateRunPending.get(key);
  const task=(async()=>{const bars=(pane.displayBars||[]).slice(-5000).map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume??b.tickVolume??0}));if(bars.length<2)return;const payload=await api.run(ind.programId,{bars,inputs:ind.inputs||{},pipSize:Number(pane.app?.state?.symbols?.[pane.symbol]?.pipSize)||.01,hasLiveBar:!closed});privateResults.set(key,payload);pane.rebuildSeries?.({preserveVisibleRange:true});pane.refreshHeader?.();pane.renderOverlays?.(true);})().catch(e=>{console.warn(`[${BUILD}] secure indicator run ${ind.programId}`,e.message);}).finally(()=>privateRunPending.delete(key));privateRunPending.set(key,task);return task;
}
globalThis.TRADE_AVATA_PRIVATE_RUNNER=runPrivateIndicator;

function attachPrivate(app,id,meta=null){
  if(app.state.indicators.some(x=>x.kind==='ta-script'&&x.programId===id))return;
  const p=meta||app.state.authorizedPrivatePrograms.find(x=>x.indicatorId===id)||{};
  const ind={id:`private-${id}`,kind:'ta-script',programId:id,securePrivate:true,name:p.name||id,scriptName:p.name||id,calculate:p.calculate||'bar-close',pane:p.overlay===false?'oscillator':'price',visible:true,color:'#16b8ce',lineWidth:1.5,lineStyle:'solid',opacity:1,settingsSchema:clone(p.settingsSchema||[]),inputs:{}};app.state.indicators.push(ind);app.refreshAllCharts?.();app.save?.();for(const pane of app.panes||[])runPrivateIndicator(pane,ind,{full:true}).catch(()=>{});
}

function patchPrivateIndicators(app){
  app.taScriptAuthorization=()=>taAuthorization(app);
  app.attachPrivateIndicator=function(id){const p=this.state.authorizedPrivatePrograms.find(x=>x.indicatorId===id);if(!p){toast('Private indicator access is not available for this account.','error');return;}attachPrivate(this,id,p);};
  app.refreshPrivateIndicatorAccess=()=>refreshPrivateAccess(app);
  const oldLicenses=app.openIndicatorLicenses?.bind(app);app.openIndicatorLicenses=async function(){const api=window.TRADE_AVATA_PRIVATE_INDICATORS;if(!api)return oldLicenses?.();const m=this.makeModal('Indicator access','license-center-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';body.append(el('p',{class:'settings-note'},`TA ID ${this.state.identity?.taId||'—'} is a public lookup identity; authorization is enforced by the signed-in backend account.`));try{const rows=await api.entitlements();this.state.secureIndicatorEntitlements=rows;this.__taEntitlementsVerified=true;if(!rows.length)body.append(el('div',{class:'empty-state'},'No granted private indicators.'));for(const x of rows)body.append(el('div',{class:'ta-license-card'},el('strong',{},x.indicatorId),el('small',{},x.active===false||x.status==='revoked'?'REVOKED':x.expiresAt?`Active until ${new Date(x.expiresAt?._seconds?x.expiresAt._seconds*1000:x.expiresAt).toLocaleString()}`:'Active until revoked')));}catch(e){body.append(el('div',{class:'empty-state'},e.message));}};
  app.openLicenseAdmin=async function(){if(!verifiedOwner(this)){toast('Verified Owner access required','error');return;}const api=window.TRADE_AVATA_PRIVATE_INDICATORS;if(!api){toast('Secure indicator backend is not configured','error');return;}const m=this.makeModal('TA ID · Private Indicator Access','license-admin-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';let taId='',duration='until-revoked',devices=3;
    const ta=el('input',{class:'field',placeholder:'TA-12345678'}),dur=el('select',{class:'field'});for(const [v,l] of [['7d','7 days'],['30d','30 days'],['3m','3 months'],['6m','6 months'],['1y','1 year'],['until-revoked','Until revoked']])dur.append(el('option',{value:v},l));const dev=el('input',{class:'field',type:'number',min:1,max:20,value:3});
    body.append(el('div',{class:'side-card'},el('strong',{},'Gold Hunter V4'),el('p',{},'Owner-only by default. Grant or revoke another authenticated Trade Avata user using their TA ID. The backend, not the browser, enforces access.')),el('div',{class:'setting-row'},el('label',{},'TA ID'),ta),el('div',{class:'setting-row'},el('label',{},'Duration'),dur),el('div',{class:'setting-row'},el('label',{},'Device allowance'),dev));
    body.append(el('div',{class:'ta-login-actions'},el('button',{class:'primary',onclick:async()=>{try{await api.grant({taId:ta.value,indicatorId:PRIVATE_DEFAULT,duration:dur.value,deviceAllowance:Number(dev.value)||3});toast('Private indicator access granted','success');this.closeModal();this.openLicenseAdmin();}catch(e){toast(e.message,'error');}}},'Grant access'),el('button',{class:'danger',onclick:async()=>{try{await api.revoke({taId:ta.value,indicatorId:PRIVATE_DEFAULT});toast('Access revoked','success');this.closeModal();this.openLicenseAdmin();}catch(e){toast(e.message,'error');}}},'Revoke')));
    const list=el('div',{class:'ta-upgrade-section'},el('h4',{},'Current grants'));body.append(list);try{const rows=await api.grants(PRIVATE_DEFAULT);if(!rows.length)list.append(el('div',{class:'empty-state'},'No grants yet.'));for(const g of rows)list.append(el('div',{class:'ta-license-card'},el('strong',{},g.taId||g.uid),el('small',{},g.active?'ACTIVE':'REVOKED')));}catch(e){list.append(el('div',{class:'empty-state'},e.message));}
  };
  window.addEventListener('tradeavata:auth-state',()=>setTimeout(()=>refreshPrivateAccess(app),20));setTimeout(()=>refreshPrivateAccess(app),80);
}

function applyRemotePreferences(app,data){
  if(app.__taApplyingRemoteSync)return;const own=window.TRADE_AVATA_ACCOUNT_SYNC?.deviceId?.();if(data?.updatedByDevice===own)return;
  app.__taApplyingRemoteSync=true;
  try{
    const p=data.v12Preferences||data.preferences||{};
    const keys=['platformTheme','themeSyncChart','uiStyle','performanceMode','gridH','gridV','majorRoundGrid','roundNumbers','background','textColor','gridColor','candleStyle','crosshairColor','marketLineStyles','showBidLine','showAskLine','showLastPriceLine','showCountdown','timezone','favoritePeriods','favoriteSymbols','watchlist','indicators','indicatorProfiles','indicatorFavorites','chartSettings','panelVisibility','drawingFavorites','taScriptPrograms'];
    for(const k of keys)if(Object.prototype.hasOwnProperty.call(p,k))app.state[k]=clone(p[k]);
    if(Array.isArray(data.drawings))app.state.drawings=clone(data.drawings);
    const ls=data.layoutState||{};if(Array.isArray(ls.workspaces))app.state.workspaces=clone(ls.workspaces);if(Array.isArray(ls.chartTemplates))app.state.chartTemplates=clone(ls.chartTemplates);
    if(syncMode()==='linked'&&ls.layout&&Array.isArray(ls.paneConfigs)){app.state.paneConfigs=clone(ls.paneConfigs);if(app.state.layout!==ls.layout)app.applyLayout?.(ls.layout,false);}
    app.applyPlatformTheme?.();app.refreshAllCharts?.();app.syncDrawingLayers?.();app.renderTopbar?.();app.renderRightPanel?.();
  }finally{app.__taApplyingRemoteSync=false;}
}
function applyRemoteActiveChart(app,data){
  if(syncMode()!=='linked')return;const live=data?.live,own=window.TRADE_AVATA_ACCOUNT_SYNC?.deviceId?.();if(!live?.activeChart||live.updatedByDevice===own||live.revision===app.__taLastRemoteLiveRevision)return;
  app.__taLastRemoteLiveRevision=live.revision;const cfg=live.activeChart,p=app.activePane?.();if(!p)return;app.__taApplyingRemoteSync=true;
  try{p.setConfig({symbol:cfg.symbol,period:cfg.period,chartType:cfg.chartType},{home:true,preserveView:false});app.state.symbol=cfg.symbol||p.symbol;app.state.period=clone(cfg.period||p.period);app.state.chartType=cfg.chartType||p.chartType;if(cfg.period?.mode==='time')app.state.timeframe=cfg.period.value;app.syncPaneConfigs?.();app.renderTopbar?.();app.renderRightPanel?.();}finally{app.__taApplyingRemoteSync=false;}
}

function patchAccountSync(app){
  const adapter=window.TRADE_AVATA_ACCOUNT_SYNC;app.state.crossDeviceSync={...(app.state.crossDeviceSync||{}),mode:syncMode()};
  app.openDeviceSyncSettings=function(){const m=this.makeModal('Cross-device synchronization','ta-device-sync-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';const render=()=>{body.innerHTML='';const mode=syncMode();body.append(el('div',{class:'side-card'},el('strong',{},mode==='linked'?'Linked devices':'Independent chart'),el('p',{},mode==='linked'?'Symbol, timeframe and chart type follow your latest action on another signed-in device. Saved settings, indicators, drawings and workspaces also sync.':'This device keeps its own active symbol/timeframe/chart type, while account settings, indicators, drawings and saved workspaces continue to sync.')),el('div',{class:'ta-login-actions'},el('button',{class:mode==='linked'?'primary':'secondary',onclick:()=>{setSyncMode('linked');this.state.crossDeviceSync.mode='linked';render();this.__taScheduleAccountSync?.(true);}},'Linked'),el('button',{class:mode==='independent'?'primary':'secondary',onclick:()=>{setSyncMode('independent');this.state.crossDeviceSync.mode='independent';render();}},'Independent')));};render();};
  const oldMore=app.openMore?.bind(app);app.openMore=function(){oldMore?.();if(this.menu&&!this.menu.querySelector('.ta-device-sync-menu')){this.menu.append(el('button',{class:'menu-item ta-device-sync-menu',onclick:()=>{this.closeMenu();this.openDeviceSyncSettings();}},`Device sync · ${syncMode()==='linked'?'Linked':'Independent'}`));}};
  let activeTimer=0,workspaceTimer=0;
  app.__taScheduleAccountSync=function(immediate=false){if(this.__taApplyingRemoteSync||!currentUser(this)?.uid||!adapter)return;clearTimeout(activeTimer);clearTimeout(workspaceTimer);const activeDelay=immediate?0:90,workspaceDelay=immediate?0:420;
    if(syncMode()==='linked')activeTimer=setTimeout(()=>adapter.publishActiveChart(activeChartSnapshot(this)).catch(()=>{}),activeDelay);
    workspaceTimer=setTimeout(()=>adapter.saveWorkspaceState({preferences:v12Preferences(this),activeChart:activeChartSnapshot(this),layoutState:{layout:this.state.layout,paneConfigs:clone(this.state.paneConfigs||[]),workspaces:clone(this.state.workspaces||[]),chartTemplates:clone(this.state.chartTemplates||[])},drawings:clone(this.state.drawings||[]),linked:syncMode()==='linked'}).catch(()=>{}),workspaceDelay);
  };
  const oldSave=app.save?.bind(app);app.save=function(...args){const out=oldSave?.(...args);if(!this.__taApplyingRemoteSync)this.__taScheduleAccountSync?.();return out;};
  let unsub=null;const subscribe=()=>{unsub?.();unsub=null;if(!currentUser(app)?.uid||!adapter?.subscribe)return;unsub=adapter.subscribe(data=>{applyRemotePreferences(app,data);applyRemoteActiveChart(app,data);});};
  window.addEventListener('tradeavata:auth-state',()=>setTimeout(subscribe,50));setTimeout(subscribe,100);
}

function selfCheck(app){
  const checks={
    baselinePreserved:!!window.__tradeAvataLiveReady?.app,
    taScript:typeof compileTaScript==='function'&&globalThis.TRADE_AVATA_TA_SCRIPT?.revision==='R4',
    indicatorCount:BUILTIN_INDICATORS.length>=37,
    sharedMath:!!BUILTIN_INDICATORS.find(x=>x.kind==='ichimoku'),
    runningManager:typeof app.openIndicatorManager==='function',
    securePrivate:!!window.TRADE_AVATA_PRIVATE_INDICATORS&&typeof window.TRADE_AVATA_PRIVATE_INDICATORS.run==='function',
    accountSync:!!window.TRADE_AVATA_ACCOUNT_SYNC,
    sameFrame:!!TradeAvataNativeChart.prototype.__taV12SameFrame,
    liveIndicatorRAF:String(window.__tradeAvataLiveReady?.app||'')!==null
  };return{ok:Object.values(checks).every(Boolean),checks,build:BUILD};
}

function install(app){
  if(app.__taV12Installed)return;app.__taV12Installed=true;
  app.state.indicators=Array.isArray(app.state.indicators)?app.state.indicators:[];
  // Preserve saved legacy stochastic settings. New instances use the certified 9/3/9 baseline.
  patchSameFrameOverlays(app);patchTaScriptStudio(app);patchIndicatorUi(app);patchPrivateIndicators(app);patchAccountSync(app);
  app.renderTopbar?.();app.refreshAllCharts?.();
  window.__tradeAvataV12={build:BUILD,app,selfCheck:()=>selfCheck(app),taScript:globalThis.TRADE_AVATA_TA_SCRIPT,refreshPrivateAccess:()=>refreshPrivateAccess(app)};
  console.info(`[${BUILD}] installed`,selfCheck(app));
}

async function boot(){for(let i=0;i<400;i++){const app=window.__tradeAvataLiveReady?.app||window.__tradeAvataV111?.app||window.__tradeAvata;if(app&&window.__tradeAvataLiveReady){install(app);return;}await new Promise(r=>setTimeout(r,25));}console.error(`[${BUILD}] bootstrap timed out`);}boot();
