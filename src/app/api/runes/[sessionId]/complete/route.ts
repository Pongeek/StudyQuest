// POST /api/runes/[sessionId]/complete — settle a drill session.
//
// XP: RUNE_XP_PER_DUE_CARD per rep whose frozen was_due is true AND final
// rating >= 3 (Hard/Good/Easy). Non-due (cram) reps earn 0 — dueness is
// time-gated by SM-2, which makes rune XP farm-proof. Queue-clear bonus
// (+RUNE_QUEUE_CLEAR_BONUS_XP) fires at most once per UTC day, only for
// due-scope sessions that leave the queue empty.
//
// Streak: due-scope sessions with at least one rep count as studying
// (computeStreakUpdate, freeze-token forgiveness). Free drills don't.
//
// NEVER touches user_topic_mastery — rune scheduling is per-card only.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  RUNE_QUEUE_CLEAR_BONUS_XP,
  RUNE_XP_PER_DUE_CARD,
} from "@/lib/spaced-repetition";
import { countDueRunes } from "@/lib/runes-queue";
import { calculateLevel, getLevelTitle } from "@/lib/xp";
import { awardAchievementIfNew, awardSessionAchievements } from "@/lib/achievements";
import { computeStreakUpdate, getEarnedStreakTitle } from "@/lib/streak";

/** Lifetime due reps needed for the Rune Adept achievement (migration 026). */
const RUNE_ADEPT_DUE_REPS = 100;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select(
      "id, total_xp, current_streak, longest_streak, last_study_date, streak_freeze_tokens",
    )
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: session } = await supabase
    .from("rune_sessions")
    .select("id, scope, completed_at, card_count")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.completed_at) {
    return NextResponse.json({ error: "Session already completed" }, { status: 400 });
  }

  const { data: reps } = await supabase
    .from("rune_reps")
    .select("rating, was_due")
    .eq("session_id", sessionId);
  const allReps = (reps || []) as Array<{ rating: number; was_due: boolean }>;

  const ratedCount = allReps.length;
  const againCount = allReps.filter((r) => r.rating === 1).length;
  const dueRatedCount = allReps.filter((r) => r.was_due && r.rating >= 3).length;
  let xpEarned = dueRatedCount * RUNE_XP_PER_DUE_CARD;

  // ── Daily queue-clear bonus ─────────────────────────────────────────────────
  // Due-scope session, at least one rep, queue now empty, and no other
  // queue-cleared due-session today. (Freshly rated cards left the queue —
  // SM-2 pushes due_at at least a day out even on Again.)
  let queueCleared = false;
  const remainingDue = await countDueRunes(supabase, dbUser.id);
  if (session.scope === "due" && ratedCount > 0 && remainingDue === 0) {
    const todayStartIso = `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`;
    const { data: clearedToday } = await supabase
      .from("rune_sessions")
      .select("id")
      .eq("user_id", dbUser.id)
      .eq("queue_cleared", true)
      .gte("completed_at", todayStartIso)
      .limit(1);
    if (!clearedToday || clearedToday.length === 0) {
      queueCleared = true;
      xpEarned += RUNE_QUEUE_CLEAR_BONUS_XP;
    }
  }

  // ── Streak (due-scope only) + XP write ──────────────────────────────────────
  const isStreakSession = session.scope === "due" && ratedCount > 0;
  const today = new Date().toISOString().split("T")[0];
  const streakResult = isStreakSession
    ? computeStreakUpdate({
        currentStreak: dbUser.current_streak || 0,
        freezeTokens: dbUser.streak_freeze_tokens ?? 0,
        lastStudyDate: dbUser.last_study_date,
        today,
      })
    : null;
  const newStreak = streakResult?.newStreak ?? (dbUser.current_streak || 0);
  const earnedStreakTitle = streakResult
    ? getEarnedStreakTitle(dbUser.current_streak || 0, newStreak)
    : null;

  const oldTotalXp = dbUser.total_xp || 0;
  const newTotalXp = oldTotalXp + xpEarned;

  const userUpdate: Record<string, unknown> = {};
  if (xpEarned > 0) userUpdate.total_xp = newTotalXp;
  if (streakResult) {
    userUpdate.current_streak = newStreak;
    userUpdate.longest_streak = Math.max(dbUser.longest_streak || 0, newStreak);
    userUpdate.last_study_date = today;
    userUpdate.streak_freeze_tokens = streakResult.newFreezeTokens;
  }
  if (Object.keys(userUpdate).length > 0) {
    await supabase.from("users").update(userUpdate).eq("id", dbUser.id);
  }

  await supabase
    .from("rune_sessions")
    .update({
      completed_at: new Date().toISOString(),
      rated_count: ratedCount,
      due_rated_count: dueRatedCount,
      again_count: againCount,
      xp_earned: xpEarned,
      queue_cleared: queueCleared,
    })
    .eq("id", sessionId);

  // ── Achievements ────────────────────────────────────────────────────────────
  // Condition-based evaluator (cross-surface streak badges can fire here);
  // rune drills carry no score/combo and complete no episode.
  const newAchievements = await awardSessionAchievements({
    userId: dbUser.id,
    supabase,
    sessionType: "rune",
    scorePct: null,
    maxCombo: null,
    sessionDurationMs: null,
    newStreak,
    completedEpisodeIds: [],
  });

  // Rune Adept — 100 lifetime due reps (imperative slug award, scrolls/exorcist
  // pattern; the partial index idx_rune_reps_user_due makes this count cheap).
  try {
    const { count: lifetimeDueReps } = await supabase
      .from("rune_reps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id)
      .eq("was_due", true);
    if ((lifetimeDueReps ?? 0) >= RUNE_ADEPT_DUE_REPS) {
      const adept = await awardAchievementIfNew({
        userId: dbUser.id,
        slug: "rune_adept",
        supabase,
      });
      if (adept) {
        newAchievements.push(adept);
        if (adept.xp_reward > 0) {
          await supabase.rpc("increment_user_xp", {
            p_user_id: dbUser.id,
            amount: adept.xp_reward,
          });
        }
      }
    }
  } catch {
    // Non-fatal — don't break the completion response
  }

  const oldLevel = calculateLevel(oldTotalXp);
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > oldLevel;

  return NextResponse.json({
    xpEarned,
    ratedCount,
    againCount,
    dueRatedCount,
    queueCleared,
    remainingDue,
    newStreak,
    newAchievements,
    leveledUp,
    oldLevel,
    newLevel,
    newRank:
      leveledUp && getLevelTitle(oldLevel) !== getLevelTitle(newLevel)
        ? getLevelTitle(newLevel)
        : undefined,
    streakAction: streakResult?.action,
    freezeTokensUsed: streakResult?.tokensUsed,
    freezeTokenEarned: streakResult?.tokenEarned,
    freezeTokensRemaining: streakResult?.newFreezeTokens,
    streakTitleEarned: earnedStreakTitle?.title ?? null,
  });
}
