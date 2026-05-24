-- Migration 016: Tier-2 extensions of existing achievement tracks.
-- Run this in the Supabase SQL editor (Dashboard > SQL editor > New query).
--
-- Each new achievement reuses an existing `condition_type` (so no new
-- server-side checking logic is needed) but raises the bar above the
-- current top-of-track achievement. Purpose: give long-term study a
-- continued sense of progression once the original goals are claimed.
--
-- New achievements:
--   sage             — Master tier on 15 topics (raises master_mind=5)
--   iron_legend      — 60-day study streak (raises iron_will=30)
--   iron_discipline  — Review on 60 different days (raises review_master=30)
--   centenarian      — 100 quiz sessions (raises knowledge_seeker=50)
--   apex_predator    — 15 episode bosses (raises unstoppable=5)
--   twilight_reader  — 30 daily Scrolls read (raises lore_keeper=7)
--
-- Category placement is handled in src/lib/achievement-categories.ts.

INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward) VALUES
  ('sage',             'Sage',             'Achieve Master mastery on 15 topics',                 '🧙', 'master_topics',            15, 700),
  ('iron_legend',      'Iron Legend',      'Maintain a 60-day study streak',                      '🛡️', 'streak_days',              60, 800),
  ('iron_discipline',  'Iron Discipline',  'Complete review sessions on 60 different days',       '⚖️', 'review_days',              60, 800),
  ('centenarian',      'Centenarian',      'Complete 100 quiz sessions',                          '💎', 'quiz_sessions_completed', 100, 600),
  ('apex_predator',    'Apex Predator',    'Defeat 15 episode bosses',                            '🐲', 'boss_fights_completed',    15, 800),
  ('twilight_reader',  'Twilight Reader',  'Read 30 daily Scrolls of Wisdom',                     '🌙', 'scrolls_dismissed',        30, 400)
ON CONFLICT (slug) DO NOTHING;
