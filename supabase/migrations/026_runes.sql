-- Migration 026: Runes — Anki-style atomic recall cards.
-- Apply via Supabase Dashboard → SQL Editor.
--
-- Four tables: deck content, per-user SM-2 state, drill sessions, per-rep log.
-- No RLS (house style): service-role client + user_id ownership checks in routes.
-- Scheduling is per-CARD and fully separate from user_topic_mastery — rune
-- drills never touch the topic-level review queue.

-- 1. Deck content (a topic's deck = all its rune_cards)
CREATE TABLE IF NOT EXISTS rune_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'forged' CHECK (source IN ('forged', 'manual')),
  -- Set on first user edit; NULL = pristine. Reforge replaces ONLY pristine
  -- forged cards — manual and edited cards survive.
  edited_at TIMESTAMPTZ,
  -- "Banished": excluded from drills and due counts. NULL = active.
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rune_cards_topic_id ON rune_cards(topic_id);

-- 2. Per-user per-card SM-2 state. Created EAGERLY at forge/manual-add with
--    due_at = NOW() (new cards are immediately due — no new-card gating).
CREATE TABLE IF NOT EXISTS rune_card_srs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES rune_cards(id) ON DELETE CASCADE,
  interval_days NUMERIC NOT NULL DEFAULT 1,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  review_count INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rating INTEGER,
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, card_id)
);

-- The "what's due?" index (mirrors idx_user_topic_mastery_next_review in 007)
CREATE INDEX IF NOT EXISTS idx_rune_card_srs_due ON rune_card_srs(user_id, due_at);

-- 3. Drill sessions (global due session / topic drill / course cram)
CREATE TABLE IF NOT EXISTS rune_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('due', 'topic', 'course')),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  card_ids JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  card_count INTEGER NOT NULL DEFAULT 0,
  rated_count INTEGER NOT NULL DEFAULT 0,
  -- XP-eligible reps: was_due AND final rating >= 3 (Hard/Good/Easy)
  due_rated_count INTEGER NOT NULL DEFAULT 0,
  again_count INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  -- Daily queue-clear bonus guard: at most one TRUE per user per day.
  queue_cleared BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_rune_sessions_user_id ON rune_sessions(user_id);

-- 4. Per-rep log — one row per card per session, written at rate time so a
--    mid-session abandon keeps SRS progress. The Again-requeue loop re-rates
--    the same card by UPDATING its row (rating/interval_after change;
--    was_due stays frozen from the first rate — authoritative for XP).
--    card_id SET NULL so Reforge (which deletes pristine forged cards) never
--    erases rep history or achievement counts.
CREATE TABLE IF NOT EXISTS rune_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES rune_sessions(id) ON DELETE CASCADE,
  card_id UUID REFERENCES rune_cards(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating IN (1, 3, 4, 5)),
  was_due BOOLEAN NOT NULL DEFAULT FALSE,
  interval_before NUMERIC,
  interval_after NUMERIC,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_rune_reps_session_id ON rune_reps(session_id);
-- Counts toward the rune_adept achievement (100 due reps)
CREATE INDEX IF NOT EXISTS idx_rune_reps_user_due ON rune_reps(user_id) WHERE was_due;

-- 5. Achievements (awarded imperatively in the forge / complete routes —
--    condition_types are descriptive, not evaluator-counted; scrolls precedent)
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward) VALUES
  ('runesmith',  'Runesmith',  'Forge your first Rune Deck',    '⚒️', 'rune_decks_forged', 1,   50),
  ('rune_adept', 'Rune Adept', 'Complete 100 due rune reviews', '✴️', 'rune_due_reps',     100, 400)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE rune_cards IS
  'Anki-style front/back recall cards per topic. UI name: Runes. suspended_at = banished. Reforge replaces only source=forged AND edited_at IS NULL.';
COMMENT ON TABLE rune_card_srs IS
  'Per-user SM-2 schedule per card (computeNextReviewFromQuality). Fully separate from user_topic_mastery.';
