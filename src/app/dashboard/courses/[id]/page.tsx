import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft, Loader2, BookOpen, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CourseProcessingPoller from "@/components/course/CourseProcessingPoller";
import CourseMap from "@/components/course/CourseMap";
import ExamDateButton from "@/components/course/ExamDateButton";
import EpisodeUploadForm from "@/components/course/EpisodeUploadForm";
import EpisodeProcessingPoller from "@/components/course/EpisodeProcessingPoller";
import ProcessingEpisodesBanner from "@/components/course/ProcessingEpisodesBanner";
import FailedEpisodesBanner from "@/components/course/FailedEpisodesBanner";
import DeleteCourseDialog from "@/components/course/DeleteCourseDialog";
import CourseStudyReport from "@/components/course/CourseStudyReport";

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

  // Count completed quiz sessions across all this course's topics — used
  // to convey the weight of deletion in DeleteCourseDialog.
  const topicIds: string[] = [];
  for (const ep of episodes || []) {
    for (const t of ep.topics || []) topicIds.push(t.id);
  }
  let sessionsCount = 0;
  if (topicIds.length > 0) {
    const { count } = await supabase
      .from("quiz_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id)
      .in("topic_id", topicIds)
      .not("completed_at", "is", null);
    sessionsCount = count ?? 0;
  }

  return {
    course,
    episodes: episodes || [],
    dbUserId: dbUser.id,
    examFileCount,
    latestExamSession,
    bossFightMap,
    sessionsCount,
  };
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

  const { course, episodes, dbUserId, examFileCount, latestExamSession, bossFightMap, sessionsCount } = result;

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

        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: "rgba(8, 6, 25, 0.84)",
            backdropFilter: "blur(20px)",
            border: `1px solid ${progressPct === 100 ? "rgba(16, 185, 129, 0.22)" : "rgba(99, 102, 241, 0.20)"}`,
            boxShadow: progressPct === 100
              ? "0 0 0 1px rgba(16,185,129,0.06), 0 8px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.045)"
              : "0 0 0 1px rgba(99,102,241,0.06), 0 8px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.045)",
          }}
        >
          {/* Top accent line — matches DashboardHeroCard indigo seam */}
          <div className={cn(
            "absolute top-0 inset-x-0 h-px",
            progressPct === 100
              ? "bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
              : "bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"
          )} />

          {/* Dot-matrix HUD texture — same primitive used by the dashboard hero */}
          <div className="absolute inset-0 hud-hero-texture rounded-2xl pointer-events-none" />

          {/* Pixel nail corners — progress-colored, Tier A signature */}
          {(() => {
            const nail = progressPct === 100 ? "bg-emerald-400" : "bg-indigo-400";
            return (
              <>
                <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nail)} />
                <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nail)} />
                <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nail)} />
                <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nail)} />
              </>
            );
          })()}

          <div className="relative p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className={cn(
                    "w-11 h-11 pixel-border bg-white/[0.04] flex items-center justify-center shrink-0",
                    progressPct === 100 ? "text-emerald-400" : "text-indigo-400"
                  )}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  {/* Subject chip styled as a rank-chip — matches dashboard hero vocabulary */}
                  <span className="rank-chip rank-chip-shimmer">
                    <span aria-hidden="true" className="opacity-50">&#9670;</span>
                    <span>{(course.subject || "COURSE").toUpperCase()}</span>
                    <span aria-hidden="true" className="opacity-50">&#9670;</span>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight">
                  {course.theme_name || course.title}
                </h1>
                {course.theme_name && (
                  <p className="text-slate-500 mt-1.5 text-sm truncate">{course.title}</p>
                )}
              </div>

              {/* Percent HUD — pixel-bordered scoreboard with Press Start 2P numerals */}
              <div className={cn(
                "shrink-0 inline-flex flex-col items-center justify-center px-4 py-3 pixel-border bg-slate-950/40 min-w-[110px]",
                progressPct === 100 ? "text-emerald-400" : "text-indigo-300"
              )}>
                <span className="font-pixel text-[9px] tracking-wider opacity-80 mb-1">
                  {progressPct === 100 ? "COMPLETE" : "PROGRESS"}
                </span>
                <span className={cn(
                  "font-pixel tracking-tight tabular-nums leading-none",
                  progressPct >= 100 ? "text-[20px]" : "text-[22px]"
                )}>
                  {progressPct}%
                </span>
              </div>
            </div>

            {/* Pixel XP bar — matches the dashboard hero progress vocabulary */}
            <div className="mt-6 pt-5 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="stat-label text-amber-500/70">MASTERY PROGRESS</span>
                <span className="text-[11px] text-slate-400 tabular-nums font-medium">
                  {masteredTopics} / {totalTopics}
                </span>
              </div>
              <div
                className="pixel-xp-bar"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Course mastery progress: ${progressPct}% complete`}
              >
                <div
                  className="pixel-xp-bar-fill"
                  style={{
                    width: `${progressPct}%`,
                    ...(progressPct === 100
                      ? {
                          background:
                            "linear-gradient(90deg, #047857, #059669 40%, #10b981 75%, #34d399 100%)",
                        }
                      : {}),
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="stat-label text-slate-600">{episodes.length} {episodes.length === 1 ? "EPISODE" : "EPISODES"}</span>
                <span className="stat-label text-indigo-400/50">
                  {progressPct === 100 ? "MASTERED" : `${100 - progressPct}% TO GO`}
                </span>
                <span className="stat-label text-slate-600">{totalTopics} {totalTopics === 1 ? "TOPIC" : "TOPICS"}</span>
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

            {/* Danger zone — quiet by design so it never competes with the
                primary actions. Placed at the bottom of the hero card so
                power users can find it but new users won't trip on it. */}
            <div className="mt-5 pt-4 border-t border-slate-700/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400">Danger zone</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Permanently remove this course and everything inside it.
                </p>
              </div>
              <DeleteCourseDialog
                courseId={id}
                courseName={course.theme_name || course.title}
                stats={{
                  episodes: episodes.length,
                  topics: totalTopics,
                  sessions: sessionsCount,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly study report — last-7d activity across quiz/boss/review for
          this course, plus weakest-topics callout. Renders nothing if the
          user has no recent activity AND no exam date. */}
      <CourseStudyReport
        dbUserId={dbUserId}
        topicIds={episodes.flatMap((ep: any) => (ep.topics || []).map((t: any) => t.id))}
        episodeIds={episodes.map((ep: any) => ep.id)}
        examDate={course.exam_date ?? null}
      />

      {/* Exam Prep — Tier A: amber pixel-border + nails + pixel-font micro-label */}
      <Link href={`/dashboard/courses/${id}/exam`} className="block group">
        <div className="relative bg-slate-900/95 pixel-border text-amber-500/80 p-5 transition-transform duration-100 group-hover:translate-y-0.5 group-active:translate-y-1">
          {/* Pixel nails */}
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

          <div className="relative z-[1] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 pixel-border bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-1">
                  EXAM PREPARATION
                </div>
                <p className="text-xs text-slate-400">
                  {examFileCount > 0
                    ? `${examFileCount} past exam${examFileCount > 1 ? "s" : ""} uploaded`
                    : "Upload past exams to practice"}
                </p>
              </div>
            </div>
            {latestExamSession && (
              <div className="shrink-0 inline-flex items-center gap-1.5 pixel-border bg-amber-500/10 text-amber-400 px-3 py-1.5">
                <Target className="w-4 h-4" />
                <span className="font-pixel text-[10px] tracking-wider tabular-nums">
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

      {/* Auto-refresh while any episode is being AI-processed + fire
          transition toasts when episodes go processing → ready/error.
          The poller takes the full status list so it can diff across
          refreshes; no separate query needed. */}
      <EpisodeProcessingPoller
        courseId={id}
        episodes={episodes.map((e: any) => ({
          id: e.id,
          title: e.title,
          status: e.status,
        }))}
      />

      {/* Processing banner — visible "AI is forging your episode" status
          above the CourseMap with per-episode elapsed-time. Renders null
          when nothing is in flight. Pulling processing episodes OUT of
          CourseMap below means the map only shows ready episodes,
          which avoids the broken "empty episode card" we used to get. */}
      <ProcessingEpisodesBanner
        episodes={episodes
          .filter((e: any) => e.status === "processing")
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            startedAt: e.created_at,
          }))}
      />

      {/* Failed banner — shows episodes whose extraction errored, with
          the user-facing reason from `episodes.error_message`. Persistent
          until the user deletes the row. Filtered out of CourseMap below
          for the same reason as processing — an error episode has no
          topics so it would render as a broken empty card. */}
      <FailedEpisodesBanner
        episodes={episodes
          .filter((e: any) => e.status === "error")
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            errorMessage: (e.error_message as string | null) ?? null,
          }))}
      />

      {/* Course Map — only ready episodes from here. Processing + error
          episodes own their own banners above; the map shouldn't render
          them because their topics array is empty. */}
      <CourseMap
        courseId={id}
        rtl={isRTL}
        evolutionEvent={evolutionEvent}
        episodes={episodes
          .filter((e: any) => e.status === "ready")
          .map((episode: any) => ({
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
