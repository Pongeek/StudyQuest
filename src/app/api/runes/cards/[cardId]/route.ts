// PATCH /api/runes/cards/[cardId] — edit a card's text, or banish/restore it.
//
//   { front, back }        → update text + stamp edited_at (edited forged
//                            cards survive Reforge, same as manual cards)
//   { suspended: true }    → banish (excluded from drills + due counts)
//   { suspended: false }   → restore
//
// Ownership chain: card → topic → episode → course → user.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_BACK_CHARS, MAX_FRONT_CHARS } from "@/lib/rune-deck";
import { getDbUserId, verifyCardOwned } from "@/lib/ownership";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { front?: unknown; back?: unknown; suspended?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasText = body.front !== undefined || body.back !== undefined;
  const hasSuspend = typeof body.suspended === "boolean";
  if (!hasText && !hasSuspend) {
    return NextResponse.json(
      { error: "Provide front/back to edit, or suspended to banish/restore" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const dbUserId = await getDbUserId(supabase, userId);
  if (!dbUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await verifyCardOwned(supabase, cardId, dbUserId))) {
    return NextResponse.json({ error: "Rune not found" }, { status: 404 });
  }

  const updates: Record<string, string | null> = {};

  if (hasText) {
    const front = typeof body.front === "string" ? body.front.trim() : "";
    const back = typeof body.back === "string" ? body.back.trim() : "";
    if (!front || !back) {
      return NextResponse.json(
        { error: "front and back must both be non-empty" },
        { status: 400 },
      );
    }
    if (front.length > MAX_FRONT_CHARS || back.length > MAX_BACK_CHARS) {
      return NextResponse.json(
        { error: `Front is capped at ${MAX_FRONT_CHARS} chars and back at ${MAX_BACK_CHARS}.` },
        { status: 400 },
      );
    }
    updates.front = front;
    updates.back = back;
    updates.edited_at = new Date().toISOString();
  }

  if (hasSuspend) {
    updates.suspended_at = body.suspended ? new Date().toISOString() : null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("rune_cards")
    .update(updates)
    .eq("id", cardId)
    .select("id, front, back, source, edited_at, suspended_at, created_at")
    .single();
  if (updateError || !updated) {
    console.error("[api/runes/cards/patch] update failed:", updateError);
    return NextResponse.json({ error: "Couldn't update the rune" }, { status: 500 });
  }

  return NextResponse.json({
    card: {
      id: updated.id,
      front: updated.front,
      back: updated.back,
      source: updated.source,
      editedAt: updated.edited_at,
      suspendedAt: updated.suspended_at,
      createdAt: updated.created_at,
    },
  });
}
