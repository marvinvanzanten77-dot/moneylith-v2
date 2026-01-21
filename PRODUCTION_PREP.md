# 🚀 Production Prep - Checklist & Stap-voor-Stap Gids

## STATUS: `sandbox` → `production`

**Huidige situatie:**
- ✅ Bankkoppeling werkt in sandbox
- ✅ OnboardingChoice flow werkend
- ✅ Auto-fill pipeline functioneel
- ⏳ Gereed voor production setup

---

## 📋 **DEEL 1: JIJ DOET (buiten VS Code)**

### **STAP 1: TrueLayer Production Credentials Aanvragen**

**Waar:** https://developer.truelayer.com/

**Procedure:**
1. Log in met jouw account
2. Ga naar "Applications"
3. Klik "Create New Application"
4. Vul in:
   - **Name:** `Moneylith Production`
   - **Environment:** `Production` (niet Sandbox!)
   - **Type:** `Web Application`
5. Accept terms
6. **Klik:** Create

**Wacht op:** Email met "Application Approved"
- **Tijdschatting:** 1-2 werkdagen

---

### **STAP 2: Production Credentials Opslaan**

Na goedkeuring krijg je:
- `Client ID` (lange string)
- `Client Secret` (lange string)

**Sla deze op in een BEVEILIGD document:**
- Niet in git!
- Niet in email!
- Lokaal in encrypted file of 1Password

---

### **STAP 3: Vercel Environment Variables Instellen**

**Ga naar:** https://vercel.com/dashboard

**Procedure:**
1. Klik op project `moneylith-v2`
2. Ga naar **Settings** tab
3. Klik **Environment Variables** (links menu)
4. Voeg toe:

```
TRUELAYER_ENV = production
TRUELAYER_CLIENT_ID = <jouw-production-client-id>
TRUELAYER_CLIENT_SECRET = <jouw-production-secret>
TRUELAYER_REDIRECT_URI = https://moneylith-v2.vercel.app/api/truelayer/callback
```

**BELANGRIJK:**
- Zorg dat redirect URI **exact hetzelfde** is als in TrueLayer dashboard
- Selecteer "Production" environment (niet Preview)

---

### **STAP 4: Verify Redirect URI in TrueLayer**

**Terug in TrueLayer dashboard:**
1. Applications → Jouw Production App
2. Klik **Settings**
3. Under "Redirect URIs" voeg toe:
   ```
   https://moneylith-v2.vercel.app/api/truelayer/callback
   ```
4. **Save**

---

## 🔧 **DEEL 2: IK DOE (in VS Code)**

### **STAP 5: Environment Validation**

Ik zal maken:
- `api/utils/envValidation.ts` - Check alle env vars
- Error messages als iets ontbreekt

**Dit zorgt ervoor dat:**
- ✅ App failt *snel* als config fout is
- ✅ Je ziet wat ontbreekt
- ✅ Geen silent failures

---

### **STAP 6: Error Handling Uitbreiden**

Voeg toe in:
- `api/truelayer/token.ts` - Log token errors
- `api/truelayer/transactions.ts` - Log transaction errors
- `src/components/steps/StepBank.tsx` - User-friendly error UI

**Dit geeft:**
- ✅ Duidelijk feedback wat fout gaat
- ✅ Retry opties
- ✅ Fallback flows

---

### **STAP 7: Staging Deployment Config**

Maak:
- `.env.staging` template
- Deploy instructies
- Rollback procedure

---

## 📝 **DEEL 3: Testing Roadmap**

### **Fase A: Sandbox (wat we al gedaan hebben)**
- ✅ Mock data
- ✅ Happy path testing
- ✅ UI flow werkt

### **Fase B: Staging (met production creds)**
- [ ] Deploy naar Vercel preview met production env vars
- [ ] Test met échte bank account
- [ ] Verify transactions sync
- [ ] Check error states

### **Fase C: Production**
- [ ] Alle staging tests passed
- [ ] Monitor first 24h closely
- [ ] Have rollback plan ready

---

## ✅ **CHECKLIST: Weet je wat je moet doen?**

- [ ] Begrijp je dat je TrueLayer Production credentials nodig hebt?
- [ ] Weet je dat die 1-2 werkdagen kunnen duren?
- [ ] Heb je Vercel project access?
- [ ] Heb je de Redirect URI opgeschreven?

---

## 🎯 **VOLGENDE STAP**

**Voor jou:**
1. Ga naar https://developer.truelayer.com/
2. Create Production Application
3. Wacht op approval email
4. Sla credentials op

**Voor mij:**
1. Zodra jij klaar bent → zeg "stap 1 done"
2. Ik bouw env validation + error handling
3. We gaan naar STAP 5

---

**Vragen? Laat het weten!**
- Kun je de TrueLayer site vinden?
- Heb je al production app aangevraagd?
- Wat is onduidelijk?
