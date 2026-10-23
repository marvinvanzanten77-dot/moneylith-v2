# Compact, installable Moneylith

The smartphone presentation reuses ApplicationLayout, workspace navigation, the existing data/models, forms, ProjectionView, BankSpendingOverview, AiAssistantCard and NotificationCenter. It introduces no second financial store. Desktop defaults to the full interface; widths below 768px, standalone display or `/?app=1` use the compact view. A device-local layout preference can override this. Full and compact views are both reachable.

## Essentials

Five bottom tabs: Vandaag, Potjes, Vooruit, Meldingen, Meer. Today derives a small overview from the existing projection engine: current available amount, seven-day expectation and at most three known upcoming payment moments. Retrieved personal bank balances are explicitly labeled with their fetch date and shown separately from spendable space; business-role accounts are excluded. Unknowns remain unknown. The other tabs reuse working screens. More contains account access, installation help, mode information, all existing sections and the full-layout switch. The shared AI assistant is available on demand. Navigation state is UI-only; mode changes retain the corresponding content tab without carrying financial values across contexts.

Fresh phone users can enter the overview directly and log into the existing account. Existing desktop onboarding remains available. Financial records remain in the existing browser/account storage. Installing on another device does not itself copy browser-only records: use the Moneylith login/account storage.

## Installation and network handling

`manifest.webmanifest` supplies standalone display, stable app ID, root scope, `/?app=1` start URL and PNG icons derived from the existing logo. Index includes manifest, Apple touch icon and viewport/safe-area metadata. InstallApp uses the browser's actual install prompt when offered, with manual Safari/Android directions as fallback; it never claims success without browser feedback.

The service worker caches **only `/offline.html`**. HTML navigation is network-first without persisting the live application. All `/api/` routes, POSTs and other origins bypass the worker; bank/account/chat/notification responses are never cached by it. Existing browser storage behavior is unchanged. A disconnected launch shows the public offline page. An already open compact app displays an offline state and offers reload on reconnect. It does not promise background sync or silently reload while the user is editing. New server/client builds are fetched from the network rather than held in an app-shell cache.

## Scope and validation

This is an installable web app, not an App Store/Google Play release. Web Push can be enabled per device in Meldingen. A production cron fetches and processes linked Lunch Flow accounts three times daily. Bankgegevens bijwerken runs the same account scan on demand. Open account-connected devices check cloud revisions every thirty seconds and on returning to the app. Disjoint changes merge; same-field conflicts retain local edits and require resolution. See push-notifications.md. Physical-device installation must still be checked by the owner on their own phone; browser emulation cannot demonstrate an actual iOS/Android home-screen installation.

Regression checks cover compact/full selection, unknown versus zero, seven-day engine reuse, business separation, retrieved bank balances, manifest/icon hosting, and a worker harness proving only public offline content is cached. Browser checks cover new-user entry, essential tabs, mode switching, existing forms/account/bank access, reload, multiple narrow widths, desktop layout, manifest validity and offline/reconnect behavior.

## App updates

Use **Meer → App bijwerken** on the phone, or **App bijwerken** in the desktop sidebar. Save open edit forms first. The button fetches the deployment's uncached `app-version.json`, updates the existing service worker, waits for activation, flushes an active cloud sync and navigates to a fresh document while retaining query/hash navigation. A failed check/save leaves the current screen open. The service worker uses uncached navigation requests. No unregister, storage clear, sign-out or push resubscription occurs. The version marker is generated once per build and served without caching. One ordinary reload is needed to obtain this button in apps opened before its introduction; subsequent releases use the button.
