import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { regenerateQuestion } from "@/lib/ai/regenerate-question";
import { classifyAiError } from "@/lib/ai-error";

export const maxDuration = 60;

/**
 * POST /api/questions/[questionId]/regenerate
 *
 * Generates ONE replacement question for the given question and soft-replaces
 * the old row. Old quiz_answers stay intact (they reference question_id) so
 * historical mastery data is preserved. The new row inherits the old row's
 * `created_at` so chronological ordering keeps it in the same slot.
 *
 * Ownership chain: question → topic → episode → course → user.
 *
 * Returns the new question shape (id + type + content + options + …) so the
 * client engine can swap it into local state without a refetch.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createServiceClient();

    // Resolve internal user id.
    const { data: dbUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch the rejected question + full topic/episode/course context.
    // The nested-join filter on courses.user_id is the ownership check —
    // if the question belongs to someone else's course, this returns null.
    const { data: oldQuestion } = await supabase
      .from("questions")
      .select(
        `
        id, type, content, correct_answer, difficulty, created_at, replaced_at, topic_id,
        topics!inner(
          title, summary, key_concepts,
          episodes!inner(
            title,
            courses!inner(id, user_id, subject, output_language)
          )
        )
      `
      )
      .eq("id", questionId)
      .eq("topics.episodes.courses.user_id", dbUser.id)
      .single();

    if (!oldQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (oldQuestion.replaced_at) {
      return NextResponse.json(
        { error: "Question already replaced" },
        { status: 409 }
      );
    }

    // Flatten the nested topic / episode / course rows. Supabase types these
    // as object-or-array depending on the relationship cardinality, so we
    // normalize defensively.
    const topic: any = Array.isArray(oldQuestion.topics)
      ? oldQuestion.topics[0]
      : oldQuestion.topics;
    const episode: any = Array.isArray(topic?.episodes)
      ? topic.episodes[0]
      : topic?.episodes;
    const course: any = Array.isArray(episode?.courses)
      ? episode.courses[0]
      : episode?.courses;

    const rawLang = course?.output_language;
    const outputLanguage: "auto" | "en" | "he" =
      rawLang === "en" || rawLang === "he" ? rawLang : "auto";

    // Call Claude for the replacement. Errors here surface via classifier.
    const replacement = await regenerateQuestion({
      topicTitle: topic?.title ?? "",
      topicSummary: topic?.summary ?? "",
      keyConcepts: Array.isArray(topic?.key_concepts) ? topic.key_concepts : [],
      episodeTitle: episode?.title ?? "",
      courseSubject: course?.subject ?? "Academic",
      oldQuestion: {
        type: oldQuestion.type as "mcq" | "open",
        content: oldQuestion.content,
        correct_answer: oldQuestion.correct_answer,
        difficulty: oldQuestion.difficulty,
      },
      outputLanguage,
    });

    // Insert the new question, inheriting the old row's created_at so
    // ordering stays stable. Force the new type to match the old — even
    // if Claude tried to switch (the prompt forbids it, but defense in depth).
    const { data: insertedRows, error: insertError } = await supabase
      .from("questions")
      .insert({
        topic_id: oldQuestion.topic_id,
        type: oldQuestion.type, // hard-pin to old type
        content: replacement.content,
        options: replacement.options ?? null,
        correct_answer: replacement.correct_answer,
        explanation: replacement.explanation,
        difficulty: replacement.difficulty,
        created_at: oldQuestion.created_at, // slot inheritance
      })
      .select(
        "id, topic_id, type, content, options, correct_answer, explanation, difficulty, created_at"
      )
      .single();

    if (insertError || !insertedRows) {
      console.error("[regenerate] insert failed:", insertError);
      throw new Error(insertError?.message ?? "Failed to insert replacement question");
    }

    // Soft-replace the old question — pointer + timestamp. Done AFTER the
    // insert so a failed insert leaves the old question still live.
    const { error: markError } = await supabase
      .from("questions")
      .update({
        replaced_by_id: insertedRows.id,
        replaced_at: new Date().toISOString(),
      })
      .eq("id", oldQuestion.id);

    if (markError) {
      // Best-effort cleanup: drop the new row so we don't end up with two
      // live questions on the same concept. Don't fail the request — the
      // user can retry; both rows exist but the old one is still primary.
      console.error("[regenerate] mark-replaced failed, rolling back insert:", markError);
      await supabase.from("questions").delete().eq("id", insertedRows.id);
      throw new Error(markError.message);
    }

    return NextResponse.json({ question: insertedRows });
  } catch (err) {
    console.error("[api/questions/regenerate] failed:", err);
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }
}
