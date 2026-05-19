import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateBossFightQuestions } from "@/lib/ai/generate-boss-questions";

// Generating 12–15 boss questions for a Hebrew episode can take 1–3 minutes
// for Claude to write — keep ample headroom over the default 10s function
// timeout.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { episodeId, courseId, regenerate = false } = body as {
    episodeId: string;
    courseId?: string;
    regenerate?: boolean;
  };
  if (!episodeId) return NextResponse.json({ error: "episodeId required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify user owns the course
  const { data: episode } = await supabase
    .from("episodes")
    .select("id, title, course_id, courses!inner(user_id, subject)")
    .eq("id", episodeId)
    .single();

  if (!episode || (episode.courses as any).user_id !== dbUser.id) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // Check all topics in episode are at Novice+ mastery
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, summary, key_concepts, user_topic_mastery(mastery_level)")
    .eq("episode_id", episodeId)
    .order("order_index");

  if (!topics || topics.length === 0) {
    return NextResponse.json({ error: "No topics in this episode" }, { status: 400 });
  }

  const allAttempted = topics.every(
    (t: any) => (t.user_topic_mastery?.[0]?.mastery_level ?? 0) >= 1
  );

  // TODO: Remove this bypass after testing — lets users start a boss fight
  // without first reaching Novice on every topic in the episode.
  const DEV_FORCE_BOSS_UNLOCK = true;

  if (!allAttempted && !DEV_FORCE_BOSS_UNLOCK) {
    return NextResponse.json(
      { error: "Complete all topics in this episode first" },
      { status: 400 }
    );
  }

  // If regenerate is requested, wipe the cached questions so the generator runs fresh
  if (regenerate) {
    console.log(`[boss-fight] regenerate=true, wiping cached questions for episode ${episodeId}`);
    const { error: deleteError } = await supabase
      .from("boss_fight_questions")
      .delete()
      .eq("episode_id", episodeId);
    if (deleteError) {
      console.error("[boss-fight] failed to delete cached questions:", deleteError);
      return NextResponse.json(
        { error: "Failed to clear cached questions", detail: deleteError.message },
        { status: 500 }
      );
    }
  }

  // Check if we already have boss fight questions for this episode
  const { data: existingQuestionsLookup, error: lookupError } = await supabase
    .from("boss_fight_questions")
    .select("id")
    .eq("episode_id", episodeId);

  if (lookupError) {
    console.error("[boss-fight] question lookup failed:", lookupError);
    return NextResponse.json(
      { error: "Question lookup failed", detail: lookupError.message },
      { status: 500 }
    );
  }

  let existingQuestions = existingQuestionsLookup;
  const cacheHit = existingQuestions && existingQuestions.length > 0;
  console.log(
    `[boss-fight] episode=${episodeId} cache=${cacheHit ? `HIT (${existingQuestions!.length})` : "MISS"}`
  );

  // Generate questions if none exist
  if (!cacheHit) {
    // ── Past-exam calibration ──
    // Pull real exam questions the user uploaded for this course. They're
    // used as style + difficulty anchors so the boss questions feel like
    // the actual exam the student is preparing for. We prefer samples that
    // touch this episode's topics; if too few match, we fall back to the
    // broader course pool. If no past exams exist, the generator runs in
    // its "moderately challenging" baseline mode.
    const courseIdForExams = (episode as { course_id: string }).course_id;
    let examSamples: { content: string; modelAnswer?: string; marks?: number }[] = [];
    try {
      const episodeTopicIds = topics.map((t: any) => t.id as string);
      const { data: courseExamRows } = await supabase
        .from("exam_questions")
        .select("content, model_answer, topic_ids, marks")
        .eq("course_id", courseIdForExams)
        .limit(40);

      const allRows = courseExamRows ?? [];
      const episodeRelevant = allRows.filter((r: any) => {
        const tids: string[] = Array.isArray(r.topic_ids) ? r.topic_ids : [];
        return tids.some((t) => episodeTopicIds.includes(t));
      });
      const pool = episodeRelevant.length >= 2 ? episodeRelevant : allRows;
      examSamples = pool.slice(0, 5).map((r: any) => ({
        content: r.content as string,
        modelAnswer: (r.model_answer as string) || undefined,
        marks: typeof r.marks === "number" ? r.marks : undefined,
      }));
      console.log(
        `[boss-fight] exam-sample anchors: ${examSamples.length} (${episodeRelevant.length} episode-relevant of ${allRows.length} course-wide)`
      );
    } catch (err) {
      console.warn("[boss-fight] exam-sample lookup failed, proceeding without anchors:", err);
    }

    console.log(`[boss-fight] generating questions for episode "${episode.title}" (${topics.length} topics, ${examSamples.length} anchors)`);
    const generateStart = Date.now();
    let bossQuestions;
    try {
      bossQuestions = await generateBossFightQuestions({
        episodeTitle: episode.title,
        courseSubject: (episode.courses as any).subject || "",
        topics: topics.map((t: any) => ({
          id: t.id,
          title: t.title,
          summary: t.summary,
          keyConcepts: Array.isArray(t.key_concepts) ? t.key_concepts : [],
        })),
        examSamples,
      });
      console.log(
        `[boss-fight] generated ${bossQuestions.length} questions in ${Math.round((Date.now() - generateStart) / 1000)}s`
      );
    } catch (err: any) {
      const elapsed = Math.round((Date.now() - generateStart) / 1000);
      console.error(`[boss-fight] generation FAILED after ${elapsed}s:`, err);
      return NextResponse.json(
        {
          error: "Boss question generation failed",
          detail: err?.message ?? String(err),
          stage: "generate",
          elapsedSeconds: elapsed,
        },
        { status: 500 }
      );
    }

    if (!bossQuestions || bossQuestions.length === 0) {
      console.error("[boss-fight] generation returned zero questions");
      return NextResponse.json(
        { error: "Generation returned no questions", stage: "generate" },
        { status: 500 }
      );
    }

    // Map topic titles to IDs for source_topic_ids
    const titleToId = new Map(topics.map((t: any) => [t.title, t.id]));

    const questionRows = bossQuestions.map((q) => ({
      episode_id: episodeId,
      type: q.type,
      content: q.content,
      options: q.options || null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      source_topic_ids: q.source_topics
        .map((title) => titleToId.get(title))
        .filter(Boolean),
    }));

    const { error: insertError } = await supabase
      .from("boss_fight_questions")
      .insert(questionRows);

    if (insertError) {
      console.error("[boss-fight] insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to save boss questions", detail: insertError.message, stage: "insert" },
        { status: 500 }
      );
    }

    // Re-fetch
    const { data: newQuestions, error: refetchError } = await supabase
      .from("boss_fight_questions")
      .select("id")
      .eq("episode_id", episodeId);

    if (refetchError) {
      console.error("[boss-fight] refetch failed:", refetchError);
      return NextResponse.json(
        { error: "Question refetch failed", detail: refetchError.message, stage: "refetch" },
        { status: 500 }
      );
    }

    existingQuestions = newQuestions;
  }

  // Create boss fight session
  const { data: session, error: sessionError } = await supabase
    .from("boss_fight_sessions")
    .insert({
      user_id: dbUser.id,
      episode_id: episodeId,
      question_count: existingQuestions?.length ?? 0,
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("[boss-fight] session insert failed:", sessionError);
    return NextResponse.json(
      {
        error: "Failed to start boss fight",
        detail: sessionError?.message ?? "no session returned",
        stage: "session",
      },
      { status: 500 }
    );
  }

  console.log(`[boss-fight] session created: ${session.id}`);
  return NextResponse.json({ sessionId: session.id });
}
