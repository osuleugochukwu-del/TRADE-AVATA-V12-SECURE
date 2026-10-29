# Trade Avata SECURE — Market Data Fix Register — 2026-10-29

Purpose: preserve the exact fixes and acceptance work performed in `TRADE-AVATA-V12-SECURE/main` so a later production promotion can reproduce verified changes without relying on memory.

## Safety boundary
- Test repository only: `osuleugochukwu-del/TRADE-AVATA-V12-SECURE`, branch `main`.
- Production `TRADE-AVATA-V12-R5-FINAL` remains read-only during this stage.
- `TRADE-AVATA-NEXT/next-dev` remains untouched.
- Do not promote individual files blindly. Compare the recorded commits/diffs and re-run acceptance tests on the production candidate.

## Genuine data rules
- No fake/demo/synthetic market prices or missing candles.
- Preserve genuine candles during disconnect/reconnect.
- Missing intervals are backfilled from genuine source data and merged/deduplicated.
- Historical paging must never recursively flood the VPS.

## VPS/backend work already proven
- cTrader genuine XAUUSD live ticks/candles verified.
- SQLite durable seconds history active at `/var/lib/ocarun/trade-avata-market/seconds-history.sqlite3`.
- 7-day genuine tick backfill completed: 82 pages, 372,046 rows, 2026-10-22T03:39:01Z through 2026-10-29T03:41:09Z, 168.04 hours.
- SQLite backward pagination passed with no overlap.
- End-to-end 30s older-history request reached VPS and displayed older data.
- 5s/15s/30s bucket alignment and recent gap/range integrity tests passed.
- Log rotation configured and tested.
- User-level systemd service configured; deliberate reboot recovery test still remains.

## Frontend historical-loading architecture
- Historical requests use small viewport-aware pages: minimum 250, maximum 500 bars.
- One deliberate left-navigation gesture may trigger at most one older-page request.
- A prepend caused by a history response must not recursively trigger another request.
- Preserve the visible logical viewport after prepend.
- Previously fetched genuine bars are reused from browser cache before new network requests.
- Current immediate cache is session-based and capped at 10,000 bars; final persistent cache should use IndexedDB keyed by symbol + timeframe + time range so refresh/browser restart does not lose downloaded history.
- Normal interactive chart entitlement proposal: 10,000 bars standard, up to 15,000 upper normal-analysis tier; deeper backtesting uses a separate path. Enforce entitlements server-side against authenticated Trade Avata account/TA ID when product tiers are implemented.
- Higher timeframes must have appropriate genuine historical sources; the 7-day seconds archive is not a universal chart-history limit.

## Frontend initial-load correction
- Normal time-chart initial history target reduced from 1,800 to 500 bars.
- Renko/Range/Tick initial source requests reduced from very large 6,000–30,000/12,000–20,000 bursts to bounded working requests (normally 500–2,000 depending on construction).
- Deep history is progressive/cache-first instead of being loaded on every timeframe change.

## Live connection/recovery correction
- Socket health and market-data health are separate concepts.
- Track last genuine `bar`/`quote`/history market-data time separately from generic WebSocket heartbeat traffic.
- A live socket with stale market data must reassert subscriptions and then force reconnect if genuine data does not resume promptly.
- Foreground/pageshow/online events immediately reassert subscriptions or reconnect; do not wait for long backoff after a phone/browser resumes.
- Reconnect preserves existing genuine candles; no blank-chart recovery and no synthetic bridge.
- Genuine bar/quote receipt returns UI status to LIVE.
- Current frontend hardening commit: `3b8e5a21ce286d698822461c655df3f321ea99c3`.
- Progressive initial-load commit: `f92a933cce37e1ed6866c5afdd500776b855e4ac`.
- Historical paging/viewport commit: `60999b7993517c6dabc5b582cad209c6e6c74870`.

