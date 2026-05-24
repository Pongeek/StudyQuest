import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import QuizEngine from "@/components/quiz/QuizEngine";

async function getSessionData(sessionId: string, userId: string, topicId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, current_streak, total_xp")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return null;

  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId)
    .single();

  if (!session) return null;

  // Soft-replaced questions are hidden via `replaced_at IS NULL`. Sorting
  // by created_at keeps the question order stable even when a question was
  // regenerated mid-session (the new row inherits the old created_at).
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("topic_id", topicId)
    .is("replaced_at", null)
    .order("created_at", { ascending: true });

  const { data: topic } = await supabase
    .from("topics")
    .select("title, summary, episodes!inner(title)")
    .eq("id", topicId)
    .single();

  return {
    session,
    questions: questions || [],
    topic,
    dbUser,
    userTotalXp: (dbUser.total_xp as number | null) ?? 0,
  };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string; sessionId: string }>;
}) {
  const { id: courseId, topicId, sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getSessionData(sessionId, userId, topicId);
  if (!data) notFound();

  const { session, questions, topic, dbUser, userTotalXp } = data;

  if (session.completed_at) {
    redirect(`/dashboard/courses/${courseId}/topics/${topicId}`);
  }

  return (
    <QuizEngine
      sessionId={sessionId}
      topicId={topicId}
      courseId={courseId}
      questions={questions}
      topicTitle={topic?.title || ""}
      topicSummary={topic?.summary || ""}
      episodeTitle={(topic?.episodes as any)?.title || ""}
      userStreak={dbUser.current_streak || 0}
      userTotalXp={userTotalXp}
    />
  );
}
