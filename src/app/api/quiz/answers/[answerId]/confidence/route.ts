import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { classifiedErrorBody } from "@/lib/ai-error";

export const maxDuration = 30;

type Confidence = "guessed" | "unsure" | "confident";

/**
 * PATCH /api/quiz/answers/[answerId]/confidence
 *
 * Sets / updates the confidence value on a graded quiz answer. Used by the
 * post-Submit confidence row in QuizEngine — fire-and-forget from the
 * client; the row's value is the source of truth.
 *
 * Ownership chain: quiz_answers -> quiz_sessions(user_id).
 * Idempotent: same value re-PATCHed returns ok.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ answerId: string }> },
) {
  const { answerId } = await params;
  if (!answerId) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Missing answer id.", false),
      { status: 400 },
    );
  }

  let body: { confidence?: Confidence };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Malformed request.", false),
      { status: 400 },
    );
  }
  const c = body.confidence;
  if (c !== "guessed" && c !== "unsure" && c !== "confident") {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Invalid confidence value.", false),
      { status: 400 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Sign-in expired. Refresh to sign back in.", false),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Couldn't resolve your account.", false),
      { status: 401 },
    );
  }

  // Ownership chain: quiz_answers -> quiz_sessions(user_id).
  // Use the same nested-inner pattern as /api/clarify to assert ownership.
  const { data: row } = await supabase
    .from("quiz_answers")
    .select("id, quiz_sessions!inner ( user_id )")
    .eq("id", answerId)
    .single();
  if (!row) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "That answer no longer exists.", false),
      { status: 404 },
    );
  }
  const session = Array.isArray(row.quiz_sessions) ? row.quiz_sessions[0] : row.quiz_sessions;
  if (!session || session.user_id !== dbUser.id) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "You don't have access to that trial.", false),
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("quiz_answers")
    .update({ confidence: c })
    .eq("id", answerId);
  if (error) {
    console.error("[api/quiz/answers/[id]/confidence] update failed:", error);
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't save your confidence.", true),
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
