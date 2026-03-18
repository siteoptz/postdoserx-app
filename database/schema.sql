-- PostDoseRX Database Schema
-- User-centric database with strict row-level security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from auth provider or created on first login)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  ghl_contact_id VARCHAR(255),
  tier VARCHAR(50) DEFAULT 'trial' CHECK (tier IN ('trial', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles & medication info (personalization source)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication VARCHAR(100),           -- Ozempic, Wegovy, Mounjaro, etc.
  dose_amount VARCHAR(50),
  injection_day VARCHAR(20),         -- e.g., 'Sunday', 'Wednesday'  
  start_date DATE,
  preferences JSONB DEFAULT '{}',    -- dietary restrictions, allergies, goals
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Symptom logs (per user)
CREATE TABLE symptom_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  symptoms JSONB NOT NULL,           -- { "nausea": 3, "fatigue": 5 }
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Meal ratings (per user) 
CREATE TABLE meal_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id VARCHAR(100) NOT NULL,
  meal_name VARCHAR(255) NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback VARCHAR(50),              -- 'loved', 'liked', 'neutral', 'disliked'
  log_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal plans (per user, weekly)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  plan_data JSONB NOT NULL,          -- full meal schedule structure
  is_custom BOOLEAN DEFAULT FALSE,   -- user customized vs AI generated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Grocery lists (per user, per week)
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  items JSONB NOT NULL,
  checked_items JSONB DEFAULT '[]',   -- items user has checked off
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Progress tracking (weight, goals, notes)
CREATE TABLE progress_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight_lbs DECIMAL(5,2),
  notes TEXT,
  mood_rating INT CHECK (mood_rating >= 1 AND mood_rating <= 5),
  energy_rating INT CHECK (energy_rating >= 1 AND energy_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_symptom_logs_user_date ON symptom_logs(user_id, log_date);
CREATE INDEX idx_meal_ratings_user ON meal_ratings(user_id);
CREATE INDEX idx_meal_ratings_user_date ON meal_ratings(user_id, log_date);
CREATE INDEX idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX idx_meal_plans_user_week ON meal_plans(user_id, week_start);
CREATE INDEX idx_grocery_lists_user ON grocery_lists(user_id);
CREATE INDEX idx_progress_logs_user ON progress_logs(user_id);
CREATE INDEX idx_progress_logs_user_date ON progress_logs(user_id, log_date);

-- Row-Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY; 
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can access own data" ON users
  FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users can access own profile" ON user_profiles
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can access own symptom logs" ON symptom_logs
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can access own meal ratings" ON meal_ratings
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can access own meal plans" ON meal_plans
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can access own grocery lists" ON grocery_lists
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can access own progress logs" ON progress_logs
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grocery_lists_updated_at BEFORE UPDATE ON grocery_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();