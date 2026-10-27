# Trade Avata cTrader frontend history contract

Status: frontend-prepared; Oracle implementation/testing still required.

## Non-negotiable rule
No genuine market data means no candle. The configured live deployment must never substitute generated/demo OHLC.

## History request
```json
{"type":"history","requestId":"...","symbol":"XAUUSD","period":{"mode":"time","value":"1m"},"limit":1000,"count":1000,"direction":"initial"}
```
Older page adds `before` and `beforeTs` in Unix milliseconds plus `direction:"older"`.

## History response
```json
{"type":"history","requestId":"...","symbol":"XAUUSD","period":{"mode":"time","value":"1m"},"bars":[],"hasMore":true,"nextBefore":0,"direction":"older"}
```
Bars may use `time`, `ts`, `timestamp` or `openTime`; frontend normalizes to Unix seconds and OHLC numbers. Pages are merged and deduplicated by timestamp.

## Loading policy
Initial page is 1000 bars. Approaching the chart's left edge requests another older page. Continue until `hasMore:false`. The browser keeps a bounded session cache for fast timeframe switching; the gateway remains authoritative.

## Timeframes
The gateway may supply native cTrader history for standard periods from seconds through minutes/hours/day/week/month. Custom fixed intervals can be derived from genuine lower-period data. Monthly aggregation is calendar aligned, not a fixed 30-day approximation.

## Chart constructions
Candles/bars use genuine OHLC. Line/area use genuine close values. Heikin-Ashi derives from genuine OHLC. Renko and Range derive deterministically from genuine source prices and must never use synthetic fallback data.

## Live continuity
Historical closed bars and live forming bars share the same symbol/period identity and timestamp convention. Backend must bridge history through the latest closed bar before streaming the forming bar; frontend merges/deduplicates but does not fabricate missing periods to conceal server gaps.

## Backend work remaining
Implement `before` paging for persisted seconds and cTrader trendbars, return `hasMore/nextBefore`, keep standard timeframe history current through the latest closed period, support requested symbols/timeframes, and verify restart/reconnect recovery.

## Production rule
Do not transfer this integration to production until V12 Secure passes genuine-history, live-bar, timeframe-switch, left-scroll paging, custom-chart and restart/reconnect tests.