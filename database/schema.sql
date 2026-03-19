-- PostDoseRX Database Schema
-- User-centric database with strict row-level security

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

-- Row-Level Security (Supabase)
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own symptom_logs"
  ON symptom_logs FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE meal_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own meal_ratings"
  ON meal_ratings FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own meal_plans"
  ON meal_plans FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own grocery_lists"
  ON grocery_lists FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own progress_logs"
  ON progress_logs FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own user_profiles"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id);

