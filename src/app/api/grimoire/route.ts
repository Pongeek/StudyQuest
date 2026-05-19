import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export interface GrimoireDemon {
  questionId: string;
  content: string;
  type: "mcq" | "open";
  topicTitle: string;
  topicId: string;
  failCount: number;
  isSettled: boolean; // most recent answer was correct (score >= 0.8)
  lastAttemptedAt: string;
}

/**
 * Shared logic: scan a user's quiz_answers and return demon question data.
 * Exported so the session route can reuse it without an extra HTTP call.
 */
export async function getGrimoireDemons(userId: string): Promise<GrimoireDemon[]> {
  const supabase = createServiceClient();

  // 1. Fetch the user's quiz session IDs
  const { data: sessions } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("user_id", userId);

  if (!sessions || sessions.length === 0) return [];
  const sessionIds = sessions.map((s: any) => s.id);

  // 2. Fetch all quiz answers for those sessions
  const { data: quizAnswers } = await supabase
    .from("quiz_answers")
    .select("question_id, ai_score, answered_at")
    .in("session_id", sessionIds)
    .order("answered_at", { ascending: true });

  if (!quizAnswers || quizAnswers.length === 0) return [];

  // 3. Also pull any answers from completed grimoire review sessions —
  //    ReviewEngine writes to review_answers, not quiz_answers, so we must
  //    merge both sources to get an accurate "latest score" per question.
  const { data: grimSessions } = await supabase
    .from("review_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "grimoire");

  let grimAnswers: Array<{ question_id: string; ai_score: number; answered_at: string }> = [];
  if (grimSessions && grimSessions.length > 0) {
    const grimIds = grimSessions.map((s: any) => s.id);
    const { data: ra } = await supabase
      .from("review_answers")
      .select("question_id, ai_score, answered_at")
      .in("review_session_id", grimIds)
      .order("answered_at", { ascending: true });
    grimAnswers = ra ?? [];
  }

  // 4. Group by question — track fail count (from quiz only) + latest score (from all sources)
  const questionMap = new Map<
    string,
    { failCount: number; latestScore: number; latestAt: string }
  >();

  for (const ans of quizAnswers) {
    const qid = ans.question_id;
    const existing = questionMap.get(qid) ?? { failCount: 0, latestScore: 0, latestAt: "" };
    const isFailure = ans.ai_score < 0.5;
    questionMap.set(qid, {
      failCount: existing.failCount + (isFailure ? 1 : 0),
      latestScore: ans.ai_score,
      latestAt: ans.answered_at,
    });
  }

  // Overlay grimoire review answers: update latestScore/latestAt if more recent
  for (const ans of grimAnswers) {
    const qid = ans.question_id;
    const existing = questionMap.get(qid);
    if (!existing) continue; // only care about questions already tracked as demons
    if (!existing.latestAt || new Date(ans.answered_at) > new Date(existing.latestAt)) {
      questionMap.set(qid, {
        ...existing,
        latestScore: ans.ai_score,
        latestAt: ans.answered_at,
      });
    }
  }

  // 5. Keep only questions with 2+ failures (quiz failures only — grimoire answers don't add to fail count)
  const demonIds = [...questionMap.entries()]
    .filter(([, v]) => v.failCount >= 2)
    .map(([id]) => id);

  if (demonIds.length === 0) return [];

  // 5. Fetch question details with topic title
  const { data: questions } = await supabase
    .from("questions")
    .select("id, content, type, topic_id, topics(id, title)")
    .in("id", demonIds);

  if (!questions) return [];

  return questions.map((q: any) => {
    const meta = questionMap.get(q.id)!;
    return {
      questionId: q.id,
      content: q.content,
      type: q.type,
      topicTitle: q.topics?.title ?? "Unknown Topic",
      topicId: q.topic_id,
      failCount: meta.failCount,
      isSettled: meta.latestScore >= 0.8,
      lastAttemptedAt: meta.latestAt,
    };
  }).sort((a: GrimoireDemon, b: GrimoireDemon) => b.failCount - a.failCount); // worst demons first
}

// GET /api/grimoire
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const demons = await getGrimoireDemons(dbUser.id);

  return NextResponse.json({
    demons,
    totalCount: demons.length,
    activeCount: demons.filter((d) => !d.isSettled).length,
  });
}
