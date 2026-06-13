/**
 * Shared ownership-chain checks for the rune API routes. Every mutate route
 * must resolve clerk_id → users.id and prove the target hangs off one of the
 * caller's courses (combined-WHERE pattern: a cross-tenant probe sees 0 rows,
 * not a leak). These were copy-pasted per route; the security-critical check
 * now lives in one place.
 *
 * The forge route keeps its own richer resolver (it also needs topic content
 * + course language for the AI call); these helpers cover the boolean-answer
 * sites.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "@/lib/runes-queue";

/** clerk_id → users.id (null when the user row doesn't exist). */
export async function getDbUserId(
  supabase: SupabaseClient,
  clerkId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();
  return data?.id ?? null;
}

/** topic → episode → course → user. */
export async function verifyTopicOwned(
  supabase: SupabaseClient,
  topicId: string,
  dbUserId: string,
): Promise<boolean> {
  const { data: topic } = await supabase
    .from("topics")
    .select("id, episodes!inner ( courses!inner ( user_id ) )")
    .eq("id", topicId)
    .single();
  const episode = embedOne(topic?.episodes) as { courses?: unknown } | undefined;
  const course = embedOne(episode?.courses) as { user_id?: string | null } | undefined;
  return Boolean(topic && course && course.user_id === dbUserId);
}

/** rune card → topic → episode → course → user. */
export async function verifyCardOwned(
  supabase: SupabaseClient,
  cardId: string,
  dbUserId: string,
): Promise<boolean> {
  const { data: card } = await supabase
    .from("rune_cards")
    .select("id, topics!inner ( episodes!inner ( courses!inner ( user_id ) ) )")
    .eq("id", cardId)
    .single();
  const topic = embedOne(card?.topics) as { episodes?: unknown } | undefined;
  const episode = embedOne(topic?.episodes) as { courses?: unknown } | undefined;
  const course = embedOne(episode?.courses) as { user_id?: string | null } | undefined;
  return Boolean(card && course && course.user_id === dbUserId);
}
