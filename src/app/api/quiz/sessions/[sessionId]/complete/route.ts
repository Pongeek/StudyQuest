import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateSessionDebrief } from "@/lib/ai/session-debrief";
import { calculateSessionXp, calculateMasteryLevel } from "@/lib/xp";
import {
  computeConfidenceAdjustedQuality,
  computeNextReviewFromQuality,
  describeConfidenceEffect,
  scoreToQuality,
  type Confidence,
} from "@/lib/spaced-repetition";
import { computeStreakUpdate, getEarnedStreakTitle } from "@/lib/streak";
import { awardSessionAchievements } from "@/lib/achievements";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { answers, topicId, streakDays, maxCombo } = await request.json();

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, current_streak, longest_streak, last_study_date, total_xp, streak_freeze_tokens")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if this is the user's first completion of this topic
  const { count: previousSessions } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId)
    .not("completed_at", "is", null)
    .neq("id", sessionId);

  const isFirstCompletion = (previousSessions ?? 0) === 0;

  // Calculate XP
  const answersMapped = answers.map((a: any) => ({
    type: a.type as "mcq" | "open",
    score: a.score,
  }));
  const { total: xpEarned } = calculateSessionXp({
    answers: answersMapped,
    streakDays: streakDays || 0,
    isFirstCompletion,
    maxCombo: typeof maxCombo === "number" ? maxCombo : 0,
  });

  const correctCount = answers.filter((a: any) => a.score >= 0.7).length;
  const scorePct = answers.length > 0
    ? (answers.reduce((sum: number, a: any) => sum + a.score, 0) / answers.length) * 100
    : 0;

  // Fetch persisted per-answer confidence for this session's SR modulation.
  // quiz_answers.confidence is set by the client AFTER initial answer
  // submission (PATCH /api/quiz/answers/[answerId]/confidence), so the DB
  // row is the source of truth — the request body's `answers` carries
  // `score` but never `confidence`. Read both ai_score AND confidence here
  // so the modulation uses one consistent source for both fields.
  const { data: persistedAnswers } = await supabase
    .from("quiz_answers")
    .select("ai_score, confidence")
    .eq("session_id", sessionId);

  // Get existing mastery to compute new level
  const { data: existingMastery } = await supabase
    .from("user_topic_mastery")
    .select("*")
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId)
    .single();

  const previousMasteryLevel = existingMastery?.mastery_level ?? 0;
  const newLastScore = scorePct / 100;
  const newConsecutiveGood =
    newLastScore >= 0.85
      ? (existingMastery?.consecutive_good_scores ?? 0) + 1
      : 0;
  const newSessions = (existingMastery?.sessions_completed ?? 0) + 1;
  const newMasteryLevel = calculateMasteryLevel({
    sessions: newSessions,
    lastScore: newLastScore,
    consecutiveGoodScores: newConsecutiveGood,
  });

  // Topic-mastery evolution event — fires only when mastery tier strictly
  // increased. Returned in the response so the client can append it to the
  // Course Map navigation URL and the map can play the one-shot celebration.
  const masteryEvolution =
    newMasteryLevel > previousMasteryLevel
      ? {
          topicId: topicId as string,
          fromLevel: previousMasteryLevel,
          toLevel: newMasteryLevel,
        }
      : null;

  // Upsert mastery
  await supabase.from("user_topic_mastery").upsert(
    {
      user_id: dbUser.id,
      topic_id: topicId,
      mastery_level: newMasteryLevel,
      sessions_completed: newSessions,
      last_score: newLastScore,
      consecutive_good_scores: newConsecutiveGood,
      last_attempted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,topic_id" }
  );

  // Compute SR scheduling — completing a regular quiz counts as a review.
  // Quiz /complete folds quiz_answers.confidence into a per-answer quality,
  // averages across the session, then runs SM-2 against the adjusted quality.
  // See spec docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md.
  const sourceAnswers = (persistedAnswers ?? []).map(
    (a: { ai_score: number | null; confidence: string | null }) => ({
      ai_score: a.ai_score ?? 0,
      confidence: (a.confidence as Confidence) ?? null,
    })
  );

  const adjustedQuality = computeConfidenceAdjustedQuality(sourceAnswers);

  const baseQuality = scoreToQuality(scorePct);

  const nextSr = computeNextReviewFromQuality(adjustedQuality, {
    intervalDays: existingMastery?.review_interval_days ?? 1,
    easeFactor: existingMastery?.ease_factor ?? 2.5,
    reviewCount: existingMastery?.review_count ?? 0,
  });

  const confidenceEffect = describeConfidenceEffect({
    answers: sourceAnswers,
    adjustedQuality,
    baseQuality,
  });

  console.log(
    `[quiz/complete] SR: base=${baseQuality} confidence-adjusted=${adjustedQuality} ` +
      `(${sourceAnswers.length} answers; effect=${confidenceEffect?.kind ?? "none"}; ` +
      `interval=${nextSr.intervalDays}d)`,
  );

  await supabase
    .from("user_topic_mastery")
    .update({
      last_reviewed_at: new Date().toISOString(),
      next_review_at: nextSr.nextReviewAt.toISOString(),
      review_interval_days: nextSr.intervalDays,
      ease_factor: nextSr.easeFactor,
      review_count: nextSr.reviewCount,
    })
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId);

  // Mark session complete
  await supabase
    .from("quiz_sessions")
    .update({
      completed_at: new Date().toISOString(),
      xp_earned: xpEarned,
      score_pct: Math.round(scorePct * 100) / 100,
      correct_count: correctCount,
      question_count: answers.length,
    })
    .eq("id", sessionId);

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

  const newTotalXp = (dbUser.total_xp || 0) + xpEarned;
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

  // Generate AI debrief (don't fail the whole request if this errors)
  let debrief = null;
  try {
    const { data: siblingTopics } = await supabase
      .from("topics")
      .select("title, episode_id")
      .eq("episode_id", (
        await supabase.from("topics").select("episode_id").eq("id", topicId).single()
      ).data?.episode_id || "")
      .neq("id", topicId)
      .limit(5);

    debrief = await generateSessionDebrief({
      topicTitle: answers[0]?.question?.slice(0, 50) || "topic",
      answers: answers.map((a: any) => ({
        question: a.question,
        userAnswer: a.userAnswer,
        score: a.score,
        feedback: a.feedback,
      })),
      availableNextTopics: siblingTopics?.map((t: any) => t.title) || [],
    });

    // Save debrief to session
    await supabase
      .from("quiz_sessions")
      .update({ debrief })
      .eq("id", sessionId);
  } catch (err) {
    console.warn("Debrief generation failed:", err);
  }

  // Achievements — evaluate every applicable Condition for this session via the
  // shared condition-based evaluator (replaces the old inline checkAchievements).
  // sessionDurationMs drives fast_quiz; completedEpisodeIds drives course_completed.
  const { data: sessionRow } = await supabase
    .from("quiz_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  const { data: topicRow } = await supabase
    .from("topics")
    .select("episode_id")
    .eq("id", topicId)
    .single();
  const sessionDurationMs = sessionRow?.started_at
    ? Date.now() - new Date(sessionRow.started_at).getTime()
    : null;
  const completedEpisodeIds = topicRow?.episode_id ? [topicRow.episode_id] : [];

  const newAchievements = await awardSessionAchievements({
    userId: dbUser.id,
    supabase,
    sessionType: "quiz",
    scorePct,
    maxCombo: typeof maxCombo === "number" ? maxCombo : 0,
    sessionDurationMs,
    newStreak,
    completedEpisodeIds,
  });

  return NextResponse.json({
    xpEarned,
    scorePct: Math.round(scorePct * 100) / 100,
    newMasteryLevel,
    masteryEvolution,
    debrief,
    confidenceEffect,
    newStreak,
    newAchievements,
    streakAction: streakResult.action,
    freezeTokensUsed: streakResult.tokensUsed,
    freezeTokenEarned: streakResult.tokenEarned,
    freezeTokensRemaining: streakResult.newFreezeTokens,
    streakTitleEarned: earnedStreakTitle?.title ?? null,
  });
}