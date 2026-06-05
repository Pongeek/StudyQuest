// ─── Due-review queue ─────────────────────────────────────────────────────────
// Single source of truth for the spaced-repetition "due" definition: a topic is
// due when its next_review_at is set and at or before `now`. This WHERE+order
// was hand-copied across the dashboard, the profile, the review page, and the
// two /api/review routes; they now all go through getDueReviewTopics so the
// definition lives in one place.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Default projection — enough for the topic-title chip surfaces. */
export const DUE_REVIEW_SELECT = "topic_id, next_review_at, topics(title)";

export interface DueReviewOptions {
  /** Custom PostgREST select — the API routes need episode/course joins. */
  select?: string;
  /** Cap the number of due topics (used to size a review session). */
  limit?: number;
  /** Cutoff timestamp (ISO). Defaults to the call time. */
  now?: string;
}

/**
 * Topics due for spaced-repetition review for one user, ordered by how overdue
 * they are (soonest next_review_at first). Returns the raw PostgREST response
 * `{ data, error }` for the requested projection, so callers keep their own
 * error handling and row mapping.
 */
export function getDueReviewTopics(
  supabase: SupabaseClient,
  userId: string,
  opts: DueReviewOptions = {}
) {
  const { select = DUE_REVIEW_SELECT, limit, now = new Date().toISOString() } = opts;

  let query = supabase
    .from("user_topic_mastery")
    .select(select)
    .eq("user_id", userId)
    .not("next_review_at", "is", null)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true });

  // Guard limit > 0: a future caller passing a computed 0 should mean "no cap",
  // not .limit(0) (which would return an empty queue).
  if (typeof limit === "number" && limit > 0) query = query.limit(limit);

  return query;
}

export interface DueTopicTitle {
  topicTitle: string;
}

/**
 * Projects raw due rows to the `{ topicTitle }` shape ReviewQueueCard wants.
 * Tolerant of the loosely-typed PostgREST result and missing joins.
 */
export function toDueTopicTitles(rows: unknown): DueTopicTitle[] {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map((row) => ({
    topicTitle:
      (row as { topics?: { title?: string | null } | null })?.topics?.title ??
      "Unknown topic",
  }));
}
