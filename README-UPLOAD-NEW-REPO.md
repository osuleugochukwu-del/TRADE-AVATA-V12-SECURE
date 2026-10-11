# Trade Avata V12 R2 — upload this full package to a NEW repository

This directory is the complete corrected Trade Avata V12 R2 repository, not a small patch.

## Upload flow
1. Create a new empty GitHub repository.
2. Extract the supplied V12 R2 ZIP.
3. Upload **all contents at the ZIP root** into the new repository root.
4. Do not upload only `src/`; this package intentionally contains the preserved Trade Avata platform plus the corrected V12 systems.
5. Let GitHub Actions finish all included tests/verifiers before treating the new repository as the production source.

## Indicator ecosystem
Trade Avata indicators are native only:
- `.tas` — TA Script
- `.taind` — Trade Avata indicator package

External-platform indicator source formats are not part of the Trade Avata Indicator Portal. cTrader remains the broker/live-feed connection.

## Protected Gold Hunter deployment
The proprietary Gold Hunter TA Script is intentionally **not stored in this public repository**.

From the secure gateway/server environment, set:
- `TA_PRIVATE_INDICATOR_FILE` to the owner-held Gold Hunter `.tas` source path
- the required Firebase Admin/backend environment

Then run inside `gateway/`:

```bash
npm run seed:private-indicator
```

The private source remains server-side. Licensed browsers receive calculated results, not the proprietary TA Script source.

## Live cTrader feed
After the repository is deployed and verified, configure the chosen Trade Avata backend/subdomain and the cTrader gateway environment. Do not place cTrader secrets or Firebase Admin credentials in the frontend/public repository.

## Never commit
Do not commit broker client secrets, Firebase Admin credentials, private Gold Hunter source, refresh/access tokens, encryption keys or other private server credentials.
