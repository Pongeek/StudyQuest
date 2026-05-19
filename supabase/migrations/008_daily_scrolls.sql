-- Migration 008: Daily Scroll of Wisdom
-- Each user gets one AI-generated insight per day from their course material.

CREATE TABLE IF NOT EXISTS daily_scrolls (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scroll_date  DATE        NOT NULL,
  content      TEXT        NOT NULL,
  topic_id     UUID        REFERENCES topics(id) ON DELETE SET NULL,
  topic_title  TEXT,
  course_title TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, scroll_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_scrolls_user_date
  ON daily_scrolls(user_id, scroll_date);
