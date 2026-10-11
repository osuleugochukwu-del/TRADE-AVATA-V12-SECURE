const scalar=value=>({kind:'scalar',value});
const series=value=>({kind:'series',value});
const object=value=>({kind:'object',value});
const isSeries=v=>v?.kind==='series';
const isObject=v=>v?.kind==='object';
const finite=Number.isFinite;
const EPS=1e-12;

const unwrap=(v,i)=>isSeries(v)?v.value[i]:v?.value;
const mapUnary=(v,fn)=>isSeries(v)?series(v.value.map(fn)):scalar(fn(v.value));
const mapBinary=(a,b,fn,n)=>{
  if(!isSeries(a)&&!isSeries(b))return scalar(fn(a.value,b.value));
  const out=new Array(n); for(let i=0;i<n;i++)out[i]=fn(unwrap(a,i),unwrap(b,i)); return series(out);
};
const toBool=v=>!!v;
const makeNaN=n=>Array(n).fill(NaN);

function sma(values,period){
  const n=values.length,out=makeNaN(n);period=Math.max(1,Math.round(period));let sum=0,invalid=0;const q=[];
  for(let i=0;i<n;i++){const v=values[i];q.push(v);if(finite(v))sum+=v;else invalid++;if(q.length>period){const x=q.shift();if(finite(x))sum-=x;else invalid--;}if(q.length===period&&invalid===0)out[i]=sum/period;}return out;
}
function ema(values,period){
  const n=values.length,out=makeNaN(n);period=Math.max(1,Math.round(period));const alpha=2/(period+1);let seed=[],prev=NaN;
  for(let i=0;i<n;i++){const v=values[i];if(!finite(v))continue;if(!finite(prev)){seed.push(v);if(seed.length===period){prev=seed.reduce((a,b)=>a+b,0)/period;out[i]=prev;}}else{prev=alpha*v+(1-alpha)*prev;out[i]=prev;}}return out;
}
function wilder(values,period){
  const n=values.length,out=makeNaN(n);period=Math.max(1,Math.round(period));const alpha=1/period;let seed=[],prev=NaN;
  for(let i=0;i<n;i++){const v=values[i];if(!finite(v))continue;if(!finite(prev)){seed.push(v);if(seed.length===period){prev=seed.reduce((a,b)=>a+b,0)/period;out[i]=prev;}}else{prev=alpha*v+(1-alpha)*prev;out[i]=prev;}}return out;
}
function wma(values,period){period=Math.max(1,Math.round(period));const n=values.length,out=makeNaN(n),den=period*(period+1)/2;for(let i=period-1;i<n;i++){let sum=0,ok=true;for(let j=0;j<period;j++){const v=values[i-period+1+j];if(!finite(v)){ok=false;break;}sum+=v*(j+1);}if(ok)out[i]=sum/den;}return out;}
function timeSeriesMa(values,period){period=Math.max(1,Math.round(period));const n=values.length,out=makeNaN(n),sx=period*(period-1)/2,sxx=(period-1)*period*(2*period-1)/6,den=period*sxx-sx*sx;for(let i=period-1;i<n;i++){let sy=0,sxy=0,ok=true;for(let j=0;j<period;j++){const y=values[i-period+1+j];if(!finite(y)){ok=false;break;}sy+=y;sxy+=j*y;}if(!ok)continue;const slope=Math.abs(den)<EPS?0:(period*sxy-sx*sy)/den,intercept=(sy-slope*sx)/period;out[i]=intercept+slope*(period-1);}return out;}
function triangular(values,period){return sma(sma(values,period),period);}
function hull(values,period){period=Math.max(1,Math.round(period));const half=Math.max(1,Math.floor(period/2)),root=Math.max(1,Math.floor(Math.sqrt(period))),a=wma(values,half),b=wma(values,period),d=values.map((_,i)=>finite(a[i])&&finite(b[i])?2*a[i]-b[i]:NaN);return wma(d,root);}
function dema(values,period){const e1=ema(values,period),e2=ema(e1,period);return values.map((_,i)=>finite(e1[i])&&finite(e2[i])?2*e1[i]-e2[i]:NaN);}
function tema(values,period){const e1=ema(values,period),e2=ema(e1,period),e3=ema(e2,period);return values.map((_,i)=>finite(e1[i])&&finite(e2[i])&&finite(e3[i])?3*e1[i]-3*e2[i]+e3[i]:NaN);}
function vidya(values,period,sigma=.65){period=Math.max(1,Math.round(period));const n=values.length,out=makeNaN(n);for(let i=period;i<n;i++){const cur=values[i];if(!finite(cur))continue;let up=0,down=0,valid=true;for(let j=0;j<period;j++){const a=values[i-j],b=values[i-j-1];if(!finite(a)||!finite(b)){valid=false;break;}const d=a-b;if(d>0)up+=d;else down+=-d;}if(!valid)continue;const den=up+down,cmo=den<=EPS?0:Math.abs((up-down)/den),k=sigma*cmo;let prev=out[i-1];if(!finite(prev))prev=values[i-1];if(finite(prev))out[i]=(1-k)*prev+k*cur;}return out;}
function kama(values,period,fastPeriods=2,slowPeriods=30){period=Math.max(1,Math.round(period));const n=values.length,out=makeNaN(n),fast=2/(fastPeriods+1),slow=2/(slowPeriods+1);for(let i=period;i<n;i++){if(!finite(values[i])||!finite(values[i-period]))continue;const change=Math.abs(values[i]-values[i-period]);let vol=0,ok=true;for(let j=i-period+1;j<=i;j++){if(!finite(values[j])||!finite(values[j-1])){ok=false;break;}vol+=Math.abs(values[j]-values[j-1]);}if(!ok)continue;const er=vol<=EPS?0:change/vol,sc=Math.pow(er*(fast-slow)+slow,2);let prev=out[i-1];if(!finite(prev))prev=values[i-1];if(finite(prev))out[i]=prev+sc*(values[i]-prev);}return out;}
function movingAverage(values,period,type='sma'){
  switch(String(type).toLowerCase().replace(/[_\s-]/g,'')){
    case 'ema':case 'exponential':return ema(values,period);
    case 'timeseries':case 'linreg':return timeSeriesMa(values,period);
    case 'triangular':case 'tma':return triangular(values,period);
    case 'vidya':return vidya(values,period);
    case 'wma':case 'weighted':return wma(values,period);
    case 'wilder':case 'wildersmoothing':return wilder(values,period);
    case 'hull':case 'hma':return hull(values,period);
    case 'dema':case 'doubleexponential':return dema(values,period);
    case 'tema':case 'tripleexponential':return tema(values,period);
    case 'kama':case 'kaufmanadaptive':return kama(values,period);
    default:return sma(values,period);
  }
}
function rsi(values,period){period=Math.max(1,Math.round(period));const n=values.length,out=makeNaN(n);if(n<2)return out;let gs=0,ls=0;for(let i=1;i<=period&&i<n;i++){const ch=values[i]-values[i-1];gs+=Math.max(0,ch);ls+=Math.max(0,-ch);}if(n<=period)return out;let ag=gs/period,al=ls/period;const value=()=>ag<=EPS&&al<=EPS?50:al<=EPS?100:ag<=EPS?0:100-100/(1+ag/al);out[period]=value();for(let i=period+1;i<n;i++){const ch=values[i]-values[i-1],g=Math.max(0,ch),l=Math.max(0,-ch);ag=((period-1)*ag+g)/period;al=((period-1)*al+l)/period;out[i]=value();}return out;}
function stochastic(bars,kPeriod,kSlowing,dPeriod,maType='sma',calculationType='lowhigh'){
  kPeriod=Math.max(1,Math.round(kPeriod));const n=bars.length,rawK=makeNaN(n),closeClose=String(calculationType).toLowerCase().replace(/[_\s-]/g,'')==='closeclose';
  for(let i=kPeriod-1;i<n;i++){let lo=Infinity,hi=-Infinity;for(let j=i-kPeriod+1;j<=i;j++){const lowSource=closeClose?bars[j].close:bars[j].low,highSource=closeClose?bars[j].close:bars[j].high;lo=Math.min(lo,lowSource);hi=Math.max(hi,highSource);}if(Math.abs(hi-lo)<=EPS){const prev=i>0?rawK[i-1]:NaN;rawK[i]=finite(prev)?prev:50;}else rawK[i]=Math.max(0,Math.min(100,100*(bars[i].close-lo)/(hi-lo)));}
  const k=movingAverage(rawK,kSlowing,maType),d=movingAverage(k,dPeriod,maType);return{rawK,k,d};
}
function atr(bars,period){const tr=makeNaN(bars.length);for(let i=0;i<bars.length;i++)tr[i]=i===0?bars[i].high-bars[i].low:Math.max(bars[i].high-bars[i].low,Math.abs(bars[i].high-bars[i-1].close),Math.abs(bars[i].low-bars[i-1].close));return wilder(tr,period);}
function rolling(a,n,fn){n=Math.max(1,Math.round(n));const out=makeNaN(a.length);for(let i=n-1;i<a.length;i++){const w=a.slice(i-n+1,i+1);if(w.every(finite))out[i]=fn(w);}return out;}
function stdev(a,n){return rolling(a,n,w=>{const m=w.reduce((x,y)=>x+y,0)/w.length;return Math.sqrt(w.reduce((s,x)=>s+(x-m)**2,0)/w.length);});}
function bollinger(a,n,m=2,maType='sma'){const mid=movingAverage(a,n,maType),sd=stdev(a,n);return{mid,upper:mid.map((v,i)=>finite(v)&&finite(sd[i])?v+m*sd[i]:NaN),lower:mid.map((v,i)=>finite(v)&&finite(sd[i])?v-m*sd[i]:NaN)};}
function vwap(bars,anchor='session',sessionOffsetMinutes=0,sessionStartHour=0){let pv=0,v=0,lastKey=null;const mode=String(anchor||'session').toLowerCase(),offset=Math.max(-840,Math.min(840,Number(sessionOffsetMinutes)||0)),startHour=Math.max(0,Math.min(23,Math.floor(Number(sessionStartHour)||0)));return bars.map(b=>{let t=Number(b.time);if(t>1e12)t=Math.floor(t/1000);let ms=Number.isFinite(t)?t*1000:NaN;if(mode==='session'&&Number.isFinite(ms))ms+=offset*60000-startHour*3600000;const d=Number.isFinite(ms)?new Date(ms):null;let key='all';if(mode==='session'||mode==='day')key=d?`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`:'all';else if(mode==='week'&&d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-day);key=x.toISOString().slice(0,10);}else if(mode==='month'&&d)key=`${d.getUTCFullYear()}-${d.getUTCMonth()}`;if(key!==lastKey){pv=0;v=0;lastKey=key;}const vol=Math.max(0,Number(b.volume)||0),tp=(Number(b.high)+Number(b.low)+Number(b.close))/3;if(vol>0){pv+=tp*vol;v+=vol;}return v>0?pv/v:NaN;});}
function macd(a,fast=12,slow=26,signalPeriod=9){const f=ema(a,fast),s=ema(a,slow),line=a.map((_,i)=>finite(f[i])&&finite(s[i])?f[i]-s[i]:NaN),sig=ema(line,signalPeriod),hist=line.map((v,i)=>finite(v)&&finite(sig[i])?v-sig[i]:NaN);return{line,signal:sig,hist};}
function cci(bars,n=20){const tp=bars.map(b=>(b.high+b.low+b.close)/3),ma=sma(tp,n),out=makeNaN(tp.length);for(let i=n-1;i<tp.length;i++){if(!finite(ma[i]))continue;let md=0,ok=true;for(let j=i-n+1;j<=i;j++){if(!finite(tp[j])){ok=false;break;}md+=Math.abs(tp[j]-ma[i]);}if(ok){md/=n;out[i]=md===0?0:(tp[i]-ma[i])/(.015*md);}}return out;}
function momentum(a,n=10){const out=makeNaN(a.length);for(let i=n;i<a.length;i++)out[i]=a[i-n]===0?NaN:a[i]/a[i-n]*100;return out;}
function roc(a,n=12){const out=makeNaN(a.length);for(let i=n;i<a.length;i++)out[i]=a[i-n]===0?NaN:(a[i]-a[i-n])/a[i-n]*100;return out;}
function directionalMovement(bars,n=14){
  const tr=Array(bars.length).fill(0),plus=Array(bars.length).fill(0),minus=Array(bars.length).fill(0);
  if(bars.length)tr[0]=bars[0].high-bars[0].low;
  for(let i=1;i<bars.length;i++){
    const up=bars[i].high-bars[i-1].high,down=bars[i-1].low-bars[i].low;
    plus[i]=up>down&&up>0?up:0;minus[i]=down>up&&down>0?down:0;
    tr[i]=Math.max(bars[i].high-bars[i].low,Math.abs(bars[i].high-bars[i-1].close),Math.abs(bars[i].low-bars[i-1].close));
  }
  const av=wilder(tr,n),p=wilder(plus,n),m=wilder(minus,n),plusDI=makeNaN(bars.length),minusDI=makeNaN(bars.length),dx=makeNaN(bars.length);
  for(let i=0;i<bars.length;i++){
    if(!finite(av[i]))continue;
    if(Math.abs(av[i])<=EPS){plusDI[i]=0;minusDI[i]=0;dx[i]=0;continue;}
    plusDI[i]=100*p[i]/av[i];minusDI[i]=100*m[i]/av[i];const den=plusDI[i]+minusDI[i];dx[i]=den?100*Math.abs(plusDI[i]-minusDI[i])/den:0;
  }
  return{adx:wilder(dx,n),plusDI,minusDI,dx};
}
function adx(bars,n=14){return directionalMovement(bars,n).adx;}
function cross(a,b,dir){const n=Math.max(a.length,b.length),out=Array(n).fill(false);for(let i=1;i<n;i++){const ap=a[i-1],bp=b[i-1],ac=a[i],bc=b[i];if([ap,bp,ac,bc].every(finite))out[i]=dir==='up'?ap<=bp&&ac>bc:ap>=bp&&ac<bc;}return out;}

