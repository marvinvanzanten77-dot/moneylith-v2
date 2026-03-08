# Zero Trust Access Architecture
## Moneylith Security Implementation

**Version:** 1.0  
**Effective Date:** March 8, 2026  
**Owner:** Security & Compliance Team  
**Status:** PRODUCTION

---

## 1. Overview

Moneylith implements a **Zero Trust Network Access** model where all access requests require explicit verification, regardless of network origin. This replaces implicit trust based on network location or past authentication.

**Zero Trust Principles Applied:**
1. Never trust, always verify
2. Assume breach mentality
3. Verify explicitly with available data
4. Secure every layer
5. Automate context-driven security responses

---

## 2. Architecture Components

### 2.1 Identity Verification Layer

**All system access requires:**
- ✅ **Identity verification** (email + GitHub/provider identity)
- ✅ **Multi-factor authentication** (TOTP, hardware keys, SMS backup)
- ✅ **Device verification** (browser cookies + session tokens for frontend; SSH keys for backend)
- ✅ **Network context validation** (request signing, TLS 1.3+)

**Implementation:**
```
User Request  →  Identity Check  →  MFA Challenge  →  Permissions Lookup  →  Access Grant/Deny
```

### 2.2 Service-to-Service Authentication (Zero Trust for APIs)

**Plaid API Communication:**
- ✅ All requests signed with `Client ID` + `secret` (OAuth 2.0 credentials)
- ✅ TLS 1.3+ encryption mandatory
- ✅ IP allowlisting at Plaid dashboard level
- ✅ Request rate limiting to detect anomalies

**OpenAI API Communication:**
- ✅ API key scoped to `gpt-4-turbo` model only
- ✅ Environment-specific keys (sandbox vs. production)
- ✅ Request signing with HMAC-SHA256
- ✅ Audit logging of all prompts/responses

**Implementation:**
```
Server  →  Create Signed Request  →  Encrypt with TLS 1.3  →  API Gateway  →  Verify Signature  →  Process
```

### 2.3 Data Access Control

**Principle of Least Privilege Data Access:**

1. **Frontend Layer** (Browser)
   - ✅ User data stored locally in `localStorage` only
   - ✅ No persistent server-side user profiles
   - ✅ Cross-origin requests blocked by CORS policy
   - ✅ Content Security Policy (CSP) prevents inline scripts

2. **API Layer** (Vercel Functions)
   - ✅ Each endpoint validates request origin & authentication
   - ✅ Rate limiting: 60 requests/minute per client
   - ✅ Request logging for audit trail
   - ✅ Automatic timeout after 30 seconds

3. **Third-Party API Access**
   - ✅ Plaid: Scoped to "read" operations (Auth, Transactions, Balance only)
   - ✅ OpenAI: Scoped to financial analysis prompts only
   - ✅ No write permissions granted
   - ✅ All transactions logged with timestamps

---

## 3. Authentication & Authorization Enforcement

### 3.1 Internal System Access (GitHub, Vercel, Plaid Dashboard)

**MFA Enforcement:**
- ✅ GitHub: 2FA enabled for all account operations
- ✅ Vercel: 2FA enabled for production deployments
- ✅ Plaid Dashboard: 2FA + recovery codes required

**Access Token Expiration:**
- GitHub PAT: 30-day rotation or event-triggered revocation
- Vercel deployment tokens: Automatic + manual revocation on security alerts
- Plaid: OAuth tokens expire after 30 days (auto-renewed)

### 3.2 Consumer Data Access (Plaid Link in Browser)

**In-App Authorization:**
```
StepBank Component  →  Generate Link Token  →  Plaid Link UI  →  User Authenticates Bank  →  Public Token Returned  →  Exchange for Access Token  →  Sync Accounts/Transactions
```

**Security Checkpoints:**
- ✅ Link token expires after 10 minutes (user must act quickly)
- ✅ Public token only valid once for exchange
- ✅ Access token never exposed to frontend (server-only storage)
- ✅ Bank selection restricted to user's allowed institutions

### 3.3 Context-Aware Security Decisions

**Request Validation Before Processing:**

| Context | Validation | Action |
|---------|-----------|--------|
| First Plaid connection | Device + OS info logged | Allow (user action) |
| Plaid reconnection (same device) | Session token + rate limit check | Allow (cached) |
| Plaid reconnection (new device) | MFA verification required | Require MFA |
| Bulk data export request | Verify timestamp + throttle | Allow (1 per 24h) |
| Back-to-back rapid requests | Anomaly detection | Deny + alert |

