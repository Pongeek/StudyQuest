import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getGrimoireDemons } from "@/app/api/grimoire/route";
import { awardAchievementIfNew, applyAchievementXP } from "@/lib/achievements";

const MAX_DEMONS_PER_SESSION = 10;

// POST /api/grimoire/session
// Creates a review_session seeded with the user's worst unsettled demon questions.
// Awards "Demon Slayer" achievement on first grimoire session.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get all demons, prioritise unsettled ones
  const allDemons = await getGrimoireDemons(dbUser.id);
  const unsettled = allDemons.filter((d) => !d.isSettled);
  const selected = (unsettled.length > 0 ? unsettled : allDemons).slice(
    0,
    MAX_DEMONS_PER_SESSION
  );

  if (selected.length === 0) {
    return NextResponse.json({ error: "No demons found" }, { status: 404 });
  }

  const questionIds = selected.map((d) => d.questionId);
  const topicIds = [...new Set(selected.map((d) => d.topicId))];

  // Fetch full question rows (ReviewEngine needs options, correct_answer, etc.).
  // Filter `replaced_at IS NULL` so a demon that was regenerated between
  // grimoire-page render and the session-create call is dropped silently
  // rather than served as stale content. `getGrimoireDemons` already filters
  // — but the regen could happen in the millisecond window after.
  const { data: questions } = await supabase
    .from("questions")
    .select("id, type, content, options, correct_answer, explanation, difficulty, topic_id, topics(id, title)")
    .in("id", questionIds)
    .is("replaced_at", null);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Failed to load questions" }, { status: 500 });
  }

  // Create a review_session with grimoire source + pinned question IDs
  const { data: session, error } = await supabase
    .from("review_sessions")
    .insert({
      user_id: dbUser.id,
      topic_ids: topicIds,
      question_count: questions.length,
      source: "grimoire",
      pinned_question_ids: questionIds,
    })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Shape questions to match ReviewEngine's ReviewQuestion interface
  const shaped = questions.map((q: any) => ({
    id: q.id,
    type: q.type,
    content: q.content,
    options: q.options ?? null,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? "",
    difficulty: q.difficulty ?? 3,
    topicId: q.topic_id,
    topicTitle: q.topics?.title ?? "Unknown Topic",
  }));

  // Award "Demon Slayer" achievement on first grimoire session (best-effort)
  try {
    const demonSlayer = await awardAchievementIfNew({
      userId: dbUser.id,
      slug: "demon_slayer",
      supabase,
    });
    if (demonSlayer) {
      await applyAchievementXP({
        userId: dbUser.id,
        achievements: [demonSlayer],
        currentTotalXp: dbUser.total_xp ?? 0,
        supabase,
      });
    }
  } catch {
    // Non-fatal — don't fail the session creation
  }

  return NextResponse.json({ sessionId: session.id, questions: shaped });
}
