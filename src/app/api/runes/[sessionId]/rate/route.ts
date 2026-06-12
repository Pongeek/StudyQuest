// POST /api/runes/[sessionId]/rate — persist one self-grade and reschedule
// the card via SM-2. Per-rep persistence: abandoning a drill mid-way keeps
// every schedule change (XP settles only at /complete).
//
//   { cardId, rating }   rating ∈ {1, 3, 4, 5} = Again / Hard / Good / Easy
//
// First rating of a card in a session INSERTs the rep and freezes `was_due`
// (authoritative for XP). A re-rating (the Again-requeue loop sends the same
// card again after a lapse) UPDATEs the rep row and re-applies SM-2 from the
// card's CURRENT state — exactly how Anki treats a relearned card.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeNextReviewFromQuality,
  type RuneRating,
} from "@/lib/spaced-repetition";

const VALID_RATINGS = new Set([1, 3, 4, 5]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { cardId?: unknown; rating?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const rating = typeof body.rating === "number" ? body.rating : NaN;
  if (!cardId || !VALID_RATINGS.has(rating)) {
    return NextResponse.json(
      { error: "cardId and rating (1|3|4|5) are required" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Session ownership + state (combined-WHERE: cross-tenant returns 0 rows).
  const { data: session } = await supabase
    .from("rune_sessions")
    .select("id, card_ids, completed_at")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.completed_at) {
    return NextResponse.json({ error: "Session already completed" }, { status: 400 });
  }
  const memberIds: string[] = Array.isArray(session.card_ids) ? session.card_ids : [];
  if (!memberIds.includes(cardId)) {
    return NextResponse.json({ error: "Card is not part of this session" }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Current SM-2 state. The forge/add routes seed this eagerly; if the seed
  // failed, fall back to a fresh due-now state and create the row below.
  const { data: srs } = await supabase
    .from("rune_card_srs")
    .select("id, due_at, interval_days, ease_factor, review_count")
    .eq("user_id", dbUser.id)
    .eq("card_id", cardId)
    .single();

  const currentState = {
    intervalDays: srs ? Number(srs.interval_days) : 1,
    easeFactor: srs ? Number(srs.ease_factor) : 2.5,
    reviewCount: srs?.review_count ?? 0,
  };

  // Existing rep in THIS session? (UNIQUE(session_id, card_id) caps it at one.)
  const { data: existingRep } = await supabase
    .from("rune_reps")
    .select("id, was_due")
    .eq("session_id", sessionId)
    .eq("card_id", cardId)
    .maybeSingle();

  // was_due freezes at the FIRST rate of the session — a due card stays
  // XP-eligible through the Again-requeue loop, and a non-due card can't
  // become eligible by being relearned mid-session.
  const wasDue = existingRep
    ? Boolean(existingRep.was_due)
    : !srs || srs.due_at <= nowIso;

  const next = computeNextReviewFromQuality(rating as RuneRating, currentState, now);

  if (existingRep) {
    const { error: repError } = await supabase
      .from("rune_reps")
      .update({
        rating,
        interval_before: currentState.intervalDays,
        interval_after: next.intervalDays,
        rated_at: nowIso,
      })
      .eq("id", existingRep.id);
    if (repError) {
      console.error("[api/runes/rate] rep update failed:", repError);
      return NextResponse.json({ error: "Couldn't save the rating" }, { status: 500 });
    }
  } else {
    const { error: repError } = await supabase.from("rune_reps").insert({
      session_id: sessionId,
      card_id: cardId,
      user_id: dbUser.id,
      rating,
      was_due: wasDue,
      interval_before: currentState.intervalDays,
      interval_after: next.intervalDays,
      rated_at: nowIso,
    });
    if (repError) {
      // 23505 = a racing duplicate (dev StrictMode) already inserted — return
      // its outcome without re-applying SM-2.
      if ((repError as { code?: string }).code === "23505") {
        const { data: winner } = await supabase
          .from("rune_reps")
          .select("rating, was_due, interval_after")
          .eq("session_id", sessionId)
          .eq("card_id", cardId)
          .single();
        return NextResponse.json({
          wasDue: Boolean(winner?.was_due),
          xpEligible: Boolean(winner?.was_due) && (winner?.rating ?? 0) >= 3,
          intervalDays: Number(winner?.interval_after ?? next.intervalDays),
          nextDueAt: null,
        });
      }
      console.error("[api/runes/rate] rep insert failed:", repError);
      return NextResponse.json({ error: "Couldn't save the rating" }, { status: 500 });
    }
  }

  // Reschedule the card (SM-2 applied exactly once per rate call).
  const srsUpdate = {
    user_id: dbUser.id,
    card_id: cardId,
    due_at: next.nextReviewAt.toISOString(),
    interval_days: next.intervalDays,
    ease_factor: next.easeFactor,
    review_count: next.reviewCount,
    last_rating: rating,
    last_reviewed_at: nowIso,
  };
  const { error: srsError } = srs
    ? await supabase.from("rune_card_srs").update(srsUpdate).eq("id", srs.id)
    : await supabase.from("rune_card_srs").insert(srsUpdate);
  if (srsError) {
    console.error("[api/runes/rate] SRS update failed:", srsError);
    return NextResponse.json({ error: "Couldn't reschedule the rune" }, { status: 500 });
  }

  return NextResponse.json({
    wasDue,
    xpEligible: wasDue && rating >= 3,
    intervalDays: next.intervalDays,
    nextDueAt: next.nextReviewAt.toISOString(),
  });
}
