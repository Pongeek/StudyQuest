-- ============================================================================
-- Migration 012 — course output language
-- Adds an optional `output_language` field on courses so users can choose to
-- have AI-generated content (topics, questions, debriefs, scrolls, etc.)
-- emitted in a specific language regardless of the source PDF's language.
--
-- Values:
--   'auto' — match the source PDF (current/default behavior)
--   'en'   — force English regardless of source
--   'he'   — force Hebrew regardless of source
-- ============================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS output_language TEXT NOT NULL DEFAULT 'auto'
  CHECK (output_language IN ('auto', 'en', 'he'));