function shiftSeries(values,shift,{extendFuture=false}={}){
  shift=Math.trunc(Number(shift)||0);const extra=extendFuture&&shift>0?shift:0,out=makeNaN(values.length+extra);
  for(let i=0;i<values.length;i++){const j=i+shift;if(j>=0&&j<out.length)out[j]=values[i];}
  return out;
}
function envelopes(a,period=14,deviationPct=.1,maType='sma'){
  const mid=movingAverage(a,period,maType),d=Math.abs(Number(deviationPct)||0)/100;
  return{mid,upper:mid.map(v=>finite(v)?v*(1+d):NaN),lower:mid.map(v=>finite(v)?v*(1-d):NaN)};
}
function ichimoku(bars,tenkanPeriod=9,kijunPeriod=26,senkouBPeriod=52,displacement=26){
  const highs=bars.map(b=>b.high),lows=bars.map(b=>b.low),mid=(p)=>{const hi=rolling(highs,p,w=>Math.max(...w)),lo=rolling(lows,p,w=>Math.min(...w));return hi.map((v,i)=>finite(v)&&finite(lo[i])?(v+lo[i])/2:NaN);};
  const tenkan=mid(tenkanPeriod),kijun=mid(kijunPeriod),spanBBase=mid(senkouBPeriod),spanABase=tenkan.map((v,i)=>finite(v)&&finite(kijun[i])?(v+kijun[i])/2:NaN);
  return{tenkan,kijun,spanA:shiftSeries(spanABase,displacement,{extendFuture:true}),spanB:shiftSeries(spanBBase,displacement,{extendFuture:true}),chikou:shiftSeries(bars.map(b=>b.close),-displacement)};
}
function parabolicSar(bars,step=.02,maxStep=.2){
  const n=bars.length,out=makeNaN(n);if(!n)return out;step=Math.max(.0001,Number(step)||.02);maxStep=Math.max(step,Number(maxStep)||.2);
  let up=n<2?true:bars[1].close>=bars[0].close,af=step,ep=up?bars[0].high:bars[0].low,sar=up?bars[0].low:bars[0].high;out[0]=sar;
  for(let i=1;i<n;i++){
    sar=sar+af*(ep-sar);
    if(up){
      if(i>=2)sar=Math.min(sar,bars[i-1].low,bars[i-2].low);else sar=Math.min(sar,bars[i-1].low);
      if(bars[i].low<sar){up=false;sar=ep;ep=bars[i].low;af=step;}
      else if(bars[i].high>ep){ep=bars[i].high;af=Math.min(maxStep,af+step);}
    }else{
      if(i>=2)sar=Math.max(sar,bars[i-1].high,bars[i-2].high);else sar=Math.max(sar,bars[i-1].high);
      if(bars[i].high>sar){up=true;sar=ep;ep=bars[i].high;af=step;}
      else if(bars[i].low<ep){ep=bars[i].low;af=Math.min(maxStep,af+step);}
    }
    out[i]=sar;
  }
  return out;
}
function bullsPower(bars,period=13){const base=ema(bars.map(b=>b.close),period);return bars.map((b,i)=>finite(base[i])?b.high-base[i]:NaN);}
function bearsPower(bars,period=13){const base=ema(bars.map(b=>b.close),period);return bars.map((b,i)=>finite(base[i])?b.low-base[i]:NaN);}
function demarker(bars,period=14){
  const up=makeNaN(bars.length).fill(0),down=makeNaN(bars.length).fill(0);up[0]=down[0]=0;
  for(let i=1;i<bars.length;i++){up[i]=Math.max(bars[i].high-bars[i-1].high,0);down[i]=Math.max(bars[i-1].low-bars[i].low,0);}
  const a=sma(up,period),b=sma(down,period);return a.map((v,i)=>{if(!finite(v)||!finite(b[i]))return NaN;const den=v+b[i];return den>EPS?v/den:.5;});
}
function forceIndex(bars,period=13,maType='ema'){
  const raw=makeNaN(bars.length);for(let i=1;i<bars.length;i++)raw[i]=(bars[i].close-bars[i-1].close)*(Number(bars[i].volume)||0);return movingAverage(raw,period,maType);
}
function williamsR(bars,period=14){
  const highs=bars.map(b=>b.high),lows=bars.map(b=>b.low),hh=rolling(highs,period,w=>Math.max(...w)),ll=rolling(lows,period,w=>Math.min(...w));
  return bars.map((b,i)=>finite(hh[i])&&finite(ll[i])&&Math.abs(hh[i]-ll[i])>EPS?-100*(hh[i]-b.close)/(hh[i]-ll[i]):NaN);
}
function accumulationDistribution(bars){let acc=0;return bars.map(b=>{const range=b.high-b.low,clv=Math.abs(range)<=EPS?0:((b.close-b.low)-(b.high-b.close))/range;acc+=clv*(Number(b.volume)||0);return acc;});}
function moneyFlowIndex(bars,period=14){
  const tp=bars.map(b=>(b.high+b.low+b.close)/3),pos=Array(bars.length).fill(0),neg=Array(bars.length).fill(0),out=makeNaN(bars.length);
  for(let i=1;i<bars.length;i++){const flow=tp[i]*(Number(bars[i].volume)||0);if(tp[i]>tp[i-1])pos[i]=flow;else if(tp[i]<tp[i-1])neg[i]=flow;}
  for(let i=period;i<bars.length;i++){let p=0,m=0;for(let j=i-period+1;j<=i;j++){p+=pos[j];m+=neg[j];}out[i]=m<=EPS?(p>0?100:50):100-100/(1+p/m);}return out;
}
function obv(bars){let acc=0;return bars.map((b,i)=>{if(i){const v=Number(b.volume)||0;if(b.close>bars[i-1].close)acc+=v;else if(b.close<bars[i-1].close)acc-=v;}return acc;});}
function awesomeOscillator(bars){const mid=bars.map(b=>(b.high+b.low)/2),a=sma(mid,5),b=sma(mid,34);return mid.map((_,i)=>finite(a[i])&&finite(b[i])?a[i]-b[i]:NaN);}
function acceleratorOscillator(bars){const ao=awesomeOscillator(bars),sig=sma(ao,5);return ao.map((v,i)=>finite(v)&&finite(sig[i])?v-sig[i]:NaN);}
function alligator(bars,jawPeriod=13,jawShift=8,teethPeriod=8,teethShift=5,lipsPeriod=5,lipsShift=3){
  const mid=bars.map(b=>(b.high+b.low)/2);return{jaw:shiftSeries(wilder(mid,jawPeriod),jawShift,{extendFuture:true}),teeth:shiftSeries(wilder(mid,teethPeriod),teethShift,{extendFuture:true}),lips:shiftSeries(wilder(mid,lipsPeriod),lipsShift,{extendFuture:true})};
}
function gator(bars){const a=alligator(bars),upper=a.jaw.map((v,i)=>finite(v)&&finite(a.teeth[i])?Math.abs(v-a.teeth[i]):NaN),lower=a.teeth.map((v,i)=>finite(v)&&finite(a.lips[i])?-Math.abs(v-a.lips[i]):NaN);return{upper,lower};}
function marketFacilitationIndex(bars){return bars.map(b=>{const v=Number(b.volume)||0;return v>0?(b.high-b.low)/v:NaN;});}
function relativeVigorIndex(bars,period=10){
  const n=bars.length,num=makeNaN(n),den=makeNaN(n);for(let i=3;i<n;i++){num[i]=((bars[i].close-bars[i].open)+2*(bars[i-1].close-bars[i-1].open)+2*(bars[i-2].close-bars[i-2].open)+(bars[i-3].close-bars[i-3].open))/6;den[i]=((bars[i].high-bars[i].low)+2*(bars[i-1].high-bars[i-1].low)+2*(bars[i-2].high-bars[i-2].low)+(bars[i-3].high-bars[i-3].low))/6;}
  const sn=sma(num,period),sd=sma(den,period),line=sn.map((v,i)=>finite(v)&&finite(sd[i])&&Math.abs(sd[i])>EPS?v/sd[i]:NaN),signal=makeNaN(n);for(let i=3;i<n;i++)if([line[i],line[i-1],line[i-2],line[i-3]].every(finite))signal[i]=(line[i]+2*line[i-1]+2*line[i-2]+line[i-3])/6;return{line,signal};
}
function marketProfile(bars,lookback=100,bins=24,valueArea=.70){
  lookback=Math.max(10,Math.round(lookback));bins=Math.max(8,Math.round(bins));valueArea=Math.min(.95,Math.max(.5,Number(valueArea)||.7));const n=bars.length,poc=makeNaN(n),vah=makeNaN(n),val=makeNaN(n);
  for(let i=lookback-1;i<n;i++){
    const w=bars.slice(i-lookback+1,i+1),lo=Math.min(...w.map(b=>b.low)),hi=Math.max(...w.map(b=>b.high));if(!(hi>lo))continue;const step=(hi-lo)/bins,hist=Array(bins).fill(0);
    for(const b of w){const price=(b.high+b.low+b.close)/3,idx=Math.min(bins-1,Math.max(0,Math.floor((price-lo)/step))),v=Math.max(0,Number(b.volume)||0);hist[idx]+=v;}
    let p=0;for(let j=1;j<bins;j++)if(hist[j]>hist[p])p=j;poc[i]=lo+(p+.5)*step;const total=hist.reduce((a,b)=>a+b,0),target=total*valueArea;let included=hist[p],l=p,h=p;while(included<target&&(l>0||h<bins-1)){const lv=l>0?hist[l-1]:-1,hv=h<bins-1?hist[h+1]:-1;if(hv>=lv){h++;included+=hist[h];}else{l--;included+=hist[l];}}val[i]=lo+l*step;vah[i]=lo+(h+1)*step;
  }return{poc,vah,val};
}
function pivotStructure(bars,left=3,right=3){
  left=Math.max(1,Math.round(left));right=Math.max(1,Math.round(right));const n=bars.length;
  const sh=makeNaN(n),sl=makeNaN(n),shi=makeNaN(n),sli=makeNaN(n),hh=Array(n).fill(false),lh=Array(n).fill(false),hl=Array(n).fill(false),ll=Array(n).fill(false);
  let prevHigh=NaN,prevLow=NaN;
  for(let p=left;p<n-right;p++){
    let isH=true,isL=true;for(let j=p-left;j<=p+right;j++){if(j===p)continue;if(bars[j].high>=bars[p].high)isH=false;if(bars[j].low<=bars[p].low)isL=false;if(!isH&&!isL)break;}
    const c=p+right;
    if(isH){sh[c]=bars[p].high;shi[c]=p;if(finite(prevHigh)){if(bars[p].high>prevHigh)hh[c]=true;else if(bars[p].high<prevHigh)lh[c]=true;}prevHigh=bars[p].high;}
    if(isL){sl[c]=bars[p].low;sli[c]=p;if(finite(prevLow)){if(bars[p].low>prevLow)hl[c]=true;else if(bars[p].low<prevLow)ll[c]=true;}prevLow=bars[p].low;}
  }
  const lastHigh=makeNaN(n),prevHighSeries=makeNaN(n),lastLow=makeNaN(n),prevLowSeries=makeNaN(n),lastHighIndex=makeNaN(n),lastLowIndex=makeNaN(n),trend=Array(n).fill('transition'),trendCode=Array(n).fill(0),bosBull=Array(n).fill(false),bosBear=Array(n).fill(false),chochBull=Array(n).fill(false),chochBear=Array(n).fill(false);
  let h1=NaN,h2=NaN,l1=NaN,l2=NaN,hi=NaN,li=NaN,lastHighClass='',lastLowClass='',state=0;
  for(let i=0;i<n;i++){
    const priorH=h1,priorL=l1,priorState=state;
    if(i>0&&finite(priorH)&&bars[i-1].close<=priorH&&bars[i].close>priorH){bosBull[i]=true;if(priorState<0)chochBull[i]=true;}
    if(i>0&&finite(priorL)&&bars[i-1].close>=priorL&&bars[i].close<priorL){bosBear[i]=true;if(priorState>0)chochBear[i]=true;}
    if(finite(sh[i])){h2=h1;h1=sh[i];hi=shi[i];lastHighClass=hh[i]?'HH':lh[i]?'LH':lastHighClass;}
    if(finite(sl[i])){l2=l1;l1=sl[i];li=sli[i];lastLowClass=hl[i]?'HL':ll[i]?'LL':lastLowClass;}
    if(lastHighClass==='HH'&&lastLowClass==='HL')state=1;else if(lastHighClass==='LH'&&lastLowClass==='LL')state=-1;
    lastHigh[i]=h1;prevHighSeries[i]=h2;lastLow[i]=l1;prevLowSeries[i]=l2;lastHighIndex[i]=hi;lastLowIndex[i]=li;trendCode[i]=state;trend[i]=state>0?'uptrend':state<0?'downtrend':'transition';
  }
  return{swingHigh:sh,swingLow:sl,swingHighIndex:shi,swingLowIndex:sli,hh,hl,lh,ll,lastHigh,lastLow,previousHigh:prevHighSeries,previousLow:prevLowSeries,lastHighIndex,lastLowIndex,bosBull,bosBear,chochBull,chochBear,trend,trendCode};
}
function marketRegime(bars,left=3,right=3,lookback=50,rangeThreshold=.25){
  const s=pivotStructure(bars,left,right),n=bars.length,state=Array(n).fill('transition'),up=Array(n).fill(false),down=Array(n).fill(false),range=Array(n).fill(false),transition=Array(n).fill(true),efficiency=makeNaN(n),score=makeNaN(n);lookback=Math.max(5,Math.round(lookback));rangeThreshold=Math.min(.8,Math.max(.05,Number(rangeThreshold)||.25));
  for(let i=lookback;i<n;i++){let path=0;for(let j=i-lookback+1;j<=i;j++)path+=Math.abs(bars[j].close-bars[j-1].close);const er=path<=EPS?0:Math.abs(bars[i].close-bars[i-lookback].close)/path;efficiency[i]=er;const t=s.trendCode[i];if(er<=rangeThreshold){state[i]='range';range[i]=true;transition[i]=false;}else if(t>0){state[i]='uptrend';up[i]=true;transition[i]=false;}else if(t<0){state[i]='downtrend';down[i]=true;transition[i]=false;}score[i]=(t||0)*er*100;}
  return{state,uptrend:up,downtrend:down,range,transition,efficiency,score};
}
function trendChannel(bars,left=3,right=3){
  const s=pivotStructure(bars,left,right),n=bars.length,upper=makeNaN(n),lower=makeNaN(n),mid=makeNaN(n),upperSlope=makeNaN(n),lowerSlope=makeNaN(n),valid=Array(n).fill(false);let h1=null,h2=null,l1=null,l2=null;
  for(let i=0;i<n;i++){
    if(finite(s.swingHigh[i])){h2=h1;h1={price:s.swingHigh[i],index:s.swingHighIndex[i]};}
    if(finite(s.swingLow[i])){l2=l1;l1={price:s.swingLow[i],index:s.swingLowIndex[i]};}
    if(h1&&h2&&l1&&l2&&h1.index!==h2.index&&l1.index!==l2.index){const hs=(h1.price-h2.price)/(h1.index-h2.index),ls=(l1.price-l2.price)/(l1.index-l2.index);upperSlope[i]=hs;lowerSlope[i]=ls;upper[i]=h1.price+hs*(i-h1.index);lower[i]=l1.price+ls*(i-l1.index);mid[i]=(upper[i]+lower[i])/2;valid[i]=true;}
  }
  return{upper,lower,mid,upperSlope,lowerSlope,valid};
}
function rangeBounds(bars,lookback=50){lookback=Math.max(2,Math.round(lookback));const highs=rolling(bars.map(b=>b.high),lookback,w=>Math.max(...w)),lows=rolling(bars.map(b=>b.low),lookback,w=>Math.min(...w)),mid=highs.map((v,i)=>finite(v)&&finite(lows[i])?(v+lows[i])/2:NaN),width=highs.map((v,i)=>finite(v)&&finite(lows[i])?v-lows[i]:NaN);return{high:highs,low:lows,mid,width};}
function structureZones(bars,left=3,right=3,atrPeriod=14,widthAtr=.25){
  const s=pivotStructure(bars,left,right),av=atr(bars,atrPeriod),n=bars.length,demandLow=makeNaN(n),demandHigh=makeNaN(n),supplyLow=makeNaN(n),supplyHigh=makeNaN(n),retestDemand=Array(n).fill(false),retestSupply=Array(n).fill(false),breakoutUp=Array(n).fill(false),breakoutDown=Array(n).fill(false);widthAtr=Math.max(0,Number(widthAtr)||.25);
  for(let i=0;i<n;i++){const w=finite(av[i])?av[i]*widthAtr:0;if(finite(s.lastLow[i])){demandLow[i]=s.lastLow[i]-w;demandHigh[i]=s.lastLow[i]+w;retestDemand[i]=bars[i].low<=demandHigh[i]&&bars[i].high>=demandLow[i]&&bars[i].close>=s.lastLow[i];}if(finite(s.lastHigh[i])){supplyLow[i]=s.lastHigh[i]-w;supplyHigh[i]=s.lastHigh[i]+w;retestSupply[i]=bars[i].high>=supplyLow[i]&&bars[i].low<=supplyHigh[i]&&bars[i].close<=s.lastHigh[i];}if(i>0&&finite(s.lastHigh[i-1]))breakoutUp[i]=bars[i-1].close<=s.lastHigh[i-1]&&bars[i].close>s.lastHigh[i-1];if(i>0&&finite(s.lastLow[i-1]))breakoutDown[i]=bars[i-1].close>=s.lastLow[i-1]&&bars[i].close<s.lastLow[i-1];}
  return{support:s.lastLow,resistance:s.lastHigh,demandLow,demandHigh,supplyLow,supplyHigh,retestDemand,retestSupply,breakoutUp,breakoutDown};
}
function candlePatterns(bars){
  const n=bars.length,body=makeNaN(n),range=makeNaN(n),upper=makeNaN(n),lower=makeNaN(n),bodyRatio=makeNaN(n);const names=['bullish','bearish','doji','hammer','invertedHammer','shootingStar','hangingMan','bullishEngulfing','bearishEngulfing','bullishHarami','bearishHarami','morningStar','eveningStar','insideBar','outsideBar','pinBull','pinBear'];const o=Object.fromEntries(names.map(k=>[k,Array(n).fill(false)]));
  for(let i=0;i<n;i++){const b=bars[i],bd=Math.abs(b.close-b.open),rg=Math.max(EPS,b.high-b.low),uw=b.high-Math.max(b.open,b.close),lw=Math.min(b.open,b.close)-b.low;body[i]=bd;range[i]=rg;upper[i]=uw;lower[i]=lw;bodyRatio[i]=bd/rg;o.bullish[i]=b.close>b.open;o.bearish[i]=b.close<b.open;o.doji[i]=bd/rg<=.10;const hammerShape=lw>=Math.max(2*bd,.5*rg)&&uw<=Math.max(bd,.20*rg),invShape=uw>=Math.max(2*bd,.5*rg)&&lw<=Math.max(bd,.20*rg);o.hammer[i]=hammerShape;o.invertedHammer[i]=invShape;o.pinBull[i]=lw>=2.5*Math.max(bd,EPS)&&uw<=Math.max(bd,.15*rg);o.pinBear[i]=uw>=2.5*Math.max(bd,EPS)&&lw<=Math.max(bd,.15*rg);if(i){const p=bars[i-1],prevMid=(p.open+p.close)/2,trend3=i>=3?bars[i-1].close-bars[i-3].close:0;o.shootingStar[i]=invShape&&trend3>0;o.hangingMan[i]=hammerShape&&trend3>0;o.bullishEngulfing[i]=p.close<p.open&&b.close>b.open&&b.open<=p.close&&b.close>=p.open;o.bearishEngulfing[i]=p.close>p.open&&b.close<b.open&&b.open>=p.close&&b.close<=p.open;o.bullishHarami[i]=p.close<p.open&&b.close>b.open&&Math.max(b.open,b.close)<Math.max(p.open,p.close)&&Math.min(b.open,b.close)>Math.min(p.open,p.close);o.bearishHarami[i]=p.close>p.open&&b.close<b.open&&Math.max(b.open,b.close)<Math.max(p.open,p.close)&&Math.min(b.open,b.close)>Math.min(p.open,p.close);o.insideBar[i]=b.high<p.high&&b.low>p.low;o.outsideBar[i]=b.high>p.high&&b.low<p.low;if(i>=2){const a=bars[i-2],m=bars[i-1],small=Math.abs(m.close-m.open)/(Math.max(EPS,m.high-m.low))<.35;o.morningStar[i]=a.close<a.open&&small&&b.close>b.open&&b.close>=(a.open+a.close)/2;o.eveningStar[i]=a.close>a.open&&small&&b.close<b.open&&b.close<=(a.open+a.close)/2;}}
  }
  return{body,range,upperWick:upper,lowerWick:lower,bodyRatio,...o};
}
function recentSwings(structure,i,count=7){
  const pts=[];for(let j=i;j>=0&&pts.length<count;j--){if(finite(structure.swingHigh[j]))pts.push({type:'H',price:structure.swingHigh[j],index:structure.swingHighIndex[j],confirmed:j});if(finite(structure.swingLow[j]))pts.push({type:'L',price:structure.swingLow[j],index:structure.swingLowIndex[j],confirmed:j});}return pts.sort((a,b)=>a.index-b.index).slice(-count);
}
function chartPattern(bars,name,left=3,right=3,tolerance=.03,lookback=160){
  const n=bars.length,s=pivotStructure(bars,left,right),confirmed=Array(n).fill(false),score=makeNaN(n),bullish=Array(n).fill(false),bearish=Array(n).fill(false),neckline=makeNaN(n),target=makeNaN(n),anchorIndex=makeNaN(n);name=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');tolerance=Math.max(.002,Number(tolerance)||.03);lookback=Math.max(20,Math.round(lookback));
  const near=(a,b)=>Math.abs(a-b)<=Math.max(EPS,Math.max(Math.abs(a),Math.abs(b))*tolerance);
  for(let i=0;i<n;i++){
    if(!finite(s.swingHigh[i])&&!finite(s.swingLow[i]))continue;const pts=recentSwings(s,i,8).filter(p=>p.index>=Math.max(0,i-lookback-right));let ok=false,sc=0,dir=0,nl=NaN,tg=NaN,anchor=NaN;
    const last=k=>pts.slice(-k);
    if(name==='doubletop'){const p=last(3);if(p.length===3&&p[0].type==='H'&&p[1].type==='L'&&p[2].type==='H'&&near(p[0].price,p[2].price)){ok=true;dir=-1;sc=90-Math.min(40,Math.abs(p[0].price-p[2].price)/Math.max(EPS,p[0].price)*1000);nl=p[1].price;tg=nl-(Math.max(p[0].price,p[2].price)-nl);anchor=p[2].index;}}
    else if(name==='doublebottom'){const p=last(3);if(p.length===3&&p[0].type==='L'&&p[1].type==='H'&&p[2].type==='L'&&near(p[0].price,p[2].price)){ok=true;dir=1;sc=90;nl=p[1].price;tg=nl+(nl-Math.min(p[0].price,p[2].price));anchor=p[2].index;}}
    else if(name==='headandshoulders'){const p=last(5);if(p.map(x=>x.type).join('')==='HLHLH'&&p[2].price>p[0].price&&p[2].price>p[4].price&&near(p[0].price,p[4].price)){ok=true;dir=-1;sc=88;nl=(p[1].price+p[3].price)/2;tg=nl-(p[2].price-nl);anchor=p[4].index;}}
    else if(name==='inverseheadandshoulders'){const p=last(5);if(p.map(x=>x.type).join('')==='LHLHL'&&p[2].price<p[0].price&&p[2].price<p[4].price&&near(p[0].price,p[4].price)){ok=true;dir=1;sc=88;nl=(p[1].price+p[3].price)/2;tg=nl+(nl-p[2].price);anchor=p[4].index;}}
    else if(name==='threedrivebearish'||name==='threedrivepatternbearish'){const p=last(5);if(p.map(x=>x.type).join('')==='HLHLH'&&p[0].price<p[2].price&&p[2].price<p[4].price){ok=true;dir=-1;sc=78;nl=Math.min(p[1].price,p[3].price);anchor=p[4].index;}}
    else if(name==='threedrivebullish'||name==='threedrivepatternbullish'){const p=last(5);if(p.map(x=>x.type).join('')==='LHLHL'&&p[0].price>p[2].price&&p[2].price>p[4].price){ok=true;dir=1;sc=78;nl=Math.max(p[1].price,p[3].price);anchor=p[4].index;}}
    else if(['risingwedge','fallingwedge','bullishpennant','bearishpennant','bullishflag','bearishflag'].includes(name)){
      const highs=pts.filter(p=>p.type==='H').slice(-3),lows=pts.filter(p=>p.type==='L').slice(-3);if(highs.length===3&&lows.length===3){const hs=(highs[2].price-highs[0].price)/Math.max(1,highs[2].index-highs[0].index),ls=(lows[2].price-lows[0].price)/Math.max(1,lows[2].index-lows[0].index);const converging=Math.abs(hs-ls)>EPS&&((hs>0&&ls>hs)||(hs<0&&ls<hs)||(hs<0&&ls>0));if(name==='risingwedge'&&hs>0&&ls>0&&ls>hs){ok=true;dir=-1;sc=74;}if(name==='fallingwedge'&&hs<0&&ls<0&&hs<ls){ok=true;dir=1;sc=74;}if(name.includes('pennant')&&converging&&hs<0&&ls>0){const impulse=bars[i].close-bars[Math.max(0,i-lookback)].close;dir=name==='bullishpennant'?1:-1;if((dir>0&&impulse>0)||(dir<0&&impulse<0)){ok=true;sc=70;}}if(name.includes('flag')&&Math.sign(hs)===Math.sign(ls)&&Math.abs(hs-ls)<Math.max(Math.abs(hs),Math.abs(ls),EPS)*.7){const impulse=bars[i].close-bars[Math.max(0,i-lookback)].close;dir=name==='bullishflag'?1:-1;if((dir>0&&impulse>0&&hs<0)||(dir<0&&impulse<0&&hs>0)){ok=true;sc=68;}}anchor=Math.max(highs[2].index,lows[2].index);}}
    else if(['diamondtop','diamondbottom','roundingtop','roundingbottom'].includes(name)){
      const start=Math.max(0,i-lookback),w=bars.slice(start,i+1),mid=Math.floor(w.length/2);if(w.length>=30){const first=w.slice(0,mid),second=w.slice(mid),rangeA=Math.max(...first.map(b=>b.high))-Math.min(...first.map(b=>b.low)),rangeB=Math.max(...second.map(b=>b.high))-Math.min(...second.map(b=>b.low));if(name==='diamondtop'||name==='diamondbottom'){const q1=w.slice(0,Math.floor(w.length/4)),q2=w.slice(Math.floor(w.length/4),Math.floor(3*w.length/4)),q3=w.slice(Math.floor(3*w.length/4));const r1=Math.max(...q1.map(b=>b.high))-Math.min(...q1.map(b=>b.low)),r2=Math.max(...q2.map(b=>b.high))-Math.min(...q2.map(b=>b.low)),r3=Math.max(...q3.map(b=>b.high))-Math.min(...q3.map(b=>b.low));if(r2>r1*1.25&&r2>r3*1.25){ok=true;dir=name==='diamondtop'?-1:1;sc=60;anchor=i;}}else{const closes=w.map(b=>b.close),center=closes[mid],edge=(closes[0]+closes.at(-1))/2;if(name==='roundingtop'&&center>edge){ok=true;dir=-1;sc=58;anchor=i;}if(name==='roundingbottom'&&center<edge){ok=true;dir=1;sc=58;anchor=i;}}}}
    if(ok){confirmed[i]=true;score[i]=Math.max(0,Math.min(100,sc));if(dir>0)bullish[i]=true;else bearish[i]=true;neckline[i]=nl;target[i]=tg;anchorIndex[i]=anchor;}
  }
  return{confirmed,score,bullish,bearish,neckline,target,anchorIndex};
}
function fractals(bars,left=2,right=2){const s=pivotStructure(bars,left,right);return{up:s.swingHigh,down:s.swingLow,upIndex:s.swingHighIndex,downIndex:s.swingLowIndex};}
function zigzag(bars,depth=12,deviationPct=0,backstep=3){
  depth=Math.max(2,Math.round(Number(depth)||12));backstep=Math.max(1,Math.round(Number(backstep)||3));const dev=Math.max(0,Number(deviationPct)||0);
  const side=Math.max(1,Math.floor(depth/2)),s=pivotStructure(bars,side,side),candidates=[];
  for(let confirm=0;confirm<bars.length;confirm++){
    if(finite(s.swingHigh[confirm]))candidates.push({type:'H',price:s.swingHigh[confirm],pivot:Math.round(s.swingHighIndex[confirm]),confirm});
    if(finite(s.swingLow[confirm]))candidates.push({type:'L',price:s.swingLow[confirm],pivot:Math.round(s.swingLowIndex[confirm]),confirm});
  }
  candidates.sort((a,b)=>a.confirm-b.confirm||a.pivot-b.pivot||(a.type==='H'?-1:1));
  const pivots=[];
  for(const c of candidates){
    const last=pivots.at(-1);
    if(!last){pivots.push(c);continue;}
    if(c.type===last.type){const better=c.type==='H'?c.price>last.price:c.price<last.price;if(better)pivots[pivots.length-1]=c;continue;}
    if(c.pivot-last.pivot<backstep)continue;
    const move=Math.abs(c.price-last.price)/Math.max(EPS,Math.abs(last.price))*100;if(move+EPS<dev)continue;
    pivots.push(c);
  }
  const line=makeNaN(bars.length),displayLine=makeNaN(bars.length),high=makeNaN(bars.length),low=makeNaN(bars.length),highIndex=makeNaN(bars.length),lowIndex=makeNaN(bars.length);
  for(const p of pivots){if(p.confirm>=0&&p.confirm<line.length)line[p.confirm]=p.price;if(p.pivot>=0&&p.pivot<displayLine.length)displayLine[p.pivot]=p.price;if(p.type==='H'){high[p.confirm]=p.price;highIndex[p.confirm]=p.pivot;}else{low[p.confirm]=p.price;lowIndex[p.confirm]=p.pivot;}}
  return{line,displayLine,pivots,high,low,highIndex,lowIndex};
}
function breaks(a,b,dir){return cross(a,b,dir);}
function touchLevel(bars,level,tolerance=0){const lv=Array.isArray(level)?level:Array(bars.length).fill(level),out=Array(bars.length).fill(false);for(let i=0;i<bars.length;i++){const x=lv[i],t=Math.abs(Number(tolerance)||0);if(finite(x))out[i]=bars[i].low<=x+t&&bars[i].high>=x-t;}return out;}

