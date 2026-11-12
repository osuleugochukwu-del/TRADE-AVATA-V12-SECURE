# Trade Avata — Browser-first Cloudflare market gateway

## Safety boundary

This work is isolated on branch `cloudflare-browser-first-market-gateway` in
`TRADE-AVATA-V12-SECURE`. It does not change R5-FINAL, production domains, the
approved chart interface, or the existing native candle renderer. The current
`market.tradeavata.com` endpoint remains the frontend target until a complete
staging gateway has passed verification.

The initial Cloudflare scaffold deliberately exposes only `GET /health`.
`/ws/market` returns HTTP 503 until the cTrader transport and all required
market-data behavior are implemented. This prevents an incomplete service from
being mistaken for a working live feed.

## Target architecture

- Browser: chart rendering, indicators, drawing tools, viewport navigation,
  local IndexedDB history cache, and optionally per-client derived periods.
- Cloudflare Worker: HTTPS routing, origin checks, authentication entry points,
  health/diagnostic endpoints, and rate limits.
- Cloudflare Durable Object: shared live-market room, browser WebSocket lifecycle,
  cTrader upstream session, subscription fan-out, and bounded history coordination.
- cTrader Open API: authoritative live quotes/ticks and historical trendbars/ticks.
- Secrets: cTrader client ID/secret and encryption key are Worker secrets, never
  frontend config, source files, public build variables, or browser messages.
- User authorization: each user authorizes their own cTrader account. User refresh
  tokens are encrypted at rest and never shared between users.

## Required implementation stages

1. **Scaffold and safety:** Worker entrypoint, Durable Object binding, staging-only
   health endpoint, closed market route. (This commit.)
2. **Protocol port:** port the existing JSON Open API message protocol to the
   Cloudflare runtime; validate outbound WebSocket behavior against cTrader demo.
   Add app authorization, account authorization, heartbeat, request correlation,
   timeouts, reconnect/backoff and clean shutdown.
3. **Public market feed:** symbol discovery, shared spot subscriptions, quote fan-out,
   market status, and server-side backpressure. No fake prices or synthetic history.
4. **History:** implement the existing browser `history` request contract
   (`symbol`, `period`, `limit/count`, `before/beforeTs`, `direction`,
   `requestId`, `hasMore`, `nextBefore`). This is essential because the
   existing Node gateway currently does not handle the browser's history message.
5. **15-second bars:** construct from genuine tick data. Backfill from genuine
   historical ticks; never infer unavailable prices from M1 candles.
6. **Personal accounts:** migrate OAuth state, token refresh, encrypted per-user
   sessions, Firebase identity verification, account snapshots, and existing
   indicator entitlement/program endpoints without weakening their authorization.
7. **Browser integration:** switch only the isolated SECURE branch after the new
   gateway passes protocol, history, reconnect, security and browser tests.
8. **Capacity and cost:** simulate 10, 50 and 100 concurrent browser clients;
   measure DO requests, duration, memory, upstream subscriptions and message fan-out.
   Do not claim 100-user capacity from registered-user counts alone.

## Compatibility checklist

- Preserve the existing frontend WebSocket message shapes: `hello`, `status`,
  `pong`, `history`, `bar`, `quote`, `account`, `positions`, `orders`,
  `trade-history`, `trade-event`, and `error`.
- Keep the existing `src/market-feed-adapter.js` and chart renderer stable.
- Keep Firebase App Check / identity verification and origin allowlists fail-closed
  in production.
- Keep cTrader credentials out of browser-visible configuration.
- Preserve demo/live environment separation.
- Never expose broker account identifiers unnecessarily in the UI or logs.
- Do not switch the frontend endpoint until the Cloudflare staging service has
  passed real cTrader demo tests and history paging tests.

## Deployment prerequisites

Before staging deployment, create the Durable Object SQLite binding/migration and
set secrets using Cloudflare's secret-management interface or Wrangler secret
commands. Secret values must be entered directly into the secure dashboard/CLI
prompt; they must not be pasted into chat or committed to Git. Configure only the
staging origin initially.
