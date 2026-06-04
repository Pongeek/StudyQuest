import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeConfidenceAdjustedQuality,
  computeNextReviewFromQuality,
  describeConfidenceEffect,
  scoreToQuality,
  REVIEW_XP_PER_CORRECT,
  REVIEW_SESSION_BONUS_XP,
  type Confidence,
  type ConfidenceEffectKind,
} from "@/lib/spaced-repetition";
import { calculateLevel, getLevelTitle } from "@/lib/xp";
import { awardAchievementIfNew } from "@/lib/achievements";
import { getGrimoireDemons } from "@/app/api/grimoire/route";
import { computeStreakUpdate, getEarnedStreakTitle } from "@/lib/streak";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp, current_streak, longest_streak, last_study_date, streak_freeze_tokens")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify session belongs to this user
  const { data: session } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.completed_at) {
    return NextResponse.json({ error: "Session already completed" }, { status: 400 });
  }

  // Load all answers for this session. confidence (migration 023) feeds the
  // per-topic confidence-adjusted SM-2 schedule below.
  const { data: answers } = await supabase
    .from("review_answers")
    .select("question_id, topic_id, ai_score, confidence")
    .eq("review_session_id", sessionId);

  interface AnswerRow {
    question_id: string;
    topic_id: string;
    ai_score: number;
    confidence: Confidence;
  }

  const allAnswers: AnswerRow[] = (answers ?? []).map(
    (a: { question_id: string; topic_id: string; ai_score: number | null; confidence: string | null }) => ({
      question_id: a.question_id,
      topic_id: a.topic_id,
      ai_score: a.ai_score ?? 0,
      confidence: (a.confidence as Confidence) ?? null,
    }),
  );

  // Group full answer rows (score + confidence) by topic so each topic's
  // SR schedule folds in its own confidence ratings (per ADR-0001).
  const topicAnswers = new Map<string, Array<{ ai_score: number; confidence: Confidence }>>();
  for (const a of allAnswers) {
    const group = topicAnswers.get(a.topic_id) ?? [];
    group.push({ ai_score: a.ai_score, confidence: a.confidence });
    topicAnswers.set(a.topic_id, group);
  }

  // Count totals
  const totalAnswers = allAnswers.length;
  const correctAnswers = allAnswers.filter((a) => a.ai_score >= 0.7).length;
  const xpEarned = correctAnswers * REVIEW_XP_PER_CORRECT + REVIEW_SESSION_BONUS_XP;

  // Per-topic SR updates
  const perTopicResults: Array<{
    topicId: string;
    topicTitle: string;
    scorePct: number;
    oldInterval: number;
    newInterval: number;
    nextReviewAt: string;
    passed: boolean;
    /** Topic-mastery evolution event for this review topic. Set when the
     *  topic's score was strong enough (>= 85%) AND it had room to evolve
     *  (current mastery_level < 5). Surfaced inline in ReviewSummary. */
    evolved: { fromLevel: number; toLevel: number } | null;
  }> = [];

  // Threshold above which a review answer cluster on a topic counts as
  // "mastery-bumping" evidence. 85% mirrors the "consecutive good scores"
  // threshold used by quiz mastery calculations in lib/xp.ts.
  const REVIEW_EVOLUTION_THRESHOLD = 85;

  for (const [topicId, topicAnswerRows] of topicAnswers.entries()) {
    // scorePct (raw accuracy) drives the display + mastery-evolution gate.
    // The SR interval is driven separately by the confidence-adjusted
    // quality below — a confident-but-wrong topic can reset to 1 day even
    // when its raw scorePct looks middling (ADR-0001, undampened fold).
    const scorePct =
      topicAnswerRows.length > 0
        ? (topicAnswerRows.reduce((s, a) => s + a.ai_score, 0) /
            topicAnswerRows.length) *
          100
        : 0;

    // Fetch current SR state + mastery_level for this topic
    const { data: mastery } = await supabase
      .from("user_topic_mastery")
      .select("review_interval_days, ease_factor, review_count, mastery_level, topics(title)")
      .eq("user_id", dbUser.id)
      .eq("topic_id", topicId)
      .single();

    const currentState = {
      intervalDays: (mastery as any)?.review_interval_days ?? 1,
      easeFactor: (mastery as any)?.ease_factor ?? 2.5,
      reviewCount: (mastery as any)?.review_count ?? 0,
    };
    const currentMasteryLevel: number = (mastery as any)?.mastery_level ?? 0;

    // Per-topic, undampened confidence fold (ADR-0001). A topic with no
    // confidence ratings has zero confidence influence — its quality is the
    // pure avg-of-per-answer-qualities, exactly mirroring the Quiz unrated
    // path (NOT quality-of-avg-score; the two diverge on multi-answer topics,
    // see the spaced-repetition unit test).
    const adjustedQuality = computeConfidenceAdjustedQuality(topicAnswerRows);
    const nextSr = computeNextReviewFromQuality(adjustedQuality, currentState);

    // Decide whether this topic evolves this review session.
    let evolved: { fromLevel: number; toLevel: number } | null = null;
    let newMasteryLevel = currentMasteryLevel;
    if (scorePct >= REVIEW_EVOLUTION_THRESHOLD && currentMasteryLevel < 5) {
      newMasteryLevel = currentMasteryLevel + 1;
      evolved = { fromLevel: currentMasteryLevel, toLevel: newMasteryLevel };
    }

    // Update mastery row — SR fields always, mastery_level only when bumped.
    const update: Record<string, unknown> = {
      last_reviewed_at: new Date().toISOString(),
      next_review_at: nextSr.nextReviewAt.toISOString(),
      review_interval_days: nextSr.intervalDays,
      ease_factor: nextSr.easeFactor,
      review_count: nextSr.reviewCount,
    };
    if (evolved) {
      update.mastery_level = newMasteryLevel;
    }

    await supabase
      .from("user_topic_mastery")
      .update(update)
      .eq("user_id", dbUser.id)
      .eq("topic_id", topicId);

    perTopicResults.push({
      topicId,
      topicTitle: (mastery as any)?.topics?.title ?? "Unknown topic",
      scorePct: Math.round(scorePct),
      oldInterval: currentState.intervalDays,
      newInterval: nextSr.intervalDays,
      nextReviewAt: nextSr.nextReviewAt.toISOString(),
      passed: scorePct >= 70,
      evolved,
    });
  }

  // ── Session-wide confidence chip (A2 Slice 2) ───────────────────────────────
  // Mirrors the Quiz /complete path: one chip narrating the strongest
  // confidence signal across the WHOLE session (all topics combined). The
  // per-topic SR scheduling above stays per-topic (ADR-0001); this is purely
  // a summary signal. Reuses the shared describeConfidenceEffect with
  // session-wide inputs so the Quiz priority (overconfident-stumble >
  // confident-mastery > lucky-win) carries over for free.
  const sessionFoldAnswers = allAnswers.map((a) => ({
    ai_score: a.ai_score,
    confidence: a.confidence,
  }));
  const sessionScorePct =
    totalAnswers > 0
      ? (sessionFoldAnswers.reduce((s, a) => s + a.ai_score, 0) / totalAnswers) *
        100
      : 0;
  const sessionAdjustedQuality = computeConfidenceAdjustedQuality(sessionFoldAnswers);
  const sessionBaseQuality = scoreToQuality(sessionScorePct);
  const rawConfidenceEffect = describeConfidenceEffect({
    answers: sessionFoldAnswers,
    adjustedQuality: sessionAdjustedQuality,
    baseQuality: sessionBaseQuality,
  });

  // Re-voice the shared (singular) line for Review's multi-topic context
  // WITHOUT mutating describeConfidenceEffect (Quiz must stay untouched). The
  // chip's `kind` keeps the Quiz priority + visual treatment; only the copy
  // pluralizes. Returns null cleanly when no signal qualifies.
  const REVIEW_CONFIDENCE_LINES: Record<ConfidenceEffectKind, string> = {
    "overconfident-stumble":
      "Confident but stumbled — those trials return sooner.",
    "confident-mastery":
      "Mastered with confidence — pushed deeper into the queue.",
    "lucky-win": "Lucky guesses — back on the queue soon.",
  };
  const confidenceEffect = rawConfidenceEffect
    ? {
        kind: rawConfidenceEffect.kind,
        line: REVIEW_CONFIDENCE_LINES[rawConfidenceEffect.kind],
      }
    : null;

  // Update user XP and streak (with freeze-token forgiveness)
  const today = new Date().toISOString().split("T")[0];
  const streakResult = computeStreakUpdate({
    currentStreak: dbUser.current_streak || 0,
    freezeTokens: dbUser.streak_freeze_tokens ?? 0,
    lastStudyDate: dbUser.last_study_date,
    today,
  });
  const newStreak = streakResult.newStreak;
  const newLongestStreak = Math.max(dbUser.longest_streak || 0, newStreak);

  // Streak Title (B1) — did this session cross a 7/14/30/60/100-day milestone?
  const earnedStreakTitle = getEarnedStreakTitle(
    dbUser.current_streak || 0,
    newStreak,
  );

  const oldTotalXp = dbUser.total_xp || 0;
  const newTotalXp = oldTotalXp + xpEarned;

  await supabase
    .from("users")
    .update({
      total_xp: newTotalXp,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      last_study_date: today,
      streak_freeze_tokens: streakResult.newFreezeTokens,
    })
    .eq("id", dbUser.id);

  // Mark review session complete
  await supabase
    .from("review_sessions")
    .update({
      completed_at: new Date().toISOString(),
      xp_earned: xpEarned,
      question_count: totalAnswers,
      correct_count: correctAnswers,
      per_topic_results: perTopicResults,
    })
    .eq("id", sessionId);

  // Check review-specific achievements
  const newAchievements = await checkReviewAchievements({
    userId: dbUser.id,
    supabase,
  });

  // ── Grimoire-specific achievement: Exorcist ─────────────────────────────────
  // If this was a grimoire session, check whether all demons are now settled.
  if (session.source === "grimoire") {
    try {
      const remainingDemons = await getGrimoireDemons(dbUser.id);
      const allCleared =
        remainingDemons.length > 0 &&
        remainingDemons.every((d) => d.isSettled);

      if (allCleared) {
        const exorcist = await awardAchievementIfNew({
          userId: dbUser.id,
          slug: "exorcist",
          supabase,
        });
        if (exorcist) newAchievements.push(exorcist);
      }
    } catch {
      // Non-fatal — don't break the completion response
    }
  }

  // Award all achievement XP bonuses in one update
  if (newAchievements.length > 0) {
    const xpBonus = newAchievements.reduce(
      (sum: number, a: { xp_reward: number }) => sum + (a.xp_reward || 0),
      0
    );
    if (xpBonus > 0) {
      await supabase
        .from("users")
        .update({ total_xp: newTotalXp + xpBonus })
        .eq("id", dbUser.id);
    }
  }

  // Level-up detection
  const oldLevel = calculateLevel(oldTotalXp);
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > oldLevel;

  return NextResponse.json({
    xpEarned,
    correctCount: correctAnswers,
    totalCount: totalAnswers,
    newStreak,
    perTopicResults,
    confidenceEffect,
    newAchievements,
    leveledUp,
    oldLevel,
    newLevel,
    newRank: leveledUp && getLevelTitle(oldLevel) !== getLevelTitle(newLevel)
      ? getLevelTitle(newLevel)
      : undefined,
    streakAction: streakResult.action,
    freezeTokensUsed: streakResult.tokensUsed,
    freezeTokenEarned: streakResult.tokenEarned,
    freezeTokensRemaining: streakResult.newFreezeTokens,
    streakTitleEarned: earnedStreakTitle?.title ?? null,
  });
}

async function checkReviewAchievements({
  userId,
  supabase,
}: {
  userId: string;
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>;
}) {
  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*")
    .in("condition_type", ["review_days"]);

  if (!allAchievements || allAchievements.length === 0) return [];

  const { data: earned } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const earnedIds = new Set((earned || []).map((e: any) => e.achievement_id));

  // Count distinct days with completed review sessions
  const { data: reviewDays } = await supabase
    .from("review_sessions")
    .select("completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const distinctDays = new Set(
    (reviewDays || []).map((r: any) =>
      new Date(r.completed_at).toISOString().split("T")[0]
    )
  ).size;

  const toAward: string[] = [];
  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;
    if (ach.condition_type === "review_days" && distinctDays >= ach.condition_value) {
      toAward.push(ach.id);
    }
  }

  if (toAward.length === 0) return [];

  await supabase.from("user_achievements").insert(
    toAward.map((id) => ({ user_id: userId, achievement_id: id }))
  );

  return allAchievements
    .filter((a: any) => toAward.includes(a.id))
    .map((a: any) => ({
      slug: a.slug,
      name: a.name,
      icon: a.icon,
      description: a.description,
      xp_reward: a.xp_reward,
    }));
}
