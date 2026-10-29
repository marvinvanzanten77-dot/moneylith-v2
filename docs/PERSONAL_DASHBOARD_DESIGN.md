> Actuele vervolgstap: zie [PERSONAL_VISUAL_WORKSPACE.md](PERSONAL_VISUAL_WORKSPACE.md).
> De hieronder beschreven teruggenomen uitbreiding is inmiddels gevolgd door
> nieuw ontworpen detailpagina’s, zonder de oude schermopbouw te gebruiken.

# Huidige status — dashboard behouden, uitbreiding teruggenomen

De uitbreiding met oude functionele schermen is op verzoek teruggenomen.
Alleen het dashboard uit de referentieschets en zijn oorspronkelijke detailvensters
zijn gemonteerd. De nieuwe detailpagina’s en uitgebreide bewerkfuncties zijn nog
niet opnieuw ontworpen of aangesloten. De oude broncode, opslag en backend zijn
behouden. Er is niets gepubliceerd.

De geldende ontwerprichting staat in [PERSONAL_DESIGN_DIRECTION.md](PERSONAL_DESIGN_DIRECTION.md).

De onderstaande beschrijving en controles zijn een historisch verslag van de
**afgewezen, inmiddels losgekoppelde uitbreiding**, geen beschrijving van wat nu
in de preview beschikbaar is.

---

# Personal workspace — calm dashboard and connected detail pages

Local branch `personal/ui-reset`. Public and production remain unchanged.

## Design and connections

The supplied sketch guides the cream palette, mountain panorama, compact header,
four summary cards, upcoming obligations and responsive layout. The figures in
that sketch are not shipped as sample financial data.

`App` exposes a presentation callback; it retains its existing state, validation,
classification, storage handlers, bank processing, debt reconciliation and AI
snapshot. `PersonalShell` replaces the old ApplicationLayout only in this branch's
entry point. `presentPersonal` consumes that exact classified snapshot. Planning,
forecast and dashboard share projection options; no new financial source is created.

Six primary destinations: Overview, Planning, Spending, Forecast, Debts and Goals.
The menu adds Transactions, Assets, Accounts, Bank connections, Notifications,
AI, Intention, Settings, statement import and Backup. Detail dialogs lead directly
to the relevant editor. The header sync uses the existing authenticated bank scan.

- Planning: salary periods 23–22, actual versus expected payments, income,
  future receipts, monthly bills, variable subscriptions and confirmed budgets.
- Spending: existing categories, limits, coach, one-at-a-time classification and
  correction controls; same view on mobile and desktop.
- Debts: existing balances, repayment agreements, payment allocations and analysis.
- Accounts, assets, goals and intention: original data models and save handlers.
- Forecast: original deterministic projection and explicitly chosen scenarios.
- AI: existing Personal component, API, prompt, snapshot and scoped history.
- Notifications: existing monitoring, preferences, push and scan controls; push
  deep links still open the inbox. Existing background bank schedules are unchanged.
- Settings: owner/cloud account, save/load, recovery, PWA installation and updates.
- Backup/import: existing recovery and import functions retained as secondary tools.

Native dashboard dialogs support Escape and focus return. A StrictMode close-event
race in the existing category dialog was fixed so classification remains usable.
Detail forms share scoped light surfaces, controls, focus states and muted green
buttons; critical warnings are retained. Authentication and cloud error boundaries
remain outside the shell. No financial storage reset or migration is performed.

## Removed or combined presentation

- The always-visible AI column becomes an on-demand page.
- Sidebar plus overlapping subnavigation become one short primary navigation and menu.
- Intro/start screens and the personal/business mode banner are omitted in this
  private-only entry point; their obsolete visibility toggles are hidden.
- Action/Forecast share one destination; Focus/Goals share one destination.
- Repeated overview figures and headings are removed from the detail presentation.
- Statement uploads are secondary, not the main bank/spending experience.
- Account/storage controls and app install/update are together in Settings.

No debt, provider, transaction, financial rule or saved record was removed.
The old layout remains in source for compatibility, but is not mounted here.

## Limitations

Local visual and interaction tests use synthetic records in isolated browser
contexts. They do not verify real cloud credentials, live bank APIs, actual push
delivery or a real AI answer. Those servers were not changed. This redesign has
not been committed, pushed or deployed. Reserve/projection options retain their
existing temporary lifecycle; they survive navigation but not a full reload.
The existing functional forms are restyled and reused, not rewritten as a second
set of controllers. Future visual refinements can be made without data migrations.

## Hero asset

Asset: `src/redesign/landscape.png`, generated with the built-in image-generation
tool. No external image host or tracker is loaded.

Prompt: Generate a photorealistic landscape background asset for a warm minimalist
financial dashboard hero banner, wide panoramic composition 3:1. Peaceful alpine
lake, layered muted grey olive mountains on left and background, soft peach
sunrise haze on right, calm water at bottom, understated cream sky. Low contrast
editorial photography, no people, no text, no logos, no UI. Preserve good negative
space for a dark heading on left and a white card over right. Save generated image
for use in a website project.


## Verification (28 October 2026)

- Full regression suite: 284 passed, 0 failed.
- Strict TypeScript check and production build; no settings relaxed. Vite still
  reports its bundle-size advisory for a chunk around 500 kB.
- Isolated Chrome at 1536px and 390px: navigation through every menu destination,
  no page overflow or uncaught JavaScript errors.
- Account save (including decimal balance), income edit, reload, retained values,
  return to dashboard and correct Goals/Forecast navigation tested on both widths.
- Mobile classification: unknown purchase assigned to Clothing, saved transaction
  and dashboard updated; separate Business record unchanged.
- AI failure path verified with an intercepted failed API response. No claim of
  a new live AI or bank test is made.
- Existing six dashboard regressions plus route round-trip and shared classified
  snapshot/nonmutation regressions are in `tests/redesign-dashboard.test.tsx`.

Changed presentation files: `src/main.tsx`, `src/redesign/*`, `src/App.tsx`
(presentation callback), `StepSettings.tsx` (hide obsolete UI switches),
`BankSpendingOverview.tsx` (StrictMode dialog close fix). Backend, provider clients,
cloud schema, authentication and deployment configuration were not changed.
