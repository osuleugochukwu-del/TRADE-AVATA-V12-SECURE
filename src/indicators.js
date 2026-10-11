import {TA_MATH} from './ta-script/runtime.js';
import {compile as compileTaScript} from './ta-script/index.js';

const {
  sma,ema,wma,wilder,timeSeriesMa,triangular,hull,dema,tema,vidya,kama,movingAverage,
  rsi,stochastic:stochasticCore,atr,stdev,bollinger,vwap,macd,cci,momentum,roc,adx,directionalMovement,
  envelopes,ichimoku,parabolicSar,bullsPower,bearsPower,demarker,forceIndex,williamsR,
  accumulationDistribution,moneyFlowIndex,obv,awesomeOscillator,acceleratorOscillator,
  alligator,gator,marketFacilitationIndex,relativeVigorIndex,marketProfile,fractals,zigzag
}=TA_MATH;

const period=(label='Period',value=14,min=1)=>({key:'length',label,type:'number',min,step:1,default:value});
const sourceSetting={key:'source',label:'Source',type:'select',options:['close','open','high','low','hl2','hlc3','ohlc4'],default:'close'};
const maSetting={key:'maType',label:'MA Type',type:'select',options:['sma','ema','wma','wilder','hull','triangular','dema','tema','linreg','vidya','kama'],default:'sma'};

