import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateTopicQuestions } from "@/lib/ai/generate-questions";
import { adjustDifficultyForMastery } from "@/lib/adaptive-difficulty";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("*, episodes!inner(title, course_id, courses!inner(subject, output_language))")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  // Check if regeneration was requested
  let regenerate = false;
  try {
    const body = await req.json();
    regenerate = body?.regenerate === true;
  } catch {
    // No body or invalid JSON — that's fine, default to false
  }

  // Check if live (non-replaced) questions already exist.
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .is("replaced_at", null);

  if (count && count > 0 && !regenerate) {
    return NextResponse.json({ message: "Questions already exist", count });
  }

  // If regenerating, SOFT-REPLACE the live questions instead of DELETE.
  // The original DELETE would CASCADE through quiz_answers / review_answers
  // / boss_fight_answers and wipe every historical answer row for the
  // topic — destroying mastery sparkline data, the Stumble heatmap, the
  // Quest Log, and per-topic accuracy stats. Migration 019 was built
  // specifically to AVOID exactly that ("old rows stay so historical
  // quiz_answers integrity is preserved"). We stamp replaced_at on every
  // live row instead — readers already filter `.is('replaced_at', null)`
  // so they vanish from queries, but quiz_answers FK references stay
  // intact and historical data survives.
  if (regenerate && count && count > 0) {
    const { error: replaceError } = await supabase
      .from("questions")
      .update({ replaced_at: new Date().toISOString() })
      .eq("topic_id", topicId)
      .is("replaced_at", null);
    if (replaceError) {
      return NextResponse.json(
        {
          error: "Failed to retire old questions",
          detail: replaceError.message,
        },
        { status: 500 },
      );
    }
  }

  const episode = topic.episodes as any;
  const course = episode.courses as any;

  // Calculate page count from source_pages for scaling question count
  const sourcePages = topic.source_pages as { start: number; end: number } | null;
  const pageCount = sourcePages ? (sourcePages.end - sourcePages.start + 1) : undefined;

  // Read the course's output_language so question text stays consistent
  // with the rest of the course content (episode titles, topic summaries).
  const rawLang = course?.output_language;
  const outputLanguage: "auto" | "en" | "he" =
    rawLang === "en" || rawLang === "he" ? rawLang : "auto";

  // ── Adaptive difficulty ──────────────────────────────────────────────────
  // Bias the generator's anchor based on this student's mastery of the topic.
  // Only fires on regeneration (the bulk-regen path is the only writer here
  // since first-time generation already skipped at the count > 0 branch
  // above). See src/lib/adaptive-difficulty.ts.
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  let adjustedDifficulty = topic.difficulty;
  let adjustment: "easier" | "harder" | "none" = "none";
  if (dbUser) {
    const { data: masteryRow } = await supabase
      .from("user_topic_mastery")
      .select("mastery_level, repetitions")
      .eq("user_id", dbUser.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    const result = adjustDifficultyForMastery({
      baseDifficulty: topic.difficulty,
      mastery: masteryRow
        ? {
            masteryLevel: Number(masteryRow.mastery_level) || 0,
            repetitions: Number(masteryRow.repetitions) || 0,
          }
        : null,
    });
    adjustedDifficulty = result.difficulty;
    adjustment = result.adjustment;
    console.log(
      `[topic-questions] adaptive-difficulty: base=${topic.difficulty} → ` +
        `adjusted=${adjustedDifficulty} (${adjustment}); mastery=${
          masteryRow ? `L${masteryRow.mastery_level}/R${masteryRow.repetitions}` : "none"
        }`,
    );
  }

  const questions = await generateTopicQuestions({
    topicTitle: topic.title,
    topicSummary: topic.summary,
    keyConcepts: Array.isArray(topic.key_concepts) ? topic.key_concepts : [],
    episodeTitle: episode.title,
    courseSubject: course?.subject || "Academic",
    difficulty: adjustedDifficulty,
    pageCount,
    outputLanguage,
  });

  const toInsert = questions.map((q) => ({
    topic_id: topicId,
    type: q.type,
    content: q.content,
    options: q.options || null,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
  }));

  const { error } = await supabase.from("questions").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ generated: questions.length, regenerated: regenerate });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("topic_id", topicId)
    .is("replaced_at", null)
    .order("created_at", { ascending: true });

  return NextResponse.json({ questions: questions || [] });
}
