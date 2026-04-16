# Claude Memory Bootstrap

This file provides context for cross-session project continuity.

## Project Overview
PostDoseRX is a user dashboard for GLP-1 medication patients, providing meal planning and symptom tracking functionality.

## Architecture
- **Frontend**: Static HTML/CSS/JS served by Vercel
- **Backend**: Serverless functions in `/api/` directory
- **Database**: Supabase (PostgreSQL) 
- **Auth**: Supabase Auth with OAuth providers
- **Payments**: Stripe integration for subscription billing

## Key Files & Patterns
- `index.html` - Main dashboard
- `login.html` - Authentication flow
- `/api/` - All serverless functions
- `/js/` - Client-side JavaScript modules
- `/styles/` - CSS and design system

## Development Workflow
1. Local development: `npm run dev` (Vercel dev server)
2. Deploy: `npm run deploy` (Vercel production)
3. No build step required (static assets)

## Agent Stack Status
- **Installation Date**: 2026-04-15
- **Current Phase**: Initial deployment (warn-only mode)
- **Protected Paths**: `/api/*`, `/login.html`, `/after-checkout.html`, `/success.html`

## Common Tasks
- API endpoints follow RESTful patterns
- Authentication middleware in `/api/middleware/auth.js`
- Database operations use Supabase client
- Frontend forms submit to corresponding API endpoints

## Quality Standards
- Accessibility: WCAG 2.1 AA compliance target
- Security: OWASP guidelines for web applications  
- Performance: <2s page load, <100ms API response
- UI: Consistent design system, mobile-responsive

## Known Issues & Suppressions
Reference `*-suppressions.md` files for current known issues being tracked.