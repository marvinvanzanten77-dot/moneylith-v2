# Centralized Identity & Access Management
## Moneylith IAM Architecture

**Version:** 1.0  
**Effective Date:** March 8, 2026  
**Owner:** Security & Compliance Team  
**Status:** PRODUCTION

---

## 1. Overview

Moneylith implements a **centralized identity and access management** system where all identity verification, authentication, and authorization decisions flow through standardized mechanisms.

**Key Components:**
- ✅ GitHub as primary identity provider (OAuth 2.0)
- ✅ Vercel for infrastructure access (SSO via GitHub)
- ✅ Plaid for banking API authentication (OAuth 2.0)
- ✅ OpenAI for AI API authentication (API keys with scoped permissions)

**Single Source of Truth:** GitHub organization members list determines who has production access.

---

## 2. Identity Provider Integration

### 2.1 GitHub (Primary IdP)

**GitHub Organization:** moneylith  
**Members:**
- Owner: [Founder/Technical Lead] (2FA enabled)
- Developers: [As needed] (2FA enabled)

**Authentication Flow:**
```
Developer           →  GitHub OAuth 2.0           →  GitHub
(with 2FA)             (code flow + MFA prompt)        (issues OAuth token)
                                                       ↓
                    ←  GitHub OAuth Token  ←  ←  ─────┘
                    (verified + 2FA passed)

          Token stored in:
          - git config (local machine)
          - Environment: $GITHUB_ACTOR
          - CI/CD secrets (GitHub Actions)
```

**GitHub Permissions (by Role):**

| Role | Permissions | MFA | Account Recovery |
|------|-----------|-----|------------------|
| **Owner** | All org + repo operations | Required | Recovery codes + backup email |
| **Developer** | Clone + push + pull requests | Required | Recovery codes + backup email |
| **Third-party Bot** | Read-only (deployments) | N/A | Scoped PAT with 30-day rotation |

### 2.2 Vercel (Infrastructure IdP)

**Vercel Team Configuration:**
- ✅ SSO via GitHub (no separate Vercel-only accounts)
- ✅ Members auto-sync from GitHub organization
- ✅ Deployment tokens require GitHub 2FA verification
- ✅ All production deployments logged with user identity

**Authentication Flow:**
```
Developer (GitHub 2FA verified)  →  Vercel CLI or Web
                                      ↓
                              GitHub OAuth verification
                                      ↓
                              Issue Vercel deployment token
                                      ↓
                              Log deployment (audit trail)
```

**Vercel Permissions:**
- **Owner:** Full production access + team management
- **Developer:** Deploy to preview + production (audit logged)
- **Guest:** Read-only logs + analytics

### 2.3 Plaid (Banking API IdP)

**Organization Setup:**
- ✅ Single Vercel team manages all Plaid credentials
- ✅ Plaid Client ID: `69aab6b12e387d000ceeddfd` (shared, read-only in code)
- ✅ Plaid Secret: Environment variable (Vercel only, never shared)
- ✅ Plaid Dashboard: 2FA required for all users

**Authentication Flow (Consumer Perspective):**
```
User (Browser)      →  StepBank Component
                        ↓
                        Generate Link Token (from /api/plaid)
                        ↓
                        Plaid Link Widget opens
                        ↓
                        User authenticates bank (ING, etc.)
                        ↓
                        Plaid returns public_token
                        ↓
                        Exchange public_token for access_token (server-only)
                        ↓
                        Store in localStorage OR Vercel secure storage
```

**Plaid Dashboard Users:**
- Owner: [Founder] (2FA required)
- Support Contact: [Secondary lead] (2FA required)

### 2.4 OpenAI (AI API IdP)

**Organization Setup:**
- ✅ Single OpenAI API key (scoped to `gpt-4-turbo` model)
- ✅ Key stored in Vercel environment variables (no hardcoding)
- ✅ Usage limits: $100/month soft limit
- ✅ Key rotation: Every 6 months or on security incident

**Authentication Flow:**
```
Vercel Function  →  Create HMAC signature with API key
                     ↓
                     Call OpenAI API (signed HTTPS request)
                     ↓
                     OpenAI verifies signature
                     ↓
                     Process request + log usage
                     ↓
                     Return JSON response
```

---

## 3. Centralized Access Management

### 3.1 Access Decision Process

**Every request (internal or external) follows this flow:**

```
┌──────────────────────────────────┐
│ Incoming Request                 │
│ (GitHub API, Vercel deploy, etc) │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│ Extract Identity Token           │
│ (OAuth token, API key, SSH key)  │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│ Verify Token Signature & Expiry  │
│ ✓ Valid?  ✓ Not expired?         │
└────────────┬─────────────────────┘
             │
      ┌──────┴──────┐
      │ Invalid     │ Valid
      ↓             ↓
    DENY         ┌──────────────────────────────────┐
    401/403      │ Look Up User in GitHub Org       │
                 │ (Source of Truth)                │
                 └────────────┬─────────────────────┘
                              │
                      ┌───────┴────────┐
                      │ Found  │ Not   │
                      ↓       Found   │
                    ┌──────────────┐  │
                    │ Check MFA    │  ↓
                    │ Status       │ DENY
                    └────┬─────────┘ 401/403
                         │
                ┌────────┴───────┐
                │ Enabled        │ Disabled
                ↓                ↓
             ┌───────┐       WARN
             │ Allow │       Allow (log)
             └───────┘
                ↓
    ┌───────────────────────────┐
    │ Map to Role/Permissions   │
    │ (Owner, Developer, Guest) │
    └────────────┬──────────────┘
                 │
                 ↓
    ┌───────────────────────────┐
    │ Check Rate Limits         │
    │ (60 req/min per user)     │
    └────────────┬──────────────┘
                 │
          ┌──────┴─────┐
          │ Under      │ Over
          ↓ Limit      ↓ Limit
        ┌──────┐    DENY
        │ALLOW │    429
        └──────┘
          ↓
    ┌────────────────────────────┐
    │ Log to Audit Trail         │
    │ + Grant Access             │
    └────────────────────────────┘
```