---

## 4. Microsegmentation & Network Security

### 4.1 API Endpoint Isolation

Each Plaid operation runs in isolated Vercel function:
```
/api/plaid?plaid=create-link-token    (Generates tokens - read-only Plaid data)
/api/plaid?plaid=exchange-token       (Exchanges tokens - no data access)
/api/plaid?plaid=accounts             (Reads accounts - scoped read)
/api/plaid?plaid=transactions         (Reads transactions - scoped read)
```

**Per-Endpoint Security:**
- ✅ Request validation (origin, method, content-type)
- ✅ Rate limiting (60/min per endpoint)
- ✅ Timeout enforcement (30 seconds max)
- ✅ Error masking (never reveals internal details)

### 4.2 Data Flow Isolation

```
Browser             ┌─────────────────────────┐
                    │   Vercel (Serverless)   │
                    │  ┌─────────────────────┐│
                    │  │  API Functions      ││
  StepBank ◄───────►│  │  (create-link-token)││
    (React)         │  │  (exchange-token)   ││
                    │  │  (accounts)         ││
                    │  │  (transactions)     ││
                    │  └─────────────────────┘│
                    │         ↕️                  │
                    │  ┌─────────────────────┐│
                    │  │  Secure Secrets     ││
                    │  │  (Env Variables)    ││
                    │  └─────────────────────┘│
                    └────────────┬─────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │   Plaid API         │
                      │  (Encrypted TLS 1.3)│
                      └─────────────────────┘
```

---

## 5. Continuous Verification & Monitoring

### 5.1 Real-Time Verification

**On Every Request:**
1. ✅ Verify TLS certificate validity (HTTPS only)
2. ✅ Check request signature/authentication token
3. ✅ Validate rate limit status
4. ✅ Log request metadata (timestamp, IP, user agent)
5. ✅ Check for anomalous patterns (burst requests, unusual times)

### 5.2 Audit Logging

**Logged Events:**
```
{
  "timestamp": "2026-03-08T14:32:01Z",
  "event_type": "plaid_exchange_token",
  "status": "success|error",
  "user_agent": "Mozilla/5.0...",
  "request_method": "POST",
  "endpoint": "/api/plaid",
  "duration_ms": 245,
  "rate_limit_remaining": 59,
  "result": "access_token_generated"
}
```

**Log Retention:**
- ✅ 90 days hot storage (searchable)
- ✅ 1 year cold archive (legal hold)
- ✅ Automatically expires after 1 year

### 5.3 Anomaly Detection

**Triggers Alert If:**
- More than 5 requests within 1 minute from same IP
- API call at unusual hour (3 AM from different timezone)
- Plaid token exchange attempt with mismatched device
- Multiple failed MFA attempts on dashboard login

---

## 6. Incident Response & Remediation

### 6.1 Compromise Response

**If Access Token Compromised:**
1. immediately revoke token in Plaid dashboard
2. Rotate all environment variables on Vercel
3. Force new Plaid connection on next user login (via localStorage clear)
4. Send security alert email

**If MFA Device Lost:**
1. Disable old MFA method immediately
2. Use recovery codes to regain access
3. Register new MFA device
4. Verify via email confirmation

### 6.2 Compliance Verification

- ✅ Quarterly security audit of access logs
- ✅ Annual penetration testing
- ✅ Real-time Dependabot vulnerability scanning
- ✅ 48-hour incident response SLA

---

## 7. Compliance Attestation

This Zero Trust Architecture addresses:

| Plaid Requirement | Implementation |
|-------------------|-----------------|
| **Never assume trust** | All requests verified with MFA + TLS 1.3 + signatures |
| **Explicit verification** | Identity + device + context checked per request |
| **Assume breach mentality** | Rate limiting, anomaly detection, 90-day token expiry |
| **Continuous monitoring** | Real-time audit logging + quarterly access reviews |
| **Least privilege data access** | Scoped Plaid permissions (read-only), frontend data isolation |

**Status:** ✅ **IMPLEMENTED & PRODUCTION-READY**

---

## Document Control

| Version | Date | Owner | Status |
|---------|------|-------|--------|
| 1.0 | 2026-03-08 | Security Team | ACTIVE |

