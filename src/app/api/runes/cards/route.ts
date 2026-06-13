// POST /api/runes/cards — add a manual rune card to an owned topic.
// Manual cards (source='manual') survive Reforge and are due immediately.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_BACK_CHARS, MAX_FRONT_CHARS } from "@/lib/rune-deck";
import { getDbUserId, verifyTopicOwned } from "@/lib/ownership";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { topicId?: unknown; front?: unknown; back?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topicId = typeof body.topicId === "string" ? body.topicId : "";
  const front = typeof body.front === "string" ? body.front.trim() : "";
  const back = typeof body.back === "string" ? body.back.trim() : "";
  if (!topicId || !front || !back) {
    return NextResponse.json(
      { error: "topicId, front and back are required" },
      { status: 400 },
    );
  }
  if (front.length > MAX_FRONT_CHARS || back.length > MAX_BACK_CHARS) {
    return NextResponse.json(
      { error: `Front is capped at ${MAX_FRONT_CHARS} chars and back at ${MAX_BACK_CHARS}.` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const dbUserId = await getDbUserId(supabase, userId);
  if (!dbUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await verifyTopicOwned(supabase, topicId, dbUserId))) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("rune_cards")
    .insert({ topic_id: topicId, front, back, source: "manual" })
    .select("id, front, back, source, edited_at, suspended_at, created_at")
    .single();
  if (insertError || !inserted) {
    console.error("[api/runes/cards] insert failed:", insertError);
    return NextResponse.json({ error: "Couldn't save the rune" }, { status: 500 });
  }

  // Fatal seed (same rationale as the forge route): a card without an SRS
  // row produces contradictory due counts across surfaces — roll back.
  const nowIso = new Date().toISOString();
  const { error: srsError } = await supabase.from("rune_card_srs").insert({
    user_id: dbUserId,
    card_id: inserted.id,
    due_at: nowIso,
  });
  if (srsError) {
    console.error("[api/runes/cards] SRS seed failed:", srsError);
    await supabase.from("rune_cards").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "Couldn't schedule the rune — try again" }, { status: 500 });
  }

  return NextResponse.json({
    card: {
      id: inserted.id,
      front: inserted.front,
      back: inserted.back,
      source: "manual",
      editedAt: inserted.edited_at,
      suspendedAt: inserted.suspended_at,
      createdAt: inserted.created_at,
      srs: {
        dueAt: nowIso,
        intervalDays: 1,
        easeFactor: 2.5,
        reviewCount: 0,
        lastRating: null,
        lastReviewedAt: null,
      },
    },
  });
}
