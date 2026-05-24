-- Migration 017: First-run onboarding flag.
-- Run this in the Supabase SQL editor (Dashboard > SQL editor > New query).
--
-- Adds a per-USER timestamp (not per-browser/localStorage) that gates the
-- Welcome Modal on /dashboard. NULL = the user has never finished or
-- skipped the modal; the /api/users/complete-onboarding route sets NOW()
-- once they do. Per-user means signing in from a new device won't re-show
-- the modal.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
