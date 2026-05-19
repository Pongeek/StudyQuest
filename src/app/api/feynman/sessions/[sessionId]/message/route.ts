import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getFeynmanReply, type ConversationMessage } from "@/lib/ai/feynman-tutor";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// POST /api/feynman/sessions/[sessionId]/message
// Appends a student message to the conversation and returns Claude's reply.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { content } = body as { content: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch the session
  const { data: session } = await supabase
    .from("feynman_sessions")
    .select("*, topics(id, title, summary, key_concepts)")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 400 });
  }

  const topic = session.topics as any;
  const existingMessages: ConversationMessage[] = Array.isArray(session.messages)
    ? session.messages
    : [];

  // Append student's message
  const updatedMessages: ConversationMessage[] = [
    ...existingMessages,
    { role: "user", content: content.trim() },
  ];

  // Get Claude's reply
  let reply = "";
  try {
    reply = await getFeynmanReply({
      topicTitle: topic?.title ?? "this topic",
      summary: topic?.summary ?? "",
      keyConcepts: Array.isArray(topic?.key_concepts) ? topic.key_concepts : [],
      conversation: updatedMessages,
    });
  } catch {
    return NextResponse.json({ error: "Failed to get reply" }, { status: 500 });
  }

  // Append Claude's reply
  const finalMessages: ConversationMessage[] = [
    ...updatedMessages,
    { role: "assistant", content: reply },
  ];

  // Persist updated conversation
  await supabase
    .from("feynman_sessions")
    .update({ messages: finalMessages })
    .eq("id", sessionId);

  // turnCount = number of student messages sent so far
  const turnCount = finalMessages.filter((m) => m.role === "user").length;

  return NextResponse.json({
    response: reply,
    turnCount,
    canEvaluate: turnCount >= 3,
  });
}
