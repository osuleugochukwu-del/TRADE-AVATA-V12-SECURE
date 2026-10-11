import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const failures=[];const passes=[];
const ok=(name,condition,detail='')=>{(condition?passes:failures).push(`${condition?'PASS':'FAIL'} · ${name}${detail?` · ${detail}`:''}`);};
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const gitBlobSha=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');};
const sha256=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const BASELINE_MANIFEST_SHA256='b32a6d77ceebf5e18bc06529c0a48102b20ec7440cbe4cfab6900cd295255f9b';
if(exists('V11.1-SHA256.txt')){
  ok('current JESUS-JESUS baseline manifest identity',sha256('V11.1-SHA256.txt')===BASELINE_MANIFEST_SHA256,sha256('V11.1-SHA256.txt'));
  const intentional=new Set(['index.html','sw.js','package.json','.github/workflows/deploy.yml','firestore.rules','gateway/package.json','gateway/server.js','src/chart-pane.js','src/indicators.js','src/indicator-security.js','src/final-upgrade.js','src/native-chart.js','src/live-ready-upgrade.js','scripts/verify.mjs']);
  const rows=text('V11.1-SHA256.txt').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const m=/^([a-f0-9]{64})\s+\.\/(.+)$/.exec(line);return m?{sha:m[1],p:m[2]}:null;}).filter(Boolean);
  let checked=0;for(const row of rows){if(intentional.has(row.p))continue;checked++;ok(`full baseline preserved ${row.p}`,exists(row.p)&&sha256(row.p)===row.sha,exists(row.p)?sha256(row.p):'missing');}
  ok('full baseline fingerprint coverage',checked>=75,`${checked} protected files checked; V12 intentional integration files are separately verified`);
}else ok('current JESUS-JESUS baseline manifest identity',false,'V11.1-SHA256.txt missing');

const preserved={
  'public/brand/trade-avata-logo.svg':'9cc86558ee79ecfbe63b31ce9d5d830dca0e8918',
  'assets/styles.css':'05a3c149a18b50b6dd8fff0b204f9977a493dc43',
  'assets/master-recovery.css':'ac4e8fd0448341a91a0d1c022c7c6b15042f9acb',
  'assets/final-upgrade.css':'93f9adda0016f8a706404d6b8fe4d95717b87d28',
  'assets/v11-correction.css':'cb8139efc97ba79716b064d2b30dc73f92a0662e',
  'src/app.js':'11d899fbd39580dbae0ce137e90965f089d5e45f',
  'src/data.js':'4f633b4500bfe061563e7cf80c0c964dbe01818e',
  'src/master-recovery.js':'28e7350c4ac9531f8a3650e3af2a5f9cd85bb14d',
  'src/v11-correction.js':'c6c2c8e6b048f79346e421aae0319eee98035f1c'
};
for(const [p,sha] of Object.entries(preserved)){
  ok(`preserve ${p}`,exists(p)&&gitBlobSha(p)===sha,exists(p)?`sha ${gitBlobSha(p)}`:'missing');
}

const required=[
  '.github/workflows/deploy.yml','index.html','sw.js','package.json','firestore.rules',
  'ctrader-callback.html','src/firebase-auth-adapter.js','src/indicator-cloud-adapter.js','src/live-ready-config.js','src/market-feed-adapter.js','src/ctrader-feed-adapter.js','src/ctrader-oauth-callback.js','src/live-ready-upgrade.js','assets/live-ready-upgrade.css',
  'gateway/server.js','gateway/account-identity.js','gateway/ctrader-json-client.js','gateway/market-engine.js','gateway/secure-session-store.js','gateway/scripts/bootstrap-owner.js','gateway/package.json','gateway/Dockerfile',
  'src/account-sync-adapter.js','src/private-indicator-adapter.js','src/v12-integration.js','assets/v12-integration.css',
  'src/ta-script/index.js','src/ta-script/lexer.js','src/ta-script/parser.js','src/ta-script/runtime.js',
  'gateway/indicator-entitlements.js','gateway/scripts/seed-private-indicator.js','gateway/ta-script/index.js','gateway/ta-script/lexer.js','gateway/ta-script/parser.js','gateway/ta-script/runtime.js'
];
for(const p of required)ok(`required ${p}`,exists(p));

