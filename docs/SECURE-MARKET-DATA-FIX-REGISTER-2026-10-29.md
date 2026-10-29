# Trade Avata SECURE — Market Data Fix Register — 2026-10-29

Purpose: preserve the exact fixes and acceptance work performed in `TRADE-AVATA-V12-SECURE/main` so a later production promotion can reproduce verified changes without relying on memory.

## Safety boundary
- Test repository only: `osuleugochukwu-del/TRADE-AVATA-V12-SECURE`, branch `main`.
- Production `TRADE-AVATA-V12-R5-FINAL` remains read-only during this stage.
- `TRADE-AVATA-NEXT/next-dev` remains untouched.
- Do not promote individual files blindly. Compare recorded commits/diffs and re-run acceptance tests on the production candidate.

## Genuine data and history rules
- No fake/demo/synthetic market prices or missing candles.
- Preserve genuine candles during disconnect/reconnect.
- Missing intervals are backfilled from genuine source data and merged/deduplicated.
- Historical paging must never recursively flood the VPS.
- Browser chart history is persisted with IndexedDB (`3d04961fc696e9f667a87c05216f96b64ebf7f76`).
- Progressive paging and viewport preservation: `b7edc818a1d011f4ae380d0ce8c9f09c3ca07831`, `60999b7993517c6dabc5b582cad209c6e6c74870`.

## Backend work already proven
- cTrader genuine XAUUSD live ticks/candles verified.
- Durable seconds history and backward pagination verified.
- 5s/15s/30s bucket alignment and recent gap/range integrity tested.
- The seconds archive is not the universal history limit for higher timeframes.

## Live recovery
- Socket health and market-data health are separate.
- Foreground/online recovery reasserts subscriptions/reconnects without synthetic bridge.
- Frontend hardening: `3b8e5a21ce286d698822461c655df3f321ea99c3`.
- Reconnect overlay correction: `4ad6351c46d6f1f36d123553dfa6c497c3c1438c`.

## Renko / Range promotion ledger
These SECURE changes are candidates for deliberate later porting to R5 after mobile acceptance:
- `b058870340a727abf903b7066cb486d87cace4bb`: Renko/Range use genuine 1s source.
- `e98d78fa8de284fc853f76216d81b7ec8a7fa059`: derived-period router activated.
- `63ee74299f7ef698d7ed739a9fc6b4cf974f6c01`: live developing Renko Time + genuine history bootstrap.
- `6aeb6e78e0025c73dda6c17562c98009ab3e9d89`: derived loader settles from usable requested-period data.
- `6548984c99c5f32dce5d5faa3072b89e151bdfcd`, `2a8596f37aa1f29ca4703af00361ab981284589e`: deeper genuine Renko history and derived paging routed through genuine 1s history.
- `6adeeac4ba2352d33c850e2de62713c31e92a909`: fast moves split into fixed-size Renko projection bricks rather than stretched bodies.
- `7de16459a0a64337978c3c948ae6771e2cdc07a3`: latest Renko acceptance repair. It enforces one-box continuation and two-box reversal behavior for live projection, keeps sub-threshold counter-moves developing rather than printing opposite completed bricks, persists genuine 1s derived-source history in IndexedDB, restores that source when a Renko period is re-selected, and publishes the full derived snapshot when a live move creates several bricks so intermediate bricks are not lost.

## Renko acceptance contract before R5 port
- No giant stretched Renko body; fast moves split into fixed-size bricks.
- Same-direction continuation: one full box.
- Completed reversal: two full boxes. Smaller counter-moves remain developing rather than becoming alternating completed red/green noise.
- Current Renko Time bucket can develop with genuine price movement.
- RT 5s, RT 1m and Renko Pips must reconstruct available historical structure from genuine source when selected; history must not begin at selection time.
- Left paging requests older genuine source and rebuilds the derived chart.
- No fabricated history.
- User mobile screenshots/manual tests are acceptance authority.

## Native chart polish
SECURE includes wick, narrower Renko body, responsive price-axis density, calendar hierarchy/separators and timestamp-first drawing projection. Activation: `0122a844e0e47dd79b1be8c771619934070c8645`.

## R5 promotion rule
- R5 stays read-only until SECURE acceptance is complete and the user explicitly authorizes the port.
- Do not copy SECURE files wholesale. Compare R5 architecture with each accepted SECURE diff and port behavior deliberately.
- Preserve existing R5 functionality/UI.
- Use this register and Git commit diffs as the source of truth, not chat memory alone.
- After porting, run focused smoke tests for live feed, reconnect, history/cache, Renko Time, Renko Pips, Range, axes, drawings, indicators and mobile interaction.

## Still requiring acceptance/diagnosis
- Mobile test of `7de16459a0a64337978c3c948ae6771e2cdc07a3` for RT 5s/RT 1m/Renko Pips noise and history.
- Indicator phone performance and prepend integrity.
- Calendar/drawing mobile acceptance.
- Permanent live reconnect root-cause diagnosis and recovery tests.
- Multi-symbol/load/reboot/higher-timeframe backend acceptance before final production promotion.
