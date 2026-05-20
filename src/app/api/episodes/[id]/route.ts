import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * DELETE /api/episodes/[id]
 *
 * Removes a single episode and all of its child rows (topics, questions,
 * user_topic_mastery entries) via the existing CASCADE constraints. Used
 * primarily so the user can clean up a failed / stuck upload and try again
 * — without having to delete the whole course.
 *
 * Authorization: must own the parent course.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: episodeId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // Resolve clerkId → dbUser
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify the user owns the episode's parent course before deleting.
  const { data: episode } = await supabase
    .from("episodes")
    .select("id, course_id, courses!inner(user_id)")
    .eq("id", episodeId)
    .single();

  if (!episode || (episode.courses as any)?.user_id !== dbUser.id) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // CASCADE handles topics, questions, course_files linked to this episode.
  const { error } = await supabase
    .from("episodes")
    .delete()
    .eq("id", episodeId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete episode" },
      { status: 500 }
    );
  }

  // Recompute course rollup counts
  const { count: episodeCount } = await supabase
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .eq("course_id", episode.course_id);
  const { count: topicCount } = await supabase
    .from("topics")
    .select("id, episodes!inner(course_id)", { count: "exact", head: true })
    .eq("episodes.course_id", episode.course_id);

  await supabase
    .from("courses")
    .update({
      episode_count: episodeCount ?? 0,
      topic_count: topicCount ?? 0,
    })
    .eq("id", episode.course_id);

  return NextResponse.json({ ok: true });
}