export const BUILTIN_INDICATORS=[
  // Trend — Trade Avata native library
  {kind:'adx',name:'Average Directional Movement Index',short:'ADX',category:'Trend',pane:'oscillator',defaults:{length:14,levels:[20,25,50]},settings:[period()]},
  {kind:'bollinger',name:'Bollinger Bands',short:'BB',category:'Trend',pane:'price',defaults:{length:20,multiplier:2,maType:'sma',source:'close'},settings:[period('Period',20),sourceSetting,maSetting,{key:'multiplier',label:'Deviation',type:'number',min:.1,step:.1,default:2}]},
  {kind:'envelopes',name:'Envelopes',short:'ENV',category:'Trend',pane:'price',defaults:{length:14,deviation:.1,maType:'sma',source:'close'},settings:[period(),sourceSetting,maSetting,{key:'deviation',label:'Deviation %',type:'number',min:0,step:.01,default:.1}]},
  {kind:'ichimoku',name:'Ichimoku Kinko Hyo',short:'ICH',category:'Trend',pane:'price',defaults:{tenkan:9,kijun:26,senkouB:52,displacement:26},settings:[{key:'tenkan',label:'Tenkan-sen',type:'number',min:1,step:1},{key:'kijun',label:'Kijun-sen',type:'number',min:1,step:1},{key:'senkouB',label:'Senkou Span B',type:'number',min:1,step:1},{key:'displacement',label:'Displacement',type:'number',min:0,step:1}]},
  {kind:'moving-average',name:'Moving Average',short:'MA',category:'Trend',pane:'price',defaults:{length:14,maType:'sma',source:'close'},settings:[period(),sourceSetting,maSetting]},
  {kind:'parabolic-sar',name:'Parabolic SAR',short:'SAR',category:'Trend',pane:'price',defaults:{step:.02,maxStep:.2},settings:[{key:'step',label:'Step',type:'number',min:.0001,step:.01},{key:'maxStep',label:'Maximum',type:'number',min:.01,step:.01}]},
  {kind:'standard-deviation',name:'Standard Deviation',short:'StdDev',category:'Trend',pane:'oscillator',defaults:{length:20,source:'close'},settings:[period('Period',20),sourceSetting]},
  {kind:'zigzag',name:'ZigZag',short:'ZigZag',category:'Trend',pane:'price',defaults:{depth:12,deviation:5,backstep:3},settings:[{key:'depth',label:'Depth',type:'number',min:2,step:1},{key:'deviation',label:'Deviation %',type:'number',min:0,step:.1},{key:'backstep',label:'Backstep',type:'number',min:1,step:1}]},

  // Oscillators — Trade Avata native library
  {kind:'atr',name:'Average True Range',short:'ATR',category:'Oscillators',pane:'oscillator',defaults:{length:14},settings:[period()]},
  {kind:'bears-power',name:'Bears Power',short:'Bears',category:'Oscillators',pane:'oscillator',defaults:{length:13},settings:[period('Period',13)]},
  {kind:'bulls-power',name:'Bulls Power',short:'Bulls',category:'Oscillators',pane:'oscillator',defaults:{length:13},settings:[period('Period',13)]},
  {kind:'cci',name:'Commodity Channel Index',short:'CCI',category:'Oscillators',pane:'oscillator',defaults:{length:20,levels:[-100,0,100]},settings:[period('Period',20)]},
  {kind:'demarker',name:'DeMarker',short:'DeM',category:'Oscillators',pane:'oscillator',defaults:{length:14,levels:[.3,.7]},settings:[period()]},
  {kind:'force-index',name:'Force Index',short:'Force',category:'Oscillators',pane:'oscillator',defaults:{length:13,maType:'ema'},settings:[period('Period',13),maSetting]},
  {kind:'macd',name:'MACD',short:'MACD',category:'Oscillators',pane:'oscillator',defaults:{fast:12,slow:26,signal:9},settings:[{key:'fast',label:'Fast EMA',type:'number',min:1,step:1},{key:'slow',label:'Slow EMA',type:'number',min:2,step:1},{key:'signal',label:'Signal',type:'number',min:1,step:1}]},
  {kind:'momentum',name:'Momentum',short:'MOM',category:'Oscillators',pane:'oscillator',defaults:{length:10,source:'close',levels:[100]},settings:[period('Period',10),sourceSetting]},
  {kind:'osma',name:'Moving Average of Oscillator',short:'OsMA',category:'Oscillators',pane:'oscillator',defaults:{fast:12,slow:26,signal:9},settings:[{key:'fast',label:'Fast EMA',type:'number',min:1,step:1},{key:'slow',label:'Slow EMA',type:'number',min:2,step:1},{key:'signal',label:'Signal',type:'number',min:1,step:1}]},
  {kind:'rsi',name:'Relative Strength Index',short:'RSI',category:'Oscillators',pane:'oscillator',defaults:{length:14,source:'close',levels:[30,50,70]},settings:[period(),sourceSetting]},
  {kind:'rvi',name:'Relative Vigor Index',short:'RVI',category:'Oscillators',pane:'oscillator',defaults:{length:10},settings:[period('Period',10)]},
  {kind:'stochastic',name:'Stochastic Oscillator',short:'Stoch',category:'Oscillators',pane:'oscillator',defaults:{k:9,kSlowing:3,d:9,maType:'sma',calculation:'lowhigh',levels:[20,50,80]},settings:[{key:'k',label:'K Periods',type:'number',min:1,step:1},{key:'kSlowing',label:'K Slowing',type:'number',min:1,step:1},{key:'d',label:'D Periods',type:'number',min:1,step:1},maSetting,{key:'calculation',label:'Calculation',type:'select',options:['lowhigh','closeclose']}]},
  {kind:'williams-r',name:"Williams' Percent Range",short:'WPR',category:'Oscillators',pane:'oscillator',defaults:{length:14,levels:[-80,-20]},settings:[period()]},

  // Volume & flow — Trade Avata native library
  {kind:'accumulation-distribution',name:'Accumulation/Distribution',short:'A/D',category:'Volumes',pane:'oscillator',defaults:{},settings:[]},
  {kind:'market-profile',name:'Volume Profile',short:'Vol Profile',category:'Volume & Flow',pane:'price',defaults:{lookback:100,bins:24,valueArea:.7},settings:[{key:'lookback',label:'Lookback',type:'number',min:10,step:1},{key:'bins',label:'Bins',type:'number',min:8,step:1},{key:'valueArea',label:'Value Area',type:'number',min:.5,max:.95,step:.01}]},
  {kind:'mfi',name:'Money Flow Index',short:'MFI',category:'Volumes',pane:'oscillator',defaults:{length:14,levels:[20,80]},settings:[period()]},
  {kind:'obv',name:'On Balance Volume',short:'OBV',category:'Volumes',pane:'oscillator',defaults:{},settings:[]},
  {kind:'volume',name:'Tick Volume',short:'VOL',category:'Volumes',pane:'oscillator',defaults:{},settings:[]},

  // Market structure & momentum — Trade Avata native library
  {kind:'accelerator',name:'Accelerator Oscillator',short:'AC',category:'Bill Williams',pane:'oscillator',defaults:{},settings:[]},
  {kind:'alligator',name:'Alligator',short:'Alligator',category:'Bill Williams',pane:'price',defaults:{jawPeriod:13,jawShift:8,teethPeriod:8,teethShift:5,lipsPeriod:5,lipsShift:3},settings:[{key:'jawPeriod',label:'Jaw Period',type:'number',min:1,step:1},{key:'jawShift',label:'Jaw Shift',type:'number',min:0,step:1},{key:'teethPeriod',label:'Teeth Period',type:'number',min:1,step:1},{key:'teethShift',label:'Teeth Shift',type:'number',min:0,step:1},{key:'lipsPeriod',label:'Lips Period',type:'number',min:1,step:1},{key:'lipsShift',label:'Lips Shift',type:'number',min:0,step:1}]},
  {kind:'awesome',name:'Awesome Oscillator',short:'AO',category:'Bill Williams',pane:'oscillator',defaults:{},settings:[]},
  {kind:'fractals',name:'Fractals',short:'Fractals',category:'Bill Williams',pane:'price',defaults:{left:2,right:2},settings:[{key:'left',label:'Left bars',type:'number',min:1,step:1},{key:'right',label:'Right bars (confirmation)',type:'number',min:1,step:1}]},
  {kind:'gator',name:'Gator Oscillator',short:'Gator',category:'Bill Williams',pane:'oscillator',defaults:{},settings:[]},
  {kind:'market-facilitation',name:'Market Facilitation Index',short:'BW MFI',category:'Bill Williams',pane:'oscillator',defaults:{},settings:[]},

  // Trade Avata extras retained
  {kind:'ema',name:'Exponential Moving Average',short:'EMA',category:'Trade Avata',pane:'price',defaults:{length:20,source:'close'},settings:[period('Period',20),sourceSetting]},
  {kind:'sma',name:'Simple Moving Average',short:'SMA',category:'Trade Avata',pane:'price',defaults:{length:20,source:'close'},settings:[period('Period',20),sourceSetting]},
  {kind:'wma',name:'Weighted Moving Average',short:'WMA',category:'Trade Avata',pane:'price',defaults:{length:20,source:'close'},settings:[period('Period',20),sourceSetting]},
  {kind:'vwap',name:'Volume Weighted Average Price',short:'VWAP',category:'Trade Avata',pane:'price',defaults:{anchor:'session',sessionStartHour:0,sessionOffsetMinutes:0},settings:[{key:'anchor',label:'Anchor',type:'select',options:['session','day','week','month','all']},{key:'sessionStartHour',label:'Session start hour',type:'number',min:0,max:23,step:1,default:0},{key:'sessionOffsetMinutes',label:'Session UTC offset (minutes)',type:'number',min:-840,max:840,step:15,default:0}]},
  {kind:'roc',name:'Rate of Change',short:'ROC',category:'Trade Avata',pane:'oscillator',defaults:{length:12,source:'close',levels:[0]},settings:[period('Period',12),sourceSetting]},
];

