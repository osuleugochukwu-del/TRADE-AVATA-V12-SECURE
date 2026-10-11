/* Trade Avata public live configuration.
 * Browser-visible values only. NEVER put private keys, cTrader secrets, Firebase Admin
 * credentials or private indicator source in this file.
 *
 * Security staging rule:
 * - GitHub Pages is allowed while we test the new repository.
 * - After chart.tradeavata.com is connected and verified, remove the GitHub Pages origin
 *   from allowedOrigins and TRADE_AVATA_ORIGIN on the gateway.
 */
const TRADE_AVATA_BACKEND_HTTP=''; // e.g. https://api.tradeavata.com

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
  requireAppCheck:true,
  // Public reCAPTCHA/App Check key only. Configure before the production gateway is enabled.
  appCheckProvider:'recaptcha-enterprise',
  appCheckSiteKey:'',
  appCheckDebugToken:false
};

window.TRADE_AVATA_BACKEND_CONFIG={
  apiHttp:TRADE_AVATA_BACKEND_HTTP
};

window.TRADE_AVATA_CTRADER_CONFIG={
  gatewayHttp:TRADE_AVATA_BACKEND_HTTP
};
