# Smartphone push

Enable in the installed app → Meldingen → Meldingen aanzetten. Permission is requested only after a tap. iPhone/iPad require a Home Screen app and iOS/iPadOS 16.4+. Testmelding requests a real Web Push; API acceptance is not proof of receipt. Permission denial is explained. Disable and normal account logout remove the current device registration. Browser settings can revoke permission too. Other devices retain their own consent.

## Architecture and privacy

- Existing authenticated `/api/cloud?action=push` handles status, subscribe, unsubscribe and test. Existing owner verification, session cookie, Origin and custom-header checks apply. No public bank access.
- `server/push/service.ts` stores at most ten encrypted subscriptions per account in the existing Redis. Only known HTTPS Chrome/Firefox/Apple push hosts and valid keys are accepted, preventing arbitrary outbound requests. No subscription or finance data is logged.
- VAPID `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` and `CRON_SECRET` are server configuration. Only the public key is returned to the authenticated browser. Production only; local secrets are in ignored `.env.push.local`, mode 600. Keep keys stable; rotation requires devices to re-enable push.
- `/api/monitoring-cron`, three times daily at 07:00, 12:00 and 18:00 UTC on the existing Pro plan, requires the cron bearer secret, production environment and verified account. It first fetches the active, already linked Lunch Flow accounts, merges their balances and booked transactions into the encrypted cloud snapshot, then evaluates monitoring. A shared pure processor routes classification and opted-in latest income to the existing models. Provider freshness is not guaranteed; this does not force an ING refresh.
- Interactive monitoring refreshes the in-app view only; automatic push dispatch runs solely on the three scheduled checks. The explicit Testmelding button remains available. No changes to financial snapshots.
- Every completed scan records a truthful success/partial/failure receipt, even without a new budget signal. Only new personal notices created after device enrollment are eligible. Read, dismissed, inactive, muted and paused notices are suppressed. One aggregate generic push per device per run. No financial fields in payloads or lock-screen text. Click opens the personal Meldingen screen, including from a previously business-mode browser.
- Per-device Redis locks suppress concurrent dispatch; durable per-notice markers deduplicate subsequent runs for 120 days. Retry on failure; remove 404/410 endpoints. Test is limited to once per minute per device. Push TTL is one hour. A network timeout after provider acceptance or a crash before writing delivery markers can cause retry: exactly-once delivery is not guaranteed. The stable notification tag replaces an earlier outstanding notification.
- A push already accepted can arrive after pause, dismissal or removal; delivery depends on the OS, connectivity and focus settings. No delivery receipt is claimed. Subscription renewal is explicit if the browser drops a registration; the UI detects it on reopening. No silent permission requests.

## Validation

`tests/push.test.tsx`: URL/key validation, personal-only eligibility and preferences, encryption, account isolation, concurrent deduplication, retries, expiry, unregister, test throttling, session/Origin protection, cron authentication and safe service-worker payload/click behavior. Full regression suite, strict typecheck and production build must pass. Browser tests use simulated PushManager for deterministic permission/subscribe/test/disable/error UI; these are not physical-device receipt tests.

Production verification checks authenticated public-key configuration and cron execution, anonymous rejection and fresh deployed UI/worker. Actual smartphone receipt remains for the owner to verify with Testmelding.

Official references: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; https://github.com/web-push-libs/web-push ; https://vercel.com/docs/cron-jobs/manage-cron-jobs

## Account synchronization

`server/lunchflow/accountSync.ts` is called by the scheduled cron and authenticated `POST /api/cloud?action=bank-scan`. It only uses already linked, active accounts; never creates new accounts from the provider listing. A per-owner lock suppresses parallel scans, scheduled IDs deduplicate retries, and each encrypted write rebases on the current snapshot with CAS. Partial failures retain the failed accounts' prior data. The scan receipt is saved with the financial changes. No bank data is returned by the public cron route.

`src/bank/processSync.ts` is shared with the existing browser import. It preserves transaction enrichment, manual bills, budgets, loans, business books and chat. Known income with `followLatestBank` uses its latest matching receipt through the existing explicit evidence link, including a salary received on a business-designated bank account. Account roles still exclude other business transactions from automatic personal income recognition and personal spending. Unlinked/manual income remains unchanged. Bank-paid bills are not inferred as paid debts or settled invoices without explicit links. Forecast and pots derive from the refreshed existing stores. Same-date ambiguous income receipts still require review.

`refreshCloudChanges` performs three-way reconciliation per storage key and emits `moneylith:cloud-restored`; existing personal storage hooks respond without reloading the page. Same-key competing edits are surfaced, never overwritten. Account mode is required for cross-device updates; browser-only storage stays local. Explicitly unsaved form drafts are not auto-submitted.