if(exists('.github/workflows/deploy.yml')){
  const w=text('.github/workflows/deploy.yml');
  for(const term of ['npm test','npm run verify','npm run verify:live-ready','npm run stress','npm run stress:native-v3','npm run stress:full-native','npm run stress:parity','actions/configure-pages@v6','actions/upload-pages-artifact@v5','actions/deploy-pages@v5'])ok(`workflow preserves/adds ${term}`,w.includes(term));
}

if(exists('index.html')){
  const x=text('index.html');
  for(const old of ['./src/app.js','./src/master-recovery.js','./src/final-upgrade.js','./src/v11-correction.js','./assets/styles.css','./assets/master-recovery.css','./assets/final-upgrade.css','./assets/v11-correction.css','./public/brand/trade-avata-logo.svg'])ok(`index preserves ${old}`,x.includes(old));
  for(const n of ['./src/firebase-auth-adapter.js','./src/indicator-cloud-adapter.js','./src/live-ready-config.js','./src/market-feed-adapter.js','./src/ctrader-feed-adapter.js','./src/live-ready-upgrade.js','./assets/live-ready-upgrade.css','./src/account-sync-adapter.js','./src/private-indicator-adapter.js','./src/v12-integration.js','./assets/v12-integration.css'])ok(`index loads ${n}`,x.includes(n));
}

if(exists('src/indicator-security.js')){
  const x=text('src/indicator-security.js');
  ok('indicator gate still rejects arbitrary JavaScript',x.includes('Arbitrary JavaScript is not accepted by the browser indicator gate.'));
  ok('indicator gate still disables network/dom/eval',x.includes('network:false')&&x.includes('dom:false')&&x.includes('eval:false'));
}