function asSeries(v,n){if(isSeries(v))return v.value;if(isObject(v))throw new Error('Expected numeric series, got object');return Array(n).fill(v.value);}
function resolvePath(env,name){
  if(env.has(name))return env.get(name);
  const parts=name.split('.');let v=env.get(parts.shift());if(!v)return null;
  for(const p of parts){if(!isObject(v)||!Object.prototype.hasOwnProperty.call(v.value,p))return null;v=v.value[p];}
  return v;
}

export function checkAccess(program,authorization=null){
  const policy=program?.accessPolicy||'public';
  if(policy==='public')return{allowed:true,policy,reason:'public'};
  if(!authorization?.verified)return{allowed:false,policy,reason:'backend-verification-required'};
  const isOwner=authorization.isOwner===true||String(authorization.role||'').toLowerCase()==='owner';
  if(policy==='owner_only')return{allowed:isOwner,policy,reason:isOwner?'owner':'owner-required'};
  if(policy==='owner_or_grant'){
    if(isOwner)return{allowed:true,policy,reason:'owner'};
    const entitlement=program?.entitlement;
    const grants=new Set([...(authorization.entitlements||[]),...(authorization.grants||[])]);
    const allowed=!!entitlement&&grants.has(entitlement);
    return{allowed,policy,reason:allowed?'granted-entitlement':entitlement?'grant-required':'missing-entitlement'};
  }
  return{allowed:false,policy,reason:'unknown-policy'};
}

