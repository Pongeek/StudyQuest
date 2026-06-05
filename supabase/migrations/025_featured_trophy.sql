-- Migration 025: Featured Trophy (profile crest pin).
--
-- Spec: src/lib/featured-trophy.ts, CONTEXT.md → Featured Trophy
--
-- A display choice: the one earned Achievement a learner pins to their hero
-- crest. NOT a third identity tier — Rank and Streak Title stay auto-derived.
-- Nullable; resolves to the most-recently-earned trophy when unset, so the
-- crest is never empty for a learner who has earned anything.
--
-- ON DELETE SET NULL: if the referenced achievement row is ever removed, the
-- pin clears rather than blocking the delete. Pure additive column.

ALTER TABLE users
  ADD COLUMN featured_achievement_id UUID REFERENCES achievements(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.featured_achievement_id IS
  'Featured Trophy: the achievement the learner pinned to their profile crest. Null falls back to most-recently-earned at render time.';
