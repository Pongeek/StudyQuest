-- StudyQuest Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Clerk webhooks)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  coins INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  theme_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  episode_count INTEGER NOT NULL DEFAULT 0,
  topic_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course files (multiple PDFs per course)
CREATE TABLE IF NOT EXISTS course_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'lecture' CHECK (file_type IN ('lecture', 'notes', 'past_exam')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Episodes (chapters / major sections)
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Topics (individual study units within episodes)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  key_concepts JSONB NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  order_index INTEGER NOT NULL DEFAULT 0,
  prerequisite_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions (generated per topic)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'open')),
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User topic mastery (per user per topic)
CREATE TABLE IF NOT EXISTS user_topic_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  mastery_level INTEGER NOT NULL DEFAULT 1 CHECK (mastery_level BETWEEN 0 AND 5),
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  last_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  consecutive_good_scores INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

-- Quiz sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  score_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  debrief JSONB
);

-- Individual quiz answers
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL DEFAULT '',
  ai_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  ai_feedback TEXT NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Achievements definitions
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 0
);

-- User earned achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Exam questions (extracted from past exam PDFs)
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source_file_id UUID NOT NULL REFERENCES course_files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  model_answer TEXT NOT NULL DEFAULT '',
  topic_ids JSONB NOT NULL DEFAULT '[]',
  marks INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam practice sessions
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_file_id UUID NOT NULL REFERENCES course_files(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'assisted' CHECK (mode IN ('timed', 'assisted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  predicted_score NUMERIC(5,2),
  exam_readiness TEXT CHECK (exam_readiness IN ('low', 'moderate', 'high', 'ready')),
  debrief JSONB
);

-- Exam practice answers
CREATE TABLE IF NOT EXISTS exam_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL DEFAULT '',
  ai_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  ai_feedback TEXT NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_course_id ON episodes(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_episode_id ON topics(episode_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_mastery_user_id ON user_topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_mastery_topic_id ON user_topic_mastery(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_topic_id ON quiz_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_session_id ON quiz_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON course_files(course_id);

-- Seed achievements
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward) VALUES
  ('first_step', 'First Step', 'Complete your very first quiz', '👟', 'quiz_sessions_completed', 1, 50),
  ('bookworm', 'Bookworm', 'Upload your first course', '📚', 'courses_uploaded', 1, 100),
  ('on_fire', 'On Fire', 'Maintain a 7-day study streak', '🔥', 'streak_days', 7, 200),
  ('perfectionist', 'Perfectionist', 'Score 100% on a quiz', '💯', 'perfect_quiz', 1, 150),
  ('scholar', 'Scholar', 'Complete all topics in a course', '🎓', 'course_completed', 1, 500),
  ('speed_demon', 'Speed Demon', 'Complete a quiz in under 2 minutes', '⚡', 'fast_quiz', 1, 100),
  ('master_mind', 'Master Mind', 'Achieve Master mastery on 5 topics', '🧠', 'master_topics', 5, 300),
  ('iron_will', 'Iron Will', 'Maintain a 30-day streak', '💪', 'streak_days', 30, 500),
  ('knowledge_seeker', 'Knowledge Seeker', 'Complete 50 quiz sessions', '🔍', 'quiz_sessions_completed', 50, 400),
  ('exam_ready', 'Exam Ready', 'Complete a full past exam practice', '📝', 'exam_sessions_completed', 1, 200)
ON CONFLICT (slug) DO NOTHING;
