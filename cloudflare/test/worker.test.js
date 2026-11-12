import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('health endpoint identifies scaffold as not market-ready', async () => {
  const response = await worker.fetch(new Request('https://staging.example/health'), {
    TRADE_AVATA_STAGE: 'scaffold'
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.marketTransportReady, false);
  assert.equal(body.liveFrontendSwitchAllowed, false);
});

test('market websocket route stays closed until upstream is implemented', async () => {
  const response = await worker.fetch(new Request('https://staging.example/ws/market', {
    headers: { Upgrade: 'websocket' }
  }), {});
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
});
