# Claude Memory Bootstrap

This file provides context for cross-session project continuity. **`npm run agent:memory:check`** validates that required sections and **redirect/auth contract strings** are still present—do not delete those strings.

## Project Overview
PostDoseRX is a user dashboard for GLP-1 medication patients (meal planning, symptom tracking). **Marketing** lives on **postdoserx.com**; the **app** is **app.postdoserx.com**. Users pick a plan on the marketing site, get a **GoHighLevel (GHL)** contact, then use **Google** + **`POST /api/auth/login`** (JWT) for the dashboard—not a generic “Supabase Auth UI” only.

## Architecture
- **Frontend**: Static HTML/CSS/JS on Vercel (`index.html`, `js/`, etc.)
- **Backend**: Serverless handlers under `/api/` (Node)
- **Database**: Supabase Postgres (`users`, `user_profiles`, …)
- **Auth**: **Custom JWT** from **`/api/auth/login`** (Google credential → email); **GHL** enforces “plan first” for net-new users; Bearer JWT on **`/api/users/me`**, etc.
- **Payments**: Stripe; webhooks / checkout tie into GHL and pending-plan store
- **CRM**: GoHighLevel—contact must exist (or checkout context) before dashboard access for first-time accounts

## Key Files & Patterns
- `index.html` — Main dashboard; **must** redirect unauthenticated users to **marketing** login (see contract below), not app `/api/login`
- `js/auth-init.js` — Token capture (`?token=`), session init, redirect when no token
- `api/auth/login.js` — **Authoritative** login: GHL gate, `requiresSignup`, JWT issuance
- `api/login.js` — **Stripe / post-payment page only** (“Payment Successful… authenticate with Google”). **Not** the global login entry.
- `lib/postdoserx/ghl.js` — GHL duplicate search / tags
- `/api/middleware/auth.js` — JWT verification for API routes
- `.cursor/rules/*.mdc` — Non-negotiable rules (deploy, GHL gate, marketing vs app login)

### Auth & redirects contract (non-negotiable) — MEMORY_ANCHOR_REDIRECTS

1. **Marketing login (normal sign-in / sign-out return):**  
   **`https://postdoserx.com/login.html`**  
   Use **`?redirect=<url-encoded app URL>`** when sending users back to the app after login.

2. **Do not use for generic “please log in”:**  
   **`https://app.postdoserx.com/api/login`**  
   That URL is **`api/login.js`** — copy and flow for **post-Stripe / payment success**, not the main marketing funnel.

3. **First-time user, no GHL contact:**  
   **`POST /api/auth/login`** returns **`requiresSignup: true`** and **`redirectUrl`** (default **`https://postdoserx.com/#signup`** or **`SIGNUP_PAGE_URL`**). Client **must** navigate to **`redirectUrl`** — never substitute an app URL.

4. **After any behavior change:** run **`npm run deploy`** so Vercel serves updated HTML/JS.

5. **Do not bypass** GHL / `requiresSignup` in **`api/auth/login.js`** to “fix” UX—that sends people to a **generic demo** dashboard.

## Development Workflow
1. Local: `npm run dev` (Vercel dev)
2. Production deploy: **`npm run deploy`**
3. Before auth/redirect work: read **this file**, **`.cursor/rules/ghl-signup-gate.mdc`**, **`.cursor/rules/marketing-vs-app-login.mdc`**, **`.cursor/rules/vercel-deploy.mdc`**
4. Optional: `npm run agent:plan` / `agent:self-review` / `agent:review` for larger changes
5. No separate build step for static assets (per `package.json`)

## Agent Stack Status
- **Installation Date**: 2026-04-15
- **Memory contract strings**: `MEMORY_ANCHOR_REDIRECTS`, `postdoserx.com/login.html`, `api/login.js` Stripe-only note above—**preserved for `agent:memory:check`**
- **Protected Paths**: `/api/*`, `login.html` (marketing), `after-checkout.html`, `success.html`

## Common Tasks
- API routes use JWT middleware where required
- Supabase server client in API handlers with service role where appropriate
- GHL integration: `searchGHLContactDetailed`, plan tags `postdoserx-plan-*`

## Quality Standards
- Accessibility: WCAG 2.1 AA target
- Security: OWASP-oriented; no secret logging
- Performance: reasonable cold-start awareness on Vercel

## Known Issues & Suppressions
Reference `*-suppressions.md` under `docs/agent-stack/` for tracked suppressions.
