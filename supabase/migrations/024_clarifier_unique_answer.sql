-- Migration 024: UNIQUE(answer_kind, answer_id) on answer_clarifications.
--
-- Spec: A2 Slice 3 (#4) — wrong-answer clarifier on Review.
--
-- The clarifier OPEN branch now upserts on conflict (answer_kind, answer_id),
-- which requires a real unique constraint to target. Before adding it we must
-- collapse any duplicate rows that the React 19 + Next.js dev StrictMode
-- double-fire of the open useEffect may have created (two opens racing past
-- the existing-row check, both INSERTing). Production never had StrictMode,
-- but simultaneous tabs could still race — dedup defensively regardless.
--
-- Keep the OLDEST row per group (matches the `.order(created_at asc).limit(1)`
-- read the pilot used, so whatever transcript the UI first surfaced is the one
-- that survives). Written idempotently so re-running is a no-op.

-- ── Step 1: dedup — delete all-but-oldest per (answer_kind, answer_id) ──
DELETE FROM answer_clarifications a
USING answer_clarifications b
WHERE a.answer_kind = b.answer_kind
  AND a.answer_id   = b.answer_id
  AND a.created_at  > b.created_at;
-- Tie-break on identical created_at (rare) by id so exactly one row remains.
DELETE FROM answer_clarifications a
USING answer_clarifications b
WHERE a.answer_kind = b.answer_kind
  AND a.answer_id   = b.answer_id
  AND a.created_at  = b.created_at
  AND a.id          > b.id;

-- ── Step 2: add the unique constraint (idempotent) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'answer_clarifications_kind_answer_uniq'
  ) THEN
    ALTER TABLE answer_clarifications
      ADD CONSTRAINT answer_clarifications_kind_answer_uniq
      UNIQUE (answer_kind, answer_id);
  END IF;
END $$;
