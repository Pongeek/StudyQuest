import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topicId } = await request.json();
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .eq("topic_id", topicId);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "No questions available" }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from("quiz_sessions")
    .insert({
      user_id: dbUser.id,
      topic_id: topicId,
      question_count: questions.length,
    })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
