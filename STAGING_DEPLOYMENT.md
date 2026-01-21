# 🚀 Staging Deployment Guide

## Overview
This guide covers deploying to Vercel with production TrueLayer credentials before going fully live.

---

## Environment Configuration

### Option 1: Using Vercel Preview (Recommended)
Deploy to preview with production env vars WITHOUT changing main deployment.

**Steps:**
1. Go to https://vercel.com/dashboard
2. Select project `moneylith-v2`
3. **Settings** → **Environment Variables**
4. Find existing env vars
5. Change their scope from "Production" to "Preview"
6. Add new vars with "Preview" scope:
   ```
   TRUELAYER_ENV = production
   TRUELAYER_CLIENT_ID = <production-client-id>
   TRUELAYER_CLIENT_SECRET = <production-secret>
   TRUELAYER_REDIRECT_URI = https://moneylith-v2-preview-*.vercel.app/api/truelayer/callback
   ```

**Important:** Use preview URL in TRUELAYER_REDIRECT_URI!

### Option 2: Using .env.local (Local Development)
Test production credentials locally before Vercel deployment.

**Steps:**
1. Copy `.env` to `.env.local`
2. Update values:
   ```
   TRUELAYER_ENV=production
   TRUELAYER_CLIENT_ID=<production-client-id>
   TRUELAYER_CLIENT_SECRET=<production-secret>
   TRUELAYER_REDIRECT_URI=http://localhost:5173/api/truelayer/callback
   ```
3. Run: `npm run dev`
4. Test bank connection locally

**Note:** This uses local Vite dev server. API calls go to production TrueLayer.

---

## Testing Checklist

### ✅ Pre-Test
- [ ] Credentials obtained from TrueLayer (production)
- [ ] Redirect URI registered in TrueLayer dashboard
- [ ] Environment variables configured correctly

### ✅ Functional Tests

**Bank Connection Flow:**
- [ ] Click "Koppel bank"
- [ ] Redirected to TrueLayer login
- [ ] Can authenticate with REAL bank account
- [ ] Get authorization code
- [ ] Accounts successfully fetched
- [ ] AI analysis runs and populates fields

**Error Handling:**
- [ ] Invalid credentials → error message displays
- [ ] Network timeout → retry option shown
- [ ] Malformed code → validation error
- [ ] Missing env vars → startup check catches it

**Manual Mode:**
- [ ] Can still use manual entry as fallback
- [ ] No errors from bank attempts

### ✅ Performance Tests
- [ ] Account fetch < 5 seconds
- [ ] AI analysis < 30 seconds
- [ ] UI responsive during loading
- [ ] No memory leaks (check DevTools)

---

## Monitoring & Debugging

### View Vercel Logs
```bash
vercel logs moneylith-v2 --prod
```

Or through dashboard: **Settings** → **Integrations** → **Vercel** → **View Logs**

### Check Environment Variables
```bash
vercel env list
```

### Test API Endpoint Directly
```bash
curl -X POST https://moneylith-v2.vercel.app/api/truelayer/token \
  -H "Content-Type: application/json" \
  -d '{"code":"test-code"}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `TRUELAYER_CLIENT_ID undefined` | Check Vercel env vars are set to correct scope |
| `invalid_grant` error | Code expired (>10 min), retry auth flow |
| `Redirect URI mismatch` | Verify exact URL matches TrueLayer dashboard |
| `Invalid sandbox mode` | Ensure TRUELAYER_ENV=production (not sandbox) |
| Accounts not fetching | Check access token validity in logs |
| Analysis takes >30s | Might be rate limited by OpenAI, check logs |

---

## Rollback Procedure

### If Preview Tests Fail
1. Do NOT merge to production
2. Fix code locally
3. Push new branch
4. Redeploy preview
5. Re-test

### If Production Deployment Fails
1. Go to **Deployments** tab
2. Click previous successful deployment
3. Click "Redeploy"
4. Confirm

---

## Next Steps

After staging tests pass:
1. Move env vars to "Production" scope
2. Deploy to production
3. Monitor logs closely (first 24h)
4. Have incident response team on standby

---

## Support

For issues:
1. Check [PRODUCTION_PREP.md](../PRODUCTION_PREP.md) troubleshooting
2. Review Vercel logs
3. Test locally with `.env.local`
4. Contact TrueLayer support for API issues
