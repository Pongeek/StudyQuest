-- Question regeneration — soft-replace pattern
--
-- When a student regenerates a question (because the AI hallucinated or
-- the question is ambiguous), we DO NOT delete the row: past quiz_answers
-- and exam stats reference question_id with ON DELETE CASCADE, and
-- nuking them would corrupt mastery history + stumble counts retroactively.
--
-- Instead the old row stays, gets `replaced_at` stamped + `replaced_by_id`
-- pointing forward to the new question. All read paths (quiz session
-- render, review/start queue, grimoire, topic mastery stumbles) filter
-- `replaced_at IS NULL`. The new row inherits the old row's `created_at`
-- so chronological ordering puts the new question in the same slot — no
-- jarring reorder when the user refreshes mid-quiz.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS replaced_by_id UUID REFERENCES questions(id),
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

-- Partial index covers the hot path: "give me all live questions for this
-- topic." Skipping replaced rows in the index keeps it tight.
CREATE INDEX IF NOT EXISTS idx_questions_topic_live
  ON questions(topic_id, created_at)
  WHERE replaced_at IS NULL;
