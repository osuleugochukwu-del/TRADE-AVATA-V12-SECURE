# Trade Avata V12 R2 Preservation Audit

## Authority order
1. **Primary working baseline:** user-supplied `Trade-Avata-JESUS-JESUS-V12-TA-SCRIPT-FULL(1).zip`.
2. **Preservation reference:** `osuleugochukwu-del/JESUS-JESUS-1/main`, inspected at `a65ffa6634b2fe905a87cae14210e00777a62355`.

V12 R2 corrects the uploaded V12 package. It does not roll the product back to JESUS-JESUS-1.

## File preservation result
- Original uploaded V12 files: **151**
- V12 R2 files before packaging: **156**
- Original V12 files accidentally missing: **0**
- One original example path intentionally removed because it carried external-platform branding:
  - `examples/ta-script/mt5-baseline-library.tas`
- That example is preserved under the Trade Avata-native name:
  - `examples/ta-script/trade-avata-indicator-library.tas`
- Other original V12 files retained: **150 / 150**
- Original files intentionally corrected/refreshed in R2 (including release reports/manifests): **24**
- Original files retained byte-for-byte: **126**
- New R2 files: **6**

## New R2 files
- `examples/ta-script/trade-avata-indicator-library.tas`
- `gateway/ta-script/index.js`
- `gateway/ta-script/lexer.js`
- `gateway/ta-script/parser.js`
- `gateway/ta-script/runtime.js`
- `tests/indicator-math-certification.test.js`

## Main intentional corrections
- TA Script-native Indicator Portal (`.tas` / `.taind` only).
- Portal build/test/install workflow correction.
- private commercial TA Script execution moved to secure gateway; source no longer returned to browser.
- certified indicator math edge cases and chart alignment corrections.
- Ichimoku/Alligator future rendering support without changing the real live-price edge.
- fractal and ZigZag pivot display correction.
- session-aware VWAP controls.
- Volume Profile naming correction.
- bounded/throttled TA Script live calculation so custom scripts do not block candle movement.
- release version/cache/baseline metadata corrected to V12 R2.
- external-platform indicator ecosystem branding removed from active V12 indicator paths.

## JESUS-JESUS-1 preservation checks
The existing verifier still fingerprints protected legacy files and boot-chain assets from the approved older platform. Critical unchanged files such as the core application, historical data layer, recovery layer, V11 correction layer and approved CSS assets remain protected by hash checks.

cTrader broker/live-feed infrastructure is intentionally retained. cTrader indicator source/import formats are not retained in the Indicator Portal.

## Final verification
- `npm test`: **158 / 158 passed**
- `npm run verify`: **PASS**
- `npm run verify:live-ready`: **265 / 265 passed**
- transition/Renko stress: **100,000 passed**
- Native v3 stress: **100,000 passed**
- Full Native stress: **100,000 passed**
- final parity stress: **1,000 passed**
- recursive JS/MJS syntax: **83 files passed**

No accidental baseline deletion was accepted in this V12 R2 package.
