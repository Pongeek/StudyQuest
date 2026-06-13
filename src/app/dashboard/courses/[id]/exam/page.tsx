import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft, FileText, Clock, BookOpen, Gem, Target, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ExamUploadForm from "@/components/exam/ExamUploadForm";
import StartExamButton from "@/components/exam/StartExamButton";
import { countDueRunes, getCourseTopicIds } from "@/lib/runes-queue";

async function getExamData(courseId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, theme_name, user_id, status")
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .single();

  if (!course) return null;

  const { data: examFiles } = await supabase
    .from("course_files")
    .select("id, file_name, uploaded_at")
    .eq("course_id", courseId)
    .eq("file_type", "past_exam")
    .order("uploaded_at", { ascending: false });

  const fileIds = (examFiles || []).map((f: any) => f.id);

  let questionCounts: Record<string, number> = {};
  if (fileIds.length > 0) {
    const { data: counts } = await supabase
      .from("exam_questions")
      .select("source_file_id")
      .in("source_file_id", fileIds);

    for (const row of counts || []) {
      questionCounts[row.source_file_id] = (questionCounts[row.source_file_id] || 0) + 1;
    }
  }

  const { data: pastSessions } = await supabase
    .from("exam_sessions")
    .select("id, source_file_id, mode, completed_at, predicted_score, exam_readiness")
    .eq("user_id", dbUser.id)
    .in("source_file_id", fileIds.length > 0 ? fileIds : ["__none__"])
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(5);

  // Rune Cram availability — active (non-banished) cards across the course's
  // decks + how many are due now (countDueRunes owns the due definition).
  let runeCount = 0;
  let dueRuneCount = 0;
  const topicIds = await getCourseTopicIds(supabase, courseId);
  if (topicIds.length > 0) {
    const [{ count: cardCount }, dueCount] = await Promise.all([
      supabase
        .from("rune_cards")
        .select("id", { count: "exact", head: true })
        .in("topic_id", topicIds)
        .is("suspended_at", null),
      countDueRunes(supabase, dbUser.id, { topicIds }),
    ]);
    runeCount = cardCount ?? 0;
    dueRuneCount = runeCount > 0 ? dueCount : 0;
  }

  return {
    course,
    examFiles: examFiles || [],
    questionCounts,
    pastSessions: pastSessions || [],
    runeCount,
    dueRuneCount,
  };
}

export default async function ExamPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getExamData(courseId, userId);
  if (!data) notFound();

  const { course, examFiles, questionCounts, pastSessions, runeCount, dueRuneCount } = data;
  const isRTL = /[֐-׿؀-ۿ]/.test(course.title || "");

  return (
    <div className="max-w-2xl mx-auto space-y-8" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <Link
          href={`/dashboard/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-white mb-6 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Course
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">Exam Preparation</h1>
            <p className="text-slate-500 text-sm">
              Practice with real exam questions and get a predicted score.
            </p>
          </div>
        </div>
      </div>

      {/* Upload past exam */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <h2 className="font-bold text-white mb-4">Upload Past Exam</h2>
        <ExamUploadForm courseId={courseId} />
      </div>

      {/* Rune Cram — flip every deck in the course before the exam.
          Free drill: 0 XP, but every rating still recasts the card's
          SM-2 schedule. Hidden until at least one deck is forged. */}
      {runeCount > 0 && (
        <Link
          href={`/dashboard/runes?scope=course&courseId=${courseId}`}
          className="group block rpg-card rounded-2xl p-5 sm:p-6 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Gem className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white">Rune Cram</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Flip through the course&apos;s {runeCount} recall card
                {runeCount === 1 ? "" : "s"}
                {dueRuneCount > 0 ? ` — ${dueRuneCount} due now` : ""}.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Past exams list */}
      {examFiles.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-white">Past Exams</h2>
          {examFiles.map((file: any) => {
            const qCount = questionCounts[file.id] || 0;
            return (
              <div
                key={file.id}
                className="rpg-card rounded-xl p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{file.file_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {qCount} questions extracted · Uploaded{" "}
                      {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {qCount > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <StartExamButton
                      sourceFileId={file.id}
                      courseId={courseId}
                      mode="assisted"
                      label="Untimed Practice"
                      icon="book"
                    />
                    <StartExamButton
                      sourceFileId={file.id}
                      courseId={courseId}
                      mode="timed"
                      label="Timed Exam"
                      icon="clock"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Past sessions — clickable links to the review page */}
      {pastSessions.length > 0 && (
        <div className="rpg-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-bold text-white">Previous Attempts</h2>
            <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
              Tap to review
            </span>
          </div>
          <div className="space-y-3">
            {pastSessions.map((session: any) => {
              const readinessColors: Record<string, string> = {
                low: "text-red-400",
                moderate: "text-amber-400",
                high: "text-green-400",
                ready: "text-emerald-400",
              };
              return (
                <Link
                  key={session.id}
                  href={`/dashboard/courses/${courseId}/exam/${session.id}`}
                  aria-label={`Review attempt from ${new Date(session.completed_at).toLocaleDateString()} — ${Math.round(session.predicted_score)}%`}
                  className={cn(
                    "group flex items-center justify-between text-sm",
                    "bg-slate-800/30 hover:bg-slate-800/60 rounded-lg px-4 py-3",
                    "border border-transparent hover:border-indigo-500/30",
                    "transition-colors duration-150",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {session.mode === "timed" ? (
                      <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm text-white font-bold tabular-nums">
                        {Math.round(session.predicted_score)}%
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {new Date(session.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full border",
                        session.mode === "timed"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
                      )}
                    >
                      {session.mode}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold hidden sm:inline",
                        readinessColors[session.exam_readiness] || "text-slate-400",
                      )}
                    >
                      {session.exam_readiness}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all duration-150" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
