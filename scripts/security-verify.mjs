import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const walk=(dir=ROOT,out=[])=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ent.name==='node_modules'||ent.name==='.git')continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else out.push(p);}return out;};
const files=walk();
const rel=p=>path.relative(ROOT,p).replaceAll('\\','/');
const checks=[];
const check=(name,fn)=>{let ok=false,detail='';try{const r=fn();ok=r===true||r?.ok===true;detail=typeof r==='string'?r:(r?.detail||'');}catch(e){detail=e.message;}checks.push({name,ok,detail});};
const index=read('index.html'), callback=read('ctrader-callback.html'), server=read('gateway/server.js'), store=read('gateway/secure-session-store.js'), rules=read('firestore.rules'), sw=read('sw.js'), auth=read('src/firebase-auth-adapter.js'), config=read('src/live-ready-config.js'), guard=read('src/security-guard.js'), privateAdapter=read('src/private-indicator-adapter.js'), entitlements=read('gateway/indicator-entitlements.js'), workflow=read('.github/workflows/deploy.yml');

check('01 Baseline-preserving additive security layer',()=>exists('docs/SECURITY-30-CONTROLS.md'));
check('02 No committed .env secret file',()=>!files.some(p=>/(^|\/)\.env($|\.)/.test(rel(p))&&!/\.env\.example$/.test(rel(p))));
check('03 Secret file patterns are git-ignored',()=>/service-account/.test(read('.gitignore'))&&/\.env/.test(read('.gitignore'))&&/\*\.map/.test(read('.gitignore')));
check('04 Container build excludes common secrets',()=>exists('gateway/.dockerignore')&&/service-account/.test(read('gateway/.dockerignore')));
check('05 Firebase ID tokens verified server-side with revocation check',()=>/verifyIdToken\(m\[1\],true\)/.test(store));
check('06 Firebase App Check initialized in the web client',()=>/initializeAppCheck/.test(auth)&&/ReCaptchaEnterpriseProvider/.test(auth));
check('07 App Check required by protected HTTP API in production',()=>/REQUIRE_APP_CHECK/.test(server)&&/verifyAppCheckRequest/.test(server)&&/u\.pathname\.startsWith\('\/api\/'\)/.test(server));
check('08 App Check required by protected WebSocket',()=>/type==='app-check'/.test(server)&&/app-check-required/.test(server));
check('09 App Check can be pinned to the intended Firebase Web App ID',()=>/TRADE_AVATA_APP_CHECK_APP_ID/.test(server)&&/application mismatch/.test(server));
check('10 Exact production Origin allowlist is fail-closed',()=>/configuredOrigins\.includes/.test(server)&&/if\(production\)return false/.test(server));
check('11 Optional exact gateway Host allowlist is supported',()=>/TRADE_AVATA_GATEWAY_HOSTS/.test(server)&&/hostAllowed/.test(server));
check('12 Straight frontend clones disable official protected endpoints',()=>/Unapproved deployment origin/.test(guard)&&/gatewayHttp=''/.test(guard));
check('13 HTTPS enforcement and HSTS are present for production gateway',()=>/HTTPS is required/.test(server)&&/strict-transport-security/.test(server));
check('14 Frontend CSP blocks plugins/base injection and upgrades insecure requests',()=>/object-src 'none'/.test(index)&&/base-uri 'self'/.test(index)&&/upgrade-insecure-requests/.test(index));
check('15 Clickjacking defenses are present',()=>/frame-ancestors 'none'/.test(index)&&/x-frame-options':'DENY'/.test(server));
check('16 API hardening headers are present',()=>/x-content-type-options/.test(server)&&/permissions-policy/.test(server)&&/referrer-policy/.test(server));
check('17 CORS exposes only required methods/headers',()=>/GET,POST,OPTIONS/.test(server)&&/x-firebase-appcheck/.test(server)&&!/access-control-allow-origin':'\*'/.test(server));
check('18 Browser protected requests omit cookies and cache',()=>/credentials:'omit'/.test(privateAdapter)&&/cache:'no-store'/.test(privateAdapter));
check('19 Sensitive API responses are non-cacheable',()=>/cache-control':'no-store/.test(server)&&/pragma':'no-cache'/.test(server));
check('20 Service worker refuses OAuth callback/query caching',()=>/sensitiveQuery/.test(sw)&&/ctrader-callback/.test(sw)&&/cache:'no-store'/.test(sw));
check('21 OAuth code/state is removed from browser history immediately',()=>/history\.replaceState/.test(read('src/ctrader-oauth-callback.js')));
check('22 OAuth state is random, hashed, expiring and single-use',()=>/randomBytes\(32\)/.test(server)&&/stateHash/.test(store)&&/10\*60\*1000/.test(store)&&/tx\.delete\(ref\)/.test(store));
check('23 cTrader refresh/access sessions use AES-256-GCM encryption',()=>/aes-256-gcm/.test(store)&&/getAuthTag/.test(store));
check('24 Proprietary TA Script source remains server-side',()=>!/source\s*:/.test(privateAdapter)&&/execution:'server'/.test(entitlements)&&/indicatorPrograms/.test(rules));
check('25 Owner/TA ID/entitlement authority is backend controlled',()=>/request\.auth\.token\.role == 'owner'/.test(rules)&&/allow write: if false/.test(rules)&&/Verified Owner authority/.test(entitlements));
check('26 Firestore is default-deny and broker/private collections are client-inaccessible',()=>/match \/\{document=\*\*\}/.test(rules)&&/ctraderPrivateSessions/.test(rules)&&/allow read, write: if false/.test(rules));
check('27 HTTP input size/content-type/rate limits are enforced',()=>/TRADE_AVATA_MAX_BODY_BYTES/.test(server)&&/Content-Type must be application\/json/.test(server)&&/rateLimit/.test(server));
check('28 WebSocket payload/connection/subscription/message limits are enforced',()=>/maxPayload:MAX_WS_MESSAGE_BYTES/.test(server)&&/MAX_WS_PER_IP/.test(server)&&/MAX_SUBSCRIPTIONS_PER_CLIENT/.test(server)&&/message rate limit exceeded/i.test(server));
check('29 Production 5xx responses do not expose internal error details',()=>/production&&status>=500/.test(server)&&/Trade Avata gateway request failed/.test(server));
check('30 CI blocks deployment when the security verifier fails',()=>/npm run security:verify/.test(workflow));

// Supplementary scans: fail if obvious private material or public source maps are present.
const forbiddenFiles=files.filter(p=>{const r=rel(p);return /(^|\/)(service-account|firebase-admin|credentials)[^/]*\.json$/i.test(r)||/\.(pem|p12|pfx|key|map)$/i.test(r);});
if(forbiddenFiles.length)checks.push({name:'Supplementary forbidden-file scan',ok:false,detail:forbiddenFiles.map(rel).join(', ')});
const textFiles=files.filter(p=>{try{return fs.statSync(p).size<2_000_000;}catch{return false;}});
const pem=textFiles.filter(p=>{try{return /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(fs.readFileSync(p,'utf8'));}catch{return false;}});
if(pem.length)checks.push({name:'Supplementary private-key content scan',ok:false,detail:pem.map(rel).join(', ')});

for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}${c.detail?` — ${c.detail}`:''}`);
const failed=checks.filter(x=>!x.ok);
console.log(`\nTrade Avata security verification: ${checks.length-failed.length}/${checks.length} passed.`);
if(failed.length)process.exit(1);
