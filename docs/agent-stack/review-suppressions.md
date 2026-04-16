# Code Review Suppressions

Current code review findings that are suppressed with justification.

## REV-001

- **Rule**: complexity-high
- **Function**: `calculateNutritionScore`
- **File**: `js/meals.js`  
- **Status**: active
- **Severity**: medium
- **Expiry**: 2026-07-15
- **Owner**: @siteoptz
- **Rationale**: Complex nutrition calculation algorithm; breaking down would hurt readability
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/3
- **Lane**: architecture
- **Last Reviewed**: 2026-04-15

## REV-002

- **Rule**: duplicate-code
- **Files**: `api/symptoms/index.js`, `api/progress/index.js`
- **Status**: active
- **Severity**: low
- **Expiry**: 2026-08-15  
- **Owner**: @siteoptz
- **Rationale**: Refactoring scheduled for Q3; acceptable duplication for now
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/4
- **Lane**: style
- **Last Reviewed**: 2026-04-15

## REV-003

- **Rule**: missing-error-handling
- **Function**: `loadUserPreferences`  
- **File**: `js/dashboard.js`
- **Status**: active
- **Severity**: medium
- **Expiry**: 2026-06-15
- **Owner**: @siteoptz  
- **Rationale**: Graceful degradation acceptable; preferences are non-critical
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/5
- **Lane**: correctness
- **Last Reviewed**: 2026-04-15

## Suppression Rules

Review suppressions are reviewed bi-weekly and require:
1. Technical justification for the finding
2. Clear plan for resolution or acceptance
3. Expiry within 180 days  
4. Lead approval for high/critical severity
5. Assignment to specific review lane