# Agent instructions (PostDoseRX)

This repo uses **Cursor rules** (`.cursor/rules/*.mdc`) plus **agent-stack memory** (`docs/agent-stack/memory-bootstrap.md`). Treat both as binding unless the user explicitly overrides.

## Before you change auth, redirects, GHL, or login URLs

1. Read **`docs/agent-stack/memory-bootstrap.md`** (especially **Auth & redirects contract**).
2. Read **`.cursor/rules/marketing-vs-app-login.mdc`** and **`.cursor/rules/ghl-signup-gate.mdc`**.
3. Do **not** send users to **`https://app.postdoserx.com/api/login`** for generic login—that route is **`api/login.js`** (Stripe / post-payment page only). Use **`https://postdoserx.com/login.html`** (with `?redirect=` when returning to the app).
4. Honor **`POST /api/auth/login`** responses: **`requiresSignup`** → navigate to **`redirectUrl`** from JSON (e.g. **`#signup`** on marketing).

## After code changes that affect production

Run **`npm run deploy`** and confirm success.

## npm “agent” scripts (six core checks)

| Script | Purpose |
|--------|---------|
| `npm run agent:memory:check` | Ensures `memory-bootstrap.md` exists, sections, and **required auth/redirect strings** |
| `npm run agent:plan` | Scaffold a plan for protected work |
| `npm run agent:self-review` | Self-review from template |
| `npm run agent:review` | Multi-lane review |
| `npm run agent:security` | Security scan |
| `npm run agent:ui-review` | UI/a11y review |

Use **`agent:memory:check`** in CI or before merging auth-related PRs so memory cannot be gutted silently.

## Why Claude “forgets”

IDE agents do not share long-term memory across sessions. **This file**, **`memory-bootstrap.md`**, and **`.cursor/rules`** are the durable layer—keep them accurate when behavior changes.
