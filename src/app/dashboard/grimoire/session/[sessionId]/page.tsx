import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import ReviewEngine from "@/components/review/ReviewEngine";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function GrimoireSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();

  // Resolve internal user
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) redirect("/sign-in");

  // Fetch the grimoire review session
  const { data: session } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session || session.source !== "grimoire") notFound();

  // Already completed — redirect back to grimoire
  if (session.completed_at) redirect("/dashboard/grimoire");

  // Fetch the pinned questions
  const pinnedIds: string[] = session.pinned_question_ids ?? [];
  if (pinnedIds.length === 0) redirect("/dashboard/grimoire");

  // Filter `replaced_at IS NULL` so a question regenerated AFTER this
  // grimoire session was created doesn't show up here with stale content.
  // The session's pinned_question_ids stays intact (history is preserved)
  // but the user-facing render only shows live rows.
  const { data: questions } = await supabase
    .from("questions")
    .select("id, type, content, options, correct_answer, explanation, difficulty, topic_id, topics(id, title)")
    .in("id", pinnedIds)
    .is("replaced_at", null);

  if (!questions || questions.length === 0) redirect("/dashboard/grimoire");

  // Shape to ReviewEngine's ReviewQuestion interface
  const shaped = questions.map((q: any) => ({
    id: q.id,
    type: q.type as "mcq" | "open",
    content: q.content,
    options: q.options ?? null,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? "",
    difficulty: q.difficulty ?? 3,
    topicId: q.topic_id,
    topicTitle: q.topics?.title ?? "Unknown Topic",
  }));

  return (
    <div className="max-w-3xl mx-auto">
      {/* Grimoire session header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-700/40 flex items-center justify-center glow-purple">
          📕
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Grimoire Session</h1>
          <p className="text-xs text-slate-400">
            Defeating {shaped.length} demon{shaped.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Reuse the full ReviewEngine — it handles grading + completion via
          the existing /api/review/[sessionId]/answer and /complete routes */}
      <ReviewEngine
        sessionId={sessionId}
        questions={shaped}
        userTotalXp={dbUser.total_xp ?? 0}
        userStreak={dbUser.current_streak ?? 0}
      />
    </div>
  );
}
