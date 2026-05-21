import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { BookOpen, Plus, Sparkles, Swords, Map as MapIcon, Crown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import TodaysMission from "@/components/dashboard/TodaysMission";
import ReviewQueueCard from "@/components/dashboard/ReviewQueueCard";
import GrimoireWidget from "@/components/dashboard/GrimoireWidget";
import StreakWarningBanner from "@/components/dashboard/StreakWarningBanner";
import ExamCountdownCard from "@/components/dashboard/ExamCountdownCard";
import QuestBoard from "@/components/gamification/QuestBoard";
import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import { cn } from "@/lib/utils";
import { calculateLevel, xpProgressInCurrentLevel } from "@/lib/xp";
import {
  generateStudyPlan,
  type StudyPlan,
  type StudyPlanTopic,
  type StudyPlanEpisode,
} from "@/lib/study-plan";

async function getOrCreateUser(clerkId: string, email: string, name: string) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) return existing;

  const { data } = await supabase
    .from("users")
    .insert({ clerk_id: clerkId, name, email })
    .select()
    .single();

  return data;
}

async function getUserCourses(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("courses")
    .select("*, episodes(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data || [];
}

async function getRecentAchievements(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_achievements")
    .select("*, achievements(*)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .limit(3);

  return data || [];
}

async function getReviewQueue(userId: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("user_topic_mastery")
    .select("topic_id, next_review_at, topics(title)")
    .eq("user_id", userId)
    .not("next_review_at", "is", null)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    topicId: row.topic_id as string,
    topicTitle: (row.topics?.title ?? "Unknown topic") as string,
  }));
}

/**
 * Quest Board recommendations.
 *
 * Surfaces the user's next 3 unmastered topics IN CURRICULUM ORDER —
 * sorted by (course created order, episode.order_index, topic.order_index).
 * This guarantees topic 1.1 surfaces before topic 3.3 when both are
 * unattempted, instead of whatever order Supabase happened to return rows in.
 *
 * Unmastered = mastery_level < 2 (covers both "never attempted" and
 * "attempted but still weak"). Both deserve to be on the board; curriculum
 * order picks the natural next-thing-to-study.
 */
async function getRecommendations(userId: string) {
  const supabase = createServiceClient();

  // 1) All ready courses with their episodes + topics. We DON'T fetch
  // user_topic_mastery via nested join here because Supabase nested selects
  // don't accept the user_id filter at the deepest level — we'd get every
  // user's mastery for these topics. Two queries + JS join instead.
  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, theme_name, episodes(id, order_index, topics(id, title, order_index))"
    )
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: true });

  if (!courses || courses.length === 0) return [];

  // 2) Collect every topic id, then look up the user's mastery in one round-trip
  const allTopicIds: string[] = [];
  for (const course of courses as any[]) {
    for (const episode of course.episodes || []) {
      for (const topic of episode.topics || []) {
        allTopicIds.push(topic.id);
      }
    }
  }
  if (allTopicIds.length === 0) return [];

  const { data: masteryRows } = await supabase
    .from("user_topic_mastery")
    .select("topic_id, mastery_level")
    .eq("user_id", userId)
    .in("topic_id", allTopicIds);

  const masteryByTopic = new Map<string, number>(
    (masteryRows || []).map((r: any) => [r.topic_id as string, (r.mastery_level as number) ?? 0])
  );

  // 3) Walk every course in curriculum order, collecting unmastered topics
  type Recommendation = {
    topicId: string;
    topicTitle: string;
    courseId: string;
    courseName: string;
    masteryLevel: number;
  };

  const candidates: Recommendation[] = [];
  for (const course of courses as any[]) {
    const sortedEpisodes = (course.episodes || [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const episode of sortedEpisodes) {
      const sortedTopics = (episode.topics || [])
        .slice()
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      for (const topic of sortedTopics) {
        const masteryLevel = masteryByTopic.get(topic.id) ?? 0;
        if (masteryLevel >= 2) continue; // skip already-mastered topics
        candidates.push({
          topicId: topic.id,
          topicTitle: topic.title,
          courseId: course.id,
          courseName: course.theme_name || course.title,
          masteryLevel,
        });
      }
    }
  }

  return candidates.slice(0, 3);
}

/**
 * Build StudyPlan inputs for every course this user owns that has an
 * `exam_date` set. Returns generated plans sorted by urgency (soonest first).
 */
