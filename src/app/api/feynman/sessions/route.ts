import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getFeynmanReply } from "@/lib/ai/feynman-tutor";

// POST /api/feynman/sessions
// Creates a new Feynman session and returns Claude's opening question.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { topicId, quizSessionId } = body as {
    topicId: string;
    quizSessionId?: string;
  };

  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch topic context
  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, summary, key_concepts")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  // Generate Claude's opening message (empty conversation → Claude opens)
  let openingMessage = "";
  try {
    openingMessage = await getFeynmanReply({
      topicTitle: topic.title,
      summary: topic.summary ?? "",
      keyConcepts: Array.isArray(topic.key_concepts) ? topic.key_concepts : [],
      conversation: [], // triggers the opener
    });
  } catch {
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }

  // Create session with Claude's opener as the first message
  const { data: session, error } = await supabase
    .from("feynman_sessions")
    .insert({
      user_id: dbUser.id,
      topic_id: topicId,
      quiz_session_id: quizSessionId ?? null,
      messages: [{ role: "assistant", content: openingMessage }],
    })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    openingMessage,
  });
}
