# PostDoseRX User-Centric Dashboard — Implementation Plan

**Document Purpose:** A comprehensive, step-by-step plan for building a user-centric dashboard on app.postdoserx.com where every logged-in user sees personalized, customized information. All data is independent per user and persisted server-side.

**Target Audience:** Cloud.ai or any AI agent tasked with implementing the dashboard.

**Last Updated:** March 2026

---

## 1. Executive Summary

### 1.1 Goal
Build a fully user-centric dashboard at **app.postdoserx.com** where:
- Each user sees **only their own data** after login
- All user data is **persisted** in a backend database (not localStorage)
- Data is **personalized** based on medication, preferences, and history
- Features work **independently** per user with strict data isolation

### 1.2 Current State vs. Target State

| Aspect | Current State | Target State |
|--------|---------------|---------------|
| **Auth** | Token in localStorage, GHL/Stripe verification | JWT or session-based auth with user ID |
| **Data Storage** | localStorage (device-only, no persistence) | Backend database with user_id foreign keys |
| **User Isolation** | None (shared demo data) | Strict row-level isolation by user_id |
| **Personalization** | Static/hardcoded content | Dynamic based on user profile + history |
| **Meal Plans** | Static templates | User-specific, dose-aware, preference-based |
| **Symptom Tracking** | localStorage | Per-user symptom history in DB |
| **Meal Ratings** | localStorage | Per-user feedback in DB, powers recommendations |

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         app.postdoserx.com                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (SPA or Multi-Page)                                             │
│  - Login/Redirect from postdoserx.com                                     │
│  - Dashboard UI (existing HTML/CSS/JS)                                    │
│  - All API calls include Authorization: Bearer <token>                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  API Layer (Vercel Serverless / Node.js)                                  │
│  - /api/auth/*     — Login, token refresh, logout                        │
│  - /api/users/*    — Profile, preferences, medication                   │
│  - /api/meals/*    — Meal plans, schedules, grocery lists               │
│  - /api/symptoms/* — Symptom logs, patterns                             │
│  - /api/ratings/*  — Meal ratings, feedback                             │
│  - /api/progress/* — Weight, goals, analytics                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Database (Supabase / PostgreSQL / PlanetScale)                          │
│  - users, user_profiles, user_medication                                 │
│  - symptom_logs, meal_ratings, meal_plans, grocery_lists                 │
│  - All tables: user_id (UUID) as foreign key                            │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  External Services                                                        │
│  - Stripe (billing, subscription status)                                 │
│  - GHL (CRM sync, contact tags)                                          │
│  - Google OAuth (optional login)                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Principle
**Every API request must:**
1. Validate JWT/session and extract `user_id`
2. Scope all queries with `WHERE user_id = :user_id`
3. Never return data for other users

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Users (synced from auth provider or created on first login)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  ghl_contact_id VARCHAR(255),
  tier VARCHAR(50) DEFAULT 'trial',  -- 'trial' | 'premium'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profile & medication (personalization source)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication VARCHAR(100),           -- Ozempic, Wegovy, Mounjaro, etc.
  dose_amount VARCHAR(50),
  injection_day VARCHAR(20),         -- e.g., 'Sunday', 'Wednesday'
  start_date DATE,
  preferences JSONB,                 -- dietary restrictions, allergies, goals
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Symptom logs (per user)
CREATE TABLE symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  symptoms JSONB NOT NULL,            -- { "nausea": 3, "fatigue": 5 }
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Meal ratings (per user)
CREATE TABLE meal_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id VARCHAR(100),
  meal_name VARCHAR(255),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback VARCHAR(50),              -- 'loved' | 'liked' | 'neutral' | 'disliked'
  log_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal plans (per user, weekly)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  plan_data JSONB NOT NULL,          -- full meal schedule structure
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Grocery lists (per user, per week)
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Progress tracking (weight, goals)
CREATE TABLE progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight_lbs DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Indexes for performance
CREATE INDEX idx_symptom_logs_user_date ON symptom_logs(user_id, log_date);
CREATE INDEX idx_meal_ratings_user ON meal_ratings(user_id);
CREATE INDEX idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX idx_grocery_lists_user ON grocery_lists(user_id);
CREATE INDEX idx_progress_logs_user ON progress_logs(user_id);
```

### 3.2 Row-Level Security (Supabase)
If using Supabase, enable RLS on all tables:

```sql
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own symptom_logs"
  ON symptom_logs FOR ALL
  USING (auth.uid() = user_id);

-- Repeat for meal_ratings, meal_plans, grocery_lists, progress_logs, user_profiles
```

---

## 4. Authentication & Authorization

### 4.1 Auth Flow (Recommended)

1. **Login** (postdoserx.com/login.html):
   - User signs in via Google OAuth or email
   - Backend verifies against GHL/Stripe for subscription
   - Backend creates/updates `users` row, returns JWT with `user_id`

2. **Dashboard Access** (app.postdoserx.com):
   - Redirect unauthenticated users to postdoserx.com/login.html?redirect=app.postdoserx.com
   - Store JWT in httpOnly cookie or localStorage (cookie preferred for security)
   - Every API call: `Authorization: Bearer <jwt>`

3. **Token Contents**:
   ```json
   {
     "sub": "user-uuid",
     "email": "user@example.com",
     "tier": "premium",
     "exp": 1234567890
   }
   ```

### 4.2 API Auth Middleware
Every API route must:
```javascript
// Pseudocode
const user = await verifyJWT(req.headers.authorization);
if (!user) return res.status(401).json({ error: 'Unauthorized' });
req.userId = user.sub;
// All DB queries use req.userId
```

---

## 5. Feature-by-Feature Implementation Plan

### Phase 1: Foundation (Weeks 1–2)

#### 5.1.1 Backend Setup
- [ ] Choose database: Supabase (recommended) or PlanetScale or Neon
- [ ] Create `users` and `user_profiles` tables
- [ ] Set up Vercel serverless API structure
- [ ] Create `/api/auth/login` and `/api/auth/me` endpoints
- [ ] Implement JWT issue/verify (use `jose` or `jsonwebtoken`)

#### 5.1.2 Auth Integration
- [ ] Modify login.html to call `/api/auth/login` after GHL/Google verification
- [ ] Return JWT with `user_id`, `email`, `tier`
- [ ] Modify app.postdoserx.com to:
  - Check for valid JWT on load
  - Redirect to login if missing/invalid
  - Pass token in all fetch requests

#### 5.1.3 User Profile API
- [ ] `GET /api/users/me` — return user + profile
- [ ] `PUT /api/users/me` — update profile (medication, dose, injection day, preferences)
- [ ] Create `user_profiles` row on first login if missing

---

### Phase 2: Symptom Tracking (Week 2–3)

#### 5.2.1 Symptom Logs API
- [ ] `GET /api/symptoms?from=YYYY-MM-DD&to=YYYY-MM-DD` — list logs for user
- [ ] `POST /api/symptoms` — create/upsert log for a date
  ```json
  { "log_date": "2026-03-18", "symptoms": { "nausea": 3, "fatigue": 5 }, "note": "..." }
  ```
- [ ] `GET /api/symptoms/patterns` — aggregate patterns (e.g., by day-of-week, injection cycle)

#### 5.2.2 Frontend Changes
- [ ] Replace `localStorage.getItem('symptom_history')` with `fetch('/api/symptoms')`
- [ ] Replace `localStorage.setItem(...)` in `saveSymptomLog()` with `POST /api/symptoms`
- [ ] Load symptom history on view mount, scoped by `user_id` (handled by API)

---

### Phase 3: Meal Ratings & Feedback (Week 3–4)

#### 5.3.1 Meal Ratings API
- [ ] `GET /api/ratings?from=...&to=...` — list ratings for user
- [ ] `POST /api/ratings` — submit rating session
  ```json
  { "ratings": { "meal-1": 5, "meal-2": 4 }, "feedback": { "meal-1": "loved" } }
  ```

#### 5.3.2 Frontend Changes
- [ ] Replace `localStorage` in `submitAllRatings()` with `POST /api/ratings`
- [ ] Replace `meal_rating_history` load with `GET /api/ratings`
- [ ] Ensure Feedback view shows only current user's ratings

---

### Phase 4: Meal Plans & Grocery Lists (Week 4–5)

#### 5.4.1 Meal Plans API
- [ ] `GET /api/meals/plan?week=YYYY-MM-DD` — get meal plan for user + week
- [ ] `PUT /api/meals/plan` — save/update meal plan
- [ ] `GET /api/meals/grocery?week=YYYY-MM-DD` — get grocery list for user + week
- [ ] `PUT /api/meals/grocery` — save grocery list
- [ ] Logic: Generate plan from template + user profile (medication, injection day) if none exists; else return stored plan

#### 5.4.2 Personalization Logic
- [ ] Use `user_profiles.medication` and `injection_day` to adjust meal timing
- [ ] Use `meal_ratings` to avoid disliked foods, favor loved ones
- [ ] Use `symptom_logs` to suggest gentler foods on high-symptom days

#### 5.4.3 Frontend Changes
- [ ] Replace static meal plan data with `GET /api/meals/plan`
- [ ] Replace static grocery list with `GET /api/meals/grocery`
- [ ] Add "Save changes" where user can edit plans → `PUT /api/meals/plan`

---

### Phase 5: Progress Tracking (Week 5–6)

#### 5.5.1 Progress API
- [ ] `GET /api/progress?from=...&to=...` — list progress entries
- [ ] `POST /api/progress` — log weight/notes for a date
- [ ] `GET /api/progress/summary` — aggregates (start weight, current, goal, trend)

#### 5.5.2 Frontend Changes
- [ ] Progress view: load from `GET /api/progress`, submit via `POST /api/progress`
- [ ] Charts/graphs use only current user's data

---

### Phase 6: Onboarding & Profile (Week 6–7)

#### 5.6.1 Onboarding Flow
- [ ] New users: redirect to onboarding (medication, dose, injection day, goals)
- [ ] Save to `user_profiles` via `PUT /api/users/me`
- [ ] Skip onboarding if profile already complete

#### 5.6.2 Settings
- [ ] Settings view: edit medication, preferences, notification preferences
- [ ] All updates go through `PUT /api/users/me`

---

### Phase 7: Polish & Security (Week 7–8)

#### 5.7.1 Security
- [ ] Ensure all API routes validate JWT and scope by `user_id`
- [ ] Rate limiting on auth endpoints
- [ ] CORS restricted to postdoserx.com, app.postdoserx.com

#### 5.7.2 Data Migration
- [ ] Optional: Migrate existing localStorage data for early users (if any) via one-time script

#### 5.7.3 Tier Gating
- [ ] Premium features: check `user.tier` from JWT or `GET /api/users/me`
- [ ] Return 403 for trial users on premium endpoints, or soft-gate in UI

---

## 6. API Reference Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current user (validate token) |
| GET | /api/users/me | User + profile |
| PUT | /api/users/me | Update profile |
| GET | /api/symptoms | List symptom logs |
| POST | /api/symptoms | Create/update log |
| GET | /api/symptoms/patterns | Pattern insights |
| GET | /api/ratings | List meal ratings |
| POST | /api/ratings | Submit ratings |
| GET | /api/meals/plan | Get meal plan |
| PUT | /api/meals/plan | Save meal plan |
| GET | /api/meals/grocery | Get grocery list |
| PUT | /api/meals/grocery | Save grocery list |
| GET | /api/progress | List progress |
| POST | /api/progress | Log progress |
| GET | /api/progress/summary | Progress summary |

---

## 7. Frontend Integration Checklist

For each dashboard view, ensure:

1. **On Load**: `fetch('/api/...', { headers: { Authorization: `Bearer ${token}` } })`
2. **On Save**: `fetch('/api/...', { method: 'POST'|'PUT', body: JSON.stringify(data), headers: { ... } })`
3. **No localStorage** for user-specific data (except token if not using httpOnly cookie)
4. **Error Handling**: 401 → redirect to login; 403 → show upgrade modal
5. **Loading States**: Show skeleton/spinner while fetching
6. **Empty States**: "No data yet" when user has no logs/ratings/plans

---

## 8. Environment Variables

```
DATABASE_URL=           # Supabase/Postgres connection string
JWT_SECRET=             # For signing/verifying tokens
STRIPE_SECRET_KEY=      # For subscription verification
GHL_API_KEY=            # For GHL contact lookup
GHL_LOCATION_ID=        # GHL location
GOOGLE_CLIENT_ID=       # OAuth (if used)
CORS_ORIGINS=           # postdoserx.com,app.postdoserx.com
```

---

## 9. Testing & Validation

### 9.1 Per-User Isolation Tests
- [ ] Create two test users (User A, User B)
- [ ] User A logs symptoms; User B must not see them
- [ ] User A rates meals; User B's ratings are independent
- [ ] User A's meal plan ≠ User B's meal plan

### 9.2 Persistence Tests
- [ ] Log in as User A, add data, log out
- [ ] Log in as User A from different device/browser → data persists
- [ ] Clear localStorage → log in again → data still present

### 9.3 Auth Tests
- [ ] No token → redirect to login
- [ ] Invalid/expired token → redirect to login
- [ ] Valid token → dashboard loads with user data

---

## 10. Deployment Checklist

- [ ] Database provisioned and migrated
- [ ] API routes deployed to Vercel
- [ ] Environment variables set in Vercel
- [ ] app.postdoserx.com points to dashboard
- [ ] postdoserx.com/login.html redirects to app with token
- [ ] CORS allows app.postdoserx.com
- [ ] Stripe webhook updates `users.tier` on subscription change

---

## 11. Quick Start for Cloud.ai

**Recommended implementation order:**
1. Set up Supabase project, run schema
2. Create `/api/auth/login` and `/api/auth/me`
3. Wire login.html to return JWT, app to use it
4. Implement `/api/symptoms` (simplest user data)
5. Update symptom UI to use API
6. Repeat pattern for ratings, meals, progress
7. Add onboarding and profile endpoints
8. Security pass and testing

**Key principle:** Every piece of user data must have `user_id` and be fetched/updated only for the authenticated user.
