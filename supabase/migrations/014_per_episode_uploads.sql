-- ============================================================================
-- Migration 014 — per-episode PDF uploads
-- Supports the new flow where a course is created empty and the user uploads
-- individual chapter PDFs as separate episodes. Each PDF is much smaller
-- and the AI extraction is per-episode focused, producing far cleaner topic
-- structures than the previous whole-textbook approach.
--
-- Backward compatible: existing course-wide PDFs leave episode_id=NULL and
-- continue to work exactly as before.
-- ============================================================================

-- Link a PDF to a specific episode when uploaded that way.
ALTER TABLE course_files
  ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_course_files_episode
  ON course_files(episode_id) WHERE episode_id IS NOT NULL;

-- Per-episode processing status. 'ready' is the default so existing rows
-- (which already had topics extracted at course-creation time) match the
-- new schema without any change in behavior.
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('processing', 'ready', 'error'));
