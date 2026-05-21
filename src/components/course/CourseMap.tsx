"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Lock, Play, Star, CheckCircle, Skull, ChevronDown, ChevronUp, Shield, Zap, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MASTERY_LABELS } from "@/lib/xp";
import StartBossButton from "@/components/quiz/StartBossButton";
import DeleteEpisodeButton from "@/components/course/DeleteEpisodeButton";
import { useSound } from "@/lib/useSound";
import { toast } from "sonner";

interface TopicNode {
  id: string;
  title: string;
  difficulty: number;
  masteryLevel: number;
  sessionsCompleted: number;
  isUnlocked: boolean;
}

interface BossFightStatus {
  isUnlocked: boolean;
  isDefeated: boolean;
  bestScore: number | null;
}

interface EpisodeData {
  id: string;
  title: string;
  topics: TopicNode[];
  bossFight?: BossFightStatus;
}

interface CourseMapProps {
  courseId: string;
  episodes: EpisodeData[];
  rtl?: boolean;
  /** When a quiz/boss/review just bumped a topic's mastery tier, the matching
   *  node plays a one-shot celebration on mount, then the URL self-cleans. */
  evolutionEvent?: { topicId: string; fromLevel: number; toLevel: number } | null;
}

/** Mastery tier display labels — used in the evolution toast. */
const TIER_NAMES: Record<number, string> = {
  1: "Novice",
  2: "Apprentice",
  3: "Adept",
  4: "Expert",
  5: "Master",
};

const TIER_COLORS: Record<number, string> = {
  1: "#94a3b8",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#fbbf24",
};

const NODE_STYLES: Record<number, { card: string; icon: string; iconBg: string; glow: string; ring: string }> = {
  0: {
    card: "border-slate-700/40 bg-slate-900/50",
    icon: "text-indigo-400",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-indigo-500/20 to-indigo-500/5",
  },
  1: {
    card: "border-slate-600/40 bg-slate-900/50",
    icon: "text-slate-300",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-slate-500/20 to-slate-500/5",
  },
  2: {
    card: "border-green-500/25 bg-green-950/20",
    icon: "text-emerald-400",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-green-500/20 to-green-500/5",
  },
  3: {
    card: "border-blue-500/25 bg-blue-950/20",
    icon: "text-blue-400",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-blue-500/20 to-blue-500/5",
  },
  4: {
    card: "border-purple-500/25 bg-purple-950/20",
    icon: "text-purple-400",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-purple-500/20 to-purple-500/5",
  },
  5: {
    card: "border-amber-400/30 bg-amber-950/20",
    icon: "text-amber-400",
    iconBg: "bg-white/[0.04] border-white/[0.07]",
    glow: "",
    ring: "from-amber-400/25 to-amber-400/5",
  },
};

const MASTERY_COLORS_MAP: Record<number, string> = {
  0: "text-indigo-400",
  1: "text-slate-400",
  2: "text-green-400",
  3: "text-blue-400",
  4: "text-purple-400",
  5: "text-amber-400",
};

function MasteryRingIcon({
  level,
  size = 48,
  evolving = false,
}: {
  level: number;
  size?: number;
  evolving?: boolean;
}) {
  const progress = (level / 5) * 100;
  const styles = NODE_STYLES[level] || NODE_STYLES[0];
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const colorMap: Record<number, string> = {
    0: "#6366f1",
    1: "#94a3b8",
    2: "#22c55e",
    3: "#3b82f6",
    4: "#a855f7",
    5: "#f59e0b",
  };

  // Tier 4 (Expert) and Tier 5 (Master) get orbital particles.
  // Tier 5 also gets a radiant halo + corner constellation glints.
  // Tier 3 (Adept) gets a subtle glow pulse.
  const showOrbitals = level >= 4;
  const showHalo = level >= 5;
  const showGlints = level >= 5;
  const showTier3Pulse = level === 3;
  const orbitalColor = level >= 5 ? "#fbbf24" : "#a855f7";

  // When the evolution-celebration is active, paint the burst ring in the
  // new tier's color via a CSS custom property.
  const evolveColor = TIER_COLORS[level] || "#fbbf24";

  return (
    <div
      className={cn(
        "relative flex-shrink-0 motion-safe:will-change-transform",
        evolving && "mastery-evolving"
      )}
      style={{ width: size, height: size, ["--evolve-color" as string]: evolveColor }}
      aria-label={`Mastery tier ${level} of 5${evolving ? " — just evolved" : ""}`}
    >
      {/* Tier 5 — radiant halo behind everything */}
      {showHalo && <div className="mastery-halo" aria-hidden />}

      {/* Tier 3 — subtle glow pulse on the ring */}
      {showTier3Pulse && <div className="absolute inset-0 mastery-tier3-pulse" aria-hidden />}

      {/* Tier 4 & 5 — orbital particles (two counter-rotating rings for a richer feel) */}
      {showOrbitals && (
        <>
          <div
            className="mastery-orbital-wrap"
            style={{ color: orbitalColor }}
            aria-hidden
          >
            <div className="mastery-orbital-particle" />
            <div className="mastery-orbital-particle mastery-orbital-particle--opposite" />
          </div>
          <div
            className="mastery-orbital-wrap mastery-orbital-wrap--reverse"
            style={{ color: orbitalColor, inset: "-8px" }}
            aria-hidden
          >
            <div className="mastery-orbital-particle" />
          </div>
        </>
      )}

      {/* Mastery ring SVG */}
      <svg width={size} height={size} className="absolute inset-0 -rotate-90 z-[3]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(100,116,139,0.15)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[level] || colorMap[0]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>

      {/* Center icon */}
      <div className={cn(
        "absolute inset-[5px] rounded-full flex items-center justify-center border z-[3]",
        styles.iconBg
      )}>
        {level >= 5 ? (
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        ) : level >= 2 ? (
          <CheckCircle className={cn("w-5 h-5", styles.icon)} />
        ) : (
          <Play className={cn("w-4 h-4", styles.icon)} />
        )}
      </div>

      {/* Tier 5 — corner constellation glints on top of everything */}
      {showGlints && (
        <>
          <div className="mastery-glint mastery-glint--tl" aria-hidden />
          <div className="mastery-glint mastery-glint--tr" aria-hidden />
          <div className="mastery-glint mastery-glint--bl" aria-hidden />
          <div className="mastery-glint mastery-glint--br" aria-hidden />
        </>
      )}
    </div>
  );
}

