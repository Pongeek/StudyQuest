-- Migration 011: New achievements for Scroll of Wisdom, Mistake Grimoire, and Feynman Mode
-- Run this in the Supabase SQL editor (Dashboard > SQL editor > New query)

-- ── Scroll of Wisdom achievements ──────────────────────────────────────────
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward)
VALUES
  (
    'dawn_scholar',
    'Dawn Scholar',
    'Read your first daily Scroll of Wisdom',
    '🌅',
    'scrolls_dismissed',
    1,
    25
  ),
  (
    'lore_keeper',
    'Lore Keeper',
    'Read 7 Scrolls of Wisdom — wisdom accumulates over time',
    '📚',
    'scrolls_dismissed',
    7,
    100
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Mistake Grimoire achievements ───────────────────────────────────────────
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward)
VALUES
  (
    'demon_slayer',
    'Demon Slayer',
    'Faced your mistakes in the Grimoire for the first time',
    '⚔️',
    'grimoire_sessions',
    1,
    75
  ),
  (
    'exorcist',
    'Exorcist',
    'Cleared every demon from your Grimoire — all mistakes conquered',
    '🔮',
    'grimoire_cleared',
    1,
    250
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Feynman Mode achievements ────────────────────────────────────────────────
INSERT INTO achievements (slug, name, description, icon, condition_type, condition_value, xp_reward)
VALUES
  (
    'first_lesson',
    'First Lesson',
    'Completed your first Feynman explanation session',
    '📖',
    'feynman_evaluated',
    1,
    30
  ),
  (
    'eloquent_scholar',
    'Eloquent Scholar',
    'Explained a concept with 90%+ mastery in Feynman mode',
    '✨',
    'feynman_high_score',
    1,
    150
  )
ON CONFLICT (slug) DO NOTHING;
