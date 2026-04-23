# Theme System Documentation
## Phase 1: Foundation Setup

**Status:** ✅ Phase 1 Complete - Foundation established with rollback safety  
**Date:** 2026-04-23  
**Objective:** Set up theming foundation without changing app behavior

---

## Files Changed

### ✅ Modified Files
1. **`/postdoserx-app/index.html`**
   - Added: `data-theme="legacy"` attribute to `<html>` element
   - Purpose: Root theme selector for legacy/postdoserx themes

2. **`/postdoserx-app/design-system.css`**
   - Added: `@import url('./styles/brand-tokens.css');` import at top
   - Purpose: Wire brand tokens into global style pipeline

### ✅ New Files
3. **`/postdoserx-app/styles/brand-tokens.css`** (New file)
   - Purpose: Shared brand tokens derived from marketing site
   - Contains: Colors, typography, spacing, shadows, gradients from `/assets/styles.css`
   - Safety: No styles applied to elements yet - only token definitions

---

## Theme System

### Current Themes
- **`legacy`** (DEFAULT): Preserves existing app appearance
- **`postdoserx`**: Future marketing site alignment (Phase 2+)

### How to Toggle Themes

#### Method 1: HTML Attribute
```html
<!-- Legacy theme (current) -->
<html lang="en" data-theme="legacy">

<!-- PostDoseRX theme (future) -->
<html lang="en" data-theme="postdoserx">
```

#### Method 2: JavaScript
```javascript
// Switch to PostDoseRX theme
document.documentElement.dataset.theme = 'postdoserx';

// Switch back to legacy theme  
document.documentElement.dataset.theme = 'legacy';
```

---

## Rollback Instructions

### One-Step Rollback (Remove Entire System)
To completely remove the theme system and return to original state:

1. **Remove theme attribute** from `/postdoserx-app/index.html`:
   ```html
   <!-- Change this: -->
   <html lang="en" data-theme="legacy">
   
   <!-- Back to this: -->
   <html lang="en">
   ```

2. **Remove import** from `/postdoserx-app/design-system.css`:
   ```css
   /* Delete this line: */
   @import url('./styles/brand-tokens.css');
   ```

3. **Delete token file**:
   ```bash
   rm /postdoserx-app/styles/brand-tokens.css
   ```

### Verification
After rollback, the app should behave exactly as before Phase 1 implementation.

---

## Safety Guardrails

### ✅ Auth/Redirect Files - UNTOUCHED
The following auth-sensitive files were **NOT MODIFIED** per hard constraints:

- `/js/auth-init.js` - Authentication initialization
- `/js/api.js` - API client  
- `/api/auth/login.js` - Auth endpoints
- `/api/middleware/auth.js` - Auth middleware
- `/login.html` - Login page flows
- `/after-checkout.html` - Payment flows
- External dependency: `https://postdoserx.com/dashboard-auth.js`

### ✅ No Behavior Changes
- Visual output remains unchanged in Phase 1
- All existing CSS variables and classes work as before
- No component logic modified
- No copy/content changes made

### ✅ Reversibility
- All changes are additive only
- Original styles preserved and active
- Rollback requires only 3 simple steps
- No data migration or complex restoration needed

---

## Phase 1 Validation

### Visual Verification
- ✅ App appearance unchanged from pre-Phase 1
- ✅ All interactive elements function normally  
- ✅ Authentication flows unaffected
- ✅ Payment/billing flows unaffected

### Technical Verification
- ✅ Brand tokens loaded but not applied
- ✅ Theme system infrastructure in place
- ✅ No CSS conflicts or console errors
- ✅ Legacy theme active by default

---

## Next Steps (Phase 2)

Phase 2 will focus on **foundation components only**:
- Buttons alignment with marketing site
- Input fields styling updates  
- Card components harmonization
- Link styling consistency

**NOT included in Phase 2:**
- Authentication components
- Payment flows
- Complex dashboard widgets
- Data visualization components

---

## Emergency Contacts

If any issues arise with the theme system:
1. Immediately switch to legacy theme: `data-theme="legacy"`
2. If problems persist, follow full rollback instructions above
3. Theme system can be safely removed without affecting app functionality

---

**Phase 1 Complete:** ✅ Foundation established with rollback safety