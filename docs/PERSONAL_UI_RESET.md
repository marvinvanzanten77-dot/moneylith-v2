# Personal UI reset — historical starting point

The empty starting canvas described below has now been replaced by the connected
dashboard and detail workspace. The remainder describes the original reset stage,
not the current functionality. See `PERSONAL_DASHBOARD_DESIGN.md` for the current scope.

Branch: `personal/ui-reset`, starting at `4edddf7`.

The Personal entry point now renders `src/redesign/PersonalShell.tsx` with its own
light stylesheet. The old workspace, navigation, cards, wizard and AI panel are
not mounted. Their code remains available for extracting existing behavior as we
design the new screens. No financial values or inactive imitation controls appear
in the new shell.

PersonalAccess, CloudSyncBoundary, service-worker registration, API handlers,
provider integrations, storage keys, financial models, calculations and cron
configuration are unchanged. No data reset or migration is part of this change.
Financial editing and navigation are intentionally unavailable in this initial
design shell; it is not ready to replace the live workspace.

This work is local only. Public is not modified or copied. Transfer the finished
design to Public later without owner-specific data, rules or credentials.

Local preview: `npm run dev:local -- --port 5190` (loopback only). The isolated
worktree contains no local environment secrets. The existing development-only
localhost access behavior applies; production authentication remains in place.
