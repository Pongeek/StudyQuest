import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import BossFightEngine from "@/components/quiz/BossFightEngine";
import type { BossFightUser, PreppedTopic } from "@/components/quiz/BossFightEngine";

async function getBossFightData(sessionId: string, courseId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, name, total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return null;

  const { data: session } = await supabase
    .from("boss_fight_sessions")
    .select("*, episodes(title, course_id)")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== dbUser.id) return null;

  const episode = session.episodes as { title: string; course_id: string };
  if (episode.course_id !== courseId) return null;

  // Already completed
  if (session.completed_at) return null;

  const { data: questions } = await supabase
    .from("boss_fight_questions")
    .select("*")
    .eq("episode_id", session.episode_id)
    .order("created_at");

  if (!questions || questions.length === 0) return null;

  // Fetch ALL topics in this episode + this user's mastery for each. We
  // start from `topics` (not `user_topic_mastery`) so unattempted topics
  // still appear in the loadout with masteryLevel = 0, making it clear
  // that the boss covers the whole episode, not just what's been practiced.
  const { data: episodeTopics } = await supabase
    .from("topics")
    .select("title, order_index, user_topic_mastery(mastery_level, user_id)")
    .eq("episode_id", session.episode_id)
    .order("order_index");

  const preppedTopics: PreppedTopic[] = (episodeTopics ?? []).map((t: any) => {
    const myMastery = (t.user_topic_mastery ?? []).find(
      (m: any) => m.user_id === dbUser.id
    );
    return {
      title: t.title as string,
      masteryLevel: (myMastery?.mastery_level as number | undefined) ?? 0,
    };
  });

  const user: BossFightUser = {
    name: (dbUser.name as string | null) ?? "Adventurer",
    totalXp: (dbUser.total_xp as number) ?? 0,
    streak: (dbUser.current_streak as number) ?? 0,
  };

  return {
    session,
    questions: questions.map((q: any) => ({
      id: q.id,
      type: q.type as "mcq" | "open",
      content: q.content,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
    })),
    episodeTitle: episode.title,
    user,
    preppedTopics,
  };
}

export default async function BossFightPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: courseId, sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getBossFightData(sessionId, courseId, userId);
  if (!data) notFound();

  return (
    <BossFightEngine
      sessionId={sessionId}
      episodeId={data.session.episode_id}
      courseId={courseId}
      questions={data.questions}
      episodeTitle={data.episodeTitle}
      user={data.user}
      preppedTopics={data.preppedTopics}
    />
  );
}
