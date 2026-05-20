import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/courses/[id]/exam-date
 *
 * Body: { examDate: "YYYY-MM-DD" | null, examLabel?: string | null }
 *
 * Sets or clears the exam date for a course. The dashboard's
 * ExamCountdownCard surfaces an auto-generated study plan when this is set.
 *
 * Authorization: the calling user must own the course (enforced by the
 * `user_id` filter on the UPDATE). RLS would also catch this, but explicit
 * ownership check makes the failure mode clearer.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { examDate?: string | null; examLabel?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate the date — must be either null/empty (to clear) or YYYY-MM-DD.
  let examDate: string | null = null;
  if (body.examDate !== null && body.examDate !== undefined && body.examDate !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.examDate)) {
      return NextResponse.json(
        { error: "examDate must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }
    examDate = body.examDate;
  }

  // Label is optional; cap length to keep things tidy.
  let examLabel: string | null = null;
  if (typeof body.examLabel === "string" && body.examLabel.trim().length > 0) {
    examLabel = body.examLabel.trim().slice(0, 64);
  }

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("courses")
    .update({
      exam_date: examDate,
      exam_label: examLabel,
    })
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .select("id, exam_date, exam_label")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Course not found or update failed" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    courseId: data.id,
    examDate: data.exam_date,
    examLabel: data.exam_label,
  });
}