export function indicatorDefinition(kind){return BUILTIN_INDICATORS.find(x=>x.kind===kind)||null;}

const n=(v,d)=>Math.max(1,Math.round(Number(v)||d));
export function indicatorLabel(ind={}){
  const kind=ind.kind||'';
  if(['ema','sma','wma'].includes(kind))return `${n(ind.length,20)} ${kind.toUpperCase()}`;
  if(kind==='moving-average'){const map={sma:'SMA',ema:'EMA',wma:'WMA',wilder:'Wilder',hull:'Hull',triangular:'Triangular',dema:'DEMA',tema:'TEMA',linreg:'Linear Reg',vidya:'VIDYA',kama:'KAMA'};return `${n(ind.length,14)} ${map[String(ind.maType||'sma').toLowerCase()]||String(ind.maType||'MA').toUpperCase()}`;}
  if(kind==='stochastic')return `Stochastic (${n(ind.k,9)},${n(ind.kSlowing,3)},${n(ind.d,9)})`;
  if(kind==='macd')return `MACD (${n(ind.fast,12)},${n(ind.slow,26)},${n(ind.signal,9)})`;
  if(kind==='bollinger')return `Bollinger Bands (${n(ind.length,20)}, ${Number(ind.multiplier)||2})`;
  if(kind==='vwap')return `VWAP (${String(ind.anchor||'session')})`;
  if(kind==='ta-script')return ind.name||ind.scriptName||'TA Script';
  const d=indicatorDefinition(kind);const p=ind.length??d?.defaults?.length;return p?`${d?.short||ind.name||kind} (${n(p,p)})`:(ind.name||d?.short||'Indicator');
}