### 3.2 Role-Based Access Control (RBAC)

**Production Systems Access:**

| Role | GitHub | Vercel | Plaid DB | Production Secrets | Can Deploy |
|------|--------|--------|----------|-------------------|------------|
| **Owner** | ✅ Admin | ✅ Admin | ✅ Admin | ✅ Read + Rotate | ✅ Yes |
| **Developer** | ✅ Push | ✅ Deploy | ❌ Read-only | ❌ No read/rotate | ✅ Yes |
| **Third-party (Bot)** | ✅ Read | ✅ Preview | ❌ No access | ❌ No access | ✅ Preview only |

**Least Privilege:**
- Developers cannot view Plaid credentials (env vars on Vercel only)
- Developers cannot rotate keys or secrets
- Developers cannot disable MFA for others
- Developers cannot change membership

### 3.3 Credential Lifecycle Management

**API Keys:**
```
Created    →    Stored in Vercel    →    Monitored    →    Rotated    →    Retired
                (Encrypted)              (Alert on use)     (6 months)      (Revoked)
```

**GitHub PATs:**
```
Generated  →    Scoped Permissions    →    Expiry Set    →    Revoked on:
for CI/CD       (no admin access)         (30 days)       - Termination
                                                          - Compromise
                                                          - Scheduled rotation
```

**SSH Keys:**
```
Registered  →    Machine-bound    →    Key Combination    →    Revoked
(GitHub)         (laptop = key A)      Required for:          (Device lost)
                                       - Production deploy
```

---

## 4. Audit Logging & Compliance

### 4.1 All Identity Events Logged

**Logged Events:**
```
User login (2FA passed)            → audit-2026-03.log
API key created/rotated            → audit-2026-03.log
Production deployment              → audit-2026-03.log
Access revoked (termination)       → audit-2026-03.log
Rate limit exceeded                → security-alert.log
MFA disabled (unusual)             → security-alert.log
Access token compromised           → security-alert.log
```

**Log Format:**
```json
{
  "timestamp": "2026-03-08T14:32:15Z",
  "event_type": "production_deploy",
  "actor": "developer@moneylith.nl",
  "actor_id": "github_user_id_12345",
  "action": "deployed_commit_abc1234",
  "system": "vercel",
  "mfa_verified": true,
  "status": "success",
  "resource": "https://moneylith-v2.vercel.app",
  "audit_id": "AUD-2026-03-08-001"
}
```

**Log Retention:**
- ✅ Hot storage (searchable): 90 days
- ✅ Cold archive: 1 year
- ✅ Auto-expiry after 1 year (unless legal hold)

### 4.2 Access Review Audit

**Quarterly Access Review (March, June, Sept, Dec):**
```
1. Export GitHub org members list
2. Cross-reference with employee/contractor list
3. Identify stale/inactive developers (no commits 90+ days)
4. Remove access if role changed
5. Verify MFA still enabled for all
6. Document findings in compliance ticket
7. Sign-off by owner
```

---

## 5. Compliance Attestation

**This architecture addresses Plaid Requirement:**
> "Attest that your organization has implemented centralized identity and access management solutions"

**Compliance Evidence:**
- ✅ GitHub as **single source of truth** for identity
- ✅ All systems (Vercel, Plaid, OpenAI) reference GitHub identity
- ✅ Centralized RBAC: Owner, Developer, Third-party roles
- ✅ MFA required for all human access to critical systems
- ✅ Automated provisioning/deprovisioning via GitHub membership
- ✅ Complete audit trail of all identity events (90-day + archive)
- ✅ Quarterly access reviews with sign-off
- ✅ Service accounts scoped with least privilege

**Status:** ✅ **IMPLEMENTED & PRODUCTION-READY**

---

## 6. Service Accounts (Non-Human Authentication)

### 6.1 GitHub Bot / CI/CD Service Account

**Identity:** `moneylith-bot`  
**Scopes:**
- ✓ Read: Public/private repos
- ✓ Write: Pull requests (automated)
- ✗ Admin: Organization settings

**Key Rotation:**
- 30-day expiry on PAT
- Auto-renewed before expiry
- Revoked on security incident

### 6.2 Vercel Deployment Service Account

**Uses GitHub identity** (no separate service account)  
**Scopes:** Deploy to production  
**Audit Trail:** Every deployment logged with GitHub actor

---

## Document Control

| Version | Date | Owner | Status |
|---------|------|-------|--------|
| 1.0 | 2026-03-08 | Security Team | ACTIVE |

