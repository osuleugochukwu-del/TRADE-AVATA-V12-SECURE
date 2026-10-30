/* Trade Avata market-data bus.
 * The native chart consumes this stable interface; cTrader is only the first provider.
 * Firebase/Firestore is deliberately NOT part of the per-tick hot path.
 */
const VALID_STATES=new Set(['not-configured','connecting','live','reconnecting','offline','error']);
const LIVE_PACKET_GRACE_MS=5000;
const periodKey=p=>{if(!p)return'';if(typeof p==='string')return`time:${String(p).toLowerCase()}`;return`${String(p.mode||'time').toLowerCase()}:${String(p.value??'').toLowerCase()}`;};
class MarketFeedHub extends EventTarget{
  constructor(){super();this.providers=new Map();this.activeProvider=null;this.status='not-configured';this.statusDetail='Live market feed is not configured.';this.quotes=new Map();this.subscriptions=new Map();this.lastPacketAt=0;this.lastLivePacketAt=0;}
  registerProvider(name,provider){if(!name||!provider)throw new Error('A market provider name and provider are required.');this.providers.set(String(name),provider);provider.hub=this;this.dispatchEvent(new CustomEvent('provider-registered',{detail:{name:String(name)}}));return provider;}
  useProvider(name){const provider=this.providers.get(String(name));if(!provider)throw new Error(`Market provider ${name} is not registered.`);if(this.activeProvider&&this.activeProvider!==provider)this.activeProvider.disconnect?.('provider-switch');this.activeProvider=provider;this.activeProviderName=String(name);return provider;}
  setStatus(status,detail=''){
    let safe=VALID_STATES.has(status)?status:'error';
    const now=Date.now();
    const socketOpen=this.activeProvider?.socket?.readyState===1;
    const freshLive=!!this.lastLivePacketAt&&now-this.lastLivePacketAt<=LIVE_PACKET_GRACE_MS;
    /* A genuine bar/quote from an open socket is stronger evidence than a stale
       reconnect/connecting presentation signal. Do not let recovery/status races
       overwrite LIVE while real market packets are still arriving. */
    if((safe==='reconnecting'||safe==='connecting')&&socketOpen&&freshLive){
      safe='live';
      detail='cTrader live market feed connected.';
    }
    if(this.status===safe&&this.statusDetail===detail)return;
    this.status=safe;this.statusDetail=detail||safe;this.dispatchEvent(new CustomEvent('status',{detail:{status:safe,detail:this.statusDetail,provider:this.activeProviderName||null,at:now}}));
  }
  connect(){if(!this.activeProvider){this.setStatus('not-configured','No live market provider is selected.');return;}return this.activeProvider.connect?.();}
  disconnect(reason='manual'){return this.activeProvider?.disconnect?.(reason);}
  subscribe({symbol,period,onHistory,onBar,onQuote,onStatus}={}){const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`;const token=`sub-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;const callbacks={token,symbol:String(symbol||'').toUpperCase(),period,onHistory,onBar,onQuote,onStatus};if(!this.subscriptions.has(key))this.subscriptions.set(key,new Map());this.subscriptions.get(key).set(token,callbacks);try{this.activeProvider?.subscribe?.({symbol:callbacks.symbol,period});}catch(err){console.warn('[Market Feed] Subscribe failed',err);}onStatus?.({status:this.status,detail:this.statusDetail});return()=>{const group=this.subscriptions.get(key);group?.delete(token);if(group&&!group.size){this.subscriptions.delete(key);try{this.activeProvider?.unsubscribe?.({symbol:callbacks.symbol,period});}catch{}}};}
  _targets(symbol,period,{symbolWide=false}={}){const sym=String(symbol||'').toUpperCase();const pk=periodKey(period);if(pk){const exact=`${sym}|${pk}`;const out=[...(this.subscriptions.get(exact)?.values()||[])];if(out.length)return out;}if(!symbolWide&&pk)return[];const out=[];for(const group of this.subscriptions.values())for(const sub of group.values())if(sub.symbol===sym)out.push(sub);return out;}
  publishHistory(payload){this.lastPacketAt=performance.now();for(const sub of this._targets(payload.symbol,payload.period,{symbolWide:!payload.period}))sub.onHistory?.(payload);this.dispatchEvent(new CustomEvent('history',{detail:payload}));}
  publishBar(payload){this.lastPacketAt=performance.now();this.lastLivePacketAt=Date.now();if(this.status!=='live')this.setStatus('live','cTrader live market feed connected.');for(const sub of this._targets(payload.symbol,payload.period,{symbolWide:!payload.period}))sub.onBar?.(payload);this.dispatchEvent(new CustomEvent('bar',{detail:payload}));}
  publishQuote(payload){this.lastPacketAt=performance.now();this.lastLivePacketAt=Date.now();if(this.status!=='live')this.setStatus('live','cTrader live market feed connected.');const sym=String(payload.symbol||'').toUpperCase();this.quotes.set(sym,payload);for(const sub of this._targets(sym,payload.period,{symbolWide:true}))sub.onQuote?.(payload);this.dispatchEvent(new CustomEvent('quote',{detail:payload}));}
  publishAccount(payload){this.dispatchEvent(new CustomEvent('account',{detail:payload}));}publishPositions(payload){this.dispatchEvent(new CustomEvent('positions',{detail:payload}));}publishOrders(payload){this.dispatchEvent(new CustomEvent('orders',{detail:payload}));}publishHistoryTrades(payload){this.dispatchEvent(new CustomEvent('trade-history',{detail:payload}));}publishTradeEvent(payload){this.dispatchEvent(new CustomEvent('trade-event',{detail:payload}));}
}
const hub=new MarketFeedHub();window.TRADE_AVATA_MARKET_FEED=hub;export{MarketFeedHub,hub};export default hub;
