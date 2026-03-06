# Access Controls Policy
## Moneylith - Identity & Access Management (IAM)

**Version:** 1.0  
**Effective Date:** March 6, 2026  
**Last Review:** March 6, 2026  
**Next Review:** September 6, 2026  
**Owner:** Security & Compliance Team  
**Contact:** info@moneylith.nl

---

## 1. Purpose

This Access Controls Policy defines how Moneylith limits and governs access to production assets (physical and virtual), source code, infrastructure, credentials, and sensitive financial data.

## 2. Scope

This policy applies to:
- Production and development environments
- Source code repositories and CI/CD pipelines
- Cloud hosting and serverless infrastructure
- Third-party platforms used to process consumer financial data
- Personnel and contractors with system access

## 3. Access Control Model

### 3.1 Least Privilege
- Access is granted to the minimum level required to perform assigned duties.
- Privileged access is restricted to authorized personnel only.
- Access rights are reviewed on a quarterly basis.

### 3.2 Role-Based Access Control (RBAC)
- Production systems: Owner/Administrator only.
- Development systems: Developer access with audit logging.
- Third-party services: Service accounts with scoped permissions.

### 3.3 Segregation of Duties
- Administrative actions are limited to designated roles.
- Sensitive changes (security settings, production-impacting updates) require review before deployment.

## 4. Authentication Requirements

### 4.1 Multi-Factor Authentication (MFA)
MFA is required for access to critical systems, including:
- Production infrastructure (Vercel and cloud services)
- Source control and deployment systems (GitHub)
- Banking and AI provider dashboards (Plaid, OpenAI)
- Email accounts used for security notifications

### 4.2 Password Requirements
- Minimum length: 16 characters (or passphrase equivalent)
- No password reuse across services
- Password manager usage is required for privileged credentials
- Privileged credential rotation is performed periodically

## 5. Access Provisioning and Deprovisioning

### 5.1 Provisioning (Onboarding)
- Access is granted via formal owner approval.
- MFA setup is verified before privileged access is enabled.
- Permissions are assigned based on role and business need.

### 5.2 Deprovisioning (Offboarding)
- Access is revoked within 24 hours of role change or separation.
- Shared credentials are rotated when applicable.
- Access removal is verified and logged.

## 6. Service-to-Service and Non-Human Access

- API communication uses secure transport (TLS 1.2+; operationally TLS 1.3).
- Non-human authentication uses scoped tokens and service credentials.
- Secrets are stored in encrypted environment variable systems.
- No credentials are hardcoded in source code.

## 7. Monitoring, Review, and Audit

- Periodic access reviews are performed quarterly.
- Access and administrative events are logged for auditability.
- Security alerts and anomalous access events are reviewed and investigated.

## 8. Exceptions

- Any exception to this policy requires documented business justification.
- Exceptions must include risk assessment and compensating controls.
- Exceptions are time-bound and reviewed before expiry.

## 9. Enforcement

Non-compliance with this policy may result in access suspension and corrective action.

---

## Document Control

| Version | Date | Owner | Change |
|---|---|---|---|
| 1.0 | 2026-03-06 | Security & Compliance Team | Initial release |
