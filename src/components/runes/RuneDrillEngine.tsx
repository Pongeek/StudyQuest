"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { useSound } from "@/lib/useSound";
import { showFreezeToasts, type StreakResponseFields } from "@/lib/freeze-toast";
import { RUNE_XP_PER_DUE_CARD, type RuneRating } from "@/lib/spaced-repetition";
import type { DrillCard } from "@/lib/runes-queue";
import type { UnlockedAchievement } from "@/components/effects/AchievementUnlockOverlay";
import RuneCardFlip from "./RuneCardFlip";
import RuneSummary from "./RuneSummary";

export type DrillScope = "due" | "topic" | "course";

export interface RuneCompleteResponse extends StreakResponseFields {
  xpEarned: number;
  ratedCount: number;
  againCount: number;
  dueRatedCount: number;
  queueCleared: boolean;
  remainingDue: number;
  newAchievements: UnlockedAchievement[];
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  newRank?: string;
}

interface RuneDrillEngineProps {
  sessionId: string;
  scope: DrillScope;
  cards: DrillCard[];
  /** Launcher-provided: start a fresh session (used by "drill remaining"). */
  onRestart?: () => void;
}

const RATING_BUTTONS: Array<{
  rating: RuneRating;
  label: string;
  key: string;
  className: string;
}> = [
  {
    rating: 1,
    label: "Again",
    key: "1",
    className:
      "border-red-500/40 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-400",
  },
  {
    rating: 3,
    label: "Hard",
    key: "2",
    className:
      "border-orange-500/40 text-orange-300 hover:bg-orange-500/10 focus-visible:ring-orange-400",
  },
  {
    rating: 4,
    label: "Good",
    key: "3",
    className:
      "border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 focus-visible:ring-indigo-400",
  },
  {
    rating: 5,
    label: "Easy",
    key: "4",
    className:
      "border-green-500/40 text-green-300 hover:bg-green-500/10 focus-visible:ring-green-400",
  },
];

const KEY_TO_RATING: Record<string, RuneRating> = { "1": 1, "2": 3, "3": 4, "4": 5 };

/** Locale-free interval label for the post-rating chip. */
function intervalChip(days: number): string {
  if (days < 14) return `${Math.max(1, Math.round(days))}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

function hasRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

function EngineInner({ sessionId, scope, cards, onRestart }: RuneDrillEngineProps) {
  const router = useRouter();
  const { play } = useSound();
  const { fireBurst } = useXPBurst();

  // The drill queue holds card ids; Again sends the card to the back until
  // it's rated Hard or better — the session ends only when every card passed.
  const [queue, setQueue] = useState<string[]>(() => cards.map((c) => c.id));
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lapsedIds, setLapsedIds] = useState<Set<string>>(new Set());
  const [lastInterval, setLastInterval] = useState<string | null>(null);
  const [summary, setSummary] = useState<RuneCompleteResponse | null>(null);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const current = queue.length > 0 ? cardById.get(queue[0]) : undefined;
  const passedCount = cards.length - queue.length;
  const progressPct = cards.length > 0 ? (passedCount / cards.length) * 100 : 0;

  const complete = useCallback(async () => {
    try {
      const res = await fetch(`/api/runes/${sessionId}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || "Couldn't finish the drill — try again.");
        return;
      }
      const data: RuneCompleteResponse = await res.json();
      showFreezeToasts(data);
      // NO router.refresh() here — refresh happens on the summary's nav
      // buttons (house rule: refreshing now would re-trigger the launcher).
      setSummary(data);
    } catch {
      toast.error("Network hiccup — try again.");
    }
  }, [sessionId]);

  const rate = useCallback(
    async (rating: RuneRating) => {
      if (!current || busy || !flipped || summary) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/runes/${sessionId}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: current.id, rating }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body?.error || "Couldn't save the rating — try again.");
          return;
        }
        const data: { xpEligible: boolean; intervalDays: number } = await res.json();

        if (rating === 1) {
          // Lapse — relearn it this session: back of the queue.
          play("wrong");
          setLapsedIds((prev) => new Set(prev).add(current.id));
          setLastInterval(null);
          setQueue((prev) => [...prev.slice(1), prev[0]]);
          setFlipped(false);
        } else {
          if (data.xpEligible) {
            play("xp");
            fireBurst({ amount: RUNE_XP_PER_DUE_CARD });
          } else {
            play("correct");
          }
          setLastInterval(intervalChip(data.intervalDays));
          const nextQueue = queue.slice(1);
          setQueue(nextQueue);
          setFlipped(false);
          if (nextQueue.length === 0) {
            await complete();
          }
        }
      } catch {
        toast.error("Network hiccup — try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, complete, current, fireBurst, flipped, play, queue, sessionId, summary],
  );

  // Keyboard: Space/Enter flips, 1-4 rates (Again/Hard/Good/Easy).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (summary || busy) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
        return;
      }
      if (flipped && KEY_TO_RATING[e.key]) {
        e.preventDefault();
        void rate(KEY_TO_RATING[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, flipped, rate, summary]);

  function leave() {
    const ok = window.confirm(
      "Leave the drill? Rated runes keep their new schedule — XP settles only when a drill is completed.",
    );
    if (ok) {
      router.refresh();
      router.back();
    }
  }

  if (summary) {
    return (
      <RuneSummary
        data={summary}
        totalCards={cards.length}
        lapseCount={lapsedIds.size}
        scope={scope}
        onRestart={onRestart}
      />
    );
  }

  if (!current) return null;

  const dir = hasRTL(current.front) || hasRTL(current.back) ? "rtl" : "ltr";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-pixel text-[10px] tracking-wider text-purple-300">
            RUNE DRILL
            {scope !== "due" && (
              <span className="text-slate-500"> · {scope.toUpperCase()} CRAM</span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {passedCount}/{cards.length} runes
            {lapsedIds.size > 0 && queue.some((id) => lapsedIds.has(id)) && (
              <span className="text-orange-300/80"> · relearning {queue.filter((id) => lapsedIds.has(id)).length}</span>
            )}
            {lastInterval && (
              <span className="text-purple-300/80"> · next in {lastInterval}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] text-xs transition-colors flex-shrink-0"
        >
          <DoorOpen className="w-3.5 h-3.5" />
          Leave
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* The card */}
      <RuneCardFlip
        key={current.id}
        front={current.front}
        back={current.back}
        topicTitle={current.topicTitle}
        flipped={flipped}
        onFlip={() => !flipped && setFlipped(true)}
        dir={dir}
      />

      {/* Rating row — only after the flip */}
      <div
        className={cn(
          "grid grid-cols-4 gap-2 transition-opacity duration-150",
          flipped ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!flipped}
      >
        {RATING_BUTTONS.map((btn) => (
          <button
            key={btn.rating}
            type="button"
            onClick={() => void rate(btn.rating)}
            disabled={!flipped || busy}
            className={cn(
              "min-h-[52px] rounded-xl border bg-white/[0.02] font-semibold text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2",
              busy && "opacity-60 cursor-not-allowed",
              btn.className,
            )}
          >
            <span className="block">{btn.label}</span>
            <span className="block text-[9px] font-normal text-slate-600 mt-0.5">
              {btn.key}
            </span>
          </button>
        ))}
      </div>
      {!flipped && (
        <p className="text-center text-[11px] text-slate-600">
          Recall the answer first — then flip and rate yourself honestly.
        </p>
      )}
    </div>
  );
}

export default function RuneDrillEngine(props: RuneDrillEngineProps) {
  return (
    <XPBurstProvider>
      <EngineInner {...props} />
    </XPBurstProvider>
  );
}
