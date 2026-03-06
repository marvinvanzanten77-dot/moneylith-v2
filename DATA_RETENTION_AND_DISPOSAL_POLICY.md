# Data Retention and Disposal Policy
## Moneylith

**Version:** 1.0  
**Effective Date:** March 6, 2026  
**Last Review:** March 6, 2026  
**Next Review:** September 6, 2026  
**Owner:** Security & Compliance Team  
**Contact:** info@moneylith.nl

---

## 1. Purpose

This policy defines how Moneylith retains, minimizes, and disposes of data, including consumer financial data received via banking API providers (e.g., Plaid), in alignment with security and privacy requirements.

## 2. Scope

This policy applies to:
- Consumer financial data retrieved via banking APIs
- Application logs and analytics data
- Access tokens and technical credentials
- Data processed by serverless backend components
- Data stored in end-user browser storage

## 3. Data Architecture Summary

- Moneylith does not maintain centralized user accounts for financial data storage.
- Consumer financial data is processed transiently and is not stored long-term on Moneylith servers.
- User planner data is primarily stored client-side in browser local storage.

## 4. Retention Periods

### 4.1 Consumer Financial Data
- **Server-side at-rest storage:** Not used for long-term storage.
- **Server-side processing window:** Temporary in-memory processing only (typically up to 30 seconds per request).
- **Client-side storage:** Retained in user browser storage until the user deletes it.

### 4.2 Bank Access Tokens
- Access tokens are temporary and subject to provider lifecycle and inactivity expiration controls.
- Operational target retention is up to 90 days where applicable.

### 4.3 Logs and Analytics
- Application/security logs: retained up to 90 days, then deleted.
- Analytics data: retained up to 90 days in anonymized or aggregated form where feasible.

## 5. Disposal and Deletion Controls

### 5.1 Automated Disposal
- Log retention limits are enforced by time-based deletion.
- Temporary backend processing data is not persisted beyond request handling.

### 5.2 User-Initiated Deletion
- Users can delete local app data by clearing browser storage.
- Users may request deletion support via info@moneylith.nl.

### 5.3 Security of Disposal
- Disposal follows data minimization principles.
- Deleted data is removed from active systems and is not used for product purposes afterward.

## 6. Data Minimization Principles

- Collect only data required to provide budgeting and financial analysis functionality.
- Avoid long-term server-side retention of sensitive consumer financial data.
- Limit retention duration to operational and legal necessity.

## 7. Legal and Regulatory Alignment

This policy supports compliance objectives under:
- GDPR (data minimization, storage limitation, deletion rights)
- PSD2-aligned secure handling of banking data access

## 8. Roles and Responsibilities

- **Security & Compliance Owner:** Maintains this policy and reviews controls.
- **Engineering:** Implements retention limits and disposal mechanisms.
- **Operations:** Monitors logs and retention jobs.

## 9. Review and Update Cycle

- Policy is reviewed at least every 6 months.
- Earlier review is triggered by architecture changes, provider changes, or legal updates.

---

## Document Control

| Version | Date | Owner | Change |
|---|---|---|---|
| 1.0 | 2026-03-06 | Security & Compliance Team | Initial release |