function aiComponentValue(condition,weight,n){
  const pass=isSeries(condition)?condition.value.map(Boolean):Array(n).fill(Boolean(condition?.value));
  const w=Math.max(0,Number(weight?.value)||0);
  return object({pass:series(pass),earned:series(pass.map(x=>x?w:0)),weight:scalar(w)});
}

function aiDecisionValue(args,n){
  const threshold=Math.max(0,Math.min(100,Number(args[0]?.value)||0));
  const components=args.slice(1).filter(isObject);
  const maxScore=components.reduce((s,c)=>s+Math.max(0,Number(c.value?.weight?.value)||0),0);
  const raw=Array(n).fill(0),passed=Array(n).fill(0),failed=Array(n).fill(0);
  for(const c of components){
    const earned=c.value?.earned,pass=c.value?.pass;
    for(let i=0;i<n;i++){
      const e=Number(unwrap(earned,i));if(Number.isFinite(e))raw[i]+=e;
      if(Boolean(unwrap(pass,i)))passed[i]++;else failed[i]++;
    }
  }
  const score=raw.map(x=>maxScore>0?Math.max(0,Math.min(100,x/maxScore*100)):0);
  const allow=score.map(x=>x>=threshold);
  return object({score:series(score),raw_score:series(raw),max_score:scalar(maxScore),threshold:scalar(threshold),allow:series(allow),confidence:series(score),passed_count:series(passed),failed_count:series(failed)});
}