## Native chart polish correction — 2026-10-29
Implemented in additive `src/chart-polish-fix.js` and loaded only by SECURE:
- Ordinary candle wick is rendered as one continuous high-to-low physical-pixel-aligned stroke before the body. No split upper/lower wick geometry is introduced.
- Wick strength is kept crisp on high-DPI/mobile displays without changing OHLC values.
- Renko body width is reduced from near-full-slot square geometry to a narrower candle-like brick. Renko price construction/reversal logic is unchanged.
- Right price-axis target density is responsive to available main-pane height, with a bounded maximum to avoid label crowding.
- Bottom axis gains explicit calendar hierarchy at real boundaries: intraday time remains native; day boundaries receive date labels; month boundaries receive full month names such as February/March; year boundaries receive year labels.
- Day/month/year boundaries receive progressively clearer vertical separators while candles remain visually dominant.
- Drawing projection is timestamp-first. Stored logical index is only a fallback, so a drawing made on 30s can project to the same market time/price when switching to 15s/1m/etc. Symbol/pane ownership remains intact.
- Activation commit: `0122a844e0e47dd79b1be8c771619934070c8645`.

## Indicator/render performance diagnosis
Observed sequence: candles render first and feel smooth; synchronous indicator calculation/application follows and can make the phone chart feel heavy or visibly settle/re-shape.
Required final rule:
- candle/native interaction owns the critical frame;
- indicator calculation must not repeatedly rebuild the viewport or main candle geometry;
- live updates should update only changed indicator state where mathematically possible;
- historical prepend should calculate only required added history/state rather than repeatedly rebuilding thousands of unchanged points;
- indicator work should yield/defer around active pointer interaction;
- EMA is the first visible symptom, but the solution must apply to the indicator pipeline generally (RSI/MACD/private indicators included).
Existing `dense-pan-fix.js` already frame-caches native geometry and coalesces dense drag paints, but synchronous `computeIndicator()` in `ChartPane.rebuildSeries()` still requires a dedicated calculation-pipeline refactor. Do not mark this complete until measured on phone with indicators enabled.

## UI issues identified / remaining
- Timeframe transition loader should remain compact: three-dot pulse + concise `Loading <tf>…`; remove tiny explanatory secondary sentence that extends the pill unnecessarily.
- EMA/indicator integrity and performance must be re-tested after history prepends; indicators must stay attached to the correct chronological candle series and must not disturb viewport geometry.
- Calendar/date/month/year axis and drawing timestamp projection are implemented in SECURE but still require browser/mobile acceptance testing before production promotion.

## Persistent browser-cache target
Final design:
1. Check IndexedDB for requested symbol/timeframe/range.
2. Cache hit: render locally; zero VPS historical request.
3. Cache miss: request only missing 250–500-bar section.
4. Persist genuine response to IndexedDB.
5. Keep only a bounded working window actively rendered to protect trader CPU/RAM.
6. Live edge continues to update normally and cached history remains available after refresh/crash/restart.

## Current outage to diagnose when local power/terminal access returns
Observed browser state: SECURE chart can remain `RECONNECTING` after refresh while candles stop ticking, although VPS previously appeared healthy. Do not assume frontend or backend cause without tracing the live chain.

Run diagnostics one command at a time:
1. systemd service status.
2. confirm engine process/listener on 8765.
3. inspect recent engine errors/live cTrader events.
4. test local WS/gateway path as appropriate.
5. inspect Caddy reverse-proxy/WSS state.
6. test public `market.tradeavata.com/ws/market` path.
7. determine whether 7-day startup backfill blocks/interferes with live session/event loop.

The 7-day startup backfill is a proof mechanism, not the desired permanent restart architecture. Final backend should backfill only the missing recent gap on startup and use controlled/on-demand expansion for older history rather than redownloading seven overlapping days after every restart.

## Remaining acceptance before production promotion
- Compact loader UI.
- IndexedDB persistent history cache.
- Mobile/browser acceptance of crisp wick + narrow Renko geometry.
- Mobile/browser acceptance of day/month/year hierarchy and separators.
- Cross-timeframe drawing persistence test across 30s/15s/1m/5m and back.
- Dedicated incremental/deferred indicator calculation pipeline + phone performance test.
- EMA/indicator prepend integrity.
- Permanent live reconnect root-cause diagnosis + end-to-end test.
- Background/foreground automatic wake test.
- Network drop/recovery and genuine gap backfill test.
- Multi-symbol server generalization and tests.
- 10/25/50/100 concurrent-client load tests on 1 CPU/1 GB VPS.
- Deliberate VPS reboot recovery test.
- Higher timeframe genuine history policy/source tests (minute/hour/daily/weekly/monthly/custom).
- Freeze/document frontend ↔ VPS protocol contract before production promotion.
