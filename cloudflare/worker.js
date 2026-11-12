/**
 * Trade Avata Cloudflare gateway — isolated migration scaffold.
 *
 * This intentionally exposes health only. The market WebSocket route remains closed
 * until the cTrader upstream transport, OAuth/session storage, history paging and
 * load tests are implemented. Do not point the live frontend at this scaffold.
 */
export class MarketRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return new Response("Market gateway transport is not enabled.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "trade-avata-market-gateway",
        stage: env.TRADE_AVATA_STAGE || "unknown",
        marketTransportReady: false,
        liveFrontendSwitchAllowed: false
      });
    }
    if (url.pathname === "/ws/market") {
      return json({
        ok: false,
        error: "Market transport is not enabled on this staging scaffold."
      }, 503);
    }
    return json({ ok: false, error: "Not found." }, 404);
  }
};
