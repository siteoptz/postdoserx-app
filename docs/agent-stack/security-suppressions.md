# Security Suppressions

Current security findings that are suppressed with justification.

## SEC-001

- **Rule**: hardcoded-secrets
- **File**: `js/config.js`
- **Finding**: Supabase public API key  
- **Status**: active
- **Severity**: medium
- **Expiry**: 2026-07-15
- **Owner**: @siteoptz
- **Rationale**: Supabase public keys are intended to be exposed; actual security via RLS policies
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/1
- **Tool**: custom-secret-scan
- **Last Reviewed**: 2026-04-15

## SEC-002  

- **Rule**: dependency-vulnerability
- **Package**: `@supabase/supabase-js`
- **Version**: `^2.38.4`
- **CVE**: CVE-2024-XXXX (example)
- **Status**: active  
- **Severity**: low
- **Expiry**: 2026-06-15
- **Owner**: @siteoptz
- **Rationale**: Vulnerability only affects Node.js server usage; we use browser client only
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/2
- **Tool**: npm-audit
- **Last Reviewed**: 2026-04-15

## Suppression Rules

Security suppressions are reviewed weekly and require:
1. Clear technical justification
2. Mitigation evidence where applicable  
3. Expiry within 90 days for critical, 180 days for others
4. Security team approval for high/critical severity
5. Link to tracking issue for resolution