import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft, BookOpen, Star, Zap, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MASTERY_LABELS, MASTERY_COLORS, MASTERY_BG } from "@/lib/xp";
import { cn } from "@/lib/utils";
import StartQuizButton from "@/components/quiz/StartQuizButton";
import TopicPDFViewer from "@/components/course/TopicPDFViewerClient";
import TopicMasteryPanel from "@/components/course/TopicMasteryPanel";

async function getTopicData(topicId: string, courseId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return null;

  const { data: topic } = await supabase
    .from("topics")
    .select("*, episodes!inner(course_id, title)")
    .eq("id", topicId)
    .single();

  if (!topic || (topic.episodes as any).course_id !== courseId) return null;

  const { data: mastery } = await supabase
    .from("user_topic_mastery")
    .select("*")
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId)
    .single();

  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .eq("topic_id", topicId);

  // Note: Recent-session list is now owned by TopicMasteryPanel, which
  // pulls a wider window (up to 10) plus per-session metadata. The old
  // 3-row fetch here is intentionally gone — keeping it would duplicate
  // queries for the same data the panel already loads.

  // Fetch source file info for PDF viewer
  let sourceFile: { file_id: string; file_url: string; file_name: string; page_count: number | null } | null = null;
  if (topic.source_file_id) {
    const { data: fileData } = await supabase
      .from("course_files")
      .select("id, file_url, file_name, page_count")
      .eq("id", topic.source_file_id)
      .single();

    if (fileData) {
      sourceFile = {
        file_id: fileData.id,
        file_url: fileData.file_url,
        file_name: fileData.file_name,
        page_count: fileData.page_count,
      };
    }
  }

  return {
    topic,
    mastery: mastery || null,
    hasQuestions: (questions?.length ?? 0) > 0,
    dbUserId: dbUser.id,
    courseId,
    sourceFile,
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  const { id: courseId, topicId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getTopicData(topicId, courseId, userId);
  if (!data) notFound();

  const { topic, mastery, hasQuestions, sourceFile, dbUserId } = data;
  const masteryLevel = mastery?.mastery_level ?? 0;
  const keyConcepts: string[] = Array.isArray(topic.key_concepts) ? topic.key_concepts : [];
  const difficultyDots = Array.from({ length: 5 }, (_, i) => i < topic.difficulty);

  // Source page info
  const sourcePages = topic.source_pages as { start: number; end: number } | null;
  const hasSourcePages = sourceFile && sourcePages && sourcePages.start && sourcePages.end;

  const isRTL = /[֐-׿؀-ۿ]/.test(topic.title || "");

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Course
      </Link>

      {/* Topic header */}
      <div className="rpg-card rounded-2xl overflow-hidden">
        {/* Mastery accent line */}
        <div className={cn(
          "h-px",
          masteryLevel >= 5 ? "bg-amber-400/40" :
          masteryLevel >= 3 ? "bg-blue-500/35" :
          masteryLevel >= 2 ? "bg-emerald-500/35" :
          "bg-indigo-500/30"
        )} />

        <div className="p-5 sm:p-8">
          <div className="flex items-start gap-3 sm:gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] border border-white/[0.07]">
              {masteryLevel >= 2 ? (
                <Star className={cn(
                  "w-5 h-5",
                  masteryLevel >= 5 ? "text-amber-400 fill-amber-400" :
                  masteryLevel >= 3 ? "text-blue-400" :
                  "text-emerald-400"
                )} />
              ) : (
                <BookOpen className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-600 truncate font-medium">{(topic.episodes as any).title}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{topic.title}</h1>
            </div>
            <Badge
              className={cn(
                "text-xs font-bold",
                MASTERY_COLORS[masteryLevel]
              )}
              variant="outline"
            >
              {MASTERY_LABELS[masteryLevel]}
            </Badge>
          </div>

          <p className="text-slate-400 leading-relaxed mb-6 text-sm">{topic.summary}</p>

          {keyConcepts.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-bold">Key Concepts</p>
              <div className="flex flex-wrap gap-2">
                {keyConcepts.map((concept: string) => (
                  <span
                    key={concept}
                    className="bg-indigo-500/10 border border-indigo-500/15 text-indigo-300 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-indigo-500/15 transition-colors"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-700/30">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="text-xs font-bold uppercase tracking-widest">Difficulty</span>
              <div className="flex items-center gap-1">
                {difficultyDots.map((filled, i) => (
                  <div key={i} className={cn("w-2 h-2 rounded-full transition-colors", filled ? "bg-amber-400" : "bg-slate-700/50")} />
                ))}
              </div>
            </div>
            {mastery && (
              <>
                <span className="text-slate-800">|</span>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">{mastery.sessions_completed} sessions</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PDF Study Material */}
      {hasSourcePages && (
        <TopicPDFViewer
          fileId={sourceFile.file_id}
          fileUrl={sourceFile.file_url}
          pageStart={sourcePages.start}
          pageEnd={sourcePages.end}
          totalPages={sourceFile.page_count ?? undefined}
          fileName={sourceFile.file_name}
        />
      )}

      {/* Mastery progression */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          Mastery Path
        </h2>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
          {MASTERY_LABELS.slice(1).map((label, i) => {
            const level = i + 1;
            const isReached = masteryLevel >= level;
            const isCurrent = masteryLevel === level;
            return (
              <div key={label} className="flex-1 text-center min-w-[60px]">
                <div
                  className={cn(
                    "w-full py-2.5 px-1 rounded-lg text-xs font-bold transition-all duration-300 relative",
                    isReached
                      ? cn(MASTERY_BG[level], MASTERY_COLORS[level])
                      : "bg-slate-800/50 text-slate-600",
                    isCurrent && "ring-2 ring-indigo-500 scale-105"
                  )}
                >
                  {isCurrent && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  )}
                  {label}
                </div>
                {/* Connector arrow — always reserve the slot so every cell
                    has the same height; the last tier hides the glyph. */}
                <div className="hidden sm:block text-center mt-1">
                  <span
                    className={cn(
                      "text-[8px]",
                      i === 4
                        ? "invisible"
                        : isReached
                        ? "text-slate-500"
                        : "text-slate-800"
                    )}
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start quiz CTA */}
      <div className="rpg-card rounded-2xl relative overflow-hidden">
        <div className="relative z-10 p-6 sm:p-8 text-center">
          <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Swords className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-lg font-extrabold text-white mb-2">
            {masteryLevel === 0 ? "Start Your Quest" : "Continue Training"}
          </h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            {masteryLevel === 0
              ? "Answer questions and earn XP to begin mastering this topic."
              : `You're at ${MASTERY_LABELS[masteryLevel]}. Keep going to reach the next tier!`}
          </p>
          <StartQuizButton
            topicId={topicId}
            courseId={courseId}
            hasExistingQuestions={hasQuestions}
          />
        </div>
      </div>

      {/* Per-topic mastery view — activity tiles, score sparkline,
          failed-question heatmap, and the full quest log (up to 10
          sessions). Renders nothing on a brand-new topic with zero
          completed sessions; the CTA above is the entry point in that case. */}
      <TopicMasteryPanel
        topicId={topicId}
        courseId={courseId}
        dbUserId={dbUserId}
      />
    </div>
  );
}