function goldHunterAiValue(bars,trendMa,side,minDistancePips,minSlopePips,mode,pipSize){
  const n=bars.length,trend=asSeries(trendMa,n),directionOk=Array(n).fill(false),distanceOk=Array(n).fill(false),slopeOk=Array(n).fill(false),score=Array(n).fill(0),allow=Array(n).fill(true),wouldCancel=Array(n).fill(false),regime=Array(n).fill('OFF');
  const buy=String(side||'buy').toLowerCase()!=='sell',distMin=Math.max(0,Number(minDistancePips)||0),slopeMin=Math.max(0,Number(minSlopePips)||0),m=String(mode||'monitor').toLowerCase(),pip=Math.max(EPS,Math.abs(Number(pipSize)||0.01));
  for(let i=0;i<n;i++){
    if(m==='off'){directionOk[i]=distanceOk[i]=slopeOk[i]=true;score[i]=100;allow[i]=true;regime[i]='OFF';continue;}
    if(i<1||!finite(trend[i])||!finite(trend[i-1])){allow[i]=m==='monitor';regime[i]='UNKNOWN';continue;}
    const close=Number(bars[i].close),distance=Math.abs(close-trend[i])/pip,slope=Math.abs(trend[i]-trend[i-1])/pip;
    directionOk[i]=buy?close>trend[i]:close<trend[i];distanceOk[i]=distance>=distMin;slopeOk[i]=slope>=slopeMin;
    const regimeOk=directionOk[i]&&distanceOk[i]&&slopeOk[i];score[i]=(directionOk[i]?40:0)+(distanceOk[i]?30:0)+(slopeOk[i]?30:0);regime[i]=regimeOk?'TREND':(!directionOk[i]?'RANGE':'CHOP');wouldCancel[i]=!regimeOk;allow[i]=m==='monitor'||regimeOk;
  }
  return object({direction_ok:series(directionOk),distance_ok:series(distanceOk),slope_ok:series(slopeOk),score:series(score),allow:series(allow),would_cancel:series(wouldCancel),regime:series(regime)});
}

