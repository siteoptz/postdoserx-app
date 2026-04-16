# Agent Stack Enforcement Policy

## Rollout Strategy

The agent stack will be deployed in stages, starting with warn-only mode and gradually enforcing stricter policies.

### Stage 1: Security & Secrets (Current)
- **Status**: Warn-only
- **Timeline**: Initial 2 weeks  
- **Scope**: Secret scanning, dependency vulnerabilities
- **Enforcement**: Continue-on-error in CI

### Stage 2: Correctness
- **Status**: Planned
- **Timeline**: Weeks 3-4
- **Scope**: Critical bugs, type errors, obvious logic issues
- **Enforcement**: Block PR merge for critical issues only

### Stage 3: Architecture & Regression Critical
- **Status**: Planned  
- **Timeline**: Weeks 5-8
- **Scope**: API breaking changes, protected path modifications
- **Enforcement**: Require approval for protected path changes

### Stage 4: UI Critical Accessibility
- **Status**: Planned
- **Timeline**: Weeks 9-12
- **Scope**: WCAG violations, keyboard navigation, color contrast
- **Enforcement**: Block for Level A violations

### Stage 5: Process Artifacts
- **Status**: Planned
- **Timeline**: Weeks 13-16
- **Scope**: Plans, self-reviews for non-trivial changes
- **Enforcement**: Require artifacts for protected path changes

### Stage 6: Release Governance
- **Status**: Planned
- **Timeline**: Weeks 17+
- **Scope**: Production deployment approvals
- **Enforcement**: Human approval required for production

## Enforcement Matrix

| Check Type | Local Dev | PR/CI | Production |
|------------|-----------|-------|------------|
| Secret Scanning | Warn | Warn → Block* | Block |
| Dependency Vulns | Warn | Warn → Block* | Block |
| Code Review | Optional | Warn → Required* | Required |
| UI Accessibility | Warn | Warn → Block* | Block |
| Process Gates | Optional | Warn → Required* | Required |
| Release Approval | N/A | N/A | Required |

*Transitions occur according to stage timeline above

## Protected Paths

Changes to these paths trigger enhanced scrutiny:

### Critical Security
- `/api/**` - All serverless functions
- `/login.html` - Authentication entry point
- `/after-checkout.html` - Payment flow
- `/success.html` - Payment confirmation

### Configuration  
- `package.json` - Dependencies and scripts
- `vercel.json` - Deployment configuration
- `.github/workflows/**` - CI configuration

## Severity Definitions

### Critical
- Security vulnerabilities (CVSS ≥ 7.0)
- Data loss or corruption risks
- Authentication/authorization bypass
- Payment processing errors

### High  
- Functional regressions in core features
- Performance degradation >50%
- Accessibility violations (WCAG Level A)
- Breaking API changes

### Medium
- Minor functional issues
- Performance degradation 20-50% 
- Accessibility violations (WCAG Level AA)
- Code quality issues

### Low
- Style/formatting issues
- Minor performance optimizations
- Documentation gaps
- Non-critical warnings

## Suppression Policy

### Allowed Suppressions
- False positives from automated tools
- Known issues with mitigation plans
- Technical debt with scheduled resolution
- Third-party library issues

### Required for Suppressions
- Clear rationale and evidence
- Expiry date (max 90 days for critical, 180 days for others)
- Owner assignment
- Link to tracking issue

### Review Process
- Security suppressions require security team approval
- Critical severity suppressions require lead approval
- All suppressions reviewed monthly
- Expired suppressions block CI until renewed or resolved