if(exists('src/live-ready-upgrade.js')){
  const x=text('src/live-ready-upgrade.js');
  for(const term of ['collapsed','half','full','mobileLandscapePanelOpen','Indicator Portal','Upload Indicator','Indicator Builder','TA ID Licensing','compileTaScript','Trade Avata native indicators only','fileBlobs','syncPortalCloud','portalOwnerKey','draftKey','PORTAL_MAX_FILES','PORTAL_MAX_TOTAL','FEED NOT CONFIGURED','RECONNECTING','applyLiveBar','patchDenseChartPerformance'])ok(`live-ready behavior: ${term}`,x.includes(term));
  ok('no direct eval in live-ready layer',!/\beval\s*\(/.test(x));
}

if(exists('src/firebase-auth-adapter.js')){
  const x=text('src/firebase-auth-adapter.js');
  for(const term of ['trade-avata','signInWithEmailAndPassword','createUserWithEmailAndPassword','sendPasswordResetEmail','signInWithPopup','browserLocalPersistence','onAuthStateChanged','getIdToken','/api/account/bootstrap',"profileRole===\'owner\'?\'free\':profileRole"])ok(`Firebase auth: ${term}`,x.includes(term));
  ok('no password storage',!x.includes('localStorage.setItem')&&!x.includes('sessionStorage.setItem'));
}

if(exists('src/indicator-cloud-adapter.js')){
  const x=text('src/indicator-cloud-adapter.js');
  for(const term of ['indicatorProjects','indicatorEntitlements','indicatorVersions','sourceStoredInFirestore:false'])ok(`Indicator cloud: ${term}`,x.includes(term));
}

if(exists('src/ctrader-feed-adapter.js')){
  const x=text('src/ctrader-feed-adapter.js');
  ok('cTrader frontend has no Client Secret literal',!x.includes('CTRADER_CLIENT_SECRET')&&!/clientSecret\s*:/.test(x));
  ok('stream reconnect included',x.includes('scheduleReconnect')&&x.includes('WebSocket'));
  ok('personal OAuth starts through secure gateway',x.includes('/api/ctrader/session/start')&&x.includes('Authorization'));
}

if(exists('src/live-ready-config.js')){
  const x=text('src/live-ready-config.js');
  ok('single public backend/gateway plug exists',x.includes("TRADE_AVATA_BACKEND_HTTP=''")&&x.includes('gatewayHttp:TRADE_AVATA_BACKEND_HTTP')&&x.includes('apiHttp:TRADE_AVATA_BACKEND_HTTP'));
  ok('config has no secret values',!/(clientSecret|accessToken|refreshToken)\s*:\s*['\"][^'\"]+/.test(x));
}


if(exists('ctrader-callback.html')&&exists('src/ctrader-oauth-callback.js')){
  const h=text('ctrader-callback.html'),x=text('src/ctrader-oauth-callback.js');
  ok('cTrader callback restores Firebase auth then completes server-side OAuth',h.includes('firebase-auth-adapter.js')&&x.includes('/api/ctrader/session/complete')&&x.includes('getIdToken'));
  ok('OAuth state survives redirect without exposing secrets',x.includes("params.get('state')")&&x.includes('JSON.stringify({code,state})')&&!x.includes('client_secret'));
}

if(exists('gateway/server.js')&&exists('gateway/ctrader-json-client.js')&&exists('gateway/secure-session-store.js')){
  const g=text('gateway/server.js'),c=text('gateway/ctrader-json-client.js'),st=text('gateway/secure-session-store.js');
  for(const term of ['CTRADER_CLIENT_ID','CTRADER_CLIENT_SECRET','CTRADER_PUBLIC_ACCOUNT_ID','CTRADER_PUBLIC_REFRESH_TOKEN','TRADE_AVATA_ORIGIN'])ok(`gateway environment hook: ${term}`,g.includes(term));
  ok('gateway restores market subscriptions after upstream reconnect',g.includes('recoverPublic')&&g.includes("status:'reconnecting'")&&g.includes('subscribedIds.clear'));
  ok('gateway persists refreshed public token encrypted server-side',g.includes("loadSystemSession('public-feed')")&&g.includes("saveSystemSession('public-feed'")&&st.includes('ctraderSystemSessions')&&st.includes('aes-256-gcm'));
  ok('gateway pages historical tick requests within cTrader historical rate budget',g.includes('historicalTicks')&&g.includes('await sleep(220)'));
  ok('gateway pushes personal execution events into journal-ready stream',g.includes('onPersonalExecution')&&g.includes("type:'trade-event'"));
  ok('gateway obtains unrealized PnL/equity',c.includes('POSITION_PNL_REQ:2187')&&c.includes('POSITION_PNL_RES:2188')&&g.includes('positionPnl'));
  ok('gateway enforces configured HTTP/WebSocket origin',g.includes('originAllowed')&&g.includes("u.pathname!=='/ws/market'||!originAllowed"));
  ok('gateway cTrader heartbeat is ten seconds',c.includes('10000'));
  ok('gateway never hardcodes cTrader credential values',!/(CTRADER_CLIENT_SECRET|CTRADER_PUBLIC_ACCESS_TOKEN)\s*=\s*['\"][^'\"]+/.test(g));
  ok('gateway validates server-stored OAuth state',g.includes("auth.searchParams.set('state',state)")&&g.includes('consumeOAuthState'));
  ok('gateway has connection/subscription/message limits',g.includes('MAX_WS_CLIENTS')&&g.includes('MAX_SUBSCRIPTIONS_PER_CLIENT')&&g.includes('MAX_WS_MESSAGE_BYTES'));
  ok('gateway production origin policy is fail-closed',g.includes('production is fail-closed'));
  if(exists('gateway/account-identity.js')){const id=text('gateway/account-identity.js');ok('backend allocates permanent TA ID',id.includes('TA-')&&id.includes('taIds'));ok('Owner bootstrap uses server custom claim',id.includes('TRADE_AVATA_OWNER_UID')&&id.includes('setCustomUserClaims'));}
}

if(exists('gateway/indicator-entitlements.js')&&exists('src/private-indicator-adapter.js')&&exists('src/v12-integration.js')){
  const ent=text('gateway/indicator-entitlements.js'),priv=text('src/private-indicator-adapter.js'),v12=text('src/v12-integration.js'),g=text('gateway/server.js');
  const a=ent.indexOf('export async function getIndicatorProgram'),b=ent.indexOf('export async function runIndicatorProgram',a),metadata=ent.slice(a,b);
  ok('private program metadata never returns proprietary source',a>=0&&b>a&&!/\bsource\s*:/.test(metadata));
  ok('private TA Script executes on secure gateway',ent.includes('compileTaScript(source)')&&g.includes('/api/indicators/run/'));
  ok('browser consumes private calculated results only',priv.includes('async function run(')&&v12.includes('TRADE_AVATA_PRIVATE_RESULTS')&&!v12.includes('TRADE_AVATA_TA_SCRIPT_SOURCES'));
}

if(exists('src/live-ready-upgrade.js')){
  const x=text('src/live-ready-upgrade.js');
  ok('Indicator Portal accepts TA Script native formats only',x.includes("new Set(['tas','taind'])")&&x.includes("accept:'.tas,.taind'")&&!x.includes("'mq4'")&&!x.includes("'mq5'")&&!x.includes("'algo'"));
  ok('custom tick TA Script is throttled away from candle hot path',x.includes('count>5000?120:count>2000?80:40')&&x.includes('liveRefresh:!full'));
}

if(exists('sw.js')){
  const x=text('sw.js');ok('service worker cache bumped',x.includes('v11-2-live-ready-r3')&&x.includes('v12-ta-script-native-ready-r2'));for(const f of ['firebase-auth-adapter.js','indicator-cloud-adapter.js','live-ready-config.js','market-feed-adapter.js','ctrader-feed-adapter.js','ctrader-oauth-callback.js','live-ready-upgrade.js','live-ready-upgrade.css','ctrader-callback.html','account-sync-adapter.js','private-indicator-adapter.js','v12-integration.js','v12-integration.css','ta-script/runtime.js'])ok(`service worker includes ${f}`,x.includes(f));
  ok('service worker ignores cross-origin auth/feed requests',x.includes("if(url.origin!==self.location.origin)return"));
}


const syntaxFiles=[
  'src/firebase-auth-adapter.js','src/indicator-cloud-adapter.js','src/live-ready-config.js','src/market-feed-adapter.js','src/ctrader-feed-adapter.js','src/ctrader-oauth-callback.js','src/live-ready-upgrade.js',
  'gateway/account-identity.js','gateway/ctrader-json-client.js','gateway/market-engine.js','gateway/secure-session-store.js','gateway/server.js','gateway/scripts/bootstrap-owner.js','scripts/install-into-clone.mjs',
  'src/account-sync-adapter.js','src/private-indicator-adapter.js','src/v12-integration.js','src/ta-script/index.js','src/ta-script/lexer.js','src/ta-script/parser.js','src/ta-script/runtime.js','gateway/indicator-entitlements.js','gateway/scripts/seed-private-indicator.js','gateway/ta-script/index.js','gateway/ta-script/lexer.js','gateway/ta-script/parser.js','gateway/ta-script/runtime.js'
];
for(const p of syntaxFiles){if(!exists(p)){ok(`syntax ${p}`,false,'missing');continue;}const r=spawnSync(process.execPath,['--check',p],{cwd:root,encoding:'utf8'});ok(`syntax ${p}`,r.status===0,(r.stderr||'').trim());}

console.log([...passes,...failures].join('\n'));
console.log(`\n${passes.length} passed · ${failures.length} failed`);
if(failures.length)process.exit(1);
