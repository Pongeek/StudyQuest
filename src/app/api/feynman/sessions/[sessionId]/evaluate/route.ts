import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluateFeynmanSession, type ConversationMessage } from "@/lib/ai/feynman-tutor";
import { awardAchievementsIfNew, applyAchievementXP } from "@/lib/achievements";

const XP_PASS = 60;
const XP_FAIL_CONSOLATION = 15;

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// POST /api/feynman/sessions/[sessionId]/evaluate
// Asks Claude to evaluate the student's explanation across the full conversation.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch session + topic
  const { data: session } = await supabase
    .from("feynman_sessions")
    .select("*, topics(id, title, key_concepts)")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session already completed" }, { status: 400 });
  }

  const topic = session.topics as any;
  const messages: ConversationMessage[] = Array.isArray(session.messages)
    ? session.messages
    : [];

  // Must have at least 3 student turns
  const turnCount = messages.filter((m) => m.role === "user").length;
  if (turnCount < 3) {
    return NextResponse.json(
      { error: "Need at least 3 exchanges before evaluation" },
      { status: 400 }
    );
  }

  // Evaluate with Claude
  let evaluation = { passed: false, score: 0, feedback: "" };
  try {
    evaluation = await evaluateFeynmanSession({
      topicTitle: topic?.title ?? "this topic",
      keyConcepts: Array.isArray(topic?.key_concepts) ? topic.key_concepts : [],
      conversation: messages,
    });
  } catch {
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }

  const xpEarned = evaluation.passed ? XP_PASS : XP_FAIL_CONSOLATION;
  const newTotalXp = (dbUser.total_xp ?? 0) + xpEarned;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Update session
  await supabase
    .from("feynman_sessions")
    .update({
      status: evaluation.passed ? "passed" : "abandoned",
      evaluation_score: evaluation.score,
      xp_earned: xpEarned,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  // Award XP + update last_study_date
  await supabase
    .from("users")
    .update({
      total_xp: newTotalXp,
      last_study_date: todayStr,
    })
    .eq("id", dbUser.id);

  // ── Achievement checks ────────────────────────────────────────────────────
  const newAchievements: Array<{ slug: string; name: string; icon: string; description: string; xp_reward: number }> = [];

  const slugsToCheck: string[] = [];

  // "First Lesson" — first evaluated Feynman session (pass or fail)
  slugsToCheck.push("first_lesson");

  // "Eloquent Scholar" — scored 90%+ on any single session
  if (evaluation.score >= 0.9) {
    slugsToCheck.push("eloquent_scholar");
  }

  // "The Professor" — 5 passed sessions
  if (evaluation.passed) {
    const { count: passedCount } = await supabase
      .from("feynman_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id)
      .eq("status", "passed");

    if ((passedCount ?? 0) >= 5) {
      slugsToCheck.push("the_professor");
    }
  }

  const awarded = await awardAchievementsIfNew({
    userId: dbUser.id,
    slugs: slugsToCheck,
    supabase,
  });
  newAchievements.push(...awarded);

  if (awarded.length > 0) {
    await applyAchievementXP({
      userId: dbUser.id,
      achievements: awarded,
      currentTotalXp: newTotalXp,
      supabase,
    });
  }

  return NextResponse.json({
    passed: evaluation.passed,
    score: evaluation.score,
    feedback: evaluation.feedback,
    xpEarned,
    newAchievements,
  });
}
