// ─── Due-rune queue ───────────────────────────────────────────────────────────
// Single source of truth for the per-CARD spaced-repetition "due" definition:
// a rune is due when its rune_card_srs.due_at is at or before `now` AND the
// card itself is not banished (rune_cards.suspended_at IS NULL). Consumers:
// the dashboard widget, Next Best Action, /dashboard/runes, and the session
// routes — mirror of review-queue.ts for the topic-level queue.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapRuneCardRows,
  RUNE_CARD_COLUMNS,
  RUNE_SRS_COLUMNS,
  type RuneCardDto,
} from "@/lib/rune-deck";

/** Default projection — SRS state + the card + its topic title. */
export const DUE_RUNE_SELECT =
  "card_id, due_at, interval_days, ease_factor, review_count, rune_cards!inner(id, front, back, topic_id, suspended_at, topics(title))";

/** Slim projection for chip/count surfaces — no card text on the wire. */
export const DUE_RUNE_CHIP_SELECT =
  "card_id, due_at, rune_cards!inner(id, topic_id, suspended_at, topics(title))";

/** PostgREST embeds a to-one relation as an object, but loosely-typed rows
 *  sometimes surface it as a 1-element array — unwrap either shape. */
export function embedOne<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

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

/** Head-count of due, non-banished runes — for widgets and queue-clear checks.
 *  Pass `topicIds` to scope the count to one course's decks (exam page). */
export async function countDueRunes(
  supabase: SupabaseClient,
  userId: string,
  opts: { now?: string; topicIds?: string[] } = {},
): Promise<number> {
  const { now = new Date().toISOString(), topicIds } = opts;
  let query = supabase
    .from("rune_card_srs")
    .select("id, rune_cards!inner(id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("rune_cards.suspended_at", null)
    .lte("due_at", now);
  if (topicIds && topicIds.length > 0) {
    query = query.in("rune_cards.topic_id", topicIds);
  }
  const { count } = await query;
  return count ?? 0;
}

/** All topic ids of a course via the two-step episodes→topics resolution
 *  (avoids 3-level nested PostgREST filters — house pattern). */
export async function getCourseTopicIds(
  supabase: SupabaseClient,
  courseId: string,
): Promise<string[]> {
  const { data: episodes } = await supabase
    .from("episodes")
    .select("id")
    .eq("course_id", courseId);
  const episodeIds = (episodes || []).map((e: { id: string }) => e.id);
  if (episodeIds.length === 0) return [];
  const { data: topics } = await supabase
    .from("topics")
    .select("id")
    .in("episode_id", episodeIds);
  return (topics || []).map((t: { id: string }) => t.id);
}

/**
 * One topic's full deck as the client DTO — cards + this user's SM-2 state.
 * Shared by the topic page (initial render) and the forge route (GET + POST
 * response) so the panel can never see two diverging shapes.
 */
export async function loadRuneDeck(
  supabase: SupabaseClient,
  topicId: string,
  userId: string,
): Promise<RuneCardDto[]> {
  const { data: cards } = await supabase
    .from("rune_cards")
    .select(RUNE_CARD_COLUMNS)
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });

  const cardIds = (cards || []).map((c: { id: string }) => c.id);
  const { data: srsRows } =
    cardIds.length > 0
      ? await supabase
          .from("rune_card_srs")
          .select(RUNE_SRS_COLUMNS)
          .eq("user_id", userId)
          .in("card_id", cardIds)
      : { data: [] };

  return mapRuneCardRows(cards || [], srsRows || []);
}

/** The card shape a drill session serves to the engine. Dueness is NOT on
 *  the wire — XP eligibility is decided server-side at rate time. */
export interface DrillCard {
  id: string;
  front: string;
  back: string;
  topicTitle: string;
}
