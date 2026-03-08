# Consumer-Facing MFA Roadmap
## Moneylith Multi-Factor Authentication Implementation Plan

**Version:** 1.0  
**Effective Date:** March 8, 2026  
**Owner:** Product & Security Team  
**Status:** PLANNED

---

## 1. Current State (March 2026)

### 1.1 Authentication Model

**Current Approach:**
- ✅ No user accounts required
- ✅ Data stored locally in browser (`localStorage`)
- ✅ No server-side user profiles or credentials
- ✅ No login/password needed

**Security Posture:**
- ✅ No authentication attack surface (no passwords)
- ✅ User data never stored server-side
- ✅ No session hijacking risk
- ✅ Clear data on browser: "Logout" button clears localStorage

### 1.2 Plaid Authentication (Current)

**Plaid Link handles MFA:**
- ✅ Bank site MFA (ING, ABN AMRO, etc.) managed by bank
- ✅ User authenticates directly to bank (Plaid never handles credentials)
- ✅ Plaid verifies bank consent, returns permission to Moneylith
- ✅ No separate user account in Moneylith needed

**Current Plaid Compliance Status:**
- ✅ Meets current requirements (no consumer-facing app accounts)
- ⏳ Roadmap: Will be required when user accounts added

---

## 2. Phase 1: Optional Cloud Backup Account (Q3 2026)

### 2.1 Use Case

**Problem:** User clears browser cache accidentally → loses data

**Solution:** Optional cloud account for backup/sync
- Users can create account (optional)
- Account protects backup data in cloud
- Data encrypted at-rest (user passphrase)

### 2.2 Implementation

**Authentication Flow:**
```
Sign Up Page
  ↓
[Email] [Create Passphrase] [Confirm Passphrase]
  ↓
Send verification email
  ↓
User clicks email link
  ↓
Account created + set to "verified"
  ↓
Auto-login + show "MFA Setup" (Phase 2 later)
```

**Security:**
- ✅ Passwords: Bcrypt with salt (industry standard)
- ✅ Email verification required
- ✅ Password reset via email only
- ✅ No storing plaintext passwords

### 2.3 Compliance for Phase 1

**Status:** Not yet required (no real user accounts)  
**Audit Trail:**
- Log account creation timestamp
- Log successful logins
- Log password resets

---

## 3. Phase 2: Optional TOTP-based MFA (Q4 2026)

### 3.1 Use Case

**Problem:** Account password stolen → someone accesses backup

**Solution:** Optional 2FA with Time-based One-Time Password (TOTP)
- Users can enable during account setup or later
- Uses authenticator apps (Google Authenticator, Authy, 1Password)
- Backup recovery codes provided

### 3.2 Implementation

**TOTP Flow:**
```
Login Page [Email] [Password]
  ↗ Correct credentials entered ↗
  
2FA Check
  ↓
[MFA enabled for this account?]
  ├─ NO (disabled)  → Allow login
  │
  └─ YES (enabled)  → Show "Enter 6-digit code"
                      ↓
                      User opens authenticator app
                      ↓
                      Enters 6-digit code (valid for 30 seconds)
                      ↓
                      Validate code
                      ├─ Valid  → Allow login
                      └─ Invalid → Show "Try again" (max 3 tries)
                                   ↓
                                   After 3 fails → Locked (try again in 15 min)
```

**Setup Process:**
```
Settings → "Enable 2FA" → Show QR code → User scans with app → Enter code to verify → Generate 8 backup codes → User saves codes → Done
```

### 3.3 Backup Recovery Codes

**Implementation:**
- Generate 8 single-use codes when 2FA enabled
- Store hashed in database (never plaintext)
- Download as PDF for user
- Can be downloaded again (re-generate codes)

**Recovery Codes Display:**
```
Save these codes in a safe place. Each code can only be used once.
If you lose access to your authenticator app, use one of these codes:

1. XYZA-BCDE-FGHJ
2. KLMN-OPQR-STUV
3. WXYZ-ABCD-EFGH
4. [etc]

[Download PDF] [Print] [Copy to Clipboard]
```

### 3.4 Compliance for Phase 2

**Status:** Fully compliant with MFA requirement  
**Audit Trail:**
- Log 2FA setup + timestamp
- Log TOTP code validation (success/failure)
- Log recovery code usage
- Alert on suspicious patterns (multiple failed attempts)

---

## 4. Phase 3: Optional Biometric/Passkey Support (Q1 2027)

### 4.1 Use Case

**Problem:** Typing codes is annoying → better UX with biometric

**Solution:** WebAuthn / FIDO2 support (fingerprint, face recognition)
- Users can register security key or mobile biometric
- Works on: iPhone Face ID, Android fingerprint, YubiKey, etc.
- Falls back to TOTP if biometric not available

### 4.2 Implementation