export function execute(program,bars,{inputs={},allowAutomation=false,hasLiveBar=false,pipSize=0.01,contextName='current',authorization=null,enforceAccess=true}={}){
  if(!Array.isArray(bars)||!bars.length)throw new Error('TA Script requires market bars');
  const access=checkAccess(program,authorization);
  if(enforceAccess!==false&&!access.allowed)throw new Error(`TA Script access denied: ${access.reason}`);
  const n=bars.length, env=new Map(), states=new Map(), stateHistory={}, cache=new Map(),seriesIds=new WeakMap();let nextSeriesId=1;
  for(const k of ['open','high','low','close','volume'])env.set(k,series(bars.map(b=>Number(b[k]??0))));
  env.set('tick_volume',env.get('volume'));
  env.set('hl2',series(bars.map(b=>(Number(b.high)+Number(b.low))/2)));
  env.set('hlc3',series(bars.map(b=>(Number(b.high)+Number(b.low)+Number(b.close))/3)));
  env.set('ohlc4',series(bars.map(b=>(Number(b.open)+Number(b.high)+Number(b.low)+Number(b.close))/4)));
  env.set('bar_index',series(bars.map((_,i)=>i)));env.set('pip_size',scalar(Number(pipSize)||0.01));env.set('context_name',scalar(contextName));env.set('pi',scalar(Math.PI));env.set('e',scalar(Math.E));
  const userFns=new Map((program.functions||[]).map(f=>[f.name,f]));let fnDepth=0;

  const builtin=(name,args)=>{
    const key=JSON.stringify([name,...args.map(a=>{if(a.kind==='scalar')return['s',a.value];if(a.kind==='series'){let id=seriesIds.get(a.value);if(!id){id=nextSeriesId++;seriesIds.set(a.value,id);}return['r',id];}return['o',Object.keys(a.value||{})];})]);
    if(cache.has(key))return cache.get(key);
    const s=(v)=>asSeries(v,n),num=v=>Number(v.value),str=v=>String(v.value);
    let out;
    switch(name){
      case 'sma':out=series(sma(s(args[0]),num(args[1])));break;case 'ema':out=series(ema(s(args[0]),num(args[1])));break;case 'wma':out=series(wma(s(args[0]),num(args[1])));break;
      case 'wilder':out=series(wilder(s(args[0]),num(args[1])));break;case 'dema':out=series(dema(s(args[0]),num(args[1])));break;case 'tema':out=series(tema(s(args[0]),num(args[1])));break;case 'hull':out=series(hull(s(args[0]),num(args[1])));break;
      case 'ma':out=series(movingAverage(s(args[0]),num(args[1]),str(args[2]??scalar('sma'))));break;
      case 'rsi':out=series(rsi(s(args[0]),num(args[1])));break;case 'atr':out=series(atr(bars,num(args[0])));break;case 'adx':out=series(adx(bars,num(args[0])));break;case 'cci':out=series(cci(bars,num(args[0])));break;
      case 'vwap':out=series(vwap(bars,str(args[0]??scalar('session')),num(args[1]??scalar(0)),num(args[2]??scalar(0))));break;case 'momentum':out=series(momentum(s(args[0]),num(args[1])));break;case 'roc':out=series(roc(s(args[0]),num(args[1])));break;
      case 'macd':{const x=macd(s(args[0]),num(args[1]),num(args[2]),num(args[3]));out=object({line:series(x.line),signal:series(x.signal),hist:series(x.hist)});break;}
      case 'macd_line':out=series(macd(s(args[0]),num(args[1]),num(args[2]),num(args[3])).line);break;
      case 'macd_signal':out=series(macd(s(args[0]),num(args[1]),num(args[2]),num(args[3])).signal);break;
      case 'macd_hist':out=series(macd(s(args[0]),num(args[1]),num(args[2]),num(args[3])).hist);break;
      case 'stochastic':{const full=args.length>=6;const kp=num(full?(args[3]??scalar(9)):(args[0]??scalar(9))),ks=num(full?(args[4]??scalar(3)):(args[1]??scalar(3))),dp=num(full?(args[5]??scalar(9)):(args[2]??scalar(9))),mt=str(full?(args[6]??scalar('sma')):(args[3]??scalar('sma'))),ct=str(full?(args[7]??scalar('lowhigh')):(args[4]??scalar('lowhigh')));const x=stochastic(bars,kp,ks,dp,mt,ct);out=object({raw:series(x.rawK),k:series(x.k),d:series(x.d)});break;}
      case 'stoch_k':out=series(stochastic(bars,num(args[0]),num(args[2]),num(args[1]),'sma','lowhigh').k);break;
      case 'stoch_d':out=series(stochastic(bars,num(args[0]),num(args[2]),num(args[1]),'sma','lowhigh').d);break;
      case 'bollinger':{const x=bollinger(s(args[0]),num(args[1]),num(args[2]),str(args[3]??scalar('sma')));out=object({upper:series(x.upper),mid:series(x.mid),lower:series(x.lower)});break;}
      case 'bb_upper':out=series(bollinger(s(args[0]),num(args[1]),num(args[2]),str(args[3]??scalar('sma'))).upper);break;case 'bb_mid':out=series(bollinger(s(args[0]),num(args[1]),num(args[2]),str(args[3]??scalar('sma'))).mid);break;case 'bb_lower':out=series(bollinger(s(args[0]),num(args[1]),num(args[2]),str(args[3]??scalar('sma'))).lower);break;
      case 'stddev':case 'standard_deviation':out=series(stdev(s(args[0]),num(args[1])));break;
      case 'envelopes':{const x=envelopes(s(args[0]),num(args[1]),num(args[2]),str(args[3]??scalar('sma')));out=object({upper:series(x.upper),mid:series(x.mid),lower:series(x.lower)});break;}
      case 'ichimoku':{const x=ichimoku(bars,num(args[0]??scalar(9)),num(args[1]??scalar(26)),num(args[2]??scalar(52)),num(args[3]??scalar(26)));out=object({tenkan:series(x.tenkan),kijun:series(x.kijun),span_a:series(x.spanA),span_b:series(x.spanB),chikou:series(x.chikou)});break;}
      case 'parabolic_sar':case 'psar':out=series(parabolicSar(bars,num(args[0]??scalar(.02)),num(args[1]??scalar(.2))));break;
      case 'zigzag':{const x=zigzag(bars,num(args[0]??scalar(12)),num(args[1]??scalar(0)),num(args[2]??scalar(3)));out=object({line:series(x.line),high:series(x.high),low:series(x.low),high_index:series(x.highIndex),low_index:series(x.lowIndex)});break;}
      case 'bulls_power':out=series(bullsPower(bars,num(args[0]??scalar(13))));break;
      case 'bears_power':out=series(bearsPower(bars,num(args[0]??scalar(13))));break;
      case 'demarker':out=series(demarker(bars,num(args[0]??scalar(14))));break;
      case 'force_index':out=series(forceIndex(bars,num(args[0]??scalar(13)),str(args[1]??scalar('ema'))));break;
      case 'osma':out=series(macd(s(args[0]??env.get('close')),num(args[1]??scalar(12)),num(args[2]??scalar(26)),num(args[3]??scalar(9))).hist);break;
      case 'rvi':case 'relative_vigor_index':{const x=relativeVigorIndex(bars,num(args[0]??scalar(10)));out=object({line:series(x.line),signal:series(x.signal)});break;}
      case 'williams_r':case 'wpr':out=series(williamsR(bars,num(args[0]??scalar(14))));break;
      case 'accumulation_distribution':case 'ad_line':out=series(accumulationDistribution(bars));break;
      case 'money_flow_index':case 'mfi':out=series(moneyFlowIndex(bars,num(args[0]??scalar(14))));break;
      case 'obv':case 'on_balance_volume':out=series(obv(bars));break;
      case 'awesome_oscillator':case 'ao':out=series(awesomeOscillator(bars));break;
      case 'accelerator_oscillator':case 'ac':out=series(acceleratorOscillator(bars));break;
      case 'alligator':{const x=alligator(bars,num(args[0]??scalar(13)),num(args[1]??scalar(8)),num(args[2]??scalar(8)),num(args[3]??scalar(5)),num(args[4]??scalar(5)),num(args[5]??scalar(3)));out=object({jaw:series(x.jaw),teeth:series(x.teeth),lips:series(x.lips)});break;}
      case 'gator':{const x=gator(bars);out=object({upper:series(x.upper),lower:series(x.lower)});break;}
      case 'fractals':{const x=fractals(bars,num(args[0]??scalar(2)),num(args[1]??scalar(2)));out=object({up:series(x.up),down:series(x.down),up_index:series(x.upIndex),down_index:series(x.downIndex)});break;}
      case 'market_facilitation_index':case 'bw_mfi':out=series(marketFacilitationIndex(bars));break;
      case 'market_profile':{const x=marketProfile(bars,num(args[0]??scalar(100)),num(args[1]??scalar(24)),num(args[2]??scalar(.70)));out=object({poc:series(x.poc),vah:series(x.vah),val:series(x.val)});break;}
      case 'candles':case 'candle_patterns':{const x=candlePatterns(bars);out=object(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,series(v)])));break;}
      case 'market_structure':case 'structure':{const x=pivotStructure(bars,num(args[0]??scalar(3)),num(args[1]??scalar(3)));out=object({swing_high:series(x.swingHigh),swing_low:series(x.swingLow),swing_high_index:series(x.swingHighIndex),swing_low_index:series(x.swingLowIndex),hh:series(x.hh),hl:series(x.hl),lh:series(x.lh),ll:series(x.ll),last_high:series(x.lastHigh),last_low:series(x.lastLow),previous_high:series(x.previousHigh),previous_low:series(x.previousLow),last_high_index:series(x.lastHighIndex),last_low_index:series(x.lastLowIndex),bos_bull:series(x.bosBull),bos_bear:series(x.bosBear),choch_bull:series(x.chochBull),choch_bear:series(x.chochBear),trend:series(x.trend),trend_code:series(x.trendCode)});break;}
      case 'market_regime':{const x=marketRegime(bars,num(args[0]??scalar(3)),num(args[1]??scalar(3)),num(args[2]??scalar(50)),num(args[3]??scalar(.25)));out=object({state:series(x.state),uptrend:series(x.uptrend),downtrend:series(x.downtrend),range:series(x.range),transition:series(x.transition),efficiency:series(x.efficiency),score:series(x.score)});break;}
      case 'trend_channel':{const x=trendChannel(bars,num(args[0]??scalar(3)),num(args[1]??scalar(3)));out=object({upper:series(x.upper),lower:series(x.lower),mid:series(x.mid),upper_slope:series(x.upperSlope),lower_slope:series(x.lowerSlope),valid:series(x.valid)});break;}
      case 'range_bounds':{const x=rangeBounds(bars,num(args[0]??scalar(50)));out=object({high:series(x.high),low:series(x.low),mid:series(x.mid),width:series(x.width)});break;}
      case 'structure_zones':case 'zones':{const x=structureZones(bars,num(args[0]??scalar(3)),num(args[1]??scalar(3)),num(args[2]??scalar(14)),num(args[3]??scalar(.25)));out=object({support:series(x.support),resistance:series(x.resistance),demand_low:series(x.demandLow),demand_high:series(x.demandHigh),supply_low:series(x.supplyLow),supply_high:series(x.supplyHigh),retest_demand:series(x.retestDemand),retest_supply:series(x.retestSupply),breakout_up:series(x.breakoutUp),breakout_down:series(x.breakoutDown)});break;}
      case 'pattern':case 'chart_pattern':{const x=chartPattern(bars,str(args[0]),num(args[1]??scalar(3)),num(args[2]??scalar(3)),num(args[3]??scalar(.03)),num(args[4]??scalar(160)));out=object({confirmed:series(x.confirmed),score:series(x.score),bullish:series(x.bullish),bearish:series(x.bearish),neckline:series(x.neckline),target:series(x.target),anchor_index:series(x.anchorIndex)});break;}
      case 'breaks_above':out=series(breaks(s(args[0]),s(args[1]),'up'));break;
      case 'breaks_below':out=series(breaks(s(args[0]),s(args[1]),'down'));break;
      case 'touch':out=series(touchLevel(bars,s(args[0]),num(args[1]??scalar(0))));break;
      case 'ai_component':case 'score_when':out=aiComponentValue(args[0]??scalar(false),args[1]??scalar(0),n);break;
      case 'ai_decision':case 'ai_score':out=aiDecisionValue(args,n);break;
      case 'gold_hunter_ai':{const trend=args[0]??env.get('close'),side=str(args[1]??scalar('buy')),minDistance=num(args[2]??scalar(10)),minSlope=num(args[3]??scalar(.5)),mode=str(args[4]??scalar('monitor'));out=goldHunterAiValue(bars,trend,side,minDistance,minSlope,mode,pipSize);break;}
      case 'highest':out=series(rolling(s(args[0]),num(args[1]),x=>Math.max(...x)));break;case 'lowest':out=series(rolling(s(args[0]),num(args[1]),x=>Math.min(...x)));break;
      case 'crossover':out=series(cross(s(args[0]),s(args[1]),'up'));break;case 'crossunder':out=series(cross(s(args[0]),s(args[1]),'down'));break;
      case 'abs':out=mapUnary(args[0],x=>Math.abs(Number(x)));break;case 'min':out=mapBinary(args[0],args[1],(x,y)=>Math.min(Number(x),Number(y)),n);break;case 'max':out=mapBinary(args[0],args[1],(x,y)=>Math.max(Number(x),Number(y)),n);break;
      case 'nz':{const a=args[0],b=args[1]??scalar(0);out=isSeries(a)?series(a.value.map((x,i)=>x==null||Number.isNaN(x)?unwrap(b,i):x)):scalar(a.value??b.value);break;}
      default:throw new Error(`Unknown function ${name}`);
    }
    cache.set(key,out);return out;
  };

  const evalNode=(node,index=null)=>{
    if(node.type==='number'||node.type==='string'||node.type==='boolean')return scalar(node.value);
    if(node.type==='identifier'){
      if(states.has(node.name))return scalar(states.get(node.name));
      const v=resolvePath(env,node.name);if(!v)throw new Error(`Unknown identifier ${node.name}`);return v;
    }
    if(node.type==='history'){
      const offV=evalNode(node.offset,index),off=Math.max(0,Math.round(Number(unwrap(offV,index??0))||0)),target=evalNode(node.target,index);
      if(isObject(target))throw new Error('History operator must target a scalar/series value, e.g. stoch.k[1]');
      if(index!=null)return scalar(isSeries(target)?target.value[index-off]:target.value);
      if(!isSeries(target))return target;
      const a=target.value,out=Array(a.length).fill(NaN);for(let i=off;i<a.length;i++)out[i]=a[i-off];return series(out);
    }
    if(node.type==='call'){
      const callArgs=node.args.map(a=>evalNode(a,index));
      const fn=userFns.get(node.name);
      if(fn){
        if(fnDepth++>32){fnDepth--;throw new Error(`Function recursion limit exceeded in ${node.name}`);}
        const saved=[];
        try{
          for(let j=0;j<fn.params.length;j++){const k=fn.params[j];saved.push([k,env.has(k),env.get(k)]);env.set(k,callArgs[j]??scalar(NaN));}
          return evalNode(fn.expr,index);
        }finally{for(const [k,had,v] of saved){if(had)env.set(k,v);else env.delete(k);}fnDepth--;}
      }
      return builtin(node.name,callArgs);
    }
    if(node.type==='unary'){const a=evalNode(node.arg,index);const fn=node.op==='-'?(x=>-Number(x)):node.op==='+'?(x=>Number(x)):(x=>!toBool(x));if(index!=null)return scalar(fn(unwrap(a,index)));return mapUnary(a,fn);}
    if(node.type==='binary'){
      const a=evalNode(node.left,index),b=evalNode(node.right,index),op=node.op;
      const f={'+':(x,y)=>Number(x)+Number(y),'-':(x,y)=>Number(x)-Number(y),'*':(x,y)=>Number(x)*Number(y),'/':(x,y)=>Number(y)===0?NaN:Number(x)/Number(y),'%':(x,y)=>Number(x)%Number(y),'>':(x,y)=>x>y,'<':(x,y)=>x<y,'>=':(x,y)=>x>=y,'<=':(x,y)=>x<=y,'==':(x,y)=>x===y,'!=':(x,y)=>x!==y,and:(x,y)=>toBool(x)&&toBool(y),'&&':(x,y)=>toBool(x)&&toBool(y),or:(x,y)=>toBool(x)||toBool(y),'||':(x,y)=>toBool(x)||toBool(y)}[op];
      if(!f)throw new Error(`Unsupported operator ${op}`);if(index!=null)return scalar(f(unwrap(a,index),unwrap(b,index)));return mapBinary(a,b,f,n);
    }
    throw new Error(`Unsupported AST node ${node.type}`);
  };

  for(const x of program.inputs){const override=Object.prototype.hasOwnProperty.call(inputs,x.name)?scalar(inputs[x.name]):evalNode(x.expr);env.set(x.name,override);}
  for(const x of program.lets)env.set(x.name,evalNode(x.expr));
  for(const x of program.states){const v=evalNode(x.expr,0);states.set(x.name,unwrap(v,0));stateHistory[x.name]=Array(n).fill(undefined);}

  const plots=program.plots.map(p=>({name:p.name,values:asSeries(evalNode(p.expr),n)}));
  const signals=[],alerts=[],armedEvents=[],markers=[],orderIntents=[];
  const entries=program.entries.map(x=>({...x,series:Array(n).fill(false)})),exits=program.exits.map(x=>({...x,series:Array(n).fill(false)}));
  const entryMap=new Map(program.entries.map((x,i)=>[x,entries[i]])),exitMap=new Map(program.exits.map((x,i)=>[x,exits[i]]));
  const lastProcessIndex=program.calculate==='bar-close'&&hasLiveBar?Math.max(-1,n-2):n-1;

  for(let i=0;i<n;i++){
    if(i>lastProcessIndex){for(const [k] of states)stateHistory[k][i]=states.get(k);continue;}
    for(const a of program.actions){
      const yes=toBool(unwrap(evalNode(a.when,i),i));if(!yes)continue;
      if(a.type==='set'){
        if(!states.has(a.name))throw new Error(`Cannot set unknown state ${a.name}`);
        states.set(a.name,unwrap(evalNode(a.expr,i),i));
      }else if(a.type==='marker'){
        const price=Number(unwrap(evalNode(a.price,i),i));let anchor=i;if(a.anchor){const x=Number(unwrap(evalNode(a.anchor,i),i));if(Number.isFinite(x))anchor=Math.max(0,Math.min(n-1,Math.round(x)));}
        markers.push({text:a.text,index:anchor,confirmedAt:i,time:bars[anchor]?.time??bars[i].time,price:Number.isFinite(price)?price:bars[i].close,context:contextName});
      }else if(a.type==='signal')signals.push({name:a.name,index:i,time:bars[i].time,price:bars[i].close,context:contextName});
      else if(a.type==='alert')alerts.push({message:a.message,index:i,time:bars[i].time,price:bars[i].close,context:contextName});
      else if(a.type==='armed')armedEvents.push({name:a.name,index:i,time:bars[i].time,price:bars[i].close,context:contextName});
      else if(a.type==='entry')entryMap.get(a).series[i]=true;
      else if(a.type==='exit')exitMap.get(a).series[i]=true;
      else if(a.type==='order'){
        const qty=a.qty?Number(unwrap(evalNode(a.qty,i),i)):null;
        orderIntents.push({action:a.action,tag:a.tag||null,qty,index:i,time:bars[i].time,referencePrice:bars[i].close,status:allowAutomation?'approved-intent':'simulation-only',context:contextName});
      }
    }
    for(const [k] of states)stateHistory[k][i]=states.get(k);
  }

  const backtest=runBacktest(entries,exits,bars);
  return{version:program.version,revision:program.revision,name:program.name,context:contextName,plots,markers,signals,alerts,armed:armedEvents,backtest,orderIntents,automationEnabled:!!allowAutomation,access:{...access,entitlement:program.entitlement||null,defaultAttach:program.defaultAttach||'none',grantVia:program.grantVia||'ta_id'},state:{current:Object.fromEntries(states),history:stateHistory},processedThrough:lastProcessIndex};
}

