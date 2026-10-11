# Trade Avata Integration Contract — TA Script R4

## Private owner-default indicator

Gold Hunter should be represented as a backend entitlement (for example `gold-hunter-v4`). Its TA Script declares `access owner_or_grant`, `default_attach owner`, and `grant_via ta_id`.

At sign-in / workspace restore the platform should:

1. authenticate the account;
2. obtain server-verified role/entitlements;
3. auto-attach Gold Hunter only for the verified owner when it is not already attached to that workspace;
4. allow another account to add/use it only when the backend confirms an active grant created for that account/TA ID;
5. re-check entitlement on expiry/revocation according to the platform's entitlement policy.

Never make client-side TA ID comparison the security authority.

## Running / Attached Indicators UI

Preserve the existing indicator menu/settings experience. Add a Running / Attached Indicators surface showing every indicator instance on the active chart.

Per instance controls:

- Eye: show/hide without deleting settings.
- Edit: open the existing professional settings modal for that exact instance.
- Remove: detach only that instance after the normal UI action.
- Label: use the script/native automatic parameter-derived name unless a supported custom label is set.
- Pane: preserve overlay/oscillator placement.

The list must update immediately when an indicator is added, hidden, edited, removed, restored from workspace sync, or revoked by authorization.

## Instance state

A chart/workspace should persist an instance record similar to:

```text
instanceId
script/indicator id
version/revision
input values
style values
visible
pane
order
entitlement id (when protected)
```

Entitlement ownership/grants stay in the backend and are not deleted when an indicator instance is removed from one chart.

## Cross-device note

Instance/workspace state can participate in Trade Avata account sync, while access decisions remain server-authoritative. Linked workspaces may mirror indicator changes live; independent workspaces must remain independently usable on another device.
