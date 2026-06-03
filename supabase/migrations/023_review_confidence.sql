-- Migration 023: Confidence rating on review_answers (Phase 2 — Review).
--
-- Spec: A2 Slice 1 (#2) — Phase 2 confidence + clarifier on Review sessions.
-- ADR: docs/adr/0001-confidence-weighted-sm2-review.md
--
-- Mirrors migration 020's quiz_answers.confidence column exactly (same
-- NULL/guessed/unsure/confident CHECK constraint) so the per-answer
-- confidence self-report means the same thing on the Review path as it
-- already does on Quiz. Review's /complete folds this into the per-topic
-- SM-2 schedule (undampened, per ADR-0001).
--
-- The polymorphic answer_clarifications table (migration 020) already
-- accepts answer_kind = 'review', so no clarifier schema work is needed here.

ALTER TABLE review_answers
  ADD COLUMN confidence TEXT
  CHECK (confidence IS NULL OR confidence IN ('guessed', 'unsure', 'confident'));