async function getStudyPlans(userDbId: string) {
  const supabase = createServiceClient();

  // 1) Courses with an exam_date set (status must be ready — others have no topics yet)
  const { data: examCourses } = await supabase
    .from("courses")
    .select("id, title, theme_name, exam_date, exam_label")
    .eq("user_id", userDbId)
    .eq("status", "ready")
    .not("exam_date", "is", null);

  if (!examCourses || examCourses.length === 0) return [];

  // 2) For each course, pull episodes + topics + mastery + boss status
  const courseIds = examCourses.map((c: any) => c.id);

  const [episodesRes, topicsRes, masteryRes, bossRes] = await Promise.all([
    supabase
      .from("episodes")
      .select("id, title, course_id")
      .in("course_id", courseIds),
    supabase
      .from("topics")
      .select("id, title, episode_id, order_index, episodes!inner(course_id)")
      .in("episodes.course_id", courseIds),
    supabase
      .from("user_topic_mastery")
      .select("topic_id, mastery_level, next_review_at")
      .eq("user_id", userDbId),
    supabase
      .from("boss_fight_sessions")
      .select("episode_id, passed")
      .eq("user_id", userDbId)
      .eq("passed", true),
  ]);

  const episodes = episodesRes.data || [];
  const topics = topicsRes.data || [];
  const masteryByTopic = new Map<string, { level: number; nextReview: string | null }>(
    (masteryRes.data || []).map((m: any) => [
      m.topic_id as string,
      { level: m.mastery_level as number, nextReview: m.next_review_at as string | null },
    ])
  );
  const defeatedBosses = new Set(
    (bossRes.data || []).map((b: any) => b.episode_id as string)
  );

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const plans: StudyPlan[] = [];
  for (const course of examCourses) {
    const courseEpisodes = episodes.filter((e: any) => e.course_id === course.id);
    const courseEpisodeIds = new Set(courseEpisodes.map((e: any) => e.id));
    const courseTopics = topics.filter((t: any) => courseEpisodeIds.has(t.episode_id));

    // Map topics → StudyPlanTopic
    const planTopics: StudyPlanTopic[] = courseTopics.map((t: any) => ({
      topicId: t.id,
      topicTitle: t.title,
      episodeId: t.episode_id,
      episodeTitle:
        courseEpisodes.find((e: any) => e.id === t.episode_id)?.title || "Episode",
      masteryLevel: masteryByTopic.get(t.id)?.level ?? 0,
      orderIndex: t.order_index ?? 0,
    }));

    // Map episodes → StudyPlanEpisode (boss unlocked when ALL topics ≥ 1)
    const planEpisodes: StudyPlanEpisode[] = courseEpisodes.map((e: any) => {
      const epTopics = planTopics.filter((t) => t.episodeId === e.id);
      const bossUnlocked =
        epTopics.length > 0 && epTopics.every((t) => t.masteryLevel >= 1);
      return {
        episodeId: e.id,
        episodeTitle: e.title,
        bossUnlocked,
        bossDefeated: defeatedBosses.has(e.id),
      };
    });

    // Reviews due in this course
    const dueReviewTopicIds = planTopics
      .map((t) => t.topicId)
      .filter((id) => {
        const m = masteryByTopic.get(id);
        return m?.nextReview && m.nextReview.slice(0, 10) <= todayISO;
      });

    const plan = generateStudyPlan({
      courseId: course.id,
      courseTitle: course.theme_name || course.title,
      examDate: new Date(course.exam_date + "T00:00:00"),
      examLabel: course.exam_label || null,
      allTopics: planTopics,
      episodes: planEpisodes,
      dueReviewTopicIds,
      today,
    });
    plans.push(plan);
  }

  // Sort: most-urgent first. Past exams sink to the bottom.
  plans.sort((a, b) => {
    if (a.urgency === "past" && b.urgency !== "past") return 1;
    if (a.urgency !== "past" && b.urgency === "past") return -1;
    return a.daysUntilExam - b.daysUntilExam;
  });

  return plans;
}

