import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft, Loader2, BookOpen, Lock, Play, FileText, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MASTERY_LABELS, MASTERY_COLORS } from "@/lib/xp";
import { cn } from "@/lib/utils";
import CourseProcessingPoller from "@/components/course/CourseProcessingPoller";
import CourseMap from "@/components/course/CourseMap";
import ExamDateButton from "@/components/course/ExamDateButton";
import EpisodeUploadForm from "@/components/course/EpisodeUploadForm";
import EpisodeProcessingPoller from "@/components/course/EpisodeProcessingPoller";

async function getCourse(courseId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .single();

  if (!course) return null;

  const { data: episodes } = await supabase
    .from("episodes")
    .select("*, topics(*, user_topic_mastery(mastery_level, sessions_completed))")
    .eq("course_id", courseId)
    .order("order_index");

  const { data: examFiles } = await supabase
    .from("course_files")
    .select("id")
    .eq("course_id", courseId)
    .eq("file_type", "past_exam");

  const examFileCount = examFiles?.length ?? 0;

  let latestExamSession: any = null;
  if (examFileCount > 0) {
    const fileIds = examFiles!.map((f: any) => f.id);
    const { data: sessions } = await supabase
      .from("exam_sessions")
      .select("predicted_score, exam_readiness, completed_at")
      .eq("user_id", dbUser.id)
      .in("source_file_id", fileIds)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1);
    latestExamSession = sessions?.[0] ?? null;
  }

  // Fetch boss fight sessions for all episodes
  const episodeIds = (episodes || []).map((ep: any) => ep.id);
  let bossFightMap: Record<string, { passed: boolean; bestScore: number }> = {};
  if (episodeIds.length > 0) {
    const { data: bfSessions } = await supabase
      .from("boss_fight_sessions")
      .select("episode_id, passed, score_pct")
      .eq("user_id", dbUser.id)
      .in("episode_id", episodeIds)
      .not("completed_at", "is", null);

    for (const s of bfSessions || []) {
      const existing = bossFightMap[s.episode_id];
      if (!existing || s.score_pct > existing.bestScore) {
        bossFightMap[s.episode_id] = {
          passed: existing?.passed || s.passed,
          bestScore: Math.max(existing?.bestScore ?? 0, Number(s.score_pct)),
        };
      }
    }
  }

  return { course, episodes: episodes || [], dbUserId: dbUser.id, examFileCount, latestExamSession, bossFightMap };
}

