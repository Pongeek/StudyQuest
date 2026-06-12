// ─── Due-rune queue ───────────────────────────────────────────────────────────
// Single source of truth for the per-CARD spaced-repetition "due" definition:
// a rune is due when its rune_card_srs.due_at is at or before `now` AND the
// card itself is not banished (rune_cards.suspended_at IS NULL). Consumers:
// the dashboard widget, Next Best Action, /dashboard/runes, and the session
// routes — mirror of review-queue.ts for the topic-level queue.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Default projection — SRS state + the card + its topic title. */
export const DUE_RUNE_SELECT =
  "card_id, due_at, interval_days, ease_factor, review_count, rune_cards!inner(id, front, back, topic_id, suspended_at, topics(title))";

export interface DueRuneOptions {
  /** Custom PostgREST select (must keep the rune_cards!inner embed). */
  select?: string;
  /** Cap the number of due cards (used to size a drill session). */
  limit?: number;
  /** Cutoff timestamp (ISO). Defaults to the call time. */
  now?: string;
}

/**
 * Rune cards due for drilling for one user, most-overdue first. Returns the
 * raw PostgREST response `{ data, error }` for the requested projection.
 */
export function getDueRuneCards(
  supabase: SupabaseClient,
  userId: string,
  opts: DueRuneOptions = {},
) {
  const { select = DUE_RUNE_SELECT, limit, now = new Date().toISOString() } = opts;

  let query = supabase
    .from("rune_card_srs")
    .select(select)
    .eq("user_id", userId)
    .is("rune_cards.suspended_at", null)
    .lte("due_at", now)
    .order("due_at", { ascending: true });

  if (typeof limit === "number" && limit > 0) query = query.limit(limit);

  return query;
}

/** Head-count of due, non-banished runes — for widgets and queue-clear checks. */
export async function countDueRunes(
  supabase: SupabaseClient,
  userId: string,
  now: string = new Date().toISOString(),
): Promise<number> {
  const { count } = await supabase
    .from("rune_card_srs")
    .select("id, rune_cards!inner(id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("rune_cards.suspended_at", null)
    .lte("due_at", now);
  return count ?? 0;
}

/** The card shape a drill session serves to the engine. */
export interface DrillCard {
  id: string;
  front: string;
  back: string;
  topicTitle: string;
  /** Dueness at session start — display only; XP eligibility is re-checked
   *  server-side at rate time (authoritative `was_due`). */
  wasDue: boolean;
}
