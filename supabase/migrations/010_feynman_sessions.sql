-- Migration 010: Feynman Mode
-- After failing a quiz (<60%), students can "teach it back" to an AI bot student.
-- Claude plays a curious peer who never gives answers — only asks probing questions.

CREATE TABLE IF NOT EXISTS feynman_sessions (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id         UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  quiz_session_id  UUID        REFERENCES quiz_sessions(id) ON DELETE SET NULL,
  -- Conversation stored as [{role: "user"|"assistant", content: "..."}]
  messages         JSONB       NOT NULL DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'passed', 'abandoned')),
  evaluation_score NUMERIC(4,3),
  xp_earned        INTEGER     NOT NULL DEFAULT 0,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feynman_sessions_user
  ON feynman_sessions(user_id, topic_id);

-- Achievement: The Professor — pass 5 Feynman sessions
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward)
VALUES (
  'the_professor',
  'The Professor',
  'Proved your understanding by teaching a concept 5 times and passing',
  '🎓',
  'feynman_sessions_passed',
  5,
  350
) ON CONFLICT (slug) DO NOTHING;
