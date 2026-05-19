-- Migration 009: Mistake Grimoire
-- Extends review_sessions so grimoire sessions can pin specific question IDs
-- rather than pulling randomly from the SM-2 queue.

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS source            TEXT    NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS pinned_question_ids JSONB  DEFAULT NULL;

-- source: 'review' (default SM-2 queue) | 'grimoire' (pinned failed questions)
