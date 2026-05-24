-- Migration 018: persist a user-facing error message on failed episode
-- extractions. Without this column, the only signal of failure is
-- `status = 'error'` — the actual reason (PDF too large, rate-limited,
-- no text layer, etc.) lives in the dev console and is invisible to the
-- end user, who just sees an empty card and has no idea what to fix.
--
-- The processEpisodeAsync catch handler in
-- `api/courses/[id]/episodes/route.ts` classifies the underlying error
-- (via src/lib/episode-error.ts) and writes a short, actionable sentence
-- here. The FailedEpisodesBanner reads it back out and shows it to the
-- user above the CourseMap.

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS error_message TEXT;
