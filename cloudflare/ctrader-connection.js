/**
 * Cloudflare-runtime cTrader Open API JSON WebSocket transport.
 * No Node ws/crypto dependencies: uses Workers' global WebSocket and crypto.randomUUID.
 * Credentials are supplied from Worker secrets by the Durable Object only.
 */
export const CTraderPayload = Object.freeze({
  HEARTBEAT: 51,
  APP_AUTH_REQ: 2100, APP_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103,
  SYMBOLS_LIST_REQ: 2114, SYMBOLS_LIST_RES: 2115,
  SYMBOL_BY_ID_REQ: 2116, SYMBOL_BY_ID_RES: 2117,
  TRADER_REQ: 2121, TRADER_RES: 2122, TRADER_UPDATE: 2123,
  RECONCILE_REQ: 2124, RECONCILE_RES: 2125, EXECUTION_EVENT: 2126,
  SUBSCRIBE_SPOTS_REQ: 2127, SUBSCRIBE_SPOTS_RES: 2128,
  UNSUBSCRIBE_SPOTS_REQ: 2129, UNSUBSCRIBE_SPOTS_RES: 2130, SPOT_EVENT: 2131,
  DEAL_LIST_REQ: 2133, DEAL_LIST_RES: 2134,
  GET_TRENDBARS_REQ: 2137, GET_TRENDBARS_RES: 2138,
  GET_TICKDATA_REQ: 2145, GET_TICKDATA_RES: 2146,
  ACCOUNTS_BY_TOKEN_REQ: 2149, ACCOUNTS_BY_TOKEN_RES: 2150,
  ACCOUNT_LOGOUT_REQ: 2162, ACCOUNT_LOGOUT_RES: 2163,
  ORDER_LIST_REQ: 2175, ORDER_LIST_RES: 2176,
  POSITION_PNL_REQ: 2187, POSITION_PNL_RES: 2188,
  ERROR_RES: 2142
});