**Biometric Setup:**
```
Settings → "Enable Biometric 2FA" → Tap "Register"
  ↓
Browser prompts: "Use your fingerprint?"
  ↓
User touches fingerprint sensor
  ↓
Biometric registered + confirmed
  ↓
Show: "Biometric 2FA enabled. You can still use backup codes."
```

**Login with Biometric:**
```
[Email] [Password] → Correct
  ↓
2FA Check → TOTP or Biometric enabled?
  ↓
Browser: "Verify with fingerprint?"
  ↓
User: Touch sensor
  ↓
Verified → Allow login
```

### 4.3 Compliance for Phase 3

**Status:** Enhanced security beyond requirements  
**Audit Trail:**
- Log biometric registration + device
- Log biometric authentication (success/failure)
- Alert on multiple biometric failures (physical security issue)

---

## 5. Security Considerations

### 5.1 Rate Limiting

**Authentication Endpoint:**
- Max 5 login attempts per IP per minute
- Max 10 incorrect 2FA codes per account per hour
- Temporary lockout (15 minutes) after thresholds exceeded

### 5.2 Session Management

**Session Tokens:**
- Generate secure random token (32 bytes)
- Expire after 30 days (auto-renew on activity)
- Invalidate on logout
- Invalidate on password change
- Invalidate on 2FA changes

### 5.3 Password Requirements

**Phase 1 Passwords:**
- Minimum: 12 characters (or passphrase)
- Recommended: 16+ characters
- No common passwords (check against HaveIBeenPwned)
- Cannot reuse last 5 passwords

### 5.4 Data at Rest

**Backup Data Encryption:**
- AES-256-GCM (authenticated encryption)
- Key derived from user passphrase (PBKDF2 + salt)
- Server never has plaintext passphrase
- Even employees cannot access user backup data

---

## 6. Compliance Mapping

### 6.1 Plaid Requirement

> "Attest that your organization has implemented multi-factor authentication (MFA) on the consumer-facing application where Plaid Link is deployed"

### 6.2 Current Status (March 2026)

**Status:** ⏳ **NOT YET REQUIRED** (no consumer accounts)

**Attestation:**
- Current architecture: No consumer accounts → no authentication needed
- Interim: Document single-user (local-only) state
- Future: Roadmap outlines MFA implementation when accounts added
- Timeline: Q3 2026 (Phase 1) → Q4 2026 (Phase 2) → Q1 2027 (Phase 3)

### 6.3 Future Attestation (Q4 2026)

When Phase 2 complete:
- ✅ TOTP-based MFA on consumer account login
- ✅ Backup recovery codes provided
- ✅ Audit logging for all auth events
- ✅ Rate limiting on login/MFA attempts
- ✅ Session token expiry + invalidation

---

## 7. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| User loses authenticator app (Q4) | Medium | High | Backup recovery codes provided |
| Rate limiting too strict (Q4) | Low | Low | Monitor failed login metrics + adjust thresholds |
| Phishing attacks → credential theft (Q3) | Medium | Medium | Email verification + warning banners |
| Session hijacking (Q3) | Low | High | HTTPS-only + secure cookie flags |
| Database breach → password hashes (Q3) | Low | High | Bcrypt + salt (slow hashing) minimizes risk |

---

## 8. Timeline

| Phase | Feature | Target | Status |
|-------|---------|--------|--------|
| **Phase 1** | Optional cloud account + email verification | Q3 2026 (Sep) | Planned |
| **Phase 2** | TOTP 2FA + recovery codes | Q4 2026 (Dec) | Planned |
| **Phase 3** | WebAuthn/biometric 2FA | Q1 2027 (Mar) | Roadmap |

---

## 9. Interim Compliance (Until Q4 2026)

### 9.1 Current Honest Assessment

**Question:** "Is MFA implemented on consumer app?"  
**Answer:** "No consumer accounts exist currently. The application is single-user with local-only data storage. When user accounts are introduced (Q3 2026+), MFA will be implemented with TOTP 2FA and backup recovery codes."

### 9.2 Documented Roadmap

This document serves as:
- ✅ Commitment to implement MFA before consumer accounts go live
- ✅ Security-first approach (MFA before feature launch)
- ✅ Transparency with Plaid compliance team
- ✅ Timeline alignment with product roadmap

---

## 10. Attestation Timeline

| Date | Attestation | Evidence |
|------|-----------|----------|
| 2026-03-08 | Architecture documented (local-only, no accounts) | This document + architecture.md |
| 2026-09-30 | Phase 1 complete (cloud backup account) | Account signup + email verification |
| 2026-12-31 | Phase 2 complete (TOTP + recovery codes) | 2FA setup + audit logs |
| 2027-03-31 | Phase 3 complete (WebAuthn support) | Biometric registration + testing |

**Current Status:** ✅ **PLANNED & DOCUMENTED**

---

## Document Control

| Version | Date | Owner | Status |
|---------|------|-------|--------|
| 1.0 | 2026-03-08 | Product & Security Team | ACTIVE |

