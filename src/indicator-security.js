/* Trade Avata Indicator Security Gate
 * The browser accepts declarative indicator specifications, not arbitrary user JS.
 * Built-in code is first-party and reviewed. Custom indicators use restricted
 * TA Script; protected commercial indicators execute on the secure server.
 */
const ALLOWED_KINDS=new Set([
  'adx','bollinger','envelopes','ichimoku','moving-average','parabolic-sar','standard-deviation','zigzag',
  'atr','bears-power','bulls-power','cci','demarker','force-index','macd','momentum','osma','rsi','rvi','stochastic','williams-r',
  'accumulation-distribution','market-profile','mfi','obv','volume',
  'accelerator','alligator','awesome','fractals','gator','market-facilitation',
  'ema','sma','wma','vwap','roc','ta-script','custom-server'
]);
const ALLOWED_SOURCES=new Set(['open','high','low','close','hl2','hlc3','ohlc4']);

export function validateIndicatorSpec(spec){
  const errors=[];
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return{ok:false,errors:['Indicator spec must be an object.']};
  if(!ALLOWED_KINDS.has(spec.kind))errors.push('Unsupported indicator kind.');
  if(spec.source&&!ALLOWED_SOURCES.has(spec.source))errors.push('Unsupported price source.');
  if(spec.length!=null&&(!Number.isInteger(Number(spec.length))||Number(spec.length)<1||Number(spec.length)>100000))errors.push('Length is outside the safe range.');
  if(spec.code!=null||spec.script!=null||spec.javascript!=null)errors.push('Arbitrary JavaScript is not accepted by the browser indicator gate.');
  return{ok:errors.length===0,errors};
}

export function safeIndicatorSummary(spec){
  const {ok,errors}=validateIndicatorSpec(spec);
  return{ok,errors,permissions:['read:market-bars','write:indicator-series'],network:false,dom:false,storage:false,eval:false};
}
