/* Trade Avata public live configuration.
 * Browser-visible values only. NEVER put private keys, cTrader secrets, Firebase Admin
 * credentials or private indicator source in this file.
 *
 * Isolated market-feed test environment:
 * - This old V12 repository is intentionally used only to prove the cTrader market-data path.
 * - The browser connects to the public HTTPS/WSS gateway; cTrader credentials remain on Oracle.
 * - Production and TRADE-AVATA-NEXT are not part of this test.
 */
const TRADE_AVATA_BACKEND_HTTP='https://market.tradeavata.com';

const TRADE_AVATA_ALLOWED_ORIGINS=[
  'https://tradeavata.com',
  'https://www.tradeavata.com',
  'https://chart.tradeavata.com',
  'https://osuleugochukwu-del.github.io'
];

window.TRADE_AVATA_SECURITY_CONFIG={
  mode:'enforce',
  allowedOrigins:TRADE_AVATA_ALLOWED_ORIGINS,
  allowLocalDevelopment:true,
  // The current Oracle market engine is a market-data-only test gateway and does not
  // perform Firebase App Check. Keep this disabled only for this disposable test build.
  requireAppCheck:false,
  appCheckProvider:'recaptcha-enterprise',
  appCheckSiteKey:'',
  appCheckDebugToken:false
};

window.TRADE_AVATA_BACKEND_CONFIG={
  apiHttp:TRADE_AVATA_BACKEND_HTTP
};

window.TRADE_AVATA_CTRADER_CONFIG={
  enabled:true,
  gatewayHttp:TRADE_AVATA_BACKEND_HTTP,
  gatewayWs:'wss://market.tradeavata.com/ws/market'
};
