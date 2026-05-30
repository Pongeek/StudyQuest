-- Migration 022: Per-topic cheat sheet.
--
-- Stored as Markdown+LaTeX on the topics row. Generated on demand via
-- POST /api/topics/[id]/cheat-sheet, cached forever until the user
-- regenerates (POST overwrites).
--
-- Two columns:
--   cheat_sheet              -- the rendered content (NULL until generated)
--   cheat_sheet_generated_at -- last regeneration timestamp; surfaced in
--                               UI so the student knows how fresh the
--                               summary is.

ALTER TABLE topics
  ADD COLUMN cheat_sheet TEXT,
  ADD COLUMN cheat_sheet_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN topics.cheat_sheet IS
  'AI-generated 1-page Markdown+LaTeX summary of the topic. Cached until user regenerates. NULL = not yet generated.';
