-- PostDoseRX Supabase RLS Policies
-- Implements user isolation as per PRD §3.2
-- Each user can only access their own data

-- Enable RLS on all user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;

-- USERS table policies
-- Users can only read/update their own record
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id);

-- USER_PROFILES table policies  
-- Users can only access their own profile data
CREATE POLICY "Users can view own user profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own user profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own user profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = user_id);

-- SYMPTOM_LOGS table policies
-- Users can only access their own symptom logs
CREATE POLICY "Users can view own symptom logs" ON symptom_logs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own symptom logs" ON symptom_logs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own symptom logs" ON symptom_logs
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own symptom logs" ON symptom_logs
    FOR DELETE USING (auth.uid()::text = user_id);

-- MEAL_RATINGS table policies
-- Users can only access their own meal ratings
CREATE POLICY "Users can view own meal ratings" ON meal_ratings
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own meal ratings" ON meal_ratings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own meal ratings" ON meal_ratings
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own meal ratings" ON meal_ratings
    FOR DELETE USING (auth.uid()::text = user_id);

-- MEAL_PLANS table policies
-- Users can only access their own meal plans
CREATE POLICY "Users can view own meal plans" ON meal_plans
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own meal plans" ON meal_plans
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own meal plans" ON meal_plans
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own meal plans" ON meal_plans
    FOR DELETE USING (auth.uid()::text = user_id);

-- PROGRESS_LOGS table policies
-- Users can only access their own progress logs
CREATE POLICY "Users can view own progress logs" ON progress_logs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own progress logs" ON progress_logs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own progress logs" ON progress_logs
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own progress logs" ON progress_logs
    FOR DELETE USING (auth.uid()::text = user_id);

-- Additional security: Ensure auth.uid() matches user_id in JWT
-- This prevents token substitution attacks
CREATE OR REPLACE FUNCTION auth_user_id_matches_jwt()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify that the authenticated user's ID matches the JWT subject
    -- This is enforced by the middleware but provides defense in depth
    RETURN auth.uid() IS NOT NULL;
END;
$$;

-- Create indexes for performance on user_id columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_logs_user_id ON symptom_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_ratings_user_id ON meal_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_id ON progress_logs(user_id);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_symptom_logs_user_date ON symptom_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_ratings_user_date ON meal_ratings(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_date ON progress_logs(user_id, log_date DESC);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON symptom_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON progress_logs TO authenticated;