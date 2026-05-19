import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
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

  const { data: dueMasteries, error } = await supabase
    .from("user_topic_mastery")
    .select(`
      topic_id,
      next_review_at,
      last_score,
      mastery_level,
      topics (
        id,
        title,
        episode_id,
        episodes (
          id,
          title,
          course_id,
          courses (
            id,
            title,
            theme_name
          )
        )
      )
    `)
    .eq("user_id", dbUser.id)
    .not("next_review_at", "is", null)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true });

  if (error) {
    console.error("Review queue fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 });
  }

  const dueTopics = (dueMasteries ?? []).map((row: any) => {
    const overdueDays =
      row.next_review_at
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(row.next_review_at).getTime()) / 86_400_000
            )
          )
        : 0;

    return {
      topicId: row.topic_id,
      topicTitle: row.topics?.title ?? "Unknown topic",
      episodeTitle: row.topics?.episodes?.title ?? "",
      courseTitle:
        row.topics?.episodes?.courses?.theme_name ||
        row.topics?.episodes?.courses?.title ||
        "",
      daysOverdue: overdueDays,
      lastScore: row.last_score ?? null,
      masteryLevel: row.mastery_level ?? 0,
    };
  });

  return NextResponse.json({ count: dueTopics.length, dueTopics });
}
