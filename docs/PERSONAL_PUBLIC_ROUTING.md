# Public and Personal routing

The existing `moneylith-v2` Vercel project owns www.moneylith.nl and acts as the entry point:

- `/` and public `/assets/*` proxy the independently deployed `moneylith-public.vercel.app` application.
- `/prive` and `/prive/assets/*` serve the Personal build from `personal/reliability-review`.
- Personal `/api/*` retains existing server-side owner authorization, encrypted storage, bank credentials and cron. Public uses its separate Supabase account storage; a public session does not authorize personal endpoints.
- Personal workspace mounts only after `/api/cloud?action=session` confirms the owner. Network failure fails closed. The development-only localhost exception is absent in production builds.
- Browser storage keys are unchanged; no migration, reset, snapshot write or bank sync is performed by this routing change.

The apps share an origin, so this is separation between trusted applications, not a browser-origin security boundary. Public must continue using account-scoped storage and must never import or read Personal storage keys. Personal data authorization remains on the server.

## Installed app compatibility

Keep manifest ID `/`, worker `/sw.js` and worker scope `/` to retain the installed app identity and push subscriptions. Start URL and notification target use `/prive`. Existing `/?app=1` links redirect to `/prive?app=1`; query parameters survive. No worker unregister or storage deletion occurs. The worker never caches financial API data. Public does not register a second worker.

## Release

Deploy the Personal branch to the existing Personal project with production configuration, stage with `--skip-domain`, verify, then promote that exact deployment. Do not publish Personal `main` over this release: it does not contain the split routing. Public can be deployed independently in its own project. No secrets belong in either repository or upload; `.vercelignore` excludes local environment and bank installation files.
