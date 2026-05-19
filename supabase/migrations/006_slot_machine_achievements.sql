-- Tier 1 dopamine: slot-machine achievement rows
-- Apply via Supabase Dashboard SQL editor or `supabase db push`.

INSERT INTO achievements (slug, name, description, icon, xp_reward, condition_type, condition_value)
VALUES
  (
    'lucky_scholar',
    'Lucky Scholar',
    'A wild bonus appeared! (5% chance on a perfect quiz)',
    '🍀',
    100,
    'random',
    0
  ),
  (
    'perfect_day',
    'Perfect Day',
    'Score 100% on 3 different quizzes in a single day',
    '🌟',
    200,
    'perfect_day',
    3
  ),
  (
    'combo_breaker',
    'Combo Breaker',
    'Hit a 5× combo in any single quiz session',
    '⚡',
    150,
    'combo_session',
    5
  )
ON CONFLICT (slug) DO NOTHING;
