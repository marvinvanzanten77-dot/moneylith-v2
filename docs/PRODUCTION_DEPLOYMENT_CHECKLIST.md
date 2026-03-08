# Production Deployment Checklist
## Plaid Production Setup

**Status:** ⏳ Waiting for Plaid production approval  
**Expected:** 1-2 business days after risk diligence review  
**Target Deploy Date:** [TBD - after approval]

---

## Configuration Details (Confirmed)

```
Redirect URI:  https://moneylith-v2.vercel.app
Environment:   production-eu
Region:        European Union
```

---

## Step 1: Wait for Plaid Approval Email

**You will receive email when:**
- ✅ Risk diligence questionnaire approved
- Plaid sends production credentials:
  - `Client ID` (production)
  - `Secret` (production)
  - Access to production-eu environment

**Email subject:** "Your Plaid production access has been approved"

---

## Step 2: Configure Vercel Environment Variables (ONE TIME)

### 2.1 Go to Vercel Dashboard
```
https://vercel.com/dashboard
→ Select moneylith-v2 project
→ Settings
→ Environment Variables
```

### 2.2 Add 4 Production Variables

**For each variable below:**
1. Click "Add"
2. Enter variable name + value
3. Select **[Production]** checkbox (IMPORTANT!)
4. Click Save

| Variable | Value | Env |
|----------|-------|-----|
| `PLAID_CLIENT_ID` | Your production Client ID from Plaid email | Production |
| `PLAID_SECRET` | Your production Secret from Plaid email | Production |
| `PLAID_ENV` | `production-eu` | Production |
| `PLAID_REDIRECT_URI` | `https://moneylith-v2.vercel.app` | Production |

**Screenshot example:**
```
┌─────────────────────────────────────┐
│ PLAID_CLIENT_ID                     │
│ [abc123xyz...]                      │
│ ☑ Production                        │
│ ☐ Preview                           │
│ ☐ Development                       │
│ [Save]                              │
└─────────────────────────────────────┘
```

### 2.3 Redeploy
After all 4 variables saved:
```
Go to: Deployments
Click: Latest deploy
Button: [Redeploy]
```

---

## Step 3: Verify Production Connection

Once deployment completes:

### 3.1 Test Plaid Link in Browser
```
Go to: https://moneylith-v2.vercel.app
Navigate to: Bank → StepBank component
Button: "Connect Bank"
→ Should show Plaid Link with production banks
```

### 3.2 Test Full Flow
1. Open Plaid Link
2. Search for: "ING" (major EU bank in production-eu)
3. Use test credentials (from Plaid docs for production-eu)
4. Complete authentication
5. Return to app → Should show accounts

### 3.3 Check Logs in Vercel
```
Vercel Dashboard → Deployments → Latest
→ Logs tab
→ Search for: "PLAID_ENV=production-eu"
→ Should confirm production environment active
```

---

## Step 4: Update Plaid Dashboard Settings

### 4.1 Add Redirect URI in Plaid Dashboard
```
https://dashboard.plaid.com/
→ Settings
→ Team Settings
→ Redirect URI

Add URI:
https://moneylith-v2.vercel.app
```

### 4.2 Verify Credentials Active
```
https://dashboard.plaid.com/
→ Developers
→ Keys
→ Environment selector: [Production-EU]
→ Copy Client ID + Secret
→ Verify they match what you entered in Vercel
```

---

## Rollback Plan (If Issues)

If production deployment fails:

### Option A: Revert to Sandbox (Quick)
```
Vercel Dashboard
→ Environment Variables
→ PLAID_ENV = sandbox (change to sandbox)
→ Redeploy
```

### Option B: Contact Plaid Support
Use info from logs:
- Vercel build ID
- Error message from logs
- Link session ID (from Plaid Link error)

---

## Timeline: What Happens Next

| When | Action | Owner |
|------|--------|-------|
| **Mar 8-9** | Plaid reviews risk diligence | Plaid |
| **Mar 9-10** | Approval email with production keys | Plaid → You |
| **Mar 10** | Add Vercel environment variables | You |
| **Mar 10** | Redeploy to production | Vercel (automatic) |
| **Mar 10** | Test Plaid Link with real banks | You |
| **Mar 10** | Update Plaid dashboard settings | You |
| **Mar 10+** | Production live 🚀 | You |

---

## Troubleshooting

### Issue: "Unknown Plaid action"
**Cause:** Environment variables not set correctly  
**Fix:** Verify PLAID_CLIENT_ID + PLAID_SECRET in Vercel (must be Production env)

### Issue: "Invalid Client ID"
**Cause:** Using sandbox credentials in production  
**Fix:** Copy production credentials from Plaid email + redeploy

### Issue: "Link token expired"
**Cause:** Link token older than 4 hours  
**Fix:** Refresh Plaid Link in browser

### Issue: "Bank not found"
**Cause:** Bank not available in production-eu  
**Fix:** Test with supported banks (ING, ABN AMRO, etc.)

---

## Success Criteria

✅ All checks must pass:
- [ ] Plaid production email received
- [ ] Environment variables set in Vercel (Production)
- [ ] Deployment completed
- [ ] Plaid Link opens with production banks
- [ ] Can complete bank authentication
- [ ] Accounts displayed in app
- [ ] Transactions sync working
- [ ] Audit logs show `PLAID_ENV=production-eu`

---

## Document Control

| Version | Date | Status |
|---------|------|--------|
| 1.0 | 2026-03-08 | READY FOR DEPLOYMENT |

**Next action:** Wait for Plaid approval email, then follow this checklist.

