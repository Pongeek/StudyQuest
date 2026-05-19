-- Add MCQ support to exam_questions.
--
-- Past exams routinely mix multiple-choice and open-ended questions, but the
-- original schema (in 001) treated every extracted question as open-ended.
-- This migration adds the question-type discriminator + the MCQ-specific
-- fields so the extractor and engine can render and grade MCQs natively.

ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'open'
    CHECK (type IN ('mcq', 'open'));

ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS correct_answer TEXT DEFAULT NULL;

-- All existing rows default to type='open' which preserves current behavior;
-- new extractions can set type='mcq' with populated options + correct_answer.