export default function CourseMap({
  courseId,
  episodes,
  rtl = false,
  evolutionEvent,
}: CourseMapProps) {
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Set<string>>(new Set());
  const [evolvingTopicId, setEvolvingTopicId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { play: playSfx } = useSound();
  const evolutionFiredRef = useRef(false);

  const toggleEpisode = (epId: string) => {
    setCollapsedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(epId)) next.delete(epId);
      else next.add(epId);
      return next;
    });
  };

  // ── Evolution moment ──────────────────────────────────────────────────────
  // Triggered by the `?evolved=topicId:from:to` URL param. Fires exactly once
  // per mount (guarded by evolutionFiredRef so React StrictMode double-mount
  // can't replay it). Sequence:
  //   1. Find the episode that owns the topic, auto-expand it
  //   2. Mark the topic as evolving → MasteryRingIcon plays the spring+burst
  //   3. Play the right sound (achievement for tier 5, level-up otherwise)
  //   4. Show a sonner toast announcing the new tier
  //   5. Scroll the node into view
  //   6. After the animation completes, clear the URL param so a refresh
  //      doesn't replay the celebration
  useEffect(() => {
    if (!evolutionEvent || evolutionFiredRef.current) return;
    const { topicId, toLevel } = evolutionEvent;

    // Find which episode contains this topic — also verify the topic is
    // present on the current course (defensive against stale URLs).
    const owningEpisode = episodes.find((ep) =>
      ep.topics.some((t) => t.id === topicId)
    );
    if (!owningEpisode) {
      // Stale or wrong-course URL — just clean it up silently.
      router.replace(pathname, { scroll: false });
      return;
    }

    evolutionFiredRef.current = true;

    // Auto-expand the owning episode if the user had it collapsed.
    setCollapsedEpisodes((prev) => {
      if (!prev.has(owningEpisode.id)) return prev;
      const next = new Set(prev);
      next.delete(owningEpisode.id);
      return next;
    });

    // Small delay so the collapse animation can finish before we scroll.
    const scrollDelay = setTimeout(() => {
      const el = document.getElementById(`topic-node-${topicId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 280);

    // Mark the node as evolving — fires CSS spring + burst on the ring icon.
    setEvolvingTopicId(topicId);

    // Sound + toast — tier 5 gets the louder achievement cue.
    const tierName = TIER_NAMES[toLevel] || `Tier ${toLevel}`;
    const topicTitle =
      owningEpisode.topics.find((t) => t.id === topicId)?.title ?? "Topic";
    if (toLevel >= 5) {
      playSfx("achievement");
    } else {
      playSfx("levelUp");
    }
    toast.success(`⭐ ${topicTitle} evolved — ${tierName} tier!`, {
      duration: 4000,
    });

    // Clear evolving state after CSS animation duration (~1.1s) and strip
    // the URL param so a refresh doesn't replay.
    const clearTimer = setTimeout(() => {
      setEvolvingTopicId(null);
      router.replace(pathname, { scroll: false });
    }, 1400);

    return () => {
      clearTimeout(scrollDelay);
      clearTimeout(clearTimer);
    };
  }, [evolutionEvent, episodes, router, pathname, playSfx]);

  return (
    <div className="space-y-6">
      {episodes.map((episode, epIdx) => {
        const completedCount = episode.topics.filter((t) => t.masteryLevel >= 2).length;
        const epProgress = episode.topics.length > 0 ? Math.round((completedCount / episode.topics.length) * 100) : 0;
        const isCollapsed = collapsedEpisodes.has(episode.id);
        const isEpisodeComplete = epProgress === 100;

        const epNailColor = isEpisodeComplete ? "bg-emerald-400" : "bg-indigo-400";

        return (
          <motion.div
            key={episode.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: epIdx * 0.08, duration: 0.4 }}
            className={cn(
              "rpg-card rounded-2xl overflow-hidden transition-all duration-300 relative",
              isEpisodeComplete && "!border-green-500/20"
            )}
          >
            {/* Pixel nail corners — status-colored, ties episode card to family */}
            <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[2]", epNailColor)} />
            <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[2]", epNailColor)} />
            <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[2]", epNailColor)} />
            <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[2]", epNailColor)} />

            {/* Episode Header — left region collapses, right has delete +
                chevron. Split into two siblings because HTML disallows
                button-in-button (the delete dialog trigger is itself a
                <button>). */}
            <div className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
              <button
                type="button"
                onClick={() => toggleEpisode(episode.id)}
                aria-expanded={!isCollapsed}
                aria-label={`Toggle episode ${episode.title}`}
                className="flex-1 min-w-0 flex items-center gap-4 text-left cursor-pointer"
              >
                {/* Episode number badge — pixel-bordered tile (currentColor
                    drives the border tone so it stays crisp against the fill). */}
                <div className={cn(
                  "w-11 h-11 pixel-border flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0 transition-all duration-150",
                  isEpisodeComplete
                    ? "bg-emerald-500"
                    : "bg-indigo-500"
                )}>
                  {isEpisodeComplete ? (
                    <Trophy className="w-5 h-5" />
                  ) : (
                    epIdx + 1
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white text-sm sm:text-base truncate">{episode.title}</h2>
                    {isEpisodeComplete && (
                      <span className="font-pixel text-[8px] tracking-wider text-green-400 bg-green-500/10 pixel-border px-2 py-1 flex-shrink-0">
                        COMPLETE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div className="flex-1 max-w-[160px] h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          isEpisodeComplete ? "bg-emerald-500" : "bg-indigo-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${epProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: epIdx * 0.08 + 0.3 }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-semibold tabular-nums">
                      {completedCount}/{episode.topics.length}
                    </span>
                  </div>
                </div>
              </button>

              {/* Right side — destructive action + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <DeleteEpisodeButton
                  episodeId={episode.id}
                  episodeTitle={episode.title}
                  topicCount={episode.topics.length}
                />
                <button
                  type="button"
                  onClick={() => toggleEpisode(episode.id)}
                  aria-label={isCollapsed ? "Expand episode" : "Collapse episode"}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {isCollapsed ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronUp className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Topics list */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-1.5">
                    {episode.topics.map((topic, tIdx) => {
                      const styles = NODE_STYLES[topic.masteryLevel] || NODE_STYLES[0];
                      const isLast = tIdx === episode.topics.length - 1 && !episode.bossFight;

                      const isEvolvingThisTopic = evolvingTopicId === topic.id;

                      return (
                        <div key={topic.id} className="relative" id={`topic-node-${topic.id}`}>
                          {/* Vertical connector line */}
                          {!isLast && tIdx < episode.topics.length - 1 && (
                            <div className={cn(
                              "absolute w-px h-[calc(100%-8px)] top-[40px]",
                              rtl ? "right-[29px]" : "left-[29px]",
                              topic.masteryLevel >= 2
                                ? "bg-emerald-500/25"
                                : "bg-indigo-500/15"
                            )} />
                          )}

                          <motion.div
                            initial={{ opacity: 0, x: rtl ? 15 : -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: tIdx * 0.04 + 0.1, duration: 0.25 }}
                          >
                            {topic.isUnlocked ? (
                              <Link href={`/dashboard/courses/${courseId}/topics/${topic.id}`}>
                                <div className={cn(
                                  "flex items-center gap-3.5 px-3 py-3 rounded-xl border transition-all duration-300 cursor-pointer group relative",
                                  styles.card, styles.glow,
                                  "hover:border-indigo-500/40 hover:bg-slate-800/40 hover:translate-x-1"
                                )}>
                                  <MasteryRingIcon
                                    level={topic.masteryLevel}
                                    size={48}
                                    evolving={isEvolvingThisTopic}
                                  />

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
                                      {topic.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={cn("text-xs font-bold", MASTERY_COLORS_MAP[topic.masteryLevel])}>
                                        {MASTERY_LABELS[topic.masteryLevel]}
                                      </span>
                                      <span className="text-slate-800">|</span>
                                      <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }, (_, i) => (
                                          <div
                                            key={i}
                                            className={cn(
                                              "w-1.5 h-1.5 rounded-full",
                                              i < topic.difficulty ? "bg-amber-400/80" : "bg-slate-700/50"
                                            )}
                                          />
                                        ))}
                                      </div>
                                      {topic.sessionsCompleted > 0 && (
                                        <>
                                          <span className="text-slate-800">|</span>
                                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                            <Swords className="w-3 h-3" />
                                            {topic.sessionsCompleted}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Hover arrow */}
                                  <div className={cn(
                                    "w-7 h-7 rounded-lg bg-indigo-500/0 flex items-center justify-center transition-all duration-300 flex-shrink-0",
                                    "group-hover:bg-indigo-500/15"
                                  )}>
                                    <Play className={cn(
                                      "w-3.5 h-3.5 text-slate-600 transition-colors duration-300 group-hover:text-indigo-400",
                                      rtl && "rotate-180"
                                    )} />
                                  </div>
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3.5 px-3 py-3 rounded-xl border border-slate-800/30 bg-slate-900/20 opacity-35">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-700/30 bg-slate-800/40">
                                  <Lock className="w-4 h-4 text-slate-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-500 truncate">{topic.title}</p>
                                  <span className="text-xs text-slate-700">Reach Novice on previous topic</span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </div>
                      );
                    })}

                    {/* Boss fight node */}
                    {episode.bossFight && (
                      <div className="relative">
                        {/* Connector from last topic */}
                        {episode.topics.length > 0 && (
                          <div className={cn(
                            "absolute -top-1 w-px h-3",
                            rtl ? "right-[29px]" : "left-[29px]",
                            episode.bossFight.isDefeated
                              ? "bg-amber-400/30"
                              : "bg-red-500/20"
                          )} />
                        )}

                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: episode.topics.length * 0.04 + 0.2, duration: 0.3 }}
                        >
                          {episode.bossFight.isUnlocked ? (
                            <div className={cn(
                              "relative px-4 py-3.5 flex items-center gap-3.5 transition-all duration-150 pixel-border bg-slate-900/95",
                              episode.bossFight.isDefeated
                                ? "text-amber-500/80"
                                : "text-red-500/80"
                            )}>
                              {/* Pixel nails — red for pending, amber for victory */}
                              {(() => {
                                const bossNail = episode.bossFight.isDefeated ? "bg-amber-400" : "bg-red-400";
                                return (
                                  <>
                                    <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", bossNail)} />
                                    <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", bossNail)} />
                                    <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", bossNail)} />
                                    <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", bossNail)} />
                                  </>
                                );
                              })()}

                              <div className={cn(
                                "w-10 h-10 pixel-border flex items-center justify-center flex-shrink-0 relative text-white",
                                episode.bossFight.isDefeated
                                  ? "bg-amber-500"
                                  : "bg-red-600"
                              )}>
                                {episode.bossFight.isDefeated ? (
                                  <Trophy className="w-5 h-5" />
                                ) : (
                                  <Skull className="w-5 h-5" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0 relative z-[1]">
                                <div className={cn(
                                  "font-pixel text-[9px] tracking-wider flex items-center gap-1.5",
                                  episode.bossFight.isDefeated ? "text-amber-400/90" : "text-red-400/90"
                                )}>
                                  <Shield className="w-3 h-3" />
                                  {episode.bossFight.isDefeated ? "VICTORY" : "BOSS FIGHT"}
                                </div>
                                <p className="text-sm font-extrabold text-white mt-0.5">
                                  {episode.bossFight.isDefeated ? "Boss Defeated!" : "Episode Boss Fight"}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {episode.bossFight.isDefeated
                                    ? `Best score: ${Math.round(episode.bossFight.bestScore || 0)}%`
                                    : "Comprehensive challenge covering all episode topics"}
                                </p>
                              </div>

                              {!episode.bossFight.isDefeated && (
                                <StartBossButton episodeId={episode.id} courseId={courseId} />
                              )}
                              {episode.bossFight.isDefeated && (
                                <span className="font-pixel text-[10px] tracking-wider text-amber-400 bg-amber-500/10 pixel-border px-3 py-1.5 flex-shrink-0 flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  +150 XP
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3.5 px-4 py-3.5 pixel-border bg-slate-900/20 text-slate-700/60 opacity-50">
                              <div className="w-10 h-10 pixel-border flex items-center justify-center flex-shrink-0 bg-white/[0.04] text-slate-600">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-pixel text-[9px] tracking-wider text-slate-500 mb-0.5">
                                  BOSS LOCKED
                                </div>
                                <p className="text-sm font-bold text-slate-500">Episode Boss</p>
                                <span className="text-xs text-slate-700">Complete all topics to unlock</span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
