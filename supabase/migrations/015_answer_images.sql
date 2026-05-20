-- ============================================================================
-- Migration 015 — image attachments on open answers
-- Lets students attach a photo of a hand-drawn diagram, math derivation,
-- automaton, parse tree, etc. with their open-question answer. Claude
-- vision grades the image alongside any typed text. Critical for CS theory
-- and math courses where typing the answer is impractical.
--
-- One image per answer, max 5MB. Stored in the existing course-files bucket
-- under `answers/<userId>/...` so we don't need a new bucket.
-- ============================================================================

ALTER TABLE quiz_answers
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE review_answers
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE boss_fight_answers
  ADD COLUMN IF NOT EXISTS image_url TEXT;
