import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('S1 security hardening is additive and loaded before protected adapters',()=>{
  const html=read('index.html');
  assert.ok(html.indexOf('./src/live-ready-config.js')<html.indexOf('./src/security-guard.js'));
  assert.ok(html.indexOf('./src/security-guard.js')<html.indexOf('./src/firebase-auth-adapter.js'));
  assert.match(html,/upgrade-insecure-requests/);
});

test('Firebase App Check is wired from browser to protected backend requests',()=>{
  const auth=read('src/firebase-auth-adapter.js');
  const privateAdapter=read('src/private-indicator-adapter.js');
  const ctrader=read('src/ctrader-feed-adapter.js');
  assert.match(auth,/initializeAppCheck/);
  assert.match(auth,/X-Firebase-AppCheck/);
  assert.match(privateAdapter,/X-Firebase-AppCheck/);
  assert.match(ctrader,/app-check-ok/);
});

test('gateway is fail-closed for production Origin and App Check',()=>{
  const server=read('gateway/server.js');
  assert.match(server,/if\(production\)return false/);
  assert.match(server,/verifyAppCheckRequest/);
  assert.match(server,/app-check-required/);
  assert.match(server,/strict-transport-security/);
});

test('service worker never persists cTrader OAuth callback codes or states',()=>{
  const sw=read('sw.js');
  assert.match(sw,/sensitiveQuery/);
  assert.match(sw,/ctrader-callback/);
  assert.match(sw,/cache:'no-store'/);
});

test('Firestore remains deny-by-default and private/server collections stay inaccessible',()=>{
  const rules=read('firestore.rules');
  assert.match(rules,/match \/indicatorPrograms\/\{indicatorId\}/);
  assert.match(rules,/match \/ctraderPrivateSessions\/\{docId\}/);
  assert.match(rules,/match \/\{document=\*\*\}/);
  assert.match(rules,/allow read, write: if false/);
});
