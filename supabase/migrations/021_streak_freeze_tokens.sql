-- Migration 021: Streak freeze tokens.
--
-- Spec: src/lib/streak.ts
--
-- Forgiveness mechanic — if the student misses a study day, the next
-- study session burns a token to bridge the gap and keep the streak
-- alive. Tokens are earned on every 7-day streak milestone, capped at
-- MAX_FREEZE_TOKENS (3 in v1).
--
-- Pure additive column. Existing users default to 0 — they earn their
-- first token at the next 7-day milestone.

ALTER TABLE users
  ADD COLUMN streak_freeze_tokens INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.streak_freeze_tokens IS
  'Streak forgiveness tokens (cap = 3). Earned on every 7-day streak milestone, burned lazily on next study after a 1+ day gap.';
