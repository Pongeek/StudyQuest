-- ============================================================================
-- Migration 013 — exam dates + study planner
-- Adds an optional exam date and short label on each course. When set, the
-- dashboard shows a countdown widget with an auto-generated daily study plan.
-- ============================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS exam_date DATE,
  ADD COLUMN IF NOT EXISTS exam_label TEXT;
