# UI Review Suppressions

Current UI and accessibility findings that are suppressed with justification.

## UI-001

- **Rule**: color-contrast
- **Element**: `.symptom-severity-low` 
- **File**: `styles/dashboard.css`
- **Status**: active
- **Severity**: medium
- **Expiry**: 2026-06-15
- **Owner**: @siteoptz
- **Rationale**: Color scientifically chosen for low-severity indication; adding text indicators
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/6
- **Category**: accessibility
- **Impacted Flows**: symptom-logging
- **Last Reviewed**: 2026-04-15

## UI-002

- **Rule**: missing-alt-text
- **Element**: Chart canvas elements
- **File**: `js/charts.js`
- **Status**: active  
- **Severity**: high
- **Expiry**: 2026-05-15
- **Owner**: @siteoptz
- **Rationale**: Canvas charts will be replaced with SVG + data tables in next sprint
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/7  
- **Category**: accessibility
- **Impacted Flows**: progress-viewing, meal-planning
- **Last Reviewed**: 2026-04-15

## UI-003

- **Rule**: touch-target-size
- **Element**: `.close-button` in modals
- **File**: `styles/components.css`
- **Status**: active
- **Severity**: medium
- **Expiry**: 2026-07-15
- **Owner**: @siteoptz
- **Rationale**: Acceptable on desktop; mobile design system update will address
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/8
- **Category**: usability  
- **Impacted Flows**: modal-interactions
- **Last Reviewed**: 2026-04-15

## UI-004

- **Rule**: focus-indicator
- **Element**: Custom dropdown components  
- **File**: `js/components/dropdown.js`
- **Status**: active
- **Severity**: high
- **Expiry**: 2026-05-30
- **Owner**: @siteoptz
- **Rationale**: Browser default focus visible; custom styling in progress
- **Issue**: https://github.com/siteoptz/postdoserx-app/issues/9
- **Category**: accessibility
- **Impacted Flows**: form-completion, settings
- **Last Reviewed**: 2026-04-15

## Suppression Rules

UI suppressions are reviewed weekly and require:
1. User experience impact assessment
2. Mitigation plan for accessibility issues  
3. Expiry within 60 days for high severity, 90 days for others
4. UX team approval for design-related suppressions
5. Clear categorization and affected user flows