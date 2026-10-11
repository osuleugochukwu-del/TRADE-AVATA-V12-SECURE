# Trade Avata Security Activation Checklist

Use this after the new repository is green and before requesting/activating the production cTrader feed.

1. Connect the intended chart subdomain (recommended: `chart.tradeavata.com`).
2. Add that domain to Firebase Authentication authorized domains.
3. Enable Firebase App Check for the existing Trade Avata Web App.
4. Turn on App Check enforcement for supported Firebase resources (especially Firestore) after confirming valid traffic in metrics.
5. Create/configure the reCAPTCHA Enterprise (or approved App Check) public site key for the Trade Avata domain.
6. Put only that **public site key** into `src/live-ready-config.js`; never put a private secret there.
7. Deploy `firestore.rules`.
8. Deploy `gateway/` behind HTTPS using Secret Manager/workload identity.
9. Set `TRADE_AVATA_REQUIRE_APP_CHECK=true` and the existing Firebase Web App ID.
10. Set `TRADE_AVATA_ORIGIN=https://chart.tradeavata.com`.
11. Configure the exact cTrader redirect URI and cTrader secrets on the backend only.
12. Put the gateway public HTTPS address in `src/live-ready-config.js`.
13. Re-run `npm run security:verify`, `npm test`, all verify suites and stress suites.
14. Confirm copied deployment on an unapproved origin cannot use the official backend/live feed/private indicators.
15. Remove the temporary GitHub Pages origin from backend/App Check allowlists once the custom domain is the production entry point.
