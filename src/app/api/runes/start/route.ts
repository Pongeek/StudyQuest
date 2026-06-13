// POST /api/runes/start — open a rune drill session.
//
// Body: { scope: "due" }                      → all due cards across courses
//       { scope: "topic", topicId: string }   → one deck (due-first), cram ok
//       { scope: "course", courseId: string } → every deck in a course, due-first
//
// Cards are capped at RUNE_SESSION_CAP, most-overdue first. The session row
// records card_ids so /rate can enforce membership. Dueness is used for
// ordering only — XP eligibility is decided server-side at rate time.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { RUNE_SESSION_CAP } from "@/lib/spaced-repetition";
import {
  embedOne,
  getCourseTopicIds,
  getDueRuneCards,
  type DrillCard,
} from "@/lib/runes-queue";
import { getDbUserId, verifyTopicOwned } from "@/lib/ownership";

type Scope = "due" | "topic" | "course";

interface CardRow {
  id: string;
  front: string;
  back: string;
  created_at: string;
  topics?: { title?: string | null } | { title?: string | null }[] | null;
}

function toDrillCard(row: CardRow): DrillCard {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    topicTitle: embedOne(row.topics)?.title ?? "Unknown topic",
  };
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scope?: unknown; topicId?: unknown; courseId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scope = body.scope as Scope;
  if (scope !== "due" && scope !== "topic" && scope !== "course") {
    return NextResponse.json({ error: "scope must be due | topic | course" }, { status: 400 });
  }
  const topicId = typeof body.topicId === "string" ? body.topicId : null;
  const courseId = typeof body.courseId === "string" ? body.courseId : null;
  if (scope === "topic" && !topicId) {
    return NextResponse.json({ error: "topicId required for topic scope" }, { status: 400 });
  }
  if (scope === "course" && !courseId) {
    return NextResponse.json({ error: "courseId required for course scope" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const dbUserId = await getDbUserId(supabase, userId);
  if (!dbUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  let drillCards: DrillCard[] = [];

  if (scope === "due") {
    const { data: dueRows } = await getDueRuneCards(supabase, dbUserId, {
      limit: RUNE_SESSION_CAP,
      now: nowIso,
    });
    drillCards = ((dueRows as unknown[]) || []).map((row) => {
      const card = embedOne((row as { rune_cards?: unknown }).rune_cards) as CardRow;
      return toDrillCard(card);
    });
  } else {
    // topic / course scope — resolve the owned topic id set first.
    let topicIds: string[] = [];
    if (scope === "topic") {
      if (!(await verifyTopicOwned(supabase, topicId!, dbUserId))) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
      }
      topicIds = [topicId!];
    } else {
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId!)
        .eq("user_id", dbUserId)
        .single();
      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      topicIds = await getCourseTopicIds(supabase, courseId!);
    }

    if (topicIds.length === 0) {
      return NextResponse.json({ error: "No runes to drill" }, { status: 404 });
    }

    const { data: cardRows } = await supabase
      .from("rune_cards")
      .select("id, front, back, created_at, topics(title)")
      .in("topic_id", topicIds)
      .is("suspended_at", null)
      .order("created_at", { ascending: true });
    const cards = (cardRows || []) as CardRow[];
    if (cards.length === 0) {
      return NextResponse.json({ error: "No runes to drill" }, { status: 404 });
    }

    // Dueness for ordering. Missing SRS rows count as due-now (defensive —
    // the seed is fatal, so this shouldn't occur). Epoch millis, not ISO
    // strings: PostgREST emits "+00:00" offsets while nowIso uses "Z".
    const { data: srsRows } = await supabase
      .from("rune_card_srs")
      .select("card_id, due_at")
      .eq("user_id", dbUserId)
      .in("card_id", cards.map((c) => c.id));
    const dueAtByCard = new Map(
      ((srsRows || []) as Array<{ card_id: string; due_at: string }>).map((s) => [
        s.card_id,
        s.due_at,
      ]),
    );

    const nowMs = new Date(nowIso).getTime();
    const withDueness = cards.map((c) => {
      const dueAt = dueAtByCard.get(c.id);
      const dueMs = dueAt ? new Date(dueAt).getTime() : nowMs;
      return { card: c, wasDue: dueMs <= nowMs, dueMs };
    });
    // Due first (most overdue first), then upcoming by soonest due.
    withDueness.sort((a, b) => {
      if (a.wasDue !== b.wasDue) return a.wasDue ? -1 : 1;
      return a.dueMs - b.dueMs;
    });

    drillCards = withDueness
      .slice(0, RUNE_SESSION_CAP)
      .map(({ card }) => toDrillCard(card));
  }

  if (drillCards.length === 0) {
    return NextResponse.json({ error: "No runes to drill" }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("rune_sessions")
    .insert({
      user_id: dbUserId,
      scope,
      topic_id: scope === "topic" ? topicId : null,
      course_id: scope === "course" ? courseId : null,
      card_ids: drillCards.map((c) => c.id),
      card_count: drillCards.length,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    console.error("[api/runes/start] session insert failed:", sessionError);
    return NextResponse.json({ error: "Couldn't start the drill" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    scope,
    cards: drillCards,
  });
}
