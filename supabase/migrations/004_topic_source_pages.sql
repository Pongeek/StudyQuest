-- Add source PDF page mapping to topics
-- This allows the topic detail page to show the actual PDF pages for study

-- Link each topic back to the source file it was extracted from
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES course_files(id) ON DELETE SET NULL;

-- Store page range as JSONB: {"start": 12, "end": 15}
-- Pages are 1-indexed to match what users see in a PDF viewer
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS source_pages JSONB DEFAULT NULL;

-- Also store page count on course_files for the PDF viewer
ALTER TABLE course_files
  ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT NULL;

-- Index for fast lookup of topics by source file
CREATE INDEX IF NOT EXISTS idx_topics_source_file ON topics(source_file_id) WHERE source_file_id IS NOT NULL;