async function getGrimoireCount(userId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data: sessions } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("user_id", userId);

  if (!sessions || sessions.length === 0) return 0;

  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("question_id, ai_score")
    .in("session_id", sessions.map((s: any) => s.id));

  if (!answers) return 0;

  const failMap = new Map<string, number>();
  for (const ans of answers) {
    if (ans.ai_score < 0.5) {
      failMap.set(ans.question_id, (failMap.get(ans.question_id) ?? 0) + 1);
    }
  }

  return [...failMap.values()].filter((count) => count >= 2).length;
}

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const email = (sessionClaims?.email as string) || "";
  const name =
    ((sessionClaims?.firstName as string) || "") +
    " " +
    ((sessionClaims?.lastName as string) || "");

  const dbUser = await getOrCreateUser(userId, email, name.trim() || "Adventurer");
  if (!dbUser) redirect("/sign-in");

  const [courses, recentAchievements, recommendations, reviewQueue, grimoireCount, studyPlans] = await Promise.all([
    getUserCourses(dbUser.id),
    getRecentAchievements(dbUser.id),
    getRecommendations(dbUser.id),
    getReviewQueue(dbUser.id),
    getGrimoireCount(dbUser.id),
    getStudyPlans(dbUser.id),
  ]);

  const level = calculateLevel(dbUser.total_xp || 0);
  const xpProgress = xpProgressInCurrentLevel(dbUser.total_xp || 0);
  const totalSessions = dbUser.total_sessions || 0;
  const streak = dbUser.current_streak || 0;
  const isHotStreak = streak >= 7;

  const today = new Date().toISOString().slice(0, 10);
  const lastStudyDate =
    typeof dbUser.last_study_date === "string"
      ? dbUser.last_study_date.slice(0, 10)
      : null;
  const studiedToday = lastStudyDate === today;
  const primaryRec = recommendations[0];
  const nextQuestHref = primaryRec
    ? `/dashboard/courses/${primaryRec.courseId}/topics/${primaryRec.topicId}`
    : courses.length > 0
    ? `/dashboard/courses/${courses[0].id}`
    : "/dashboard/courses/new";

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const showStreakWarning =
    streak > 0 && !studiedToday && lastStudyDate === yesterday;

  return (
    <div className="space-y-8">
      {/* ── Streak warning banner ── */}
      {showStreakWarning && (
        <StreakWarningBanner streak={streak} href={nextQuestHref} />
      )}

      {/* ── Hero Stats Bar ── */}
      <DashboardHeroCard
        level={level}
        xpProgress={xpProgress}
        dbUser={dbUser}
        studiedToday={studiedToday}
        streak={streak}
        isHotStreak={isHotStreak}
      />

      {/* ── Exam countdowns + auto-generated study plans ──
            One card per course with exam_date set, sorted by urgency
            (soonest first). Past exams sink to the bottom and render as
            a faded "was X days ago" chip — kept so the user can see their
            historical exams but not have them dominate the dashboard. */}
      {studyPlans.length > 0 && (
        <div className="space-y-4">
          {studyPlans.map((plan) => (
            <ExamCountdownCard key={plan.courseId} plan={plan} />
          ))}
        </div>
      )}

      {/* ── Review Queue (spaced repetition) — above Today's Mission ── */}
      {reviewQueue.length > 0 && (
        <ReviewQueueCard
          dueCount={reviewQueue.length}
          dueTopics={reviewQueue}
        />
      )}

      {/* ── Today's Mission (streak rescue) — time-sensitive, shown first ── */}
      <TodaysMission
        streak={streak}
        studiedToday={studiedToday}
        nextQuestHref={nextQuestHref}
      />

      {/* ── Mistake Grimoire widget ── */}
      <GrimoireWidget demonCount={grimoireCount} />

      {/* ── Quest Board (Recommended) ── */}
      <QuestBoard recommendations={recommendations} />

      {/* ── Your Realm (Courses) ── */}
      <section
        aria-labelledby="your-realm-heading"
        className="biome-realm animate-slide-up"
        style={{ animationDelay: "0.3s" }}
      >
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
              <MapIcon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="your-realm-heading"
                className="text-lg sm:text-xl font-bold leading-none text-white tracking-tight"
              >
                Your Realm
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                {courses.length === 0
                  ? "No worlds discovered yet"
                  : `${courses.length} ${courses.length === 1 ? "world" : "worlds"} discovered`}
              </p>
            </div>
          </div>
        </header>

        {courses.length === 0 ? (
          <div className="rpg-card rounded-2xl p-8 sm:p-14 text-center border-dashed">
            <div className="w-14 h-14 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              The map is blank&hellip;
            </h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm">
              Upload a course PDF to discover your first world and begin your quest.
            </p>
            <Link href="/dashboard/courses/new">
              <Button className="bg-indigo-500 hover:bg-indigo-400 text-white gap-2 font-medium">
                <Plus className="w-4 h-4" /> Discover Your First World
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course: any) => {
              const episodeCount = course.episode_count || 0;
              const topicCount = course.topic_count || 0;
              const completedTopics = course.completed_topics || 0;
              const progressPct =
                topicCount > 0
                  ? Math.round((completedTopics / topicCount) * 100)
                  : 0;

              const statusConfig =
                course.status === "ready"
                  ? {
                      badge: "READY",
                      className:
                        "border-green-700/50 text-green-400 bg-green-500/10",
                      glow: "shadow-green-500/10",
                      dot: "bg-green-400",
                    }
                  : course.status === "processing"
                  ? {
                      badge: "PROCESSING",
                      className:
                        "border-amber-700/50 text-amber-400 bg-amber-500/10 animate-pulse",
                      glow: "shadow-amber-500/10",
                      dot: "bg-amber-400 animate-pulse",
                    }
                  : {
                      badge: "ERROR",
                      className:
                        "border-red-700/50 text-red-400 bg-red-500/10",
                      glow: "shadow-red-500/10",
                      dot: "bg-red-400",
                    };

              return (
                <Link key={course.id} href={`/dashboard/courses/${course.id}`}>
                  <div
                    className={cn(
                      "rpg-card rounded-xl p-5 cursor-pointer group tilt-card sparkle-hover relative overflow-hidden h-full",
                      course.status === "ready" &&
                        "hover:ring-1 hover:ring-green-500/20"
                    )}
                  >
                    {/* Status accent line */}
                    <div
                      className={cn(
                        "absolute top-0 inset-x-0 h-0.5",
                        course.status === "ready"
                          ? "bg-gradient-to-r from-transparent via-green-400/40 to-transparent"
                          : course.status === "processing"
                          ? "bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
                          : "bg-gradient-to-r from-transparent via-red-400/40 to-transparent"
                      )}
                    />

                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.07]">
                        <BookOpen
                          className={cn(
                            "w-4.5 h-4.5",
                            course.status === "ready"
                              ? "text-indigo-400"
                              : "text-slate-500"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-pixel text-[8px] tracking-wider px-2 py-1 border inline-flex items-center gap-1.5",
                          statusConfig.className
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full inline-block",
                            statusConfig.dot
                          )}
                        />
                        {statusConfig.badge}
                      </span>
                    </div>

                    <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">
                      {course.theme_name || course.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {course.title}
                    </p>

                    {/* Progress bar */}
                    {course.status === "ready" && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-pixel text-[8px] tracking-wider text-slate-500">
                            PROGRESS
                          </span>
                          <span className="text-xs font-bold text-indigo-400 tabular-nums">
                            {progressPct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Zone / Encounter counts */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapIcon className="w-3 h-3" />
                        {episodeCount} {episodeCount === 1 ? "Zone" : "Zones"}
                      </span>
                      <span className="text-slate-700">/</span>
                      <span className="flex items-center gap-1">
                        <Swords className="w-3 h-3" />
                        {topicCount}{" "}
                        {topicCount === 1 ? "Encounter" : "Encounters"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* New World Portal card */}
            <Link href="/dashboard/courses/new" className="block h-full">
              <div className="rounded-xl p-5 cursor-pointer group h-full flex flex-col items-center justify-center text-center border border-dashed border-white/[0.09] hover:border-indigo-500/40 hover:bg-white/[0.015] transition-colors duration-200 min-h-[180px]">
                <div className="w-11 h-11 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center mb-3 group-hover:border-indigo-500/30 transition-colors duration-200">
                  <Plus className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                  Discover New World
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Upload a course to explore
                </p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* ── Achievements ── */}
      <section
        aria-labelledby="achievements-heading"
        className="biome-achievement animate-slide-up"
        style={{ animationDelay: "0.4s" }}
      >
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
              <Crown className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="achievements-heading"
                className="text-lg sm:text-xl font-bold leading-none text-white tracking-tight"
              >
                Achievements
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                {recentAchievements.length > 0
                  ? "Trophies from your journey"
                  : "Your trophy case awaits"}
              </p>
            </div>
          </div>
        </header>

        {recentAchievements.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentAchievements.map((ua: any) => (
              <div
                key={ua.id}
                className="rpg-card rounded-xl px-4 py-3.5 flex items-center gap-3.5 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-xl shrink-0">
                  {ua.achievements?.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {ua.achievements?.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {ua.achievements?.description}
                  </div>
                  {ua.earned_at && (
                    <div className="font-pixel text-[8px] tracking-wider text-slate-600 mt-1">
                      EARNED{" "}
                      {new Date(ua.earned_at)
                        .toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rpg-card rounded-xl p-6 text-center !border-slate-800/60">
            <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">
              Your adventure begins&hellip;
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Complete quests to earn your first achievement
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
