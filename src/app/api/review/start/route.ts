import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_TOPICS_PER_SESSION, QUESTIONS_PER_TOPIC } from "@/lib/spaced-repetition";

export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date().toISOString();

  // Fetch due topics (same query as GET /api/review/queue)
  const { data: dueMasteries, error: queueError } = await supabase
    .from("user_topic_mastery")
    .select(`
      topic_id,
      topics (
        id,
        title
      )
    `)
    .eq("user_id", dbUser.id)
    .not("next_review_at", "is", null)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(MAX_TOPICS_PER_SESSION);

  if (queueError) {
    console.error("Start review queue error:", queueError);
    return NextResponse.json({ error: "Failed to fetch due topics" }, { status: 500 });
  }

  if (!dueMasteries || dueMasteries.length === 0) {
    return NextResponse.json({ error: "No topics due for review" }, { status: 400 });
  }

  // For each topic, pick QUESTIONS_PER_TOPIC random questions
  const allQuestions: Array<{
    id: string;
    type: "mcq" | "open";
    content: string;
    options: string[] | null;
    correct_answer: string;
    explanation: string;
    difficulty: number;
    topicId: string;
    topicTitle: string;
  }> = [];

  const topicIds: string[] = [];

  for (const row of dueMasteries) {
    const topicId = (row as any).topic_id as string;
    const topicTitle = (row as any).topics?.title ?? "Unknown topic";
    topicIds.push(topicId);

    // Fetch questions for this topic, skipping soft-replaced rows.
    const { data: topicQuestions } = await supabase
      .from("questions")
      .select("id, type, content, options, correct_answer, explanation, difficulty")
      .eq("topic_id", topicId)
      .is("replaced_at", null);

    if (!topicQuestions || topicQuestions.length === 0) continue;

    // Shuffle and take QUESTIONS_PER_TOPIC
    const shuffled = [...topicQuestions].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, QUESTIONS_PER_TOPIC);

    for (const q of picked) {
      allQuestions.push({
        id: q.id,
        type: q.type as "mcq" | "open",
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty ?? 3,
        topicId,
        topicTitle,
      });
    }
  }

  if (allQuestions.length === 0) {
    return NextResponse.json({ error: "No questions available for due topics" }, { status: 400 });
  }

  // Interleave questions (shuffle across topics)
  const interleaved = allQuestions.sort(() => Math.random() - 0.5);

  // Create review session
  const { data: session, error: sessionError } = await supabase
    .from("review_sessions")
    .insert({
      user_id: dbUser.id,
      topic_ids: topicIds,
      question_count: interleaved.length,
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("Review session create error:", sessionError);
    return NextResponse.json({ error: "Failed to create review session" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    questions: interleaved,
  });
}
