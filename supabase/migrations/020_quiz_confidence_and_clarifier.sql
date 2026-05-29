-- Migration 020: Confidence rating on quiz_answers + clarifier transcripts.
--
-- Spec: docs/superpowers/specs/2026-05-29-pedagogy-clarifier-confidence-design.md
--
-- Pilot scope: only quiz_answers gets the confidence column.
-- Review/Boss/Exam columns are added in their Phase 2 migrations.
--
-- answer_clarifications is intentionally polymorphic (answer_kind + answer_id)
-- so /api/clarify can be ONE endpoint that lights up Phase 2 surfaces with
-- zero schema work. No FK from answer_id -> quiz_answers.id -- Postgres can't
-- enforce a polymorphic FK, so ownership is checked at the API layer.

ALTER TABLE quiz_answers
  ADD COLUMN confidence TEXT
  CHECK (confidence IS NULL OR confidence IN ('guessed', 'unsure', 'confident'));

CREATE TABLE answer_clarifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_kind  TEXT NOT NULL CHECK (answer_kind IN ('quiz', 'review', 'boss', 'exam')),
  answer_id    UUID NOT NULL,
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_turns  INT  NOT NULL DEFAULT 0,
  total_output_tokens INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX answer_clarifications_lookup
  ON answer_clarifications(answer_kind, answer_id);

CREATE INDEX answer_clarifications_user_recent
  ON answer_clarifications(user_id, created_at DESC);

COMMENT ON TABLE answer_clarifications IS
  'Multi-turn "Why was I wrong?" chat transcripts. answer_kind discriminates which answer table answer_id references. Ownership enforced at API layer.';
