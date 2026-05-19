-- ============================================================
-- Migration 007: Spaced Repetition System
-- Apply via Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add SR columns to user_topic_mastery
ALTER TABLE user_topic_mastery
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_interval_days NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

-- Index for efficient "what's due today?" queries
CREATE INDEX IF NOT EXISTS idx_user_topic_mastery_next_review
  ON user_topic_mastery(user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- 2. Review sessions table (spans multiple topics, unlike quiz_sessions)
CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_ids JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  per_topic_results JSONB DEFAULT '[]'
);

-- 3. Review answers table
CREATE TABLE IF NOT EXISTS review_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL DEFAULT '',
  ai_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  ai_feedback TEXT NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_user_id ON review_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_answers_session_id ON review_answers(review_session_id);

-- 4. Backfill: any topic the user has already attempted is immediately eligible
-- Distributed over 3 days so queue isn't 50-deep on day 1
UPDATE user_topic_mastery
SET next_review_at = NOW() + (random() * INTERVAL '3 days')
WHERE next_review_at IS NULL AND mastery_level >= 1;

-- 5. New achievements
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward) VALUES
  ('review_master', 'Review Master', 'Complete a review session on 30 different days', '🧠', 'review_days', 30, 500),
  ('consistent_scholar', 'Consistent Scholar', 'Complete review sessions on 7 different days', '📚', 'review_days', 7, 200)
ON CONFLICT (slug) DO NOTHING;
