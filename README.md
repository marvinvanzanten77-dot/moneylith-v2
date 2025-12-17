# Moneylith Frontend/Api

## Environment variables (required)

Set these in your `.env` or Vercel project settings:

- `OPENAI_API_KEY` - AI analyse
- `TURNSTILE_SITE_KEY` - Cloudflare Turnstile widget
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile server-side verificatie

Optional:
- Andere API keys die je toevoegt, altijd via env vars, nooit hardcoded.
- `VITE_ANALYTICS_SRC` - vendor analytics script URL (optioneel, alleen bij opt-in)
- `VITE_ANALYTICS_SITE` - vendor site-id/domain (optioneel)

## Scripts
- `npm run dev` - start Vite dev server
- `npm run build` - productie build

## Deploy flow
- `main` -> production (Vercel auto-deploy).
- PR/feature branch -> preview deployment.
- Rollback: open Vercel deployments, kies de vorige succesvolle deploy en klik "Promote".
