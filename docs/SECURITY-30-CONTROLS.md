# Trade Avata V12 R2 — Security S1: 30 controls

This security layer is **additive** to the exact V12 R2 package supplied by the owner. It does not redesign the chart, indicator calculations, TA Script, layouts, mobile behavior or approved UI. `JESUS-JESUS-1` remains a preservation/reference repository; the uploaded V12 R2 package remains the working baseline.

A browser-delivered frontend can never be made literally impossible to save. The objective is stronger: a copied frontend must not be able to operate as the real Trade Avata platform.

## The 30 controls

1. Preserve the V12 R2 baseline and make security changes additively.
2. Never commit real `.env`/secret files.
3. Ignore private keys, service-account JSON and source maps in Git.
4. Exclude common secret material from the gateway container build context.
5. Verify Firebase ID tokens on the backend and check revoked tokens.
6. Initialize Firebase App Check in the genuine Trade Avata web app.
7. Require valid App Check on protected HTTP API routes in production.
8. Require valid App Check before WebSocket market/account subscriptions.
9. Optionally pin App Check to the exact Firebase Web App ID.
10. Enforce exact browser Origin allowlists and fail closed in production.
11. Support an exact gateway Host allowlist.
12. Disable official backend endpoints in an unchanged frontend copy running on an unapproved origin.
13. Require HTTPS at the production gateway and send HSTS.
14. Use restrictive browser CSP directives and upgrade insecure requests.
15. Defend against clickjacking (`frame-ancestors`/`X-Frame-Options`).
16. Send `nosniff`, referrer and permissions security headers on API responses.
17. Restrict CORS methods and request headers to the Trade Avata API surface.
18. Use bearer/App Check headers with `credentials: omit`; do not depend on browser cookies for protected APIs.
19. Mark sensitive API responses `no-store`/`no-cache`.
20. Never cache cTrader OAuth callback URLs, codes, state or token-like query parameters in the service worker.
21. Remove one-time cTrader OAuth `code`/`state` from browser history immediately after capture.
22. Generate cryptographic OAuth state, store only its hash, expire it, and consume it once.
23. Encrypt cTrader server-side token/session data with AES-256-GCM.
24. Keep proprietary/private TA Script source server-side; clients receive metadata/results only.
25. Keep Owner, TA ID reservation and indicator entitlement authority on backend/custom claims, never editable browser state.
26. Keep Firestore default-deny; private indicator/broker/session collections are Admin-SDK-only.
27. Enforce HTTP request size, JSON content type, input validation and rate limits.
28. Enforce WebSocket payload, total connection, per-IP, subscription and message-rate limits.
29. Hide internal server error details for production 5xx responses.
30. Run an automatic security verifier in GitHub Actions before deployment.

## External activation that cannot be completed inside a ZIP

The code is wired and production-fail-closed, but these account/cloud steps still must be performed when the subdomain/backend is connected:

- Enable Firebase **App Check** for the Trade Avata web app and put the public site key in `src/live-ready-config.js`.
- Deploy this repository's `firestore.rules` to the `trade-avata` Firebase project.
- Deploy the `gateway/` service and set its Secret Manager/environment values.
- Set the exact production origin (recommended `https://chart.tradeavata.com`) and, after custom-domain launch, remove the temporary GitHub Pages origin.
- Add the final Trade Avata subdomain to Firebase Authentication authorized domains and configure the exact cTrader OAuth redirect URI.

Until the App Check key/backend are configured, the normal static chart can still load, but protected production backend features intentionally remain locked rather than falling back insecurely.
