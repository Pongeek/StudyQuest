"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Gem, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import { readClassifiedErrorFromResponse } from "@/lib/ai-error";
import { INLINE_COPY } from "@/lib/loading-copy";
import { countDueCards, type RuneCardDto } from "@/lib/rune-deck";

interface RuneDeckPanelProps {
  topicId: string;
  /** Pre-fetched deck from the parent server component (may be empty). */
  initialCards: RuneCardDto[];
  /** Text direction for the rendered card content (matches the topic page). */
  dir?: "ltr" | "rtl" | "auto";
}

/** Locale-free interval chip: "today", "3d", "2w". */
function intervalLabel(dueAt: string, now = new Date()): string {
  const days = Math.ceil(
    (new Date(dueAt).getTime() - now.getTime()) / 86_400_000,
  );
  if (days <= 0) return "due";
  if (days < 14) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

/**
 * Inline Rune Deck panel on the topic detail page — CheatSheetPanel's purple
 * twin. Cold state forges the deck (POST /api/topics/[id]/runes); forged
 * state lists the runes with tap-to-reveal backs. Per-card SM-2 lives in
 * rune_card_srs; drilling happens in /dashboard/runes (RuneDrillEngine).
 */
export default function RuneDeckPanel({
  topicId,
  initialCards,
  dir = "auto",
}: RuneDeckPanelProps) {
  const [cards, setCards] = useState<RuneCardDto[]>(initialCards);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);

  const activeCards = useMemo(
    () => cards.filter((c) => !c.suspendedAt),
    [cards],
  );
  const dueCount = useMemo(() => countDueCards(cards), [cards]);
  const forgedAt = useMemo(() => {
    const forged = cards.filter((c) => c.source === "forged");
    if (forged.length === 0) return null;
    return forged.reduce(
      (latest, c) => (c.createdAt > latest ? c.createdAt : latest),
      forged[0].createdAt,
    );
  }, [cards]);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function forge() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/topics/${topicId}/runes`, { method: "POST" });
      if (!res.ok) {
        const cls = await readClassifiedErrorFromResponse(res);
        toast.error(cls?.userMessage ?? "Couldn't forge the runes — try again.");
        return;
      }
      const data = await res.json();
      setCards(data.cards ?? []);
      setRevealed(new Set());
      toast.success("Rune deck forged.");
      if (Array.isArray(data.newAchievements) && data.newAchievements.length > 0) {
        setNewAchievements(data.newAchievements);
      }
    } catch {
      toast.error("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  function reforge() {
    if (busy) return;
    const ok = window.confirm(
      "Reforge this deck? Fresh runes replace the current ones — your edited and hand-made runes survive.",
    );
    if (ok) void forge();
  }

  const overlay =
    newAchievements.length > 0 ? (
      <AchievementUnlockOverlay
        achievements={newAchievements}
        onAllDismissed={() => setNewAchievements([])}
      />
    ) : null;

  // Cold state — no runes forged yet.
  if (cards.length === 0) {
    return (
      <section className="rpg-card rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {overlay}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />

        <div className="mx-auto w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3">
          <Gem className="w-6 h-6 text-purple-400" />
        </div>
        <h3 className="font-pixel text-[10px] tracking-wider text-purple-300 mb-1">
          RUNE DECK · NOT YET FORGED
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
          Atomic recall cards — definitions, theorems, notation. Flip, rate
          yourself, and spaced repetition brings each rune back right before
          you&apos;d forget it.
        </p>
        <button
          type="button"
          onClick={forge}
          disabled={busy}
          className={cn(
            "pixel-chip inline-flex items-center gap-2 px-4 py-2 font-pixel text-[10px] tracking-wider text-purple-300 border border-purple-500/40 transition-colors",
            busy ? "opacity-60 cursor-not-allowed" : "hover:bg-purple-500/10",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {INLINE_COPY.runes.toUpperCase()}
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              FORGE RUNES
            </>
          )}
        </button>
      </section>
    );
  }

  // Forged state — header + tap-to-reveal rune list.
  return (
    <section className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      {overlay}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />

      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
            <Gem className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-pixel text-[10px] tracking-wider text-purple-300">
              RUNE DECK
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {activeCards.length} runes
              {dueCount > 0 && (
                <span className="text-purple-300/90"> · {dueCount} due</span>
              )}
              {forgedAt && (
                <>
                  {" · Forged "}
                  {new Date(forgedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={reforge}
            disabled={busy}
            className={cn(
              "pixel-chip inline-flex items-center gap-1.5 px-2.5 py-1 font-pixel text-[8px] tracking-wider text-purple-300 border border-purple-500/30 transition-colors",
              busy ? "opacity-60 cursor-not-allowed" : "hover:bg-purple-500/10",
            )}
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {busy ? INLINE_COPY.runes.toUpperCase() : "REFORGE"}
          </button>
        </div>
      </header>

      <ul className="space-y-2">
        {activeCards.map((card) => {
          const isRevealed = revealed.has(card.id);
          const isDue =
            !card.srs || new Date(card.srs.dueAt).getTime() <= Date.now();
          return (
            <li
              key={card.id}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleReveal(card.id)}
                aria-expanded={isRevealed}
                className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <div dir={dir} className="flex-1 min-w-0 text-sm text-slate-200">
                  <MarkdownContent>{card.front}</MarkdownContent>
                </div>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {card.srs && card.srs.reviewCount > 0 && !isDue && (
                    <span className="text-[9px] text-slate-500 font-medium">
                      {intervalLabel(card.srs.dueAt)}
                    </span>
                  )}
                  {isDue && (
                    <span className="font-pixel text-[7px] tracking-wider text-purple-300 border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5">
                      DUE
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-500 transition-transform",
                      isRevealed && "rotate-180",
                    )}
                  />
                </span>
              </button>
              {isRevealed && (
                <div
                  dir={dir}
                  className="px-3.5 pb-3 pt-2 border-t border-white/[0.05] text-sm text-slate-300"
                >
                  <MarkdownContent>{card.back}</MarkdownContent>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
