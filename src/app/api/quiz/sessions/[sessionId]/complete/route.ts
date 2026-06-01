import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateSessionDebrief } from "@/lib/ai/session-debrief";
import { calculateSessionXp, calculateMasteryLevel } from "@/lib/xp";
import {
  aiScoreToQuality,
  adjustQualityForConfidence,
  computeNextReviewFromQuality,
  describeConfidenceEffect,
  scoreToQuality,
  type Confidence,
} from "@/lib/spaced-repetition";
import { computeStreakUpdate } from "@/lib/streak";

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

  const perAnswerQualities = sourceAnswers.map(
    (a: { ai_score: number; confidence: Confidence }) => {
      const base = aiScoreToQuality(a.ai_score);
      const isCorrect = a.ai_score >= 0.7;
      return adjustQualityForConfidence(base, isCorrect, a.confidence);
    }
  );
  const adjustedQuality =
    perAnswerQualities.length > 0
      ? Math.round(
          perAnswerQualities.reduce((s: number, q: number) => s + q, 0) /
            perAnswerQualities.length,
        )
      : 0;

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

  const newAchievements = await checkAchievements({
    userId: dbUser.id,
    streak: newStreak,
    totalXp: newTotalXp,
    scorePct,
    sessionId,
    topicId,
    maxCombo: typeof maxCombo === "number" ? maxCombo : 0,
    supabase,
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
  });
}

async function checkAchievements({
  userId,
  streak,
  totalXp,
  scorePct,
  sessionId,
  topicId,
  maxCombo,
  supabase,
}: {
  userId: string;
  streak: number;
  totalXp: number;
  scorePct: number;
  sessionId: string;
  topicId: string;
  maxCombo: number;
  supabase: any;
}) {
  const { data: allAchievements } = await supabase.from("achievements").select("*");
  const { data: earned } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const earnedIds = new Set((earned || []).map((e: any) => e.achievement_id));
  const toAward: string[] = [];

  const { count: sessionCount } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const { count: courseCount } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("started_at, completed_at, session_type")
    .eq("id", sessionId)
    .single();

  const { data: topic } = await supabase
    .from("topics")
    .select("episode_id")
    .eq("id", topicId)
    .single();

  let allTopicsCompleted = false;
  if (topic?.episode_id) {
    const { data: courseTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("episode_id", topic.episode_id);

    if (courseTopics && courseTopics.length > 0) {
      const topicIds = courseTopics.map((t: any) => t.id);
      const { data: masteries } = await supabase
        .from("user_topic_mastery")
        .select("topic_id, mastery_level")
        .eq("user_id", userId)
        .in("topic_id", topicIds)
        .gte("mastery_level", 1);

      allTopicsCompleted =
        (masteries || []).length >= topicIds.length;
    }
  }

  const { count: masterTopicCount } = await supabase
    .from("user_topic_mastery")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("mastery_level", 5);

  const { count: examSessionCount } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("session_type", "exam")
    .not("completed_at", "is", null);

  let sessionDurationMs = Infinity;
  if (session?.started_at && session?.completed_at) {
    sessionDurationMs =
      new Date(session.completed_at).getTime() -
      new Date(session.started_at).getTime();
  }
  const twoMinutesMs = 2 * 60 * 1000;

  for (const ach of allAchievements || []) {
    if (earnedIds.has(ach.id)) continue;

    let qualifies = false;
    switch (ach.condition_type) {
      case "quiz_sessions_completed":
        qualifies = (sessionCount || 0) >= ach.condition_value;
        break;
      case "courses_uploaded":
        qualifies = (courseCount || 0) >= ach.condition_value;
        break;
      case "streak_days":
        qualifies = streak >= ach.condition_value;
        break;
      case "perfect_quiz":
        qualifies = scorePct >= 100;
        break;
      case "course_completed":
        qualifies = allTopicsCompleted;
        break;
      case "fast_quiz":
        qualifies = sessionDurationMs < twoMinutesMs;
        break;
      case "master_topics":
        qualifies = (masterTopicCount || 0) >= ach.condition_value;
        break;
      case "exam_sessions_completed":
        qualifies = (examSessionCount || 0) >= ach.condition_value;
        break;

      // ── Slot-machine / probabilistic achievements ──────────────────────────
      case "random":
        // lucky_scholar: 5% chance on a perfect quiz
        qualifies = scorePct >= 100 && Math.random() < 0.05;
        break;
      case "perfect_day": {
        // Award when user scores 100% on 3+ distinct quizzes in a single day
        if (scorePct >= 100) {
          const todayStr = new Date().toISOString().split("T")[0];
          const { count: perfectTodayCount } = await supabase
            .from("quiz_sessions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("score_pct", 100)
            .gte("completed_at", `${todayStr}T00:00:00.000Z`);
          qualifies = (perfectTodayCount || 0) >= ach.condition_value;
        }
        break;
      }
      case "combo_session":
        // combo_breaker: client sends maxCombo achieved during session
        qualifies = maxCombo >= ach.condition_value;
        break;
      case "review_days":
        // Checked in review complete route — never triggers here
        qualifies = false;
        break;
    }

    if (qualifies) toAward.push(ach.id);
  }

  if (toAward.length === 0) return [];

  await supabase.from("user_achievements").insert(
    toAward.map((id) => ({ user_id: userId, achievement_id: id }))
  );

  const awarded = (allAchievements || []).filter((a: any) =>
    toAward.includes(a.id)
  );

  const xpBonus = awarded.reduce(
    (sum: number, a: any) => sum + (a.xp_reward || 0),
    0
  );
  if (xpBonus > 0) {
    await supabase.rpc("increment_user_xp", {
      user_id: userId,
      amount: xpBonus,
    });
  }

  return awarded.map((a: any) => ({
    slug: a.slug,
    name: a.name,
    icon: a.icon,
    description: a.description,
    xp_reward: a.xp_reward,
  }));
}
