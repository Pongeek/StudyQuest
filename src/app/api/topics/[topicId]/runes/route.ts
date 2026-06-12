// GET  /api/topics/[id]/runes — return the topic's rune deck (cards + this
//                               user's SM-2 state; includes banished cards
//                               so the manage list can offer Restore).
// POST /api/topics/[id]/runes — Forge / Reforge the deck. Replaces ONLY
//                               pristine forged cards (source='forged' AND
//                               edited_at IS NULL) — manual + edited cards
//                               survive. New cards are due immediately.
//
// Ownership chain: topic → episode → course → user (cheat-sheet pattern).

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyAiError, classifiedErrorBody } from "@/lib/ai-error";
import { generateRunes } from "@/lib/ai/generate-runes";
import { awardAchievementIfNew } from "@/lib/achievements";
import {
  mapRuneCardRows,
  RUNE_CARD_COLUMNS,
  RUNE_SRS_COLUMNS,
} from "@/lib/rune-deck";

export const maxDuration = 60;

async function resolveOwnedTopic(
  supabase: ReturnType<typeof createServiceClient>,
  topicId: string,
  clerkId: string,
) {
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();
  if (!dbUser) return { error: "auth" as const };

  const { data: topic } = await supabase
    .from("topics")
    .select(
      `
      id, title, summary, key_concepts,
      episodes!inner (
        title,
        courses!inner ( user_id, subject, output_language )
      )
    `,
    )
    .eq("id", topicId)
    .single();
  if (!topic) return { error: "not_found" as const };

  type EpRow = { title?: string | null; courses?: unknown };
  type CourseRow = { user_id?: string | null; subject?: string | null; output_language?: string | null };
  const episode = (Array.isArray(topic.episodes) ? topic.episodes[0] : topic.episodes) as EpRow | undefined;
  const courseRaw = (Array.isArray(episode?.courses) ? episode?.courses[0] : episode?.courses) as CourseRow | undefined;

  if (!courseRaw || courseRaw.user_id !== dbUser.id) {
    return { error: "forbidden" as const };
  }

  return {
    dbUserId: dbUser.id,
    topic: {
      id: topic.id as string,
      title: topic.title as string,
      summary: (topic.summary as string) || "",
      key_concepts: (topic.key_concepts as string[]) || [],
    },
    episodeTitle: (episode?.title as string) ?? "",
    courseSubject: (courseRaw.subject as string) ?? "Academic",
    outputLanguage:
      courseRaw.output_language === "en" || courseRaw.output_language === "he"
        ? (courseRaw.output_language as "en" | "he")
        : ("auto" as const),
  };
}

function ownershipErrorResponse(error: "auth" | "not_found" | "forbidden" | undefined) {
  const status = error === "auth" ? 401 : error === "not_found" ? 404 : 403;
  return NextResponse.json(
    classifiedErrorBody(
      error === "auth" ? "AUTH_ERROR" : "UNKNOWN",
      error === "auth"
        ? "Sign-in expired. Refresh to sign back in."
        : error === "not_found"
          ? "Topic not found."
          : "You don't have access to that topic.",
      false,
    ),
    { status },
  );
}

async function loadDeck(
  supabase: ReturnType<typeof createServiceClient>,
  topicId: string,
  dbUserId: string,
) {
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
          .eq("user_id", dbUserId)
          .in("card_id", cardIds)
      : { data: [] };

  return mapRuneCardRows(cards || [], srsRows || []);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Sign-in expired. Refresh to sign back in.", false),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const resolved = await resolveOwnedTopic(supabase, topicId, userId);
  if ("error" in resolved) return ownershipErrorResponse(resolved.error);

  const cards = await loadDeck(supabase, topicId, resolved.dbUserId);
  return NextResponse.json({ cards });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Sign-in expired. Refresh to sign back in.", false),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const resolved = await resolveOwnedTopic(supabase, topicId, userId);
  if ("error" in resolved) return ownershipErrorResponse(resolved.error);

  let reply;
  try {
    reply = await generateRunes({
      topicTitle: resolved.topic.title,
      topicSummary: resolved.topic.summary,
      keyConcepts: resolved.topic.key_concepts,
      episodeTitle: resolved.episodeTitle,
      courseSubject: resolved.courseSubject,
      outputLanguage: resolved.outputLanguage,
    });
  } catch (err) {
    console.error("[api/topics/runes] forge failed:", err);
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }

  // Reforge replaces ONLY pristine forged cards. Their SRS rows cascade away;
  // rune_reps.card_id is SET NULL so rep history / achievement counts survive.
  const { error: deleteError } = await supabase
    .from("rune_cards")
    .delete()
    .eq("topic_id", topicId)
    .eq("source", "forged")
    .is("edited_at", null);
  if (deleteError) {
    console.error("[api/topics/runes] reforge cleanup failed:", deleteError);
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't replace the old deck — try again.", true),
      { status: 500 },
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("rune_cards")
    .insert(
      reply.cards.map((c) => ({
        topic_id: topicId,
        front: c.front,
        back: c.back,
        source: "forged",
      })),
    )
    .select("id");
  if (insertError || !inserted) {
    console.error("[api/topics/runes] insert failed:", insertError);
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't save the new deck — try again.", true),
      { status: 500 },
    );
  }

  // Eager per-user SM-2 rows: new cards are due immediately (no gating).
  const nowIso = new Date().toISOString();
  const { error: srsError } = await supabase.from("rune_card_srs").insert(
    inserted.map((row: { id: string }) => ({
      user_id: resolved.dbUserId,
      card_id: row.id,
      due_at: nowIso,
    })),
  );
  if (srsError) {
    // Non-fatal: countDueCards treats missing SRS as due-now.
    console.error("[api/topics/runes] SRS seed failed:", srsError);
  }

  // Runesmith — first deck ever forged. Idempotent by slug; XP folds via the
  // atomic RPC (exorcist pattern: awardAchievementIfNew never touches XP).
  const newAchievements = [];
  const runesmith = await awardAchievementIfNew({
    userId: resolved.dbUserId,
    slug: "runesmith",
    supabase,
  });
  if (runesmith) {
    if (runesmith.xp_reward > 0) {
      await supabase.rpc("increment_user_xp", {
        p_user_id: resolved.dbUserId,
        amount: runesmith.xp_reward,
      });
    }
    newAchievements.push(runesmith);
  }

  console.log(
    `[api/topics/runes] forged topic=${topicId} cards=${reply.cards.length} tokens=${reply.outputTokens} stop_reason=${reply.stopReason}`,
  );

  const cards = await loadDeck(supabase, topicId, resolved.dbUserId);
  return NextResponse.json({ cards, newAchievements });
}