function runBacktest(entries,exits,bars){
  const open=new Map(),trades=[];
  for(let i=0;i<bars.length;i++){
    for(const e of entries){if(e.series[i]&&!open.has(e.tag))open.set(e.tag,{tag:e.tag,side:e.side,index:i,time:bars[i].time,price:bars[i].close});}
    for(const x of exits){if(x.series[i]&&open.has(x.tag)){const p=open.get(x.tag);open.delete(x.tag);const sign=p.side==='long'?1:-1,pnl=(bars[i].close-p.price)*sign;trades.push({...p,exitIndex:i,exitTime:bars[i].time,exitPrice:bars[i].close,pnl});}}
  }
  const net=trades.reduce((s,t)=>s+t.pnl,0),wins=trades.filter(t=>t.pnl>0).length;
  return{trades,openPositions:[...open.values()],summary:{closedTrades:trades.length,wins,losses:trades.length-wins,winRate:trades.length?wins/trades.length:0,netPoints:net}};
}

// Shared certified Trade Avata primitives. Native indicators and TA Script use the same math.
export const TA_MATH=Object.freeze({
  sma,ema,wma,wilder,timeSeriesMa,triangular,hull,dema,tema,vidya,kama,movingAverage,
  rsi,stochastic,atr,stdev,bollinger,vwap,macd,cci,momentum,roc,adx,directionalMovement,
  envelopes,ichimoku,parabolicSar,bullsPower,bearsPower,demarker,forceIndex,williamsR,
  accumulationDistribution,moneyFlowIndex,obv,awesomeOscillator,acceleratorOscillator,
  alligator,gator,marketFacilitationIndex,relativeVigorIndex,marketProfile,fractals,zigzag,
  shiftSeries
});

export const TA_MARKET=Object.freeze({
  candlePatterns,pivotStructure,marketRegime,trendChannel,rangeBounds,structureZones,chartPattern
});
