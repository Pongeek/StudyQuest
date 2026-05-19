import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateBossFightXp } from "@/lib/xp";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { answers, maxCombo } = await request.json();

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, current_streak, longest_streak, last_study_date, total_xp")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get boss fight session
  const { data: bfSession } = await supabase
    .from("boss_fight_sessions")
    .select("*, episodes(title, course_id)")
    .eq("id", sessionId)
    .single();

  if (!bfSession || bfSession.user_id !== dbUser.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Calculate XP
  const answersMapped = answers.map((a: any) => ({
    type: a.type as "mcq" | "open",
    score: a.score,
  }));
  const { total: xpEarned, breakdown } = calculateBossFightXp({
    answers: answersMapped,
    streakDays: dbUser.current_streak || 0,
    maxCombo: typeof maxCombo === "number" ? maxCombo : 0,
  });

  const correctCount = answers.filter((a: any) => a.score >= 0.7).length;
  const scorePct = answers.length > 0
    ? (answers.reduce((sum: number, a: any) => sum + a.score, 0) / answers.length) * 100
    : 0;

  const passed = scorePct >= 70;

  // Build debrief
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const a of answers) {
    if (a.score >= 0.7) {
      strengths.push(a.question.slice(0, 80));
    } else {
      weaknesses.push(a.question.slice(0, 80));
    }
  }

  const debrief = {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    passed,
    xpBreakdown: breakdown,
  };

  // Mark session complete
  await supabase
    .from("boss_fight_sessions")
    .update({
      completed_at: new Date().toISOString(),
      xp_earned: xpEarned,
      score_pct: Math.round(scorePct * 100) / 100,
      correct_count: correctCount,
      question_count: answers.length,
      passed,
      debrief,
    })
    .eq("id", sessionId);

  // ── Boss-fight mastery progression ─────────────────────────────────────────
  // When the user passes a boss (>=70%), bump the WEAKEST topic in the episode
  // by +1 mastery tier (capped at 5). Conservative — one evolution per boss
  // keeps the moment meaningful and prevents mastery inflation. Returned in
  // the response so the boss victory screen can forward to the Course Map.
  let masteryEvolution: { topicId: string; fromLevel: number; toLevel: number } | null = null;
  if (passed && bfSession.episode_id) {
    const { data: episodeTopics } = await supabase
      .from("topics")
      .select("id, user_topic_mastery(mastery_level)")
      .eq("episode_id", bfSession.episode_id);

    if (episodeTopics && episodeTopics.length > 0) {
      // Find topic with lowest current mastery (untouched = 0).
      type EpTopic = { id: string; user_topic_mastery: { mastery_level: number }[] };
      const withMastery = (episodeTopics as EpTopic[]).map((t) => ({
        id: t.id,
        masteryLevel: (t.user_topic_mastery?.[0]?.mastery_level ?? 0) as number,
      }));
      // Filter to topics that can still evolve (< 5).
      const eligible = withMastery.filter((t) => t.masteryLevel < 5);
      if (eligible.length > 0) {
        // Pick lowest mastery; ties broken by topic id for determinism.
        eligible.sort((a, b) =>
          a.masteryLevel !== b.masteryLevel
            ? a.masteryLevel - b.masteryLevel
            : a.id.localeCompare(b.id)
        );
        const target = eligible[0];
        const newTier = Math.min(target.masteryLevel + 1, 5);

        await supabase.from("user_topic_mastery").upsert(
          {
            user_id: dbUser.id,
            topic_id: target.id,
            mastery_level: newTier,
            // Don't overwrite session/score fields here — boss isn't per-topic.
            last_attempted_at: new Date().toISOString(),
          },
          { onConflict: "user_id,topic_id" }
        );

        masteryEvolution = {
          topicId: target.id,
          fromLevel: target.masteryLevel,
          toLevel: newTier,
        };
      }
    }
  }

  // Update user XP and streak
  const today = new Date().toISOString().split("T")[0];
  const lastStudy = dbUser.last_study_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let newStreak = dbUser.current_streak || 0;
  if (lastStudy !== today) {
    newStreak = lastStudy === yesterday ? newStreak + 1 : 1;
  }
  const newLongestStreak = Math.max(dbUser.longest_streak || 0, newStreak);

  await supabase
    .from("users")
    .update({
      total_xp: (dbUser.total_xp || 0) + xpEarned,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      last_study_date: today,
    })
    .eq("id", dbUser.id);

  // Check boss fight achievements
  const newAchievements = await checkBossAchievements({
    userId: dbUser.id,
    scorePct,
    maxCombo: typeof maxCombo === "number" ? maxCombo : 0,
    supabase,
  });

  return NextResponse.json({
    xpEarned,
    scorePct: Math.round(scorePct * 100) / 100,
    passed,
    debrief,
    newAchievements,
    masteryEvolution,
  });
}

async function checkBossAchievements({
  userId,
  scorePct,
  maxCombo,
  supabase,
}: {
  userId: string;
  scorePct: number;
  maxCombo: number;
  supabase: any;
}) {
  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*")
    .in("condition_type", ["boss_fights_completed", "combo_session", "random"]);

  if (!allAchievements || allAchievements.length === 0) return [];

  const { data: earned } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const earnedIds = new Set((earned || []).map((e: any) => e.achievement_id));

  const { count: bossCount } = await supabase
    .from("boss_fight_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("passed", true)
    .not("completed_at", "is", null);

  const toAward: string[] = [];
  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;

    let qualifies = false;
    switch (ach.condition_type) {
      case "boss_fights_completed":
        qualifies = (bossCount || 0) >= ach.condition_value;
        break;
      case "combo_session":
        qualifies = maxCombo >= ach.condition_value;
        break;
      case "random":
        qualifies = scorePct >= 100 && Math.random() < 0.05;
        break;
    }

    if (qualifies) toAward.push(ach.id);
  }

  if (toAward.length === 0) return [];

  await supabase.from("user_achievements").insert(
    toAward.map((id) => ({ user_id: userId, achievement_id: id }))
  );

  const awarded = allAchievements.filter((a: any) => toAward.includes(a.id));

  const xpBonus = awarded.reduce((sum: number, a: any) => sum + (a.xp_reward || 0), 0);
  if (xpBonus > 0) {
    await supabase.rpc("increment_user_xp", { p_user_id: userId, amount: xpBonus });
  }

  return awarded.map((a: any) => ({
    slug: a.slug,
    name: a.name,
    icon: a.icon,
    description: a.description,
    xp_reward: a.xp_reward,
  }));
}