const endpoint = environment => environment === 'demo'
  ? 'wss://demo.ctraderapi.com:5036'
  : 'wss://live.ctraderapi.com:5036';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class CTraderCloudflareConnection extends EventTarget {
  constructor({ environment = 'demo', clientId, clientSecret, WebSocketCtor = WebSocket, logger = console } = {}) {
    super();
    this.environment = environment === 'live' ? 'live' : 'demo';
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.WebSocketCtor = WebSocketCtor;
    this.logger = logger;
    this.socket = null;
    this.pending = new Map();
    this.readyPromise = null;
    this.heartbeatTask = null;
    this.authenticatedAccounts = new Set();
    this.closedByOwner = false;
    this.reconnectAttempt = 0;
  }

  get isOpen() { return this.socket?.readyState === 1; }

  async connect() {
    if (this.readyPromise) return this.readyPromise;
    if (!this.clientId || !this.clientSecret) throw new Error('cTrader application credentials are not configured.');
    this.closedByOwner = false;
    this.readyPromise = new Promise((resolve, reject) => {
      const socket = new this.WebSocketCtor(endpoint(this.environment));
      this.socket = socket;
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`cTrader ${this.environment} connection timed out.`));
        try { socket.close(4000, 'connection-timeout'); } catch {}
      }, 15000);
      socket.addEventListener('open', async () => {
        try {
          await this.request(CTraderPayload.APP_AUTH_REQ, {
            clientId: this.clientId,
            clientSecret: this.clientSecret
          }, { expect: CTraderPayload.APP_AUTH_RES, timeout: 12000 });
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.dispatchEvent(new Event('ready'));
          resolve(this);
        } catch (error) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
          try { socket.close(4001, 'app-auth-failed'); } catch {}
        }
      });
      socket.addEventListener('message', event => this.onMessage(event.data));
      socket.addEventListener('close', () => this.onClose());
      socket.addEventListener('error', () => this.logger.warn?.(`[cTrader ${this.environment}] WebSocket error.`));
    }).catch(error => {
      this.readyPromise = null;
      throw error;
    });
    return this.readyPromise;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    const beat = async () => {
      if (this.closedByOwner || !this.isOpen) return;
      try { this.sendRaw({ clientMsgId: crypto.randomUUID(), payloadType: CTraderPayload.HEARTBEAT, payload: {} }); }
      catch (error) { this.logger.warn?.('[cTrader] Heartbeat send failed.', error?.message || error); }
      this.heartbeatTask = wait(10000).then(beat);
    };
    this.heartbeatTask = wait(10000).then(beat);
  }

  stopHeartbeat() { this.heartbeatTask = null; }

  sendRaw(message) {
    if (!this.isOpen) throw new Error('cTrader socket is not open.');
    this.socket.send(JSON.stringify(message));
  }

  request(payloadType, payload = {}, { expect, timeout = 15000 } = {}) {
    const clientMsgId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(clientMsgId);
        reject(new Error(`cTrader request ${payloadType} timed out.`));
      }, timeout);
      this.pending.set(clientMsgId, { resolve, reject, timer, expect });
      try { this.sendRaw({ clientMsgId, payloadType, payload }); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(clientMsgId);
        reject(error);
      }
    });
  }

  onMessage(raw) {
    let message;
    try { message = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); }
    catch { return; }
    const pending = message.clientMsgId && this.pending.get(message.clientMsgId);
    if (pending && (message.payloadType === CTraderPayload.ERROR_RES || message.payload?.errorCode)) {
      clearTimeout(pending.timer);
      this.pending.delete(message.clientMsgId);
      pending.reject(new Error(`${message.payload?.errorCode || 'CTRADER_ERROR'}: ${message.payload?.description || 'Request failed'}`));
    } else if (pending && (!pending.expect || pending.expect === message.payloadType)) {
      clearTimeout(pending.timer);
      this.pending.delete(message.clientMsgId);
      pending.resolve(message.payload || {});
    }
    this.dispatchEvent(new CustomEvent('message', { detail: message }));
    this.dispatchEvent(new CustomEvent(`payload:${message.payloadType}`, { detail: message.payload || {} }));
  }

  onClose() {
    this.stopHeartbeat();
    this.readyPromise = null;
    this.authenticatedAccounts.clear();
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('cTrader connection closed.'));
      this.pending.delete(id);
    }
    this.dispatchEvent(new Event('close'));
  }

  async ensureAccount(accountId, accessToken) {
    await this.connect();
    const id = String(accountId);
    if (this.authenticatedAccounts.has(id)) return;
    await this.request(CTraderPayload.ACCOUNT_AUTH_REQ, {
      ctidTraderAccountId: id, accessToken
    }, { expect: CTraderPayload.ACCOUNT_AUTH_RES });
    this.authenticatedAccounts.add(id);
  }

  async getSymbols(accountId) {
    const result = await this.request(CTraderPayload.SYMBOLS_LIST_REQ, {
      ctidTraderAccountId: String(accountId), includeArchivedSymbols: false
    }, { expect: CTraderPayload.SYMBOLS_LIST_RES });
    return result.symbol || [];
  }

  async getFullSymbols(accountId, ids) {
    const result = await this.request(CTraderPayload.SYMBOL_BY_ID_REQ, {
      ctidTraderAccountId: String(accountId), symbolId: ids.map(String)
    }, { expect: CTraderPayload.SYMBOL_BY_ID_RES });
    return result.symbol || [];
  }

  async subscribeSpots(accountId, ids) {
    return this.request(CTraderPayload.SUBSCRIBE_SPOTS_REQ, {
      ctidTraderAccountId: String(accountId), symbolId: ids.map(String), subscribeToSpotTimestamp: true
    }, { expect: CTraderPayload.SUBSCRIBE_SPOTS_RES });
  }

  async unsubscribeSpots(accountId, ids) {
    return this.request(CTraderPayload.UNSUBSCRIBE_SPOTS_REQ, {
      ctidTraderAccountId: String(accountId), symbolId: ids.map(String)
    }, { expect: CTraderPayload.UNSUBSCRIBE_SPOTS_RES });
  }

  async getTrendbars(accountId, symbolId, period, { fromTimestamp, toTimestamp, count = 1800 } = {}) {
    return this.request(CTraderPayload.GET_TRENDBARS_REQ, {
      ctidTraderAccountId: String(accountId), symbolId: String(symbolId),
      period, fromTimestamp, toTimestamp, count
    }, { expect: CTraderPayload.GET_TRENDBARS_RES, timeout: 20000 });
  }

  async getTicks(accountId, symbolId, type, { fromTimestamp, toTimestamp } = {}) {
    return this.request(CTraderPayload.GET_TICKDATA_REQ, {
      ctidTraderAccountId: String(accountId), symbolId: String(symbolId),
      type, fromTimestamp, toTimestamp
    }, { expect: CTraderPayload.GET_TICKDATA_RES, timeout: 20000 });
  }

  stop() {
    this.closedByOwner = true;
    this.stopHeartbeat();
    try { this.socket?.close(1000, 'shutdown'); } catch {}
    this.socket = null;
    this.onClose();
  }
}
