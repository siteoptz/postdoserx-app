# PHASE LOCK - PostDoseRX Theme Migration Status

**Current Phase:** Phase 4 - Dashboard Shell Cleanup  
**Scope:** Sidebar + main layout + card surfaces ONLY  
**Status:** [IN PROGRESS] Dark backgrounds still showing despite theme fixes

## APPROVED BRAND TOKENS (Phase 1/2 Complete)
From `/styles/brand-tokens.css` - ONLY these values allowed:

```css
/* PRIMARY BRAND COLORS */
--brand-primary: #C6158D;        /* PostDoseRX magenta */
--brand-primary-dark: #A01273;
--brand-primary-light: #E71BA7;

--brand-secondary: #10B981;      /* Green */
--brand-secondary-dark: #059669;
--brand-secondary-light: #34D399;

/* NEUTRAL PALETTE */
--brand-background-light: #F8FAFC;  /* Light gray background */
--brand-text-dark: #1F2937;         /* Dark text */
--brand-text-gray: #6B7280;         /* Gray text */
--brand-border-light: #E5E7EB;      /* Light borders */
--brand-white: #FFFFFF;             /* White surfaces */

/* SEMANTIC COLORS */
--brand-warning: #F59E0B;           /* Orange */
--brand-error: #EF4444;             /* Red */
--brand-info: #3B82F6;              /* Blue */
```

## CURRENT ISSUE
**Problem:** Dashboard shell (sidebar, header, cards) still shows dark backgrounds despite `data-theme="postdoserx"` being set in production.

**Root Cause:** index.html inline `<style>` block has hardcoded dark variables that need to be scoped to `html[data-theme="legacy"]` only.

## PHASE 4 SCOPE RESTRICTION
**Allowed Changes:**
- Sidebar background/border fixes
- Header background/border fixes  
- Card surface background fixes
- Scoping existing dark styles to legacy theme

**FORBIDDEN:**
- New hardcoded colors in index.html
- Button/icon redesigns outside shell scope
- Auth/login URL changes
- Business logic modifications

## APPROVED SOLUTION
Move hardcoded dark variables in index.html from `:root` to `html[data-theme="legacy"]` scope, allowing PostDoseRX theme variables to take effect.

**Files to modify:**
- `index.html` - Scope existing dark CSS to legacy theme only
- NO new colors added, only scoping changes

## EMERGENCY ROLLBACK
```javascript
// Instant fallback to working theme
document.documentElement.dataset.theme = 'legacy'
```

---
**Created:** 2026-04-23  
**Phase 4 Goal:** Clean dashboard shell backgrounds using existing approved brand tokens only