function getMasteryForTopic(topic: any, dbUserId: string) {
  const mastery = topic.user_topic_mastery?.find(
    (m: any) => m !== undefined
  );
  return mastery?.mastery_level ?? 0;
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evolved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const result = await getCourse(id, userId);
  if (!result) notFound();

  // Parse ?evolved=topicId:fromLevel:toLevel from URL so the CourseMap can
  // play the one-shot mastery-evolution celebration on the matching node.
  // Cleared client-side via router.replace() after the animation plays.
  let evolutionEvent: { topicId: string; fromLevel: number; toLevel: number } | null = null;
  if (sp.evolved) {
    const parts = sp.evolved.split(":");
    if (parts.length === 3) {
      const fromLevel = Number(parts[1]);
      const toLevel = Number(parts[2]);
      if (
        parts[0] &&
        Number.isInteger(fromLevel) && Number.isInteger(toLevel) &&
        toLevel > fromLevel && toLevel >= 1 && toLevel <= 5
      ) {
        evolutionEvent = { topicId: parts[0], fromLevel, toLevel };
      }
    }
  }

  const { course, episodes, dbUserId, examFileCount, latestExamSession, bossFightMap } = result;

  if (course.status === "processing") {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-white mb-8 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="rpg-card rounded-2xl p-6 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/[0.04] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <h1 className="text-xl font-extrabold text-white mb-3">{course.title}</h1>
            <p className="text-slate-400 mb-2">The AI is analyzing your material and building your course map...</p>
            <p className="text-slate-600 text-sm">This usually takes 30-90 seconds depending on file size.</p>
            <CourseProcessingPoller courseId={id} />
          </div>
        </div>
      </div>
    );
  }

  if (course.status === "error") {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">There was an error processing your course.</p>
        <Link href="/dashboard/courses/new">
          <Button className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium">Try Again</Button>
        </Link>
      </div>
    );
  }

  const totalTopics = episodes.reduce((sum: number, ep: any) => sum + ep.topics.length, 0);
  const masteredTopics = episodes.reduce((sum: number, ep: any) => {
    return sum + ep.topics.filter((t: any) => {
      const m = t.user_topic_mastery?.[0];
      return m && m.mastery_level >= 2;
    }).length;
  }, 0);
  const progressPct = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;
  // Page direction logic — must consider THREE signals because the course
  // title may not contain the same script as the AI-generated content:
  //   1. Explicit `output_language` override on the course (most authoritative)
  //   2. RTL chars in the title (legacy / from-PDF auto-detection)
  //   3. RTL chars in the AI-generated theme_name (fallback)
  const isRTL =
    course.output_language === "he" ||
    /[֐-׿؀-ۿ]/.test(course.title || "") ||
    /[֐-׿؀-ۿ]/.test(course.theme_name || "");

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-white mb-6 text-sm transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </Link>

        <div className="rpg-card rounded-2xl overflow-hidden">
          {/* Top accent line */}
          <div className={cn(
            "h-px",
            progressPct === 100 ? "bg-emerald-500/40" : "bg-indigo-500/30"
          )} />

          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.07]">
                    <BookOpen className={cn("w-5 h-5", progressPct === 100 ? "text-emerald-400" : "text-indigo-400")} />
                  </div>
                  <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 text-xs font-bold">
                    {course.subject || "Course"}
                  </Badge>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {course.theme_name || course.title}
                </h1>
                {course.theme_name && <p className="text-slate-500 mt-1 text-sm">{course.title}</p>}
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-3xl font-extrabold tabular-nums tracking-tight",
                  progressPct === 100 ? "text-emerald-400" : "text-white"
                )}>
                  {progressPct}%
                </div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  {progressPct === 100 ? "Complete!" : "Progress"}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-slate-700/30">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    progressPct === 100 ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-500 font-semibold">{masteredTopics} / {totalTopics} topics mastered</p>
                <p className="text-xs text-slate-600 font-medium">{episodes.length} episodes</p>
              </div>
            </div>

            {/* Exam date — sets the countdown widget on the dashboard.
                When set, the dashboard generates a daily study plan. */}
            <div className="mt-5 pt-5 border-t border-slate-700/30">
              <ExamDateButton
                courseId={id}
                examDate={typeof course.exam_date === "string" ? course.exam_date : null}
                examLabel={typeof course.exam_label === "string" ? course.exam_label : null}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Exam Prep */}
      <Link href={`/dashboard/courses/${id}/exam`}>
        <div className="rpg-card rounded-2xl p-5 !border-amber-500/15 hover:!border-amber-500/35 transition-all duration-150 cursor-pointer relative overflow-hidden group">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Exam Preparation</h3>
                <p className="text-xs text-slate-400">
                  {examFileCount > 0
                    ? `${examFileCount} past exam${examFileCount > 1 ? "s" : ""} uploaded`
                    : "Upload past exams to practice"}
                </p>
              </div>
            </div>
            {latestExamSession && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-extrabold text-amber-400">
                  {Math.round(latestExamSession.predicted_score)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Add Episode — per-episode upload flow. Lets the user grow the
          course incrementally instead of trying to upload the whole
          textbook at once (which the AI struggles with at 300+ pages). */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white">Episodes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload one PDF per chapter / episode — the AI extracts topics for just that section.
          </p>
        </div>
        <EpisodeUploadForm courseId={id} />
      </div>

      {/* Auto-refresh while any episode is being AI-processed */}
      <EpisodeProcessingPoller
        courseId={id}
        processingCount={episodes.filter((e: any) => e.status === "processing").length}
      />

      {/* Course Map */}
      <CourseMap
        courseId={id}
        rtl={isRTL}
        evolutionEvent={evolutionEvent}
        episodes={episodes.map((episode: any) => ({
          id: episode.id,
          title: episode.title,
          topics: (() => {
            const sorted = episode.topics.sort((a: any, b: any) => a.order_index - b.order_index);
            // Build a mastery lookup for all topics in this episode
            const masteryByTopicId = new Map<string, number>();
            for (const t of sorted) {
              masteryByTopicId.set(t.id, t.user_topic_mastery?.[0]?.mastery_level ?? 0);
            }
            return sorted.map((topic: any, tIdx: number) => {
              const masteryData = topic.user_topic_mastery?.[0];
              const masteryLevel = masteryData?.mastery_level ?? 0;

              // TODO: Remove this bypass after testing — unlocks all topics
              const DEV_UNLOCK_ALL = true;
              if (DEV_UNLOCK_ALL) {
                return { id: topic.id, title: topic.title, difficulty: topic.difficulty, masteryLevel, sessionsCompleted: masteryData?.sessions_completed ?? 0, isUnlocked: true };
              }

              // Already attempted = always show as unlocked
              if (masteryLevel > 0) {
                return { id: topic.id, title: topic.title, difficulty: topic.difficulty, masteryLevel, sessionsCompleted: masteryData?.sessions_completed ?? 0, isUnlocked: true };
              }

              // First topic in episode is always unlocked
              if (tIdx === 0) {
                return { id: topic.id, title: topic.title, difficulty: topic.difficulty, masteryLevel, sessionsCompleted: 0, isUnlocked: true };
              }

              // If topic has a specific prerequisite, check that prerequisite's mastery
              if (topic.prerequisite_topic_id) {
                const prereqMastery = masteryByTopicId.get(topic.prerequisite_topic_id) ?? 0;
                return { id: topic.id, title: topic.title, difficulty: topic.difficulty, masteryLevel, sessionsCompleted: 0, isUnlocked: prereqMastery >= 1 };
              }

              // Fallback: require previous topic in sequence to be attempted
              const prevMastery = sorted[tIdx - 1]?.user_topic_mastery?.[0]?.mastery_level ?? 0;
              return { id: topic.id, title: topic.title, difficulty: topic.difficulty, masteryLevel, sessionsCompleted: 0, isUnlocked: prevMastery >= 1 };
            });
          })(),
          bossFight: (() => {
            const sorted = episode.topics.sort((a: any, b: any) => a.order_index - b.order_index);
            const allAtNovice = sorted.length > 0 && sorted.every(
              (t: any) => (t.user_topic_mastery?.[0]?.mastery_level ?? 0) >= 1
            );
            // TODO: Remove this bypass after testing — unlocks every episode boss
            const DEV_FORCE_BOSS_UNLOCK = true;
            const bfData = bossFightMap[episode.id];
            return {
              isUnlocked: DEV_FORCE_BOSS_UNLOCK || allAtNovice,
              isDefeated: bfData?.passed ?? false,
              bestScore: bfData?.bestScore ?? null,
            };
          })(),
        }))}
      />
    </div>
  );
}