export function makeIndicator(kind,{id,name,color='#178eff',...overrides}={}){
  const d=indicatorDefinition(kind);if(!d)return null;
  const params={...d.defaults,...overrides};
  const out={id:id||`${kind}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,kind,color,visible:true,lineWidth:1.5,lineStyle:'solid',opacity:1,source:'close',pane:d.pane,...params};
  out.name=name||indicatorLabel(out);return out;
}

export function sourceValues(bars,source='close'){
  return (bars||[]).map(b=>source==='open'?Number(b.open):source==='high'?Number(b.high):source==='low'?Number(b.low):source==='hl2'?(Number(b.high)+Number(b.low))/2:source==='hlc3'?(Number(b.high)+Number(b.low)+Number(b.close))/3:source==='ohlc4'?(Number(b.open)+Number(b.high)+Number(b.low)+Number(b.close))/4:Number(b.close));
}
const nullable=a=>a.map(v=>Number.isFinite(v)?v:null);
const line=(name,values,color,extra={})=>({type:'line',name,values:nullable(values),color,...extra});
const hist=(name,values,color,extra={})=>({type:'histogram',name,values:nullable(values),color,...extra});
const dots=(name,values,color,extra={})=>({type:'points',name,values:nullable(values),color,...extra});
function placeConfirmedAtPivot(values,indexes,length){const out=Array(Math.max(0,length)).fill(NaN);for(let i=0;i<Math.min(values?.length||0,indexes?.length||0);i++){const v=values[i],idx=Math.round(Number(indexes[i]));if(Number.isFinite(v)&&Number.isFinite(idx)&&idx>=0&&idx<out.length)out[idx]=v;}return out;}

const taCompileCache=new Map();
function cachedCompile(source){
  const key=String(source||'');
  if(!taCompileCache.has(key))taCompileCache.set(key,compileTaScript(key));
  return taCompileCache.get(key);
}
function marketProfileSnapshot(bars,lookback=100,bins=24){
  const window=(bars||[]).slice(-Math.max(10,Math.round(lookback)));if(!window.length)return null;
  const lo=Math.min(...window.map(b=>Number(b.low))),hi=Math.max(...window.map(b=>Number(b.high)));if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)return null;
  const count=Math.max(8,Math.round(bins)),step=(hi-lo)/count,volumes=Array(count).fill(0);
  for(const b of window){const price=(Number(b.high)+Number(b.low)+Number(b.close))/3,idx=Math.min(count-1,Math.max(0,Math.floor((price-lo)/step)));volumes[idx]+=Math.max(0,Number(b.volume??b.tickVolume??0));}
  const maxVolume=Math.max(0,...volumes);
  return{low:lo,high:hi,maxVolume,bins:volumes.map((volume,i)=>({low:lo+i*step,high:lo+(i+1)*step,volume}))};
}

function computeTaScript(ind,bars,context={}){
  const palette=Array.isArray(ind.plotColors)?ind.plotColors:[];
  if(ind.securePrivate){
    const key=`${ind.programId||ind.id}::${context.privateResultKey||'default'}`;
    const cached=globalThis.TRADE_AVATA_PRIVATE_RESULTS?.get?.(key);
    if(!cached)return{pane:ind.pane||'price',kind:'ta-script',series:[],locked:false,loading:true,error:'Secure indicator is waiting for the Trade Avata server result.'};
    const result=cached.result||cached;
    return{pane:cached.overlay===false?'oscillator':(ind.pane||'price'),kind:'ta-script',descriptor:cached.descriptor||null,series:(result.plots||[]).map((p,i)=>line(p.name,p.values,palette[i]||ind.color||'#178eff')),markers:result.markers||[],signals:result.signals||[],alerts:result.alerts||[],orderIntents:result.orderIntents||[],scriptResult:result,securePrivate:true};
  }
  const sourceCode=ind.sourceCode||'';
  if(!sourceCode)return{pane:ind.pane||'price',kind:'ta-script',series:[],locked:true,error:'TA Script source is not available.'};
  try{
    const compiled=cachedCompile(sourceCode);
    // Keep TA Script out of the per-tick hot path. Initial/history builds may use
    // a larger bounded window, while live tick refreshes use only the most recent
    // 5,000 bars. Recursive indicators have ample warm-up while execution time
    // stays bounded even when the chart has very deep history loaded.
    const maxBars=context.liveRefresh===true?5000:20000;
    const offset=Math.max(0,(bars?.length||0)-maxBars);
    const executionBars=offset?bars.slice(offset):bars;
    const result=compiled.run(executionBars,{inputs:ind.inputs||{},hasLiveBar:context.hasLiveBar!==false,pipSize:context.pipSize||.01,authorization:context.authorization||null,enforceAccess:context.enforceAccess!==false});
    const shiftIndex=x=>{if(!x||!offset)return x;const y={...x};for(const k of ['index','confirmedAt','anchorIndex','exitIndex'])if(Number.isFinite(Number(y[k])))y[k]=Number(y[k])+offset;return y;};
    const padValues=values=>offset?[...Array(offset).fill(NaN),...(values||[])]:values;
    const normalized={...result,plots:(result.plots||[]).map(p=>({...p,values:padValues(p.values)})),markers:(result.markers||[]).map(shiftIndex),signals:(result.signals||[]).map(shiftIndex),alerts:(result.alerts||[]).map(shiftIndex),orderIntents:(result.orderIntents||[]).map(shiftIndex)};
    return{pane:compiled.descriptor.overlay===false?'oscillator':'price',kind:'ta-script',descriptor:compiled.descriptor,series:normalized.plots.map((p,i)=>line(p.name,p.values,palette[i]||ind.color||'#178eff')),markers:normalized.markers,signals:normalized.signals,alerts:normalized.alerts,orderIntents:normalized.orderIntents,scriptResult:normalized,execution:{offset,maxBars,mode:context.liveRefresh===true?'bounded-live':'bounded-history'}};
  }catch(error){return{pane:ind.pane||'price',kind:'ta-script',series:[],locked:/access denied/i.test(String(error?.message)),error:error?.message||String(error)};}
}

export function computeIndicator(ind,bars,context={}){
  if(ind.kind==='ta-script')return computeTaScript(ind,bars,context);
  const closes=bars.map(b=>Number(b.close)),volumes=bars.map(b=>Number(b.volume??b.tickVolume??0)),source=sourceValues(bars,ind.source||'close');
  const base={pane:ind.pane||indicatorDefinition(ind.kind)?.pane||'price',kind:ind.kind};
  switch(ind.kind){
    case 'ema':return{...base,series:[line(ind.name||'EMA',ema(source,ind.length||20),ind.color)]};
    case 'sma':return{...base,series:[line(ind.name||'SMA',sma(source,ind.length||20),ind.color)]};
    case 'wma':return{...base,series:[line(ind.name||'WMA',wma(source,ind.length||20),ind.color)]};
    case 'moving-average':return{...base,series:[line(ind.name||'MA',movingAverage(source,ind.length||14,ind.maType||'sma'),ind.color)]};
    case 'bollinger':{const x=bollinger(source,ind.length||20,ind.multiplier||2,ind.maType||'sma');return{...base,series:[line('BB Upper',x.upper,ind.color),line('BB Basis',x.mid,ind.basisColor||'#94a3b8'),line('BB Lower',x.lower,ind.color)]};}
    case 'envelopes':{const x=envelopes(source,ind.length||14,ind.deviation??.1,ind.maType||'sma');return{...base,series:[line('Upper',x.upper,ind.color),line('MA',x.mid,ind.basisColor||'#94a3b8'),line('Lower',x.lower,ind.color)]};}
    case 'ichimoku':{const x=ichimoku(bars,ind.tenkan||9,ind.kijun||26,ind.senkouB||52,ind.displacement??26);return{...base,series:[line('Tenkan-sen',x.tenkan,ind.tenkanColor||ind.color),line('Kijun-sen',x.kijun,ind.kijunColor||'#f59e0b'),line('Senkou A',x.spanA,ind.spanAColor||'#22c55e'),line('Senkou B',x.spanB,ind.spanBColor||'#ef4444'),line('Chikou',x.chikou,ind.chikouColor||'#a855f7')]};}
    case 'parabolic-sar':return{...base,series:[dots('Parabolic SAR',parabolicSar(bars,ind.step??.02,ind.maxStep??.2),ind.color,{pointRadius:2})]};
    case 'standard-deviation':return{...base,series:[line(ind.name||'StdDev',stdev(source,ind.length||20),ind.color)]};
    case 'zigzag':{const x=zigzag(bars,ind.depth||12,ind.deviation||0,ind.backstep||3);return{...base,series:[line('ZigZag',x.displayLine||x.line,ind.color,{connectGaps:true})]};}
    case 'vwap':return{...base,series:[line(ind.name||'VWAP',vwap(bars,ind.anchor||'session',ind.sessionOffsetMinutes??0,ind.sessionStartHour??0),ind.color)]};
    case 'rsi':return{...base,range:{min:0,max:100},guides:ind.levels||[30,50,70],series:[line(ind.name||'RSI',rsi(source,ind.length||14),ind.color)]};
    case 'macd':{const x=macd(source,ind.fast||12,ind.slow||26,ind.signal||9);return{...base,series:[line('MACD',x.line,ind.color),line('Signal',x.signal,ind.signalColor||'#f3a000'),hist('Histogram',x.hist,ind.histColor||'#64748b')]};}
    case 'stochastic':{const x=stochasticCore(bars,ind.k||9,ind.kSlowing||3,ind.d||9,ind.maType||'sma',ind.calculation||'lowhigh');return{...base,range:{min:0,max:100},guides:ind.levels||[20,50,80],series:[line('%K',x.k,ind.color),line('%D',x.d,ind.signalColor||'#f3a000')]};}
    case 'atr':return{...base,series:[line(ind.name||'ATR',atr(bars,ind.length||14),ind.color)]};
    case 'adx':{const x=directionalMovement(bars,ind.length||14);return{...base,range:{min:0,max:100},guides:ind.levels||[20,25,50],series:[line(ind.name||'ADX',x.adx,ind.color),line('+DI',x.plusDI,ind.plusColor||'#22c55e'),line('-DI',x.minusDI,ind.minusColor||'#ef4444')]};}
    case 'cci':return{...base,guides:ind.levels||[-100,0,100],series:[line(ind.name||'CCI',cci(bars,ind.length||20),ind.color)]};
    case 'momentum':return{...base,guides:ind.levels||[100],series:[line(ind.name||'Momentum',momentum(source,ind.length||10),ind.color)]};
    case 'roc':return{...base,guides:ind.levels||[0],series:[line(ind.name||'ROC',roc(source,ind.length||12),ind.color)]};
    case 'bears-power':return{...base,guides:[0],series:[hist('Bears Power',bearsPower(bars,ind.length||13),ind.color)]};
    case 'bulls-power':return{...base,guides:[0],series:[hist('Bulls Power',bullsPower(bars,ind.length||13),ind.color)]};
    case 'demarker':return{...base,range:{min:0,max:1},guides:ind.levels||[.3,.7],series:[line('DeMarker',demarker(bars,ind.length||14),ind.color)]};
    case 'force-index':return{...base,guides:[0],series:[line('Force Index',forceIndex(bars,ind.length||13,ind.maType||'ema'),ind.color)]};
    case 'osma':{const x=macd(source,ind.fast||12,ind.slow||26,ind.signal||9);return{...base,guides:[0],series:[hist('OsMA',x.hist,ind.color)]};}
    case 'rvi':{const x=relativeVigorIndex(bars,ind.length||10);return{...base,guides:[0],series:[line('RVI',x.line,ind.color),line('Signal',x.signal,ind.signalColor||'#f3a000')]};}
    case 'williams-r':return{...base,range:{min:-100,max:0},guides:ind.levels||[-80,-20],series:[line('%R',williamsR(bars,ind.length||14),ind.color)]};
    case 'accumulation-distribution':return{...base,series:[line('A/D',accumulationDistribution(bars),ind.color)]};
    case 'mfi':return{...base,range:{min:0,max:100},guides:ind.levels||[20,80],series:[line('MFI',moneyFlowIndex(bars,ind.length||14),ind.color)]};
    case 'obv':return{...base,series:[line('OBV',obv(bars),ind.color)]};
    case 'market-profile':{const x=marketProfile(bars,ind.lookback||100,ind.bins||24,ind.valueArea??.7),profileHistogram=marketProfileSnapshot(bars,ind.lookback||100,ind.bins||24);return{...base,profile:{lookback:ind.lookback||100,bins:ind.bins||24,valueArea:ind.valueArea??.7},profileHistogram,series:[line('POC',x.poc,ind.color),line('VAH',x.vah,ind.vahColor||'#22c55e'),line('VAL',x.val,ind.valColor||'#ef4444')]};}
    case 'volume':return{...base,series:[hist(ind.name||'Tick Volume',volumes,ind.color)]};
    case 'accelerator':return{...base,guides:[0],series:[hist('Accelerator',acceleratorOscillator(bars),ind.color)]};
    case 'alligator':{const x=alligator(bars,ind.jawPeriod||13,ind.jawShift??8,ind.teethPeriod||8,ind.teethShift??5,ind.lipsPeriod||5,ind.lipsShift??3);return{...base,series:[line('Jaw',x.jaw,ind.jawColor||'#3b82f6'),line('Teeth',x.teeth,ind.teethColor||'#ef4444'),line('Lips',x.lips,ind.lipsColor||'#22c55e')]};}
    case 'awesome':return{...base,guides:[0],series:[hist('Awesome Oscillator',awesomeOscillator(bars),ind.color)]};
    case 'fractals':{const x=fractals(bars,ind.left||2,ind.right||2),up=placeConfirmedAtPivot(x.up,x.upIndex,bars.length),down=placeConfirmedAtPivot(x.down,x.downIndex,bars.length);return{...base,series:[dots('Fractal Up',up,ind.upColor||'#ef4444',{pointRadius:3}),dots('Fractal Down',down,ind.downColor||'#22c55e',{pointRadius:3})]};}
    case 'gator':{const x=gator(bars);return{...base,guides:[0],series:[hist('Gator Upper',x.upper,ind.color),hist('Gator Lower',x.lower,ind.signalColor||'#ef4444')]};}
    case 'market-facilitation':return{...base,series:[hist('Market Facilitation Index',marketFacilitationIndex(bars),ind.color)]};
    default:return{...base,series:[]};
  }
}

export function valuesToData(bars,values,maxIndex=null){
  // Keep one logical slot per bar, including warm-up gaps. Future-shifted
  // Trade Avata indicators (Ichimoku/Alligator) may extend into the chart's
  // right-side future space without changing the underlying market-bar array.
  const sourceBars=Array.isArray(bars)?bars:[],requested=maxIndex==null?Math.max(sourceBars.length,values?.length||0):Math.min(sourceBars.length,maxIndex+1),out=new Array(requested);
  let step=60;if(sourceBars.length>1){const a=Number(sourceBars.at(-1)?.time),b=Number(sourceBars.at(-2)?.time),d=a-b;if(Number.isFinite(d)&&d>0)step=d;}
  const lastTime=Number(sourceBars.at(-1)?.time)||0;
  for(let i=0;i<requested;i++){
    const time=i<sourceBars.length?sourceBars[i].time:lastTime+step*(i-sourceBars.length+1),v=values?.[i];out[i]={time,value:Number.isFinite(v)?v:NaN};
  }
  return out;
}

// Backward-compatible named math exports used by tests and older modules.
export {sma,ema,wma,wilder,dema,tema,triangular,hull,timeSeriesMa as linearRegressionMA,movingAverage,bollinger,vwap,rsi,macd,atr,adx,cci,momentum,roc,stdev};
export function cciFromSource(values,length=20){
  const ma=sma(values,length),out=new Array(values.length).fill(null);
  for(let i=length-1;i<values.length;i++){let md=0,ok=true;for(let j=i-length+1;j<=i;j++){if(!Number.isFinite(values[j])||!Number.isFinite(ma[i])){ok=false;break;}md+=Math.abs(values[j]-ma[i]);}if(ok){md/=length;out[i]=md===0?0:(values[i]-ma[i])/(.015*md);}}return out;
}
export function trueRange(bars){return bars.map((b,i)=>i===0?b.high-b.low:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)));}

export function stochastic(highs,lows,closes,kLen=14,dLen=3,kSlowing=1,maType='sma',calculation='lowhigh'){
  const bars=closes.map((close,i)=>({open:close,high:Number(highs[i]),low:Number(lows[i]),close:Number(close),volume:0,time:i}));
  const x=stochasticCore(bars,kLen,kSlowing,dLen,maType,calculation);
  const clean=a=>a.map(v=>Number.isFinite(v)?v:null);
  return{raw:clean(x.rawK),k:clean(x.k),d:clean(x.d)};
}
