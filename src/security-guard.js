/* Trade Avata clone/origin guard.
 * This is defense-in-depth only: browser JavaScript can always be copied/edited.
 * The authoritative protection remains backend Origin + Firebase Auth + App Check.
 */
(function(){
  const cfg=window.TRADE_AVATA_SECURITY_CONFIG||{};
  const origin=String(location.origin||'').replace(/\/$/,'');
  const local=/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const allowed=(Array.isArray(cfg.allowedOrigins)?cfg.allowedOrigins:[])
    .map(x=>String(x||'').trim().replace(/\/$/,''))
    .filter(Boolean);
  const trusted=allowed.includes(origin)||(cfg.allowLocalDevelopment===true&&local);

  const state={trusted,origin,mode:cfg.mode||'enforce',reason:trusted?'trusted-origin':'unapproved-origin'};
  window.TRADE_AVATA_SECURITY_STATE=Object.freeze(state);
  document.documentElement.dataset.tradeAvataTrustedOrigin=trusted?'true':'false';

  // A straight copy uploaded to another origin loses the official backend endpoints.
  if(!trusted&&cfg.mode!=='report-only'){
    if(window.TRADE_AVATA_BACKEND_CONFIG)window.TRADE_AVATA_BACKEND_CONFIG.apiHttp='';
    if(window.TRADE_AVATA_CTRADER_CONFIG){
      window.TRADE_AVATA_CTRADER_CONFIG.gatewayHttp='';
      window.TRADE_AVATA_CTRADER_CONFIG.gatewayWs='';
      window.TRADE_AVATA_CTRADER_CONFIG.enabled=false;
    }
    console.warn('[Trade Avata Security] Unapproved deployment origin. Protected services are disabled.');
  }

  // Basic anti-embedding deterrent. The production HTTP CSP should also send frame-ancestors 'none'.
  if(window.top!==window.self){
    try{window.top.location=window.self.location.href;}catch{}
  }
  try{if(window.opener)window.opener=null;}catch{}

  window.dispatchEvent(new CustomEvent('tradeavata:security-state',{detail:state}));
})();
