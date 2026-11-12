import test from 'node:test';
import assert from 'node:assert/strict';
import { CTraderCloudflareConnection, CTraderPayload } from '../ctrader-connection.js';

class FakeSocket {
  static OPEN = 1;
  constructor() { this.readyState = 1; this.listeners = new Map(); this.sent = []; }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  send(raw) { this.sent.push(JSON.parse(raw)); }
  close() { this.readyState = 3; for (const fn of this.listeners.get('close') || []) fn({}); }
}

test('cTrader transport sends correlated JSON requests without Node-only dependencies', async () => {
  const connection = new CTraderCloudflareConnection({
    environment: 'demo',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    WebSocketCtor: FakeSocket,
    logger: { warn() {} }
  });
  connection.socket = new FakeSocket();
  const pending = connection.request(CTraderPayload.GET_TRENDBARS_REQ, {
    ctidTraderAccountId: '123', symbolId: '456', period: 1
  }, { expect: CTraderPayload.GET_TRENDBARS_RES, timeout: 1000 });

  const sent = connection.socket.sent[0];
  assert.equal(sent.payloadType, CTraderPayload.GET_TRENDBARS_REQ);
  assert.equal(sent.payload.symbolId, '456');
  connection.onMessage(JSON.stringify({
    clientMsgId: sent.clientMsgId,
    payloadType: CTraderPayload.GET_TRENDBARS_RES,
    payload: { trendbar: [{ utcTimestampInMinutes: 1 }] }
  }));
  const result = await pending;
  assert.equal(result.trendbar.length, 1);
});

test('cTrader error responses reject only their matching request', async () => {
  const connection = new CTraderCloudflareConnection({
    environment: 'demo', clientId: 'id', clientSecret: 'secret',
    WebSocketCtor: FakeSocket, logger: { warn() {} }
  });
  connection.socket = new FakeSocket();
  const pending = connection.request(CTraderPayload.GET_TICKDATA_REQ, {}, { timeout: 1000 });
  const sent = connection.socket.sent[0];
  connection.onMessage(JSON.stringify({
    clientMsgId: sent.clientMsgId,
    payloadType: CTraderPayload.ERROR_RES,
    payload: { errorCode: 'NOT_AUTHORIZED', description: 'Not authorized' }
  }));
  await assert.rejects(pending, /NOT_AUTHORIZED: Not authorized/);
});
