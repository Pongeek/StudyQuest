import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * DELETE /api/courses/[id]
 *
 * Permanently removes a course and ALL of its cascaded children: episodes,
 * topics, questions, quiz_sessions / quiz_answers, boss_fight_sessions /
 * boss_fight_answers / boss_fight_questions, course_files (DB rows),
 * user_topic_mastery rows for those topics, daily_scrolls referencing
 * those topics, and any review_answers referencing those topics.
 *
 * The actual PDF files in Supabase Storage are NOT removed automatically
 * (FK CASCADE only applies to database rows). Those leave behind orphaned
 * files in the `course-files` bucket — harmless, just a few MB of quota.
 * If you want to clean those up too we can wire that up next.
 *
 * Authorization: must own the course (checked via the user_id filter).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Defensive ownership check: only delete the row when course.user_id matches
  // the calling user. The combined WHERE clause means a user-id mismatch
  // results in 0 rows affected, not an unauthorized cross-tenant delete.
  const { data, error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete course", detail: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Course not found or not yours" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
