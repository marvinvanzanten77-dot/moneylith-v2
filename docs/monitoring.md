# Monitoring and shared notifications

This milestone adds a personal, account-bound notification feed to the existing application layout. Business mode does not expose personal notices. Local-only storage has an explanatory state, not a simulated account feed.

## Data flow

While the page is visible, the browser checks every minute and after a successful cloud save. `POST /api/cloud?action=monitoring` authenticates the existing verified owner session and evaluates the encrypted cloud snapshot. It never accepts transaction data, account identity or calculated signals from the request. Editing records or syncing bank data reaches the evaluator through the existing cloud save. The evaluator does not fetch from the bank or modify financial records.

The same endpoint returns the feed and accepts optional `update` actions: `read`, `dismiss`, or `preferences` (enabled and mutedLabels). A future authenticated mobile client can reuse this domain contract. It will still require appropriate mobile authentication, device registration and push delivery; none is claimed to exist in this release.

## Signals and limits

- Existing personal category budgets: notification at 80% used or above budget; confirmed zero is valid, unknown is not zero. Duplicate budgets do not create a judgment.
- Without a budget: comparable month-to-date observed purchases at least 50% and €25 higher, with at least three purchases in each period.
- Encouraging observation after day 20 when purchases are at least 20% and €25 lower, also with three purchases per period. Explicitly not a claim of proven savings.
- Three or more unclassified purchases: invitation to use Patronen.
- Uses the existing spending classifier. Transfers, topups, lending, fixed costs, business accounts and future transactions are excluded.
- All selected personal Lunch Flow accounts need a known successful fetch time no older than 72 hours. Old data suppresses new signals. The oldest fetch time is shown. Provider fetch does not prove bank freshness or complete history. Refunds are not netted.
- Stable identity by scope/month/kind/category. Repeat checks and syncs do not duplicate or reset read/dismiss state. Changed evidence updates the existing notice. This deliberately does not issue an additional popup when a near-budget notice subsequently exceeds its budget.
- No unnecessary-spending judgment, automatic new budget, forecast assertion or invented income. AI income-opportunity coaching remains in Vooruitblik; recurring-income detection and cash-pressure alerts are not introduced here.

## Persistence and AI

Notifications/preferences are encrypted with the existing cloud encryption helper in an independent per-account Redis document `ml:monitoring:v1:<account>`. Optimistic compare-and-set retries preserve concurrent read/dismiss actions without touching the financial snapshot revision. Keep at most 200 notices. No transaction description or account identifier is stored in a notice. Category labels remain personal information, protected by the same account boundary.

AI is requested explicitly per active notice through the existing analyse route, rate limiting, Turnstile and qualitative response guard. Server resolves the authenticated account and stored active notice; only kind and category label enter the prompt. No client-submitted financial context is trusted. Canceled UI requests cannot display in another mode. AI failure leaves the deterministic notification usable.

## Not yet provided

No native mobile application, push transport/device tokens, scheduled bank synchronization, background monitoring while all clients are closed, or public multi-user bank platform. There is no operating-system browser notification permission prompt. Website alerts appear inside the application. Pausing and muting are account-wide. A stale or incomplete cloud snapshot can only produce correspondingly limited observations.

## Verification

Regression tests cover budget thresholds, zero/unknown, identity and mode isolation, freshness, elapsed-day comparisons, supportive progress, unknown categories, deduplication/read/dismiss, preferences, encrypted persistence and concurrent updates, authenticated API/CSRF, and minimized AI context. Isolated browser fixtures cover desktop/mobile and a second browser context; no real bank transactions are created for testing.
