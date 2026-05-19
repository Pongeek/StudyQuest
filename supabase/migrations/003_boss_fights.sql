-- Boss fight sessions (end-of-episode comprehensive quizzes)
CREATE TABLE IF NOT EXISTS boss_fight_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  score_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  debrief JSONB
);

-- Boss fight questions (generated per episode, stored for reuse)
CREATE TABLE IF NOT EXISTS boss_fight_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'open')),
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 4 CHECK (difficulty BETWEEN 1 AND 5),
  source_topic_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Boss fight answers
CREATE TABLE IF NOT EXISTS boss_fight_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES boss_fight_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES boss_fight_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL DEFAULT '',
  ai_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  ai_feedback TEXT NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boss_fight_sessions_user_id ON boss_fight_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_fight_sessions_episode_id ON boss_fight_sessions(episode_id);
CREATE INDEX IF NOT EXISTS idx_boss_fight_questions_episode_id ON boss_fight_questions(episode_id);
CREATE INDEX IF NOT EXISTS idx_boss_fight_answers_session_id ON boss_fight_answers(session_id);

-- Achievement for boss fight completion
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward) VALUES
  ('boss_slayer', 'Boss Slayer', 'Defeat your first episode boss', '🐉', 'boss_fights_completed', 1, 250),
  ('unstoppable', 'Unstoppable', 'Defeat 5 episode bosses', '⚔️', 'boss_fights_completed', 5, 500)
ON CONFLICT (slug) DO NOTHING;
