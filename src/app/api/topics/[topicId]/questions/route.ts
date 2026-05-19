import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateTopicQuestions } from "@/lib/ai/generate-questions";

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
    .select("*, episodes!inner(title, course_id, courses!inner(subject))")
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

  // Check if questions already exist
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (count && count > 0 && !regenerate) {
    return NextResponse.json({ message: "Questions already exist", count });
  }

  // If regenerating, delete existing questions first
  if (regenerate && count && count > 0) {
    await supabase.from("questions").delete().eq("topic_id", topicId);
  }

  const episode = topic.episodes as any;
  const course = episode.courses as any;

  // Calculate page count from source_pages for scaling question count
  const sourcePages = topic.source_pages as { start: number; end: number } | null;
  const pageCount = sourcePages ? (sourcePages.end - sourcePages.start + 1) : undefined;

  const questions = await generateTopicQuestions({
    topicTitle: topic.title,
    topicSummary: topic.summary,
    keyConcepts: Array.isArray(topic.key_concepts) ? topic.key_concepts : [],
    episodeTitle: episode.title,
    courseSubject: course?.subject || "Academic",
    difficulty: topic.difficulty,
    pageCount,
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
    .eq("topic_id", topicId);

  return NextResponse.json({ questions: questions || [] });
